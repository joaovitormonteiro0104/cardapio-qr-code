import { useEffect, useId, useState } from 'react'
import { Modal } from '@/components/Modal'
import {
  MOTIVOS_CANCELAMENTO,
  ROTULOS_MOTIVO,
  TEXTO_MOTIVO_MAX,
  confirmacaoPorNumeroValida,
  motivoParaRegistro,
  precisaDuasEtapas,
  validaMotivo,
  type MotivoCancelamento,
} from '@/domain/pedido/cancelamento'
import * as pedidoRepo from '@/repositories/pedidoRepo'
import type { Pedido } from '@/schemas/pedido'

const ESPERA_CONFIRMAR_MS = 2000

export type EtapaCancelamento = { pedido: Pedido; etapa: 1 | 2 } | null

interface Props {
  estado: EtapaCancelamento
  aoMudarEtapa: (estado: EtapaCancelamento) => void
  aoConcluir: (mensagem: string) => void
}

/**
 * Cancelamento pela cozinha (§6.6).
 * Etapa 1: motivo (lista fixa + texto; texto obrigatório em "outro").
 *   Recebido → cancela direto. Preparando/Pronto → CancelamentoPendente e abre a etapa 2.
 * Etapa 2: confirmação explícita (digitar o nº do pedido OU botão liberado após 2 s) ou desistir.
 * Vale para todos, inclusive gerência.
 */
export function CancelamentoModal({ estado, aoMudarEtapa, aoConcluir }: Props) {
  if (!estado) return <Modal aberto={false} titulo="" aoFechar={() => undefined}>{null}</Modal>
  return estado.etapa === 1 ? (
    <Etapa1 pedido={estado.pedido} aoMudarEtapa={aoMudarEtapa} aoConcluir={aoConcluir} />
  ) : (
    <Etapa2 pedido={estado.pedido} aoMudarEtapa={aoMudarEtapa} aoConcluir={aoConcluir} />
  )
}

function mensagemErro(falha: unknown): string {
  if (falha instanceof pedidoRepo.ErroConcorrencia || falha instanceof pedidoRepo.ErroRegra) return falha.message
  return 'Não foi possível salvar. Verifique a conexão e tente de novo.'
}

function Etapa1({ pedido, aoMudarEtapa, aoConcluir }: { pedido: Pedido } & Omit<Props, 'estado'>) {
  const id = useId()
  const [motivo, setMotivo] = useState<MotivoCancelamento | ''>('')
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const duasEtapas = precisaDuasEtapas(pedido)

  async function enviar() {
    if (!motivo) {
      setErro('Escolha o motivo.')
      return
    }
    const problema = validaMotivo(motivo, texto)
    if (problema === 'texto_obrigatorio') {
      setErro('Descreva o motivo quando escolher "Outro".')
      return
    }
    if (problema) {
      setErro('Motivo inválido.')
      return
    }
    setEnviando(true)
    setErro(null)
    try {
      const resultado = await pedidoRepo.solicitarCancelamento(pedido.id, motivo, texto.trim() || null)
      if (resultado === 'Cancelado') {
        aoMudarEtapa(null)
        aoConcluir(`Pedido #${pedido.numero} cancelado.`)
      } else {
        aoMudarEtapa({
          pedido: {
            ...pedido,
            estado: 'CancelamentoPendente',
            estadoAnterior: pedido.estado,
            cancelamentoMotivo: motivoParaRegistro(motivo, texto),
          },
          etapa: 2,
        })
      }
    } catch (falha) {
      console.error(falha)
      setErro(mensagemErro(falha))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      aberto
      titulo={`Cancelar pedido #${pedido.numero}`}
      aoFechar={() => aoMudarEtapa(null)}
      acoes={
        <>
          <button type="button" className="botao-secundario" onClick={() => aoMudarEtapa(null)}>
            Voltar
          </button>
          <button type="button" className="botao-perigo" disabled={enviando} onClick={() => void enviar()}>
            {enviando ? 'Salvando…' : duasEtapas ? 'Continuar' : 'Cancelar pedido'}
          </button>
        </>
      }
    >
      <fieldset>
        <legend className="rotulo">Motivo</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {MOTIVOS_CANCELAMENTO.map(opcao => (
            <label
              key={opcao}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 ${
                motivo === opcao ? 'border-perigo bg-perigo-clara' : 'border-borda'
              }`}
            >
              <input
                type="radio"
                name={`${id}-motivo`}
                className="size-5 accent-perigo"
                checked={motivo === opcao}
                onChange={() => setMotivo(opcao)}
              />
              {ROTULOS_MOTIVO[opcao]}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`${id}-texto`} className="rotulo mt-4">
        Detalhes {motivo === 'outro' ? <span className="text-perigo">(obrigatório)</span> : <span className="font-normal text-tinta-suave">(opcional)</span>}
      </label>
      <textarea
        id={`${id}-texto`}
        className="campo min-h-20 py-2"
        maxLength={TEXTO_MOTIVO_MAX}
        value={texto}
        onChange={e => setTexto(e.target.value)}
      />
      {duasEtapas && (
        <p className="mt-3 text-sm text-tinta-suave">O pedido já está em preparo: no próximo passo você confirma o cancelamento.</p>
      )}
      <p role="alert" className="mt-2 min-h-5 text-sm font-medium text-perigo">
        {erro}
      </p>
    </Modal>
  )
}

function Etapa2({ pedido, aoMudarEtapa, aoConcluir }: { pedido: Pedido } & Omit<Props, 'estado'>) {
  const id = useId()
  const [digitado, setDigitado] = useState('')
  const [liberado, setLiberado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setLiberado(true), ESPERA_CONFIRMAR_MS)
    return () => clearTimeout(timer)
  }, [])

  const numeroConfere = confirmacaoPorNumeroValida(digitado, pedido.numero)

  async function executar(acao: 'confirmar' | 'desistir') {
    setEnviando(true)
    setErro(null)
    try {
      if (acao === 'confirmar') {
        await pedidoRepo.confirmarCancelamento(pedido.id)
        aoConcluir(`Pedido #${pedido.numero} cancelado.`)
      } else {
        await pedidoRepo.desistirCancelamento(pedido.id)
        aoConcluir(`Cancelamento do pedido #${pedido.numero} desfeito.`)
      }
      aoMudarEtapa(null)
    } catch (falha) {
      console.error(falha)
      setErro(mensagemErro(falha))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      aberto
      titulo={`Confirmar cancelamento #${pedido.numero}`}
      aoFechar={() => aoMudarEtapa(null)}
      acoes={
        <>
          <button type="button" className="botao-secundario" disabled={enviando} onClick={() => void executar('desistir')}>
            Desistir
          </button>
          <button
            type="button"
            className="botao-perigo"
            disabled={enviando || !(liberado || numeroConfere)}
            onClick={() => void executar('confirmar')}
          >
            {liberado || numeroConfere ? 'Confirmar cancelamento' : 'Aguarde…'}
          </button>
        </>
      }
    >
      {pedido.cancelamentoMotivo && (
        <p className="mb-3 rounded-xl bg-perigo-clara px-3 py-2 text-sm">
          Motivo: <strong>{pedido.cancelamentoMotivo}</strong>
        </p>
      )}
      <p className="text-sm text-tinta-suave">
        Para confirmar, digite o número do pedido ou toque em “Confirmar cancelamento”. “Desistir” devolve o pedido para
        onde estava.
      </p>
      <label htmlFor={`${id}-numero`} className="rotulo mt-4">
        Número do pedido
      </label>
      <input
        id={`${id}-numero`}
        className="campo text-lg tabular-nums"
        inputMode="numeric"
        placeholder={String(pedido.numero)}
        value={digitado}
        onChange={e => setDigitado(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && numeroConfere) void executar('confirmar')
        }}
      />
      <p role="alert" className="mt-2 min-h-5 text-sm font-medium text-perigo">
        {erro}
      </p>
    </Modal>
  )
}
