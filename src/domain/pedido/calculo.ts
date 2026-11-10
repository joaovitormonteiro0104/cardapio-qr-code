// Totais em centavos (AGENTS.md §6.2). Puro.
import type { EstadoPedido } from './estado'

export interface LinhaCalculo {
  quantidade: number
  precoCentavosSnapshot: number
  removidoEm: Date | null
}

export interface PedidoCalculo {
  estado: EstadoPedido
  itens: readonly LinhaCalculo[]
}

export function subtotalLinha(linha: LinhaCalculo): number {
  return linha.removidoEm ? 0 : linha.quantidade * linha.precoCentavosSnapshot
}

/** Soma dos itens não removidos. Não olha o estado (use totalComanda pra isso). */
export function totalPedido(pedido: Pick<PedidoCalculo, 'itens'>): number {
  return pedido.itens.reduce((soma, linha) => soma + subtotalLinha(linha), 0)
}

/** Soma dos pedidos não cancelados (itens removidos não contam). */
export function totalComanda(pedidos: readonly PedidoCalculo[]): number {
  return pedidos.filter(p => p.estado !== 'Cancelado').reduce((soma, p) => soma + totalPedido(p), 0)
}

export interface ItemCarrinho {
  itemId: string
  quantidade: number
  precoCentavos: number
}

export function totalCarrinho(itens: readonly ItemCarrinho[]): number {
  return itens.reduce((soma, item) => soma + item.quantidade * item.precoCentavos, 0)
}

export function quantidadeCarrinho(itens: readonly ItemCarrinho[]): number {
  return itens.reduce((soma, item) => soma + item.quantidade, 0)
}

/** Itens que contam (não removidos). Pedido com zero itens ativos é "vazio". */
export function itensAtivos<T extends Pick<LinhaCalculo, 'removidoEm'>>(itens: readonly T[]): T[] {
  return itens.filter(item => !item.removidoEm)
}
