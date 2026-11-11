import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EditarItensModal } from '@/components/EditarItensModal'
import { EstadoPedidoBadge } from '@/components/EstadoPedidoBadge'
import { FotoItem } from '@/components/FotoItem'
import { Modal } from '@/components/Modal'
import type { ConfigsTempo } from '@/domain/config'
import { totalComanda, totalPedido } from '@/domain/pedido/calculo'
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

function mensagemErro(falha: unknown): string {
  if (falha instanceof pedidoRepo.ErroConcorrencia || falha instanceof pedidoRepo.ErroRegra) return falha.message
  return 'Não foi possível salvar. Verifique a internet e tente de novo.'
}

export default function ComandaPage() {
  const { comanda, pedidos, configs, atualizarComanda, recarregar } = useMesa()
  const agora = useAgora(1000)
  const [editando, setEditando] = useState<string | null>(null)
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (!comanda) return null

  const total = totalComanda(pedidos)
  const visiveis = [...pedidos].reverse() // mais recente primeiro
  const pedidoEditando = pedidos.find(p => p.id === editando) ?? null

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

  return (
    <div className="space-y-6">
      {visiveis.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-borda px-6 py-10 text-center">
          <p className="font-medium">Nenhum pedido ainda.</p>
          <Link to=".." relative="path" className="botao-primario mt-4">
            Ver o cardápio
          </Link>
        </div>
      ) : (
        <ol className="space-y-3" aria-label="Pedidos da mesa">
          {visiveis.map(pedido => (
            <CartaoPedido
              key={pedido.id}
              pedido={pedido}
              configs={configs}
              agora={agora}
              aoEditar={() => setEditando(pedido.id)}
              aoCancelar={() => setConfirmacao({ tipo: 'cancelar', pedido })}
              aoChamar={() => setConfirmacao({ tipo: 'chamar', pedido })}
            />
          ))}
        </ol>
      )}

      <div className="flex items-baseline justify-between rounded-2xl bg-superficie px-4 py-4 shadow-sm ring-1 ring-borda">
        <span className="font-semibold">Total da mesa</span>
        <span className="text-2xl font-bold tabular-nums">{formatarReal(total)}</span>
      </div>

      <Observacao
        valorInicial={comanda.observacao ?? ''}
        aoSalvar={async texto => atualizarComanda(await comandaRepo.atualizarObservacao(comanda, texto))}
      />

      {configs && (
        <EditarItensModal
          pedido={pedidoEditando}
          ajuda="Você pode mudar enquanto a cozinha não começou ou logo no início do preparo."
          permitirEsvaziar
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
  configs: ConfigsTempo | null
  agora: Date
  aoEditar: () => void
  aoCancelar: () => void
  aoChamar: () => void
}

function CartaoPedido({ pedido, configs, agora, aoEditar, aoCancelar, aoChamar }: PropsCartao) {
  const cancelado = pedido.estado === 'Cancelado'
  const acao = configs ? acaoDisponivel(pedido, configs, agora) : 'bloqueado'
  const fim = configs ? fimDaJanelaLivre(pedido, configs) : null
  const segundos = fim && acao === 'editar_livre' ? Math.max(0, Math.ceil((fim.getTime() - agora.getTime()) / 1000)) : null

  return (
    <li className="rounded-2xl bg-superficie px-4 py-3 shadow-sm ring-1 ring-borda">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">
          Pedido <span className="tabular-nums">#{pedido.numero}</span>
          <span className="ml-2 text-sm font-normal tabular-nums text-tinta-suave">{formatarHora(pedido.criadoEm)}</span>
        </p>
        <EstadoPedidoBadge estado={pedido.estado} />
      </div>
      <ul className={`mt-3 space-y-2 text-sm ${cancelado ? 'text-tinta-suave line-through' : ''}`}>
        {pedido.itens.map(item => (
          <li
            key={item.id}
            className={`flex items-center gap-3 ${item.removidoEm ? 'text-tinta-suave line-through opacity-60' : ''}`}
          >
            <FotoItem url={item.fotoUrl} nome={item.nomeSnapshot} className="size-10 rounded-lg" />
            <span className="min-w-0 flex-1">
              <span className="tabular-nums">{item.quantidade}×</span> {item.nomeSnapshot}
            </span>
            <span className="tabular-nums">{formatarReal(item.quantidade * item.precoCentavosSnapshot)}</span>
          </li>
        ))}
      </ul>
      {!cancelado && (
        <p className="mt-2 border-t border-borda pt-2 text-right text-sm font-semibold tabular-nums">
          {formatarReal(totalPedido(pedido))}
        </p>
      )}
      {pedido.estado === 'EdicaoSolicitada' && (
        <p className="mt-2 text-sm text-brasa-forte">Um garçom está a caminho para ajustar este pedido.</p>
      )}
      {cancelado && motivoCancelamentoParaCliente(pedido.cancelamentoMotivo) && (
        <p className="mt-2 rounded-lg bg-perigo-clara px-3 py-2 text-sm text-perigo">
          {motivoCancelamentoParaCliente(pedido.cancelamentoMotivo)}
        </p>
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
            <span className="text-xs tabular-nums text-tinta-suave">
              Dá para mudar por mais {Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, '0')}
            </span>
          )}
        </div>
      )}
      {acao === 'solicitar_edicao' && (
        <div className="mt-3">
          <button type="button" className="botao-secundario text-sm" onClick={aoChamar}>
            Chamar garçom para mudar
          </button>
        </div>
      )}
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
        placeholder="Ex.: sem cebola no X-Burguer, carne ao ponto"
        value={texto}
        onChange={e => {
          setTexto(e.target.value)
          setEstado('ocioso')
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p role="status" className="text-sm text-tinta-suave">
          {estado === 'salvo' && 'Observação salva.'}
          {estado === 'erro' && <span className="text-perigo">Não foi possível salvar.</span>}
        </p>
        <button type="button" className="botao-secundario" disabled={!alterado || estado === 'salvando'} onClick={() => void salvar()}>
          {estado === 'salvando' ? 'Salvando…' : 'Salvar observação'}
        </button>
      </div>
    </div>
  )
}
