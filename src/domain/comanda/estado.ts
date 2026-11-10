// Estados da comanda (AGENTS.md §6.4). Puro.
import { totalComanda, type PedidoCalculo } from '../pedido/calculo'
import { ehPendente } from '../pedido/estado'

export type EstadoComanda = 'Aberta' | 'AguardandoPagamento' | 'Paga' | 'Fechada'

export const ESTADOS_COMANDA: readonly EstadoComanda[] = ['Aberta', 'AguardandoPagamento', 'Paga', 'Fechada']

const TRANSICOES: Record<EstadoComanda, readonly EstadoComanda[]> = {
  Aberta: ['AguardandoPagamento', 'Fechada'], // Fechada só com total zero (podeFecharComanda)
  AguardandoPagamento: ['Aberta', 'Paga'], // caixa reabre ou confirma
  Paga: ['Fechada'],
  Fechada: [],
}

export function transicaoComandaValida(de: EstadoComanda, para: EstadoComanda): boolean {
  return TRANSICOES[de].includes(para)
}

/** Só comanda Aberta recebe pedidos novos (PRD CLI-11). */
export function aceitaNovosPedidos(estado: EstadoComanda): boolean {
  return estado === 'Aberta'
}

/** Cliente pode tocar "já paguei": comanda Aberta com valor a pagar. */
export function podeInformarPagamento(estado: EstadoComanda, pedidos: readonly PedidoCalculo[]): boolean {
  return estado === 'Aberta' && totalComanda(pedidos) > 0
}

export function temPedidoPendente(pedidos: readonly Pick<PedidoCalculo, 'estado'>[]): boolean {
  return pedidos.some(p => ehPendente(p.estado))
}

export type MotivoNaoFecha = 'pendentes' | 'nao_paga' | 'ja_fechada'

/**
 * Por que a comanda não pode ser fechada (null = pode).
 * Pode fechar se nenhum pedido estiver pendente E (estiver Paga, OU estiver
 * Aberta com total zero — todos os pedidos cancelados ou nenhum pedido).
 */
export function motivoNaoPodeFechar(
  estado: EstadoComanda,
  pedidos: readonly PedidoCalculo[],
): MotivoNaoFecha | null {
  if (estado === 'Fechada') return 'ja_fechada'
  if (temPedidoPendente(pedidos)) return 'pendentes'
  if (estado === 'Paga') return null
  if (estado === 'Aberta' && totalComanda(pedidos) === 0) return null
  return 'nao_paga'
}

export function podeFecharComanda(estado: EstadoComanda, pedidos: readonly PedidoCalculo[]): boolean {
  return motivoNaoPodeFechar(estado, pedidos) === null
}
