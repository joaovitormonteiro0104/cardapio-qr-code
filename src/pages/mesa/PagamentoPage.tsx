import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '@/components/Modal'
import { QrCode } from '@/components/QrCode'
import { podeInformarPagamento, temPedidoPendente } from '@/domain/comanda/estado'
import { totalComanda } from '@/domain/pedido/calculo'
import { PixInvalidoError, gerarPayloadPix } from '@/domain/pagamento/pix'
import { formatarReal } from '@/lib/formato'
import * as comandaRepo from '@/repositories/comandaRepo'
import { useMesa } from './MesaLayout'

export default function PagamentoPage() {
  const { comanda, pedidos, configs, recarregar } = useMesa()
  const [copiado, setCopiado] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const total = totalComanda(pedidos)

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

  async function copiar() {
    if (!payload) return
    try {
      await navigator.clipboard.writeText(payload)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 3000)
    } catch {
      setErro('Não foi possível copiar. Toque e segure no código para copiar.')
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
      <Situacao titulo="Aguardando confirmação do caixa" texto={`Assim que o pagamento de ${formatarReal(total)} for conferido, a conta aparece como paga. Para pedir mais, chame um atendente.`} />
    )
  }
  if (comanda.estado === 'Paga') {
    return <Situacao titulo="Pagamento confirmado" texto="Obrigado pela visita! Volte sempre." />
  }
  if (total <= 0) {
    return (
      <div className="py-10 text-center">
        <p className="font-medium">Nada a pagar por enquanto.</p>
        <Link to=".." relative="path" className="botao-primario mt-4">
          Ver o cardápio
        </Link>
      </div>
    )
  }
  if (!payload) {
    return (
      <Situacao
        titulo="Pagamento indisponível"
        texto={`O total é ${formatarReal(total)}. O pagamento pelo celular ainda não está disponível. Por favor, chame o garçom.`}
      />
    )
  }

  const podeInformar = podeInformarPagamento(comanda.estado, pedidos)
  // Decisão 20: pagar com pedido ainda na cozinha é permitido, mas o cliente é avisado.
  const pendentes = temPedidoPendente(pedidos)
  const avisoPendentes =
    'Ainda há pedidos sendo preparados. O valor já inclui esses pedidos e, depois de avisar que pagou, não dá para mudar nem cancelar pelo celular.'

  return (
    <div className="space-y-5 text-center">
      <div>
        <p className="text-sm text-tinta-suave">Total da mesa</p>
        <p className="text-4xl font-bold tabular-nums">{formatarReal(total)}</p>
      </div>

      <div className="mx-auto w-fit rounded-2xl bg-white p-3 shadow-sm ring-1 ring-borda">
        <QrCode texto={payload} descricao={`QR Code Pix de ${formatarReal(total)}`} tamanho={232} />
      </div>
      <p className="text-sm text-tinta-suave">Abra o app do seu banco, escolha Pix e leia o QR Code, ou copie o código.</p>

      <div className="text-left">
        <label htmlFor="pix-copia" className="rotulo">
          Pix copia e cola
        </label>
        <textarea id="pix-copia" readOnly className="campo min-h-20 break-all py-2 font-mono text-xs" value={payload} onFocus={e => e.target.select()} />
        <button type="button" className="botao-secundario mt-2 w-full" onClick={() => void copiar()}>
          {copiado ? 'Código copiado!' : 'Copiar código'}
        </button>
      </div>

      {pendentes && (
        <p role="note" className="rounded-xl bg-alerta-clara px-4 py-3 text-left text-sm">
          {avisoPendentes}
        </p>
      )}
      <button type="button" className="botao-primario w-full text-lg" disabled={!podeInformar} onClick={() => setConfirmando(true)}>
        Já paguei
      </button>
      <p role="alert" className="min-h-5 text-sm font-medium text-perigo">
        {erro}
      </p>

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
              {enviando ? 'Avisando…' : 'Sim, já paguei'}
            </button>
          </>
        }
      >
        <p>
          O caixa vai conferir o pagamento de {formatarReal(total)}. Enquanto isso, a mesa não recebe novos pedidos e os
          pedidos não podem mais ser mudados pelo celular.
        </p>
        {pendentes && <p className="mt-3 rounded-lg bg-alerta-clara px-3 py-2 text-sm">{avisoPendentes}</p>}
      </Modal>
    </div>
  )
}

function Situacao({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl bg-superficie px-6 py-10 text-center ring-1 ring-borda">
      <h2 className="text-xl font-bold">{titulo}</h2>
      <p className="mt-2 text-tinta-suave">{texto}</p>
    </div>
  )
}
