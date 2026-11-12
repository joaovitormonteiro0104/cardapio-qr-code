import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EditarItensModal } from '@/components/EditarItensModal'
import { EstadoPedidoBadge } from '@/components/EstadoPedidoBadge'
import { FotoItem } from '@/components/FotoItem'
import { Modal } from '@/components/Modal'
import type { EstadoComanda } from '@/domain/comanda/estado'
import type { ConfigsTempo } from '@/domain/config'
import { rotuloAutor, separarPedidos } from '@/domain/pedido/apresentacao'
import { itensAtivos, totalComanda, totalPedido } from '@/domain/pedido/calculo'
import { motivoCancelamentoParaCliente } from '@/domain/pedido/cancelamento'
import { acaoDisponivel, fimDaJanelaLivre } from '@/domain/pedido/edicao'
import { useAgora } from '@/hooks/usePedidosCozinha'
import { formatarHora, formatarReal } from '@/lib/formato'
import * as comandaRepo from '@/repositories/comandaRepo'
import * as pedidoRepo from '@/repositories/pedidoRepo'
import { OBSERVACAO_MAX } from '@/schemas/comanda'
import type { Pedido } from '@/schemas/pedido'
import { useMesa } from './MesaLayout'

type Confirmacao = { tipo: 'cancelar' | 'chamar'; pedido: Pedido } | null

/** Últimos segundos da janela livre ficam destacados. */
const SEGUNDOS_ALERTA = 30

function mensagemErro(falha: unknown): string {
  if (falha instanceof pedidoRepo.ErroConcorrencia || falha instanceof pedidoRepo.ErroRegra) return falha.message
  return 'Não foi possível salvar. Verifique a internet e tente de novo.'
}

/** Segundos que faltam da janela livre (null fora dela ou sem prazo, como em Recebido). */
function segundosRestantes(pedido: Pedido, configs: ConfigsTempo | null, agora: Date, estadoComanda: EstadoComanda): number | null {
  if (!configs || acaoDisponivel(pedido, configs, agora, estadoComanda) !== 'editar_livre') return null
  const fim = fimDaJanelaLivre(pedido, configs)
  return fim ? Math.max(0, Math.ceil((fim.getTime() - agora.getTime()) / 1000)) : null
}

function mmss(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`
}

export default function ComandaPage() {
  const { comanda, pedidos, nomes, usuarioId, configs, atualizarComanda, recarregar } = useMesa()
  const agora = useAgora(1000)
  const [editando, setEditando] = useState<string | null>(null)
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [avisoPrazo, setAvisoPrazo] = useState<string | null>(null)

  const pedidoEditando = pedidos.find(p => p.id === editando) ?? null
  const estadoComanda = comanda?.estado ?? 'Aberta'

  // O prazo acabou com a janela de edição aberta: fecha e explica, em vez de dar erro no próximo toque.
  const podeSeguirEditando =
    pedidoEditando && configs ? acaoDisponivel(pedidoEditando, configs, agora, estadoComanda) === 'editar_livre' : true
  useEffect(() => {
    if (pedidoEditando && !podeSeguirEditando) {
      setEditando(null)
      setAvisoPrazo(`O preparo do pedido #${pedidoEditando.numero} avançou. Para mudar algo, chame o garçom.`)
    }
  }, [pedidoEditando, podeSeguirEditando])

  if (!comanda) return null

  const total = totalComanda(pedidos)
  const { andamento, encerrados } = separarPedidos([...pedidos].reverse()) // mais recente primeiro
  const autor = (p: Pedido) => rotuloAutor(p.criadoPor, usuarioId, nomes)
  const podePagar = comanda.estado === 'Aberta' && total > 0

  async function confirmar() {
    if (!confirmacao || !configs) return
    setEnviando(true)
    setErro(null)
    try {
      if (confirmacao.tipo === 'cancelar') await pedidoRepo.cancelarPeloCliente(confirmacao.pedido.id, configs)
      else await pedidoRepo.solicitarEdicao(confirmacao.pedido.id)
      setConfirmacao(null)
      await recarregar()
    } catch (falha) {
      console.error(falha)
      setErro(mensagemErro(falha))
      await recarregar()
    } finally {
      setEnviando(false)
    }
  }

  if (pedidos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-borda px-6 py-10 text-center">
        <p className="font-medium">Nenhum pedido ainda.</p>
        <Link to=".." relative="path" className="botao-primario mt-4">
          Ver o cardápio
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Resumo primeiro: quanto deu e o caminho para pagar */}
      <section aria-label="Resumo da conta" className="rounded-2xl bg-superficie px-4 py-4 shadow-sm ring-1 ring-borda">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-semibold">Total da mesa</span>
          <span className="text-2xl font-bold tabular-nums">{formatarReal(total)}</span>
        </div>
        {andamento.length > 0 && (
          <p className="mt-1 text-sm text-tinta-suave">
            {andamento.length === 1 ? '1 pedido em andamento' : `${andamento.length} pedidos em andamento`}
          </p>
        )}
        {podePagar && (
          <Link to="../pagamento" relative="path" className="botao-primario mt-3 w-full justify-between">
            <span>Pagar</span>
            <span className="tabular-nums">{formatarReal(total)}</span>
          </Link>
        )}
        {comanda.estado !== 'Aberta' && (
          <p role="note" className="mt-3 rounded-xl bg-info-clara px-3 py-2 text-sm text-info">
            A conta foi enviada para pagamento. Para mudar algum pedido, chame um atendente.
          </p>
        )}
      </section>

      {avisoPrazo && (
        <p role="status" className="rounded-xl bg-alerta-clara px-4 py-3 text-sm">
          {avisoPrazo}
        </p>
      )}

      {andamento.length > 0 && (
        <section aria-labelledby="titulo-andamento">
          <h2 id="titulo-andamento" className="mb-2 text-lg font-semibold">
            Em andamento
          </h2>
          <ol className="space-y-3">
            {andamento.map(pedido => (
              <CartaoPedido
                key={pedido.id}
                pedido={pedido}
                autor={autor(pedido)}
                configs={configs}
                agora={agora}
                estadoComanda={comanda.estado}
                aoEditar={() => {
                  setAvisoPrazo(null)
                  setEditando(pedido.id)
                }}
                aoCancelar={() => setConfirmacao({ tipo: 'cancelar', pedido })}
                aoChamar={() => setConfirmacao({ tipo: 'chamar', pedido })}
              />
            ))}
          </ol>
        </section>
      )}

      {encerrados.length > 0 && (
        <details className="group rounded-2xl bg-superficie ring-1 ring-borda" open={andamento.length === 0}>
          <summary className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 font-semibold">
            <span>Já servidos e cancelados ({encerrados.length})</span>
            <span aria-hidden className="text-tinta-suave transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <ul className="divide-y divide-borda border-t border-borda">
            {encerrados.map(pedido => (
              <LinhaEncerrado key={pedido.id} pedido={pedido} autor={autor(pedido)} />
            ))}
          </ul>
        </details>
      )}

      <Observacao
        valorInicial={comanda.observacao ?? ''}
        aoSalvar={async texto => atualizarComanda(await comandaRepo.atualizarObservacao(comanda, texto))}
      />

      {configs && (
        <EditarItensModal
          pedido={pedidoEditando}
          ajuda={`Você pode mudar enquanto a cozinha não aceitou e por ${configs.janelaEdicaoPreparandoMin} minutos depois que ela começa.`}
          permitirEsvaziar
          segundosRestantes={pedidoEditando ? segundosRestantes(pedidoEditando, configs, agora, comanda.estado) : null}
          aoFechar={() => setEditando(null)}
          aoAlterarQuantidade={async (itemId, q) => {
            if (!pedidoEditando) return
            await pedidoRepo.alterarQuantidadeItem(pedidoEditando.id, itemId, q, configs)
            await recarregar()
          }}
          aoRemover={async itemId => {
            if (!pedidoEditando) return
            await pedidoRepo.removerItemDoPedido(pedidoEditando.id, itemId, configs)
            await recarregar()
          }}
        />
      )}

      <Modal
        aberto={confirmacao !== null}
        titulo={confirmacao?.tipo === 'cancelar' ? 'Cancelar pedido?' : 'Chamar o garçom?'}
        aoFechar={() => {
          setConfirmacao(null)
          setErro(null)
        }}
        acoes={
          <>
            <button type="button" className="botao-secundario" onClick={() => setConfirmacao(null)}>
              Voltar
            </button>
            <button
              type="button"
              className={confirmacao?.tipo === 'cancelar' ? 'botao-perigo' : 'botao-primario'}
              disabled={enviando}
              onClick={() => void confirmar()}
            >
              {enviando ? 'Enviando…' : confirmacao?.tipo === 'cancelar' ? 'Cancelar pedido' : 'Chamar garçom'}
            </button>
          </>
        }
      >
        <p>
          {confirmacao?.tipo === 'cancelar'
            ? `O pedido #${confirmacao.pedido.numero} sai da conta e da fila da cozinha.`
            : `A cozinha já está preparando o pedido #${confirmacao?.pedido.numero ?? ''}. Um garçom vem até a mesa para ver o que dá para mudar.`}
        </p>
        <p role="alert" className="mt-2 min-h-5 text-sm font-medium text-perigo">
          {erro}
        </p>
      </Modal>
    </div>
  )
}

interface PropsCartao {
  pedido: Pedido
  autor: string
  configs: ConfigsTempo | null
  agora: Date
  estadoComanda: EstadoComanda
  aoEditar: () => void
  aoCancelar: () => void
  aoChamar: () => void
}

function CartaoPedido({ pedido, autor, configs, agora, estadoComanda, aoEditar, aoCancelar, aoChamar }: PropsCartao) {
  const acao = configs ? acaoDisponivel(pedido, configs, agora, estadoComanda) : 'bloqueado'
  const segundos = segundosRestantes(pedido, configs, agora, estadoComanda)

  return (
    <li className="rounded-2xl bg-superficie px-4 py-3 shadow-sm ring-1 ring-borda">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{autor}</p>
          <p className="text-xs tabular-nums text-tinta-suave">
            {formatarHora(pedido.criadoEm)} · pedido #{pedido.numero}
          </p>
        </div>
        <EstadoPedidoBadge estado={pedido.estado} />
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {pedido.itens.map(item => (
          <li key={item.id} className={`flex items-center gap-3 ${item.removidoEm ? 'text-tinta-suave line-through opacity-60' : ''}`}>
            <FotoItem url={item.fotoUrl} nome={item.nomeSnapshot} className="size-10 rounded-lg" />
            <span className="min-w-0 flex-1">
              <span className="tabular-nums">{item.quantidade}×</span> {item.nomeSnapshot}
            </span>
            <span className="tabular-nums">{formatarReal(item.quantidade * item.precoCentavosSnapshot)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-borda pt-2 text-right text-sm font-semibold tabular-nums">{formatarReal(totalPedido(pedido))}</p>

      {pedido.estado === 'Recebido' && <p className="mt-2 text-sm text-tinta-suave">Aguardando a cozinha aceitar.</p>}
      {pedido.estado === 'EdicaoSolicitada' && (
        <p className="mt-2 text-sm text-brasa-forte">Um garçom está a caminho para ajustar este pedido.</p>
      )}

      {acao === 'editar_livre' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="botao-secundario text-sm" onClick={aoEditar}>
            Editar
          </button>
          <button type="button" className="botao-secundario text-sm text-perigo" onClick={aoCancelar}>
            Cancelar pedido
          </button>
          {segundos !== null && (
            <span
              className={`text-sm font-medium tabular-nums ${segundos <= SEGUNDOS_ALERTA ? 'rounded-md bg-alerta-clara px-2 py-0.5 text-tinta' : 'text-tinta-suave'}`}
            >
              Dá para mudar por mais {mmss(segundos)}
            </span>
          )}
        </div>
      )}
      {acao === 'solicitar_edicao' && (
        <div className="mt-3">
          <button type="button" className="botao-secundario text-sm" onClick={aoChamar}>
            Chamar garçom para mudar
          </button>
          <p className="mt-1 text-xs text-tinta-suave">A cozinha já começou: o prazo para mudar sozinho acabou.</p>
        </div>
      )}
    </li>
  )
}

/** Pedido já servido ou cancelado: uma linha com o essencial. */
function LinhaEncerrado({ pedido, autor }: { pedido: Pedido; autor: string }) {
  const cancelado = pedido.estado === 'Cancelado'
  const resumo = itensAtivos(pedido.itens)
    .map(item => `${item.quantidade}× ${item.nomeSnapshot}`)
    .join(', ')
  const motivo = cancelado ? motivoCancelamentoParaCliente(pedido.cancelamentoMotivo) : null
  return (
    <li className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-sm">
          <span className="font-semibold">{autor}</span>
          <span className="tabular-nums text-tinta-suave"> · {formatarHora(pedido.criadoEm)}</span>
        </p>
        <span className={`shrink-0 text-sm font-semibold tabular-nums ${cancelado ? 'text-tinta-suave line-through' : ''}`}>
          {formatarReal(totalPedido(pedido))}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-tinta-suave">
        {cancelado ? 'Cancelado' : 'Entregue'} · {resumo || 'sem itens'}
      </p>
      {motivo && <p className="mt-1 rounded-lg bg-perigo-clara px-3 py-1.5 text-sm text-perigo">{motivo}</p>}
    </li>
  )
}

function Observacao({ valorInicial, aoSalvar }: { valorInicial: string; aoSalvar: (texto: string) => Promise<void> }) {
  const [texto, setTexto] = useState(valorInicial)
  const [estado, setEstado] = useState<'ocioso' | 'salvando' | 'salvo' | 'erro'>('ocioso')

  useEffect(() => setTexto(valorInicial), [valorInicial])

  const alterado = texto.trim() !== valorInicial.trim()

  async function salvar() {
    setEstado('salvando')
    try {
      await aoSalvar(texto)
      setEstado('salvo')
    } catch (falha) {
      console.error(falha)
      setEstado('erro')
    }
  }

  return (
    <div>
      <label htmlFor="observacao" className="rotulo">
        Observação para a cozinha
      </label>
      <textarea
        id="observacao"
        className="campo min-h-24 py-2"
        maxLength={OBSERVACAO_MAX}
        placeholder="Ex.: sem cebola, carne ao ponto"
        value={texto}
        onChange={e => {
          setTexto(e.target.value)
          setEstado('ocioso')
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p role="status" className="text-sm text-tinta-suave">
          {estado === 'salvo' && 'Observação salva.'}
          {estado === 'erro' && <span className="text-perigo">Não foi possível salvar. Verifique a internet e toque de novo.</span>}
          {estado === 'ocioso' && alterado && 'Não salvo ainda.'}
        </p>
        <button type="button" className="botao-secundario" disabled={!alterado || estado === 'salvando'} onClick={() => void salvar()}>
          {estado === 'salvando' ? 'Salvando…' : 'Salvar observação'}
        </button>
      </div>
    </div>
  )
}
