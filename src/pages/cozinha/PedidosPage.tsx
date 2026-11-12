import { useState } from 'react'
import { EditarItensModal } from '@/components/EditarItensModal'
import { LayoutEquipe } from '@/components/LayoutEquipe'
import type { EstadoPedido } from '@/domain/pedido/estado'
import { useAgora, usePedidosCozinha } from '@/hooks/usePedidosCozinha'
import { useConfig } from '@/lib/config'
import * as pedidoRepo from '@/repositories/pedidoRepo'
import type { PedidoCozinha } from '@/repositories/pedidoRepo'
import { CancelamentoModal, type EtapaCancelamento } from './CancelamentoModal'
import { CartaoPedidoCozinha } from './CartaoPedidoCozinha'

const COLUNAS: { titulo: string; estado: EstadoPedido }[] = [
  { titulo: 'Novos', estado: 'Recebido' },
  { titulo: 'Preparando', estado: 'Preparando' },
  { titulo: 'Prontos', estado: 'Pronto' },
]

/** Coluna do pedido: estados temporários ficam na coluna de onde vieram. */
function colunaDe(pedido: PedidoCozinha): EstadoPedido {
  return pedido.estado === 'EdicaoSolicitada' || pedido.estado === 'CancelamentoPendente'
    ? (pedido.estadoAnterior ?? 'Recebido')
    : pedido.estado
}

function mensagemErro(falha: unknown): string {
  if (falha instanceof pedidoRepo.ErroConcorrencia || falha instanceof pedidoRepo.ErroRegra) return falha.message
  return 'Não foi possível salvar. Verifique a conexão e tente de novo.'
}

export default function PedidosPage() {
  const { pedidos, carregando, erro, conectado, recarregar } = usePedidosCozinha()
  const { configs } = useConfig()
  const agora = useAgora()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [cancelamento, setCancelamento] = useState<EtapaCancelamento>(null)
  const [editando, setEditando] = useState<string | null>(null)

  async function executar(pedidoId: string, acao: () => Promise<void>, sucesso?: string) {
    setOcupado(pedidoId)
    setAviso(null)
    try {
      await acao()
      if (sucesso) setAviso({ tipo: 'ok', texto: sucesso })
    } catch (falha) {
      console.error(falha)
      setAviso({ tipo: 'erro', texto: mensagemErro(falha) })
    } finally {
      setOcupado(null)
      await recarregar()
    }
  }

  const pedidoEditando = pedidos.find(p => p.id === editando) ?? null
  // Pedidos que pedem atenção aparecem primeiro na coluna
  const ordenar = (lista: PedidoCozinha[]) =>
    [...lista].sort((a, b) => Number(b.estado !== colunaDe(b)) - Number(a.estado !== colunaDe(a)))

  return (
    <LayoutEquipe titulo="Pedidos">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className={`inline-flex items-center gap-2 ${conectado ? 'text-sucesso' : 'text-perigo'}`}>
          <span className={`size-2.5 rounded-full ${conectado ? 'bg-sucesso' : 'bg-perigo'}`} aria-hidden />
          {conectado ? 'Ao vivo' : 'Sem conexão: reconectando…'}
        </span>
        {!carregando && (
          <span className="text-tinta-suave">
            {pedidos.length === 1 ? '1 pedido em aberto' : `${pedidos.length} pedidos em aberto`}
          </span>
        )}
      </div>

      {aviso && (
        <p
          role={aviso.tipo === 'erro' ? 'alert' : 'status'}
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
            aviso.tipo === 'erro' ? 'bg-perigo-clara text-perigo' : 'bg-sucesso-clara text-sucesso'
          }`}
        >
          {aviso.texto}
        </p>
      )}
      {erro && <p className="mb-4 rounded-xl bg-perigo-clara px-4 py-3 text-sm text-perigo">{erro}</p>}
      {carregando ? (
        <p className="text-tinta-suave">Carregando pedidos…</p>
      ) : (
      <div className="grid gap-5 lg:grid-cols-3">
        {COLUNAS.map(coluna => {
          const daColuna = ordenar(pedidos.filter(p => colunaDe(p) === coluna.estado))
          return (
            <section key={coluna.estado} aria-labelledby={`coluna-${coluna.estado}`} className="min-w-0">
              <h2 id={`coluna-${coluna.estado}`} className="mb-3 flex items-baseline gap-2 text-lg font-semibold">
                {coluna.titulo}
                <span className="text-sm font-normal tabular-nums text-tinta-suave">{daColuna.length}</span>
              </h2>
              {daColuna.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-borda px-4 py-6 text-center text-sm text-tinta-suave">
                  Nada aqui.
                </p>
              ) : (
                <div className="space-y-3">
                  {daColuna.map(pedido => (
                    <CartaoPedidoCozinha
                      key={pedido.id}
                      pedido={pedido}
                      agora={agora}
                      ocupado={ocupado === pedido.id}
                      aoAvancar={para => void executar(pedido.id, () => pedidoRepo.avancarEstado(pedido.id, para))}
                      aoCancelar={() => setCancelamento({ pedido, etapa: 1 })}
                      aoConcluirCancelamento={() => setCancelamento({ pedido, etapa: 2 })}
                      aoEditarItens={() => setEditando(pedido.id)}
                      aoResolverEdicao={aplicada =>
                        void executar(
                          pedido.id,
                          () => pedidoRepo.resolverEdicao(pedido.id, aplicada),
                          aplicada ? `Edição do pedido #${pedido.numero} aplicada.` : `Edição do pedido #${pedido.numero} negada.`,
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
      )}

      <CancelamentoModal
        estado={cancelamento}
        aoMudarEtapa={setCancelamento}
        aoConcluir={texto => {
          setAviso({ tipo: 'ok', texto })
          void recarregar()
        }}
      />

      {configs && (
        <EditarItensModal
          pedido={pedidoEditando}
          ajuda="Mude as quantidades ou remova itens como o cliente pediu. Depois toque em “Aplicar edição” no card."
          permitirEsvaziar={false}
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
    </LayoutEquipe>
  )
}
