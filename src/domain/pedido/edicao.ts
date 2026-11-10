// Janela livre de edição/cancelamento pelo cliente (AGENTS.md §6.5). Puro.
import { MS_POR_MINUTO, type ConfigsTempo } from '../config'
import type { EstadoPedido } from './estado'

export interface PedidoNoTempo {
  estado: EstadoPedido
  estadoDesde: Date
}

export type AcaoCliente = 'editar_livre' | 'solicitar_edicao' | 'bloqueado'

/**
 * Janela aberta: estado Recebido, OU Preparando há MENOS de
 * janela_edicao_preparando_min minutos. No limite exato, já está fechada (<).
 */
export function dentroDaJanelaLivre(
  pedido: PedidoNoTempo,
  configs: Pick<ConfigsTempo, 'janelaEdicaoPreparandoMin'>,
  agora: Date,
): boolean {
  if (pedido.estado === 'Recebido') return true
  if (pedido.estado !== 'Preparando') return false
  const decorrido = agora.getTime() - pedido.estadoDesde.getTime()
  return decorrido < configs.janelaEdicaoPreparandoMin * MS_POR_MINUTO
}

/** Fim da janela (pra mostrar contagem regressiva). null se não houver janela com prazo. */
export function fimDaJanelaLivre(
  pedido: PedidoNoTempo,
  configs: Pick<ConfigsTempo, 'janelaEdicaoPreparandoMin'>,
): Date | null {
  if (pedido.estado !== 'Preparando') return null
  return new Date(pedido.estadoDesde.getTime() + configs.janelaEdicaoPreparandoMin * MS_POR_MINUTO)
}

/**
 * O que o cliente pode fazer com o pedido agora:
 *  - editar_livre: editar quantidades, remover itens, cancelar
 *  - solicitar_edicao: só "chamar garçom" (vai pra EdicaoSolicitada)
 *  - bloqueado: nada (Entregue, Finalizado, Cancelado ou já num temporário)
 */
export function acaoDisponivel(
  pedido: PedidoNoTempo,
  configs: Pick<ConfigsTempo, 'janelaEdicaoPreparandoMin'>,
  agora: Date,
): AcaoCliente {
  if (dentroDaJanelaLivre(pedido, configs, agora)) return 'editar_livre'
  if (pedido.estado === 'Preparando' || pedido.estado === 'Pronto') return 'solicitar_edicao'
  return 'bloqueado'
}

/**
 * Quem pode mexer nos itens (quantidade/remover) agora:
 *  - cliente: só dentro da janela livre
 *  - funcionário: só com o pedido em EdicaoSolicitada (garçom aplicando a edição)
 */
export function podeEditarItens(
  pedido: PedidoNoTempo,
  quem: 'cliente' | 'funcionario',
  configs: Pick<ConfigsTempo, 'janelaEdicaoPreparandoMin'>,
  agora: Date,
): boolean {
  if (quem === 'funcionario') return pedido.estado === 'EdicaoSolicitada'
  return dentroDaJanelaLivre(pedido, configs, agora)
}

/**
 * Remover este item deixa o pedido sem nenhum item ativo? Nesse caso a
 * remoção vira cancelamento do pedido inteiro (mesmas regras, §6.5).
 */
export function remocaoEsvaziaPedido(
  itens: readonly { id: string; removidoEm: Date | null }[],
  itemId: string,
): boolean {
  return itens.every(item => item.id === itemId || item.removidoEm !== null)
}
