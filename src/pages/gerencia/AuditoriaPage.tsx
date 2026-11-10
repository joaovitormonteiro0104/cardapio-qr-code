import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { LayoutEquipe } from '@/components/LayoutEquipe'
import { eventosParaCsv, intervaloDeDias } from '@/domain/auditoria/csv'
import { TIPOS_EVENTO } from '@/domain/auditoria/evento'
import { FUSO_HORARIO, formatarDataHora } from '@/lib/formato'
import * as auditoriaRepo from '@/repositories/auditoriaRepo'
import type { EventoAuditoria } from '@/repositories/auditoriaRepo'

/** Fortaleza não tem horário de verão: deslocamento fixo. */
const OFFSET_FUSO = '-03:00'

/** "2026-11-09" de hoje no fuso de Fortaleza. */
function hojeNoFuso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_HORARIO }).format(new Date())
}

const ROTULOS_ATOR = { cliente: 'Cliente', funcionario: 'Funcionário', sistema: 'Sistema' } as const

function resumo(evento: EventoAuditoria): string {
  const p = evento.payload
  if (typeof p !== 'object' || p === null) return ''
  const partes: string[] = []
  const r = p as Record<string, unknown>
  if (typeof r.numero === 'number') partes.push(`#${r.numero}`)
  if (typeof r.de === 'string' && typeof r.para === 'string') partes.push(`${r.de} → ${r.para}`)
  if (typeof r.nome === 'string') partes.push(r.nome)
  if (typeof r.item === 'string') partes.push(r.item)
  if (typeof r.chave === 'string') partes.push(`${r.chave}: ${String(r.antes ?? '')} → ${String(r.depois ?? '')}`)
  return partes.join(' · ')
}

export default function AuditoriaPage() {
  const hoje = hojeNoFuso()
  const [inicio, setInicio] = useState(hoje)
  const [fim, setFim] = useState(hoje)
  const [tipo, setTipo] = useState('')
  const [ator, setAtor] = useState('')
  const [pagina, setPagina] = useState(0)
  const [aplicados, setAplicados] = useState({ inicio: hoje, fim: hoje, tipo: '', ator: '' })
  const [eventos, setEventos] = useState<EventoAuditoria[]>([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)

  const carregar = useCallback(async () => {
    const intervalo = intervaloDeDias(aplicados.inicio, aplicados.fim, OFFSET_FUSO)
    if (!intervalo) {
      setErro('Período inválido: a data final precisa ser igual ou depois da inicial.')
      return
    }
    setCarregando(true)
    setErro(null)
    try {
      const resultado = await auditoriaRepo.listar({
        ...intervalo,
        tipoEvento: aplicados.tipo || null,
        atorId: aplicados.ator || null,
        pagina,
      })
      setEventos(resultado.eventos)
      setTotal(resultado.total)
    } catch (falha) {
      console.error(falha)
      setErro('Não foi possível carregar a auditoria.')
    } finally {
      setCarregando(false)
    }
  }, [aplicados, pagina])

  useEffect(() => {
    void carregar()
  }, [carregar])

  function filtrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setPagina(0)
    setAplicados({ inicio, fim, tipo, ator })
  }

  async function exportar() {
    const intervalo = intervaloDeDias(aplicados.inicio, aplicados.fim, OFFSET_FUSO)
    if (!intervalo) return
    setExportando(true)
    try {
      const todos = await auditoriaRepo.listarParaExportacao({
        ...intervalo,
        tipoEvento: aplicados.tipo || null,
        atorId: aplicados.ator || null,
      })
      const blob = new Blob([eventosParaCsv(todos, FUSO_HORARIO)], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `auditoria_${aplicados.inicio}_a_${aplicados.fim}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (falha) {
      console.error(falha)
      setErro('Não foi possível exportar o CSV.')
    } finally {
      setExportando(false)
    }
  }

  const paginas = Math.max(1, Math.ceil(total / auditoriaRepo.TAMANHO_PAGINA))

  return (
    <LayoutEquipe titulo="Auditoria">
      <form onSubmit={filtrar} className="mb-5 grid gap-3 rounded-2xl bg-superficie p-4 ring-1 ring-borda sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div>
          <label htmlFor="aud-inicio" className="rotulo">De</label>
          <input id="aud-inicio" type="date" className="campo" value={inicio} max={hoje} onChange={e => setInicio(e.target.value)} />
        </div>
        <div>
          <label htmlFor="aud-fim" className="rotulo">Até</label>
          <input id="aud-fim" type="date" className="campo" value={fim} max={hoje} onChange={e => setFim(e.target.value)} />
        </div>
        <div>
          <label htmlFor="aud-tipo" className="rotulo">Tipo de evento</label>
          <select id="aud-tipo" className="campo" value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {TIPOS_EVENTO.map(t => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="aud-ator" className="rotulo">Ator (matrícula ou id)</label>
          <input id="aud-ator" className="campo" value={ator} onChange={e => setAtor(e.target.value)} placeholder="Ex.: 001" />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="botao-primario flex-1">Filtrar</button>
          <button type="button" className="botao-secundario flex-1" disabled={exportando || total === 0} onClick={() => void exportar()}>
            {exportando ? 'Gerando…' : 'Exportar CSV'}
          </button>
        </div>
      </form>

      {erro && <p role="alert" className="mb-4 rounded-xl bg-perigo-clara px-4 py-3 text-sm text-perigo">{erro}</p>}

      <p className="mb-2 text-sm text-tinta-suave" aria-live="polite">
        {carregando ? 'Carregando…' : `${total} evento(s) no período`}
      </p>

      <div className="overflow-x-auto rounded-2xl ring-1 ring-borda">
        <table className="w-full min-w-[720px] bg-superficie text-left text-sm">
          <thead className="border-b border-borda bg-fundo text-xs uppercase tracking-wide text-tinta-suave">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Quando</th>
              <th scope="col" className="px-3 py-2 font-semibold">Evento</th>
              <th scope="col" className="px-3 py-2 font-semibold">Ator</th>
              <th scope="col" className="px-3 py-2 font-semibold">Detalhes</th>
              <th scope="col" className="px-3 py-2 font-semibold">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {eventos.map(evento => (
              <tr key={evento.id} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatarDataHora(evento.criadoEm)}</td>
                <td className="px-3 py-2 font-medium">{evento.tipoEvento.replace(/_/g, ' ')}</td>
                <td className="px-3 py-2">
                  {ROTULOS_ATOR[evento.atorTipo]}
                  {evento.atorTipo === 'funcionario' && evento.atorId && <span className="text-tinta-suave"> {evento.atorId}</span>}
                </td>
                <td className="px-3 py-2 text-tinta-suave">{resumo(evento)}</td>
                <td className="px-3 py-2">{evento.motivo}</td>
              </tr>
            ))}
            {!carregando && eventos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-tinta-suave">Nenhum evento com esses filtros.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginação" className="mt-4 flex items-center justify-between gap-3">
        <button type="button" className="botao-secundario" disabled={pagina === 0 || carregando} onClick={() => setPagina(p => p - 1)}>
          Anterior
        </button>
        <span className="text-sm tabular-nums text-tinta-suave">
          Página {pagina + 1} de {paginas}
        </span>
        <button type="button" className="botao-secundario" disabled={pagina + 1 >= paginas || carregando} onClick={() => setPagina(p => p + 1)}>
          Próxima
        </button>
      </nav>
    </LayoutEquipe>
  )
}
