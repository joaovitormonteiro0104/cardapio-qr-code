import { useCallback, useEffect, useMemo, useState } from 'react'
import { AvisoFlutuante, type Aviso } from '@/components/AvisoFlutuante'
import { LayoutEquipe } from '@/components/LayoutEquipe'
import { eventosParaCsv, intervaloDeDias } from '@/domain/auditoria/csv'
import { ROTULOS_ATALHO, atalhoAtivo, periodoDoAtalho, type AtalhoPeriodo } from '@/domain/auditoria/periodo'
import { GRUPOS_TIPO_EVENTO, eventoSensivel, resumirEvento, rotuloAtor } from '@/domain/auditoria/resumo'
import { rotuloMotivo, rotuloTipoEvento } from '@/domain/auditoria/rotulos'
import { FUSO_HORARIO, formatarDataHora } from '@/lib/formato'
import * as auditoriaRepo from '@/repositories/auditoriaRepo'
import type { EventoAuditoria, FiltrosAuditoria } from '@/repositories/auditoriaRepo'
import * as equipeRepo from '@/repositories/equipeRepo'

/** Fortaleza não tem horário de verão: deslocamento fixo. */
const OFFSET_FUSO = '-03:00'

/** "2026-11-09" de hoje no fuso de Fortaleza. */
function hojeNoFuso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_HORARIO }).format(new Date())
}

/** Filtro "Quem": um funcionário (matrícula), todos os clientes ou o sistema. */
type Quem = '' | 'clientes' | 'sistema' | `f:${string}`

const numeroOuNulo = (texto: string) => (/^\d+$/.test(texto.trim()) ? Number(texto.trim()) : null)

export default function AuditoriaPage() {
  const hoje = hojeNoFuso()
  const [inicio, setInicio] = useState(hoje)
  const [fim, setFim] = useState(hoje)
  const [tipo, setTipo] = useState('')
  const [quem, setQuem] = useState<Quem>('')
  const [mesa, setMesa] = useState('')
  const [numero, setNumero] = useState('')
  const [pagina, setPagina] = useState(0)
  const [eventos, setEventos] = useState<EventoAuditoria[]>([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [exportando, setExportando] = useState<number | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [nomes, setNomes] = useState<Map<string, string>>(new Map())
  const limparAviso = useCallback(() => setAviso(null), [])

  // Nome dos funcionários: "Ana (004)" em vez de "Funcionário 004".
  useEffect(() => {
    equipeRepo
      .listarFuncionarios()
      .then(lista => setNomes(new Map(lista.map(f => [f.matricula, f.nome]))))
      .catch(falha => console.error(falha))
  }, [])

  // Os filtros valem na hora (campos de número com um pequeno atraso): o que
  // está na tela é sempre o que a tabela e a exportação usam.
  const [mesaAplicada, setMesaAplicada] = useState('')
  const [numeroAplicado, setNumeroAplicado] = useState('')
  useEffect(() => {
    const id = setTimeout(() => {
      setMesaAplicada(mesa)
      setNumeroAplicado(numero)
      setPagina(0)
    }, 400)
    return () => clearTimeout(id)
  }, [mesa, numero])

  const filtros = useMemo((): Omit<FiltrosAuditoria, 'pagina'> | null => {
    const intervalo = intervaloDeDias(inicio, fim, OFFSET_FUSO)
    if (!intervalo) return null
    return {
      ...intervalo,
      tipoEvento: tipo || null,
      atorId: quem.startsWith('f:') ? quem.slice(2) : null,
      atorTipo: quem === 'clientes' ? 'cliente' : quem === 'sistema' ? 'sistema' : quem.startsWith('f:') ? 'funcionario' : null,
      mesa: numeroOuNulo(mesaAplicada),
      numero: numeroOuNulo(numeroAplicado),
    }
  }, [inicio, fim, tipo, quem, mesaAplicada, numeroAplicado])

  const carregar = useCallback(async () => {
    if (!filtros) {
      setErro('Período inválido: a data final precisa ser igual ou depois da inicial.')
      setEventos([])
      setTotal(0)
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro(null)
    try {
      const resultado = await auditoriaRepo.listar({ ...filtros, pagina })
      setEventos(resultado.eventos)
      setTotal(resultado.total)
    } catch (falha) {
      console.error(falha)
      setEventos([])
      setTotal(0)
      setErro('Não foi possível carregar a auditoria.')
    } finally {
      setCarregando(false)
    }
  }, [filtros, pagina])

  useEffect(() => {
    void carregar()
  }, [carregar])

  function mudar<T>(setter: (v: T) => void) {
    return (valor: T) => {
      setter(valor)
      setPagina(0)
    }
  }

  function usarAtalho(atalho: AtalhoPeriodo) {
    const p = periodoDoAtalho(atalho, hoje)
    setInicio(p.inicio)
    setFim(p.fim)
    setPagina(0)
  }

  function limparFiltros() {
    setTipo('')
    setQuem('')
    setMesa('')
    setNumero('')
    setPagina(0)
  }

  async function exportar() {
    if (!filtros) return
    setExportando(0)
    try {
      const { eventos: todos, cortado } = await auditoriaRepo.listarParaExportacao(filtros, quantos => setExportando(quantos))
      const blob = new Blob([eventosParaCsv(todos, FUSO_HORARIO, nomes)], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `auditoria_${inicio}_a_${fim}.csv`
      link.click()
      URL.revokeObjectURL(url)
      setAviso(
        cortado
          ? {
              tipo: 'erro',
              texto: `Arquivo gerado só com os primeiros ${auditoriaRepo.LIMITE_EXPORTACAO.toLocaleString('pt-BR')} eventos. Escolha um período menor para ter tudo.`,
            }
          : { tipo: 'ok', texto: `CSV gerado com ${todos.length.toLocaleString('pt-BR')} eventos.` },
      )
    } catch (falha) {
      console.error(falha)
      setAviso({ tipo: 'erro', texto: 'Não foi possível gerar o CSV. Tente de novo.' })
    } finally {
      setExportando(null)
    }
  }

  const paginas = Math.max(1, Math.ceil(total / auditoriaRepo.TAMANHO_PAGINA))
  const ativo = atalhoAtivo(inicio, fim, hoje)
  const temFiltroExtra = tipo !== '' || quem !== '' || mesa !== '' || numero !== ''
  const funcionarios = [...nomes.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

  return (
    <LayoutEquipe titulo="Auditoria">
      <div className="mb-5 space-y-3 rounded-2xl bg-superficie p-4 ring-1 ring-borda">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Período rápido">
          {(Object.keys(ROTULOS_ATALHO) as AtalhoPeriodo[]).map(a => (
            <button
              key={a}
              type="button"
              aria-pressed={ativo === a}
              className={`botao min-h-11 border text-sm ${ativo === a ? 'border-brasa bg-brasa-clara text-brasa-forte' : 'border-borda-campo/50 bg-superficie'}`}
              onClick={() => usarAtalho(a)}
            >
              {ROTULOS_ATALHO[a]}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="aud-inicio" className="rotulo">De</label>
            <input id="aud-inicio" type="date" className="campo" value={inicio} max={hoje} onChange={e => mudar(setInicio)(e.target.value)} />
          </div>
          <div>
            <label htmlFor="aud-fim" className="rotulo">Até</label>
            <input id="aud-fim" type="date" className="campo" value={fim} min={inicio} max={hoje} onChange={e => mudar(setFim)(e.target.value)} />
          </div>
          <div>
            <label htmlFor="aud-tipo" className="rotulo">O que aconteceu</label>
            <select id="aud-tipo" className="campo" value={tipo} onChange={e => mudar(setTipo)(e.target.value)}>
              <option value="">Tudo</option>
              {GRUPOS_TIPO_EVENTO.map(g => (
                <optgroup key={g.titulo} label={g.titulo}>
                  {g.tipos.map(t => (
                    <option key={t} value={t}>
                      {rotuloTipoEvento(t)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="aud-quem" className="rotulo">Quem</label>
            <select id="aud-quem" className="campo" value={quem} onChange={e => mudar(setQuem)(e.target.value as Quem)}>
              <option value="">Todos</option>
              <optgroup label="Equipe">
                {funcionarios.map(([matricula, nome]) => (
                  <option key={matricula} value={`f:${matricula}`}>
                    {nome} ({matricula})
                  </option>
                ))}
              </optgroup>
              <option value="clientes">Clientes</option>
              <option value="sistema">Sistema (automático)</option>
            </select>
          </div>
          <div>
            <label htmlFor="aud-mesa" className="rotulo">Mesa</label>
            <input id="aud-mesa" className="campo tabular-nums" inputMode="numeric" placeholder="Ex.: 7" value={mesa} onChange={e => setMesa(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div>
            <label htmlFor="aud-numero" className="rotulo">Nº da conta ou do pedido</label>
            <input id="aud-numero" className="campo tabular-nums" inputMode="numeric" placeholder="Ex.: 530" value={numero} onChange={e => setNumero(e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
        <p className="text-sm text-tinta-suave">
          Horários de Fortaleza. Mesa e número de conta aparecem nos eventos a partir de 13/11/2026.
          {temFiltroExtra && (
            <>
              {' '}
              <button type="button" className="font-semibold text-brasa-forte underline" onClick={limparFiltros}>
                Limpar filtros
              </button>
            </>
          )}
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tinta-suave" aria-live="polite">
          {carregando ? 'Carregando…' : `${total.toLocaleString('pt-BR')} ${total === 1 ? 'evento' : 'eventos'} · página ${pagina + 1} de ${paginas}`}
        </p>
        <button type="button" className="botao-secundario text-sm" disabled={exportando !== null || total === 0 || !filtros} onClick={() => void exportar()}>
          {exportando !== null
            ? `Gerando CSV… ${exportando.toLocaleString('pt-BR')}`
            : `Exportar CSV · ${dataCurta(inicio)} a ${dataCurta(fim)} · ${total.toLocaleString('pt-BR')}`}
        </button>
      </div>

      {erro && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-perigo-clara px-4 py-3 text-sm text-perigo">
          {erro}
          {filtros && (
            <button type="button" className="botao-secundario text-sm" onClick={() => void carregar()}>
              Tentar de novo
            </button>
          )}
        </div>
      )}

      {/* Celular: um cartão por evento (a tabela larga escondia Detalhes e Motivo) */}
      <ul className={`space-y-2 md:hidden ${carregando ? 'opacity-60' : ''}`} aria-busy={carregando}>
        {eventos.map(evento => (
          <CartaoEvento key={evento.id} evento={evento} nomes={nomes} />
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl ring-1 ring-borda md:block" tabIndex={0} role="region" aria-label="Eventos da auditoria">
        <table className={`w-full bg-superficie text-left text-sm ${carregando ? 'opacity-60' : ''}`} aria-busy={carregando}>
          <caption className="sr-only">Eventos da auditoria no período escolhido</caption>
          <thead className="sticky top-0 border-b border-borda bg-fundo text-sm text-tinta-suave">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Quando</th>
              <th scope="col" className="px-3 py-2 font-semibold">O que</th>
              <th scope="col" className="px-3 py-2 font-semibold">Mesa</th>
              <th scope="col" className="px-3 py-2 font-semibold">Quem</th>
              <th scope="col" className="px-3 py-2 font-semibold">Detalhes</th>
              <th scope="col" className="px-3 py-2 font-semibold">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {eventos.map(evento => {
              const resumo = resumirEvento(evento.tipoEvento, evento.payload)
              const sensivel = eventoSensivel(evento.tipoEvento)
              return (
                <tr key={evento.id} className={`align-top ${sensivel ? 'border-l-4 border-l-perigo' : ''}`}>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatarDataHora(evento.criadoEm)}</td>
                  <td className="px-3 py-2 font-medium">
                    {rotuloTipoEvento(evento.tipoEvento)}
                    <IdentificadoresEvento conta={resumo.conta} pedido={resumo.pedido} />
                  </td>
                  <td className="px-3 py-2 tabular-nums">{resumo.mesa ?? '—'}</td>
                  <td className="px-3 py-2">{rotuloAtor(evento.atorTipo, evento.atorId, nomes, evento.payload)}</td>
                  <td className="px-3 py-2 text-tinta-suave">{resumo.texto}</td>
                  <td className="px-3 py-2">{rotuloMotivo(evento.motivo)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!carregando && !erro && eventos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-borda px-4 py-8 text-center text-tinta-suave">
          <p>Nenhum evento com esses filtros.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {ativo !== 'semana' && (
              <button type="button" className="botao-secundario text-sm" onClick={() => usarAtalho('semana')}>
                Ver últimos 7 dias
              </button>
            )}
            {temFiltroExtra && (
              <button type="button" className="botao-secundario text-sm" onClick={limparFiltros}>
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      )}

      <nav aria-label="Paginação" className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          className="botao-secundario"
          disabled={pagina === 0 || carregando}
          onClick={() => {
            setPagina(p => p - 1)
            window.scrollTo({ top: 0 })
          }}
        >
          Anterior
        </button>
        <span className="text-sm tabular-nums text-tinta-suave">
          Página {pagina + 1} de {paginas}
        </span>
        <button
          type="button"
          className="botao-secundario"
          disabled={pagina + 1 >= paginas || carregando}
          onClick={() => {
            setPagina(p => p + 1)
            window.scrollTo({ top: 0 })
          }}
        >
          Próxima
        </button>
      </nav>

      <AvisoFlutuante aviso={aviso} aoSumir={limparAviso} />
    </LayoutEquipe>
  )
}

function IdentificadoresEvento({ conta, pedido }: { conta: number | null; pedido: number | null }) {
  if (conta === null && pedido === null) return null
  return (
    <span className="block text-sm font-normal tabular-nums text-tinta-suave">
      {[pedido !== null ? `Pedido #${pedido}` : null, conta !== null ? `Conta #${conta}` : null].filter(Boolean).join(' · ')}
    </span>
  )
}

function CartaoEvento({ evento, nomes }: { evento: EventoAuditoria; nomes: ReadonlyMap<string, string> }) {
  const resumo = resumirEvento(evento.tipoEvento, evento.payload)
  const motivo = rotuloMotivo(evento.motivo)
  return (
    <li className={`rounded-xl bg-superficie p-3 ring-1 ring-borda ${eventoSensivel(evento.tipoEvento) ? 'border-l-4 border-l-perigo' : ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold">{rotuloTipoEvento(evento.tipoEvento)}</p>
        <p className="shrink-0 text-sm tabular-nums text-tinta-suave">{formatarDataHora(evento.criadoEm)}</p>
      </div>
      <p className="text-sm tabular-nums text-tinta-suave">
        {[
          resumo.mesa !== null ? `Mesa ${resumo.mesa}` : null,
          resumo.pedido !== null ? `Pedido #${resumo.pedido}` : null,
          resumo.conta !== null ? `Conta #${resumo.conta}` : null,
          rotuloAtor(evento.atorTipo, evento.atorId, nomes, evento.payload),
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {resumo.texto && <p className="mt-1 text-sm">{resumo.texto}</p>}
      {motivo && <p className="mt-1 text-sm font-medium text-perigo">Motivo: {motivo}</p>}
    </li>
  )
}
