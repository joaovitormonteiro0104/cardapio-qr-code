import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AvisoFlutuante, type Aviso } from '@/components/AvisoFlutuante'
import { Carregando } from '@/components/Carregando'
import { LayoutEquipe } from '@/components/LayoutEquipe'
import { Modal } from '@/components/Modal'
import { QrCode } from '@/components/QrCode'
import { enderecoServeParaQr, interpretarNumerosMesa, proximoNumeroLivre } from '@/domain/mesa/mesas'
import { useConfig } from '@/lib/config'
import * as mesaRepo from '@/repositories/mesaRepo'
import type { Mesa } from '@/schemas/comanda'

/** O endereço de onde a página está aberta é o que vai dentro do QR. */
const ORIGEM = window.location.origin

function urlDaMesa(numero: number): string {
  return `${ORIGEM}/mesa/${numero}`
}

function listarNumeros(numeros: readonly number[]): string {
  return numeros.length <= 6 ? numeros.join(', ') : `${numeros.slice(0, 6).join(', ')}…`
}

export default function MesasPage() {
  const { configs } = useConfig()
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [contas, setContas] = useState<Map<string, number>>(new Map())
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState(false)
  const [numero, setNumero] = useState('')
  const [erroCampo, setErroCampo] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [imprimirSo, setImprimirSo] = useState<string | null>(null)
  const [confirmarImpressao, setConfirmarImpressao] = useState<string | null | undefined>(undefined)
  const campo = useRef<HTMLInputElement>(null)
  const limparAviso = useCallback(() => setAviso(null), [])

  const carregar = useCallback(async () => {
    try {
      const [lista, abertas] = await Promise.all([mesaRepo.listarMesas(), mesaRepo.contasAbertasPorMesa()])
      setMesas(lista)
      setContas(abertas)
      setErroCarga(false)
    } catch (falha) {
      console.error(falha)
      setErroCarga(true)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  // Depois de imprimir (ou cancelar o diálogo), volta a imprimir todas.
  useEffect(() => {
    const aoTerminar = () => setImprimirSo(null)
    window.addEventListener('afterprint', aoTerminar)
    return () => window.removeEventListener('afterprint', aoTerminar)
  }, [])

  const proximo = proximoNumeroLivre(mesas.map(m => m.numero))
  const enderecoOk = enderecoServeParaQr(window.location.hostname)

  async function criar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const resultado = interpretarNumerosMesa(numero)
    if ('erro' in resultado) {
      setErroCampo(resultado.erro)
      campo.current?.focus()
      return
    }
    setErroCampo(null)
    setOcupado('nova')
    const criadas: number[] = []
    const repetidas: number[] = []
    try {
      for (const n of resultado.numeros) {
        try {
          await mesaRepo.criarMesa(n)
          criadas.push(n)
        } catch (falha) {
          if (falha instanceof mesaRepo.MesaDuplicadaError) repetidas.push(n)
          else throw falha
        }
      }
      setNumero('')
      const partes = []
      if (criadas.length) partes.push(criadas.length === 1 ? `Mesa ${criadas[0]} criada.` : `${criadas.length} mesas criadas.`)
      if (repetidas.length) partes.push(`Já existiam: ${listarNumeros(repetidas)}.`)
      setAviso({ tipo: criadas.length ? 'ok' : 'erro', texto: partes.join(' ') })
    } catch (falha) {
      console.error(falha)
      setAviso({ tipo: 'erro', texto: `Não foi possível criar todas as mesas.${criadas.length ? ` Criadas: ${listarNumeros(criadas)}.` : ''}` })
    } finally {
      setOcupado(null)
      await carregar()
      campo.current?.focus()
    }
  }

  async function alternar(mesa: Mesa, ativa: boolean, comDesfazer = true) {
    setOcupado(mesa.id)
    try {
      await mesaRepo.definirMesaAtiva(mesa, ativa)
      setAviso({
        tipo: 'ok',
        texto: ativa ? `Mesa ${mesa.numero} ativada.` : `Mesa ${mesa.numero} desativada: quem escanear verá "mesa indisponível".`,
        acao: comDesfazer ? { rotulo: 'Desfazer', aoClicar: () => void alternar({ ...mesa, ativa }, !ativa, false) } : undefined,
      })
    } catch (falha) {
      console.error(falha)
      setAviso({
        tipo: 'erro',
        texto:
          falha instanceof mesaRepo.MesaComContaAbertaError
            ? `A mesa ${mesa.numero} está com a conta #${falha.numeroConta} aberta. Feche a conta (aba Contas) antes de desativar.`
            : 'Não foi possível salvar. Verifique a conexão e tente de novo.',
      })
    } finally {
      setOcupado(null)
      await carregar()
    }
  }

  /** Imprime todas (null) ou só uma mesa; pergunta antes se o endereço não serve para o QR. */
  function pedirImpressao(mesaId: string | null) {
    if (!enderecoOk) {
      setConfirmarImpressao(mesaId)
      return
    }
    imprimir(mesaId)
  }

  function imprimir(mesaId: string | null) {
    setConfirmarImpressao(undefined)
    setImprimirSo(mesaId)
    // espera o React aplicar o filtro antes de abrir o diálogo de impressão
    setTimeout(() => window.print(), 50)
  }

  const ativas = mesas.filter(m => m.ativa)
  const paraImprimir = imprimirSo ? ativas.filter(m => m.id === imprimirSo) : ativas

  return (
    <LayoutEquipe titulo="Mesas" imprimirTitulo={false}>
      <div className="nao-imprimir">
        <form onSubmit={criar} noValidate className="mb-5 max-w-lg">
          <label htmlFor="nova-mesa" className="rotulo">
            Nova mesa (um número ou um intervalo)
          </label>
          <div className="flex items-start gap-2">
            <input
              ref={campo}
              id="nova-mesa"
              className="campo tabular-nums"
              inputMode="text"
              autoComplete="off"
              enterKeyHint="done"
              maxLength={11}
              placeholder={`Ex.: ${proximo} ou ${proximo}-${Math.min(9999, proximo + 9)}`}
              value={numero}
              onChange={e => {
                setNumero(e.target.value.replace(/[^\d\s\-a]/gi, ''))
                setErroCampo(null)
              }}
              aria-invalid={erroCampo ? true : undefined}
              aria-describedby={erroCampo ? 'nova-mesa-erro' : undefined}
            />
            <button type="submit" className="botao-primario shrink-0" disabled={ocupado === 'nova'}>
              {ocupado === 'nova' ? 'Criando…' : 'Adicionar'}
            </button>
          </div>
          {erroCampo && (
            <p id="nova-mesa-erro" role="alert" className="mt-1 text-sm font-medium text-perigo">
              {erroCampo}
            </p>
          )}
        </form>

        {/* O que vai dentro do QR: conferir antes de imprimir */}
        <div
          className={`mb-5 rounded-xl px-4 py-3 text-sm ${enderecoOk ? 'bg-superficie ring-1 ring-borda' : 'border-2 border-alerta bg-alerta-clara'}`}
        >
          <p>
            Os QR Codes vão abrir: <strong className="break-all">{urlDaMesa(1).replace(/1$/, 'N')}</strong>
          </p>
          {!enderecoOk && (
            <p className="mt-1 font-semibold">
              Este endereço só funciona neste computador. Abra esta tela pelo endereço público do app antes de imprimir.
            </p>
          )}
          {!configs?.nomeEstabelecimento && (
            <p className="mt-1">
              O nome do estabelecimento está vazio e não vai aparecer nos cartões.{' '}
              <Link to="/gerencia/config" className="font-semibold underline">
                Configurar
              </Link>
            </p>
          )}
          <p className="mt-1 text-tinta-suave">Imprima em A4, escala 100%, e recorte na linha tracejada de cada cartão.</p>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Mesas <span className="font-normal tabular-nums text-tinta-suave">({ativas.length} ativas de {mesas.length})</span>
          </h2>
          <button type="button" className="botao-secundario" disabled={ativas.length === 0} onClick={() => pedirImpressao(null)}>
            Imprimir todos os QR Codes
          </button>
        </div>

        {carregando ? (
          <Carregando texto="Carregando mesas…" />
        ) : erroCarga ? (
          <div role="alert" className="rounded-2xl bg-perigo-clara px-6 py-8 text-center text-perigo">
            <p className="font-semibold">Não foi possível carregar as mesas.</p>
            <button type="button" className="botao-primario mt-4" onClick={() => void carregar()}>
              Tentar de novo
            </button>
          </div>
        ) : mesas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-borda px-6 py-10 text-center">
            <p className="font-medium">Nenhuma mesa ainda.</p>
            <p className="mt-1 text-sm text-tinta-suave">Cadastre as mesas acima (ex.: 1-15) para gerar os QR Codes.</p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mesas.map(mesa => {
              const conta = contas.get(mesa.id)
              return (
                <li key={mesa.id} className={`rounded-2xl bg-superficie p-4 shadow-sm ring-1 ${mesa.ativa ? 'ring-borda-campo/40' : 'ring-borda'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 rounded-lg bg-white p-1 ring-1 ring-borda ${mesa.ativa ? '' : 'opacity-40 grayscale'}`}>
                      <QrCode texto={urlDaMesa(mesa.numero)} descricao={`QR Code da mesa ${mesa.numero}`} tamanho={64} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xl font-bold tabular-nums">Mesa {mesa.numero}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-sm">
                        {mesa.ativa ? (
                          <span className="rounded-md bg-sucesso-clara px-2 py-0.5 font-medium text-sucesso">Ativa</span>
                        ) : (
                          <span className="rounded-md bg-fundo px-2 py-0.5 font-medium text-tinta">Inativa: cliente vê "indisponível"</span>
                        )}
                        {conta && <span className="rounded-md bg-brasa-clara px-2 py-0.5 font-medium text-brasa-forte">Conta #{conta} aberta</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={mesa.ativa}
                      aria-label={`Mesa ${mesa.numero} ativa`}
                      disabled={ocupado === mesa.id || (mesa.ativa && conta !== undefined)}
                      onClick={() => void alternar(mesa, !mesa.ativa)}
                      className="flex min-h-11 items-center gap-2 rounded-xl px-1 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span
                        aria-hidden
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${mesa.ativa ? 'bg-sucesso' : 'bg-borda-campo'}`}
                      >
                        <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${mesa.ativa ? 'translate-x-6' : 'translate-x-1'}`} />
                      </span>
                      {mesa.ativa ? 'Ativa' : 'Inativa'}
                    </button>
                    {mesa.ativa && (
                      <button type="button" className="botao-secundario ml-auto text-sm" onClick={() => pedirImpressao(mesa.id)}>
                        Imprimir só esta
                      </button>
                    )}
                  </div>
                  {mesa.ativa && conta !== undefined && (
                    <p className="mt-1 text-sm text-tinta-suave">Para desativar, feche antes a conta #{conta} na aba Contas.</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Só aparece no papel: cartões para recortar e pôr nas mesas */}
      <div className="hidden grid-cols-3 gap-4 print:grid">
        {paraImprimir.map(mesa => (
          <figure
            key={mesa.id}
            className="flex break-inside-avoid flex-col items-center rounded-2xl border border-dashed border-black/50 bg-white p-4 text-center text-black"
          >
            <div className="mb-2 h-1.5 w-16 rounded-full bg-brasa" aria-hidden />
            {configs?.nomeEstabelecimento && <p className="text-base font-bold">{configs.nomeEstabelecimento}</p>}
            <QrCode texto={urlDaMesa(mesa.numero)} descricao={`QR Code da mesa ${mesa.numero}`} tamanho={190} />
            <figcaption className="mt-1">
              <span className="block text-4xl font-bold tabular-nums">Mesa {mesa.numero}</span>
              <span className="mt-1 block text-sm">Aponte a câmera do celular para ver o cardápio e pedir</span>
              <span className="mt-1 block break-all text-[10px] text-black/70">{urlDaMesa(mesa.numero)}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <Modal
        aberto={confirmarImpressao !== undefined}
        titulo="Este endereço não serve para o QR"
        aoFechar={() => setConfirmarImpressao(undefined)}
        acoes={
          <>
            <button type="button" className="botao-primario" onClick={() => setConfirmarImpressao(undefined)}>
              Não imprimir
            </button>
            <button type="button" className="botao-secundario" onClick={() => imprimir(confirmarImpressao ?? null)}>
              Imprimir mesmo assim (teste)
            </button>
          </>
        }
      >
        <p>
          Os QR Codes vão apontar para <strong className="break-all">{ORIGEM}</strong>, que só abre neste computador. No celular do
          cliente, não vai funcionar.
        </p>
        <p className="mt-2">Abra esta tela pelo endereço público do app (o da Vercel) e imprima de lá.</p>
      </Modal>

      <AvisoFlutuante aviso={aviso} aoSumir={limparAviso} />
    </LayoutEquipe>
  )
}
