import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '@/components/Modal'
import { QrCode } from '@/components/QrCode'
import { podeInformarPagamento, temPedidoPendente } from '@/domain/comanda/estado'
import { situacaoValorCopiado } from '@/domain/pagamento/valorCopiado'
import { totalComanda } from '@/domain/pedido/calculo'
import { PixInvalidoError, gerarPayloadPix } from '@/domain/pagamento/pix'
import { formatarReal } from '@/lib/formato'
import { lerValorCopiado, salvarValorCopiado } from '@/lib/pixCopiado'
import * as comandaRepo from '@/repositories/comandaRepo'
import { useMesa } from './MesaLayout'

/**
 * Pagamento por Pix estático (AGENTS.md §6.8). Quase todo cliente paga no
 * mesmo celular que mostra a tela, então o caminho principal é o "copia e
 * cola"; o QR fica recolhido para quem paga de outro aparelho.
 */
export default function PagamentoPage() {
  const { comanda, pedidos, configs, recarregar } = useMesa()
  const [copiado, setCopiado] = useState(false)
  const [valorCopiado, setValorCopiado] = useState<number | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const total = totalComanda(pedidos)
  const comandaId = comanda?.id ?? null

  // O valor copiado sobrevive à ida ao app do banco e à troca de aba.
  useEffect(() => {
    if (comandaId) setValorCopiado(lerValorCopiado(comandaId))
  }, [comandaId])

  const payload = useMemo(() => {
    if (!configs || !comanda || total <= 0) return null
    try {
      return gerarPayloadPix({
        chave: configs.chavePix,
        valorCentavos: total,
        nome: configs.nomeEstabelecimento,
        cidade: configs.cidadeEstabelecimento,
        txid: `CONTA${comanda.numero}`,
      })
    } catch (falha) {
      if (!(falha instanceof PixInvalidoError)) console.error(falha)
      return null
    }
  }, [configs, comanda, total])

  if (!comanda) return null

  const recebedor = configs?.nomeEstabelecimento || 'o estabelecimento'
  const situacaoCopia = situacaoValorCopiado(valorCopiado, total)

  async function copiar() {
    if (!payload || !comanda) return
    try {
      await navigator.clipboard.writeText(payload)
      setCopiado(true)
      setErro(null)
      setValorCopiado(total)
      salvarValorCopiado(comanda.id, total)
      setTimeout(() => setCopiado(false), 4000)
    } catch {
      setErro('Não foi possível copiar. Abra "Mostrar o código" abaixo, toque e segure no código para copiar.')
    }
  }

  async function informar() {
    if (!comanda) return
    setEnviando(true)
    setErro(null)
    try {
      await comandaRepo.informarPagamento(comanda.id)
      setConfirmando(false)
      await recarregar()
    } catch (falha) {
      console.error(falha)
      setErro(falha instanceof comandaRepo.ErroComanda ? falha.message : 'Não foi possível avisar o caixa. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  if (comanda.estado === 'AguardandoPagamento') {
    return (
      <div className="space-y-4">
        <Situacao tom="info" titulo="Aguardando o caixa conferir">
          <p>
            O caixa está conferindo o Pix de <strong className="tabular-nums">{formatarReal(total)}</strong> no extrato. Esta tela
            muda sozinha quando ele confirmar.
          </p>
          <p className="mt-2 text-sm">Se demorar, mostre o comprovante do banco a um atendente.</p>
        </Situacao>
        {payload && (
          <details className="rounded-2xl bg-superficie ring-1 ring-borda">
            <summary className="flex min-h-11 items-center px-4 font-semibold">Ainda não pagou? Ver o código Pix de novo</summary>
            <div className="space-y-3 border-t border-borda px-4 py-4">
              <BlocoCodigo payload={payload} total={total} />
            </div>
          </details>
        )}
      </div>
    )
  }

  if (comanda.estado === 'Paga') {
    return (
      <Situacao tom="sucesso" titulo="Pagamento confirmado" icone="✓">
        <p className="text-3xl font-bold tabular-nums">{formatarReal(total)}</p>
        <p className="mt-1 text-sm tabular-nums">Conta #{comanda.numero}</p>
        <p className="mt-3">Obrigado pela visita! Pode ficar à vontade: a mesa será fechada por um atendente.</p>
      </Situacao>
    )
  }

  if (total <= 0) {
    return (
      <Situacao tom="neutro" titulo="Nada a pagar por enquanto">
        <p>Pedidos cancelados não entram na conta.</p>
        <Link to=".." relative="path" className="botao-primario mt-4">
          Ver o cardápio
        </Link>
      </Situacao>
    )
  }

  if (!payload) {
    return (
      <Situacao tom="neutro" titulo="Pagamento pelo celular indisponível">
        <p>
          O total é <strong className="tabular-nums">{formatarReal(total)}</strong>. Peça a conta a um atendente.
        </p>
      </Situacao>
    )
  }

  const podeInformar = podeInformarPagamento(comanda.estado, pedidos)
  const pendentes = temPedidoPendente(pedidos)
  const avisoPendentes =
    'Ainda há pedidos sendo preparados. O valor já inclui esses pedidos e, depois de avisar que pagou, não dá para mudar nem cancelar pelo celular.'

  return (
    <div className="space-y-5">
      <h2 className="sr-only">Pagar com Pix</h2>
      <div className="rounded-2xl bg-superficie px-4 py-4 text-center shadow-sm ring-1 ring-borda">
        <p className="text-sm text-tinta-suave">Total da mesa</p>
        <p className="text-4xl font-bold tabular-nums">{formatarReal(total)}</p>
      </div>

      {pendentes && (
        <p role="note" className="rounded-xl border border-alerta/40 bg-alerta-clara px-4 py-3 text-sm">
          {avisoPendentes}
        </p>
      )}

      {situacaoCopia === 'mudou' && valorCopiado !== null && (
        <p role="alert" className="rounded-xl border border-perigo/40 bg-perigo-clara px-4 py-3 text-sm font-medium text-perigo">
          A conta mudou de {formatarReal(valorCopiado)} para {formatarReal(total)}: alguém da mesa pediu mais ou cancelou. Copie o
          código de novo antes de pagar.
        </p>
      )}

      <ol className="space-y-4">
        <Passo numero={1} titulo="Copie o código Pix">
          <button type="button" className="botao-primario w-full text-base" onClick={() => void copiar()}>
            {copiado ? 'Código copiado!' : situacaoCopia === 'mudou' ? 'Copiar o código novo' : 'Copiar código Pix'}
          </button>
          <span aria-live="polite" className="sr-only">
            {copiado ? `Código Pix de ${formatarReal(total)} copiado.` : ''}
          </span>
        </Passo>
        <Passo numero={2} titulo="Pague no app do seu banco">
          <p className="text-sm text-tinta-suave">
            Escolha <strong className="text-tinta">Pix copia e cola</strong>, cole o código e confira se o recebedor é{' '}
            <strong className="text-tinta">{recebedor}</strong> e o valor é{' '}
            <strong className="tabular-nums text-tinta">{formatarReal(total)}</strong>.
          </p>
        </Passo>
        <Passo numero={3} titulo="Volte aqui e avise o caixa">
          <button
            type="button"
            className={`${situacaoCopia === 'igual' ? 'botao-primario' : 'botao-secundario'} w-full text-base`}
            disabled={!podeInformar}
            onClick={() => setConfirmando(true)}
          >
            Já paguei
          </button>
        </Passo>
      </ol>

      <p role="alert" className="min-h-5 text-sm font-medium text-perigo">
        {erro}
      </p>

      <details className="rounded-2xl bg-superficie ring-1 ring-borda">
        <summary className="flex min-h-11 items-center px-4 font-semibold">Vai pagar de outro celular? Mostrar o QR Code</summary>
        <div className="space-y-3 border-t border-borda px-4 py-4">
          <BlocoCodigo payload={payload} total={total} />
        </div>
      </details>

      <Modal
        aberto={confirmando}
        titulo="Avisar que pagou?"
        aoFechar={() => setConfirmando(false)}
        acoes={
          <>
            <button type="button" className="botao-secundario" onClick={() => setConfirmando(false)}>
              Voltar
            </button>
            <button type="button" className="botao-primario" disabled={enviando} onClick={() => void informar()}>
              {enviando ? 'Avisando…' : `Sim, paguei ${formatarReal(total)}`}
            </button>
          </>
        }
      >
        <p>
          O caixa vai conferir um Pix de <strong className="tabular-nums">{formatarReal(total)}</strong>. Enquanto isso, a mesa não
          recebe novos pedidos e os pedidos não podem mais ser mudados pelo celular.
        </p>
        {situacaoCopia === 'mudou' && valorCopiado !== null && (
          <p className="mt-3 rounded-lg bg-perigo-clara px-3 py-2 text-sm text-perigo">
            Atenção: você copiou o código quando a conta era {formatarReal(valorCopiado)}. Confira se pagou o valor atual.
          </p>
        )}
        {pendentes && <p className="mt-3 rounded-lg bg-alerta-clara px-3 py-2 text-sm">{avisoPendentes}</p>}
      </Modal>
    </div>
  )
}

function Passo({ numero, titulo, children }: { numero: number; titulo: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brasa-clara font-bold tabular-nums text-brasa-forte"
      >
        {numero}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="pt-1 font-semibold">
          <span className="sr-only">Passo {numero}: </span>
          {titulo}
        </p>
        {children}
      </div>
    </li>
  )
}

/** QR (para outro celular) + código para copiar à mão. */
function BlocoCodigo({ payload, total }: { payload: string; total: number }) {
  return (
    <>
      <div className="mx-auto w-fit rounded-2xl bg-white p-3 ring-1 ring-borda">
        <QrCode
          texto={payload}
          descricao={`QR Code Pix de ${formatarReal(total)}`}
          tamanho={220}
          textoFalha="Não foi possível desenhar o QR Code. Use o código copia e cola."
        />
      </div>
      <div>
        <label htmlFor="pix-copia" className="rotulo">
          Código Pix copia e cola
        </label>
        <textarea
          id="pix-copia"
          readOnly
          className="campo min-h-24 break-all py-2 font-mono text-sm"
          value={payload}
          onFocus={e => e.target.select()}
        />
      </div>
    </>
  )
}

const TONS = {
  neutro: 'bg-superficie ring-borda',
  info: 'bg-info-clara ring-info/30',
  sucesso: 'bg-sucesso-clara ring-sucesso/30',
} as const

function Situacao({
  tom,
  titulo,
  icone,
  children,
}: {
  tom: keyof typeof TONS
  titulo: string
  icone?: string
  children: ReactNode
}) {
  return (
    <div className={`rounded-2xl px-6 py-8 text-center ring-1 ${TONS[tom]}`}>
      {icone && (
        <p aria-hidden className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-sucesso text-2xl font-bold text-white">
          {icone}
        </p>
      )}
      {tom === 'info' && (
        <span aria-hidden className="mx-auto mb-3 block size-3 rounded-full bg-info motion-safe:animate-pulse" />
      )}
      <h2 className="text-xl font-bold">{titulo}</h2>
      <div className="mt-2 text-tinta">{children}</div>
    </div>
  )
}
