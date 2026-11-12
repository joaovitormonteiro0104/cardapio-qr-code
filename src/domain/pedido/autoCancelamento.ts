// Auto-cancelamento de pedidos não aceitos (AGENTS.md §6.5 e §6.11). Puro.
import { MS_POR_MINUTO, type ConfigsTempo } from '../config'
import type { EstadoComanda } from '../comanda/estado'
import type { EstadoPedido } from './estado'

export interface PedidoExpiravel {
  id: string
  estado: EstadoPedido
  estadoDesde: Date
  /** Conta que já avisou o pagamento não tem pedidos cancelados sozinhos (decisão 20). */
  estadoComanda: EstadoComanda
}

/**
 * Pedido em Recebido há timeout_auto_cancelamento_min minutos ou mais.
 * (Mesmo critério da janela de edição: no limite exato, já expirou.)
 */
export function pedidoExpirado(
  pedido: Omit<PedidoExpiravel, 'id'>,
  configs: Pick<ConfigsTempo, 'timeoutAutoCancelamentoMin'>,
  agora: Date,
): boolean {
  if (pedido.estado !== 'Recebido' || pedido.estadoComanda !== 'Aberta') return false
  return agora.getTime() - pedido.estadoDesde.getTime() >= configs.timeoutAutoCancelamentoMin * MS_POR_MINUTO
}

export function pedidosExpirados<T extends PedidoExpiravel>(
  pedidos: readonly T[],
  configs: Pick<ConfigsTempo, 'timeoutAutoCancelamentoMin'>,
  agora: Date,
): T[] {
  return pedidos.filter(pedido => pedidoExpirado(pedido, configs, agora))
}
