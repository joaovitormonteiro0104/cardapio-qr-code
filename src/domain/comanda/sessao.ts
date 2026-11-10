// Comanda inativa (AGENTS.md §6.11, PRD OPE-10). Puro.
import { MS_POR_HORA, type ConfigsTempo } from '../config'
import type { PedidoCalculo } from '../pedido/calculo'
import { podeFecharComanda, type EstadoComanda } from './estado'

export interface ComandaNoTempo {
  estado: EstadoComanda
  ultimaAtividadeEm: Date
}

/** Sem atividade há timeout_sessao_mesa_h horas ou mais (e ainda não fechada). */
export function comandaInativa(
  comanda: ComandaNoTempo,
  configs: Pick<ConfigsTempo, 'timeoutSessaoMesaH'>,
  agora: Date,
): boolean {
  if (comanda.estado === 'Fechada') return false
  return agora.getTime() - comanda.ultimaAtividadeEm.getTime() >= configs.timeoutSessaoMesaH * MS_POR_HORA
}

/**
 * Inativa pode fechar sozinha se estiver paga (ou com total zero) e sem
 * pedidos pendentes — o mesmo critério do fechamento manual. Caso contrário,
 * fica destacada para o garçom.
 */
export function podeFecharAutomaticamente(comanda: ComandaNoTempo, pedidos: readonly PedidoCalculo[]): boolean {
  return podeFecharComanda(comanda.estado, pedidos)
}
