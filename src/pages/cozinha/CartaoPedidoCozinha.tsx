import { EstadoPedidoBadge } from '@/components/EstadoPedidoBadge'
import { itensAtivos } from '@/domain/pedido/calculo'
import { podeCancelar } from '@/domain/pedido/cancelamento'
import { proximosEstados, type EstadoPedido } from '@/domain/pedido/estado'
import { formatarDuracao } from '@/lib/formato'
import type { PedidoCozinha } from '@/repositories/pedidoRepo'

const ROTULO_AVANCO: Partial<Record<EstadoPedido, string>> = {
  Preparando: 'Aceitar',
  Pronto: 'Pronto',
  Entregue: 'Entregue',
}

interface Props {
  pedido: PedidoCozinha
  agora: Date
  ocupado: boolean
  aoAvancar: (para: EstadoPedido) => void
  aoCancelar: () => void
  aoConcluirCancelamento: () => void
  aoEditarItens: () => void
  aoResolverEdicao: (aplicada: boolean) => void
}

export function CartaoPedidoCozinha({
  pedido,
  agora,
  ocupado,
  aoAvancar,
  aoCancelar,
  aoConcluirCancelamento,
  aoEditarItens,
  aoResolverEdicao,
}: Props) {
  const tempo = formatarDuracao(agora.getTime() - pedido.estadoDesde.getTime())
  const avancos = proximosEstados(pedido).filter(e => ROTULO_AVANCO[e])
  const emEdicao = pedido.estado === 'EdicaoSolicitada'
  const emCancelamento = pedido.estado === 'CancelamentoPendente'
  const destaque = emEdicao
    ? 'ring-2 ring-brasa'
    : emCancelamento
      ? 'ring-2 ring-perigo'
      : 'ring-1 ring-borda'

  return (
    <article className={`flex flex-col rounded-2xl bg-superficie p-4 shadow-sm ${destaque}`} aria-label={`Pedido ${pedido.numero}, mesa ${pedido.mesaNumero}`}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-bold leading-none tabular-nums">Mesa {pedido.mesaNumero}</p>
          <p className="mt-1 text-sm tabular-nums text-tinta-suave">
            #{pedido.numero} · conta #{pedido.comandaNumero}
            {pedido.nomeCliente && <> · {pedido.nomeCliente}</>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <EstadoPedidoBadge estado={pedido.estado} />
          <span className="text-sm font-medium tabular-nums text-tinta-suave">{tempo}</span>
        </div>
      </header>

      {emEdicao && (
        <p className="mt-3 rounded-xl bg-brasa-clara px-3 py-2 text-sm font-medium text-brasa-forte">
          Cliente chamou o garçom para mudar este pedido.
        </p>
      )}
      {emCancelamento && (
        <p className="mt-3 rounded-xl bg-perigo-clara px-3 py-2 text-sm text-perigo">
          Cancelamento pendente{pedido.cancelamentoMotivo && <>: <strong>{pedido.cancelamentoMotivo}</strong></>}
        </p>
      )}

      <ul className="mt-3 flex-1 space-y-1.5">
        {itensAtivos(pedido.itens).map(item => (
          <li key={item.id} className="flex gap-2 text-base">
            <span className="min-w-8 font-bold tabular-nums">{item.quantidade}×</span>
            <span>{item.nomeSnapshot}</span>
          </li>
        ))}
      </ul>

      {pedido.observacao && (
        <p className="mt-3 rounded-xl bg-alerta-clara px-3 py-2 text-sm">
          <span className="font-semibold">Obs. da mesa:</span> {pedido.observacao}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {emEdicao ? (
          <>
            <button type="button" className="botao-secundario" disabled={ocupado} onClick={aoEditarItens}>
              Editar itens
            </button>
            <button type="button" className="botao-primario" disabled={ocupado} onClick={() => aoResolverEdicao(true)}>
              Aplicar edição
            </button>
            <button type="button" className="botao-secundario" disabled={ocupado} onClick={() => aoResolverEdicao(false)}>
              Negar
            </button>
          </>
        ) : emCancelamento ? (
          <button type="button" className="botao-perigo" disabled={ocupado} onClick={aoConcluirCancelamento}>
            Confirmar ou desistir
          </button>
        ) : (
          <>
            {avancos.map(para => (
              <button
                key={para}
                type="button"
                className="botao-primario flex-1 text-base"
                disabled={ocupado}
                onClick={() => aoAvancar(para)}
              >
                {ROTULO_AVANCO[para]}
              </button>
            ))}
            {podeCancelar(pedido) && (
              <button type="button" className="botao-secundario text-perigo" disabled={ocupado} onClick={aoCancelar}>
                Cancelar
              </button>
            )}
          </>
        )}
      </div>
    </article>
  )
}
