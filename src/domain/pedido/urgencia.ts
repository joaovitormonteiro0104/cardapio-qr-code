// Urgência de um pedido na tela da cozinha (revisão de design, 2026-11-12). Puro.
// Em "Recebido", o pedido é cancelado sozinho depois de
// timeout_auto_cancelamento_min (§6.5): a cozinha vê o prazo se aproximando.
import { MS_POR_MINUTO, type ConfigsTempo } from '../config'
import type { EstadoComanda } from '../comanda/estado'
import type { EstadoPedido } from './estado'

export type NivelUrgencia = 'normal' | 'atencao' | 'critico'

export interface Urgencia {
  nivel: NivelUrgencia
  /** Minutos inteiros que faltam para o cancelamento automático (só em Recebido com conta aberta). */
  minutosParaCancelar: number | null
}

/** A partir desta fração do prazo, o pedido pede atenção. */
const FRACAO_ATENCAO = 0.6
/** Nos últimos minutos, vira crítico. */
const MINUTOS_CRITICO = 3

export function urgenciaPedido(
  pedido: { estado: EstadoPedido; estadoDesde: Date; estadoComanda: EstadoComanda },
  configs: Pick<ConfigsTempo, 'timeoutAutoCancelamentoMin'>,
  agora: Date,
): Urgencia {
  if (pedido.estado !== 'Recebido' || pedido.estadoComanda !== 'Aberta') return { nivel: 'normal', minutosParaCancelar: null }
  const prazoMs = configs.timeoutAutoCancelamentoMin * MS_POR_MINUTO
  const decorrido = agora.getTime() - pedido.estadoDesde.getTime()
  const restanteMs = Math.max(0, prazoMs - decorrido)
  const minutosParaCancelar = Math.ceil(restanteMs / MS_POR_MINUTO)
  if (restanteMs <= MINUTOS_CRITICO * MS_POR_MINUTO) return { nivel: 'critico', minutosParaCancelar }
  if (decorrido >= prazoMs * FRACAO_ATENCAO) return { nivel: 'atencao', minutosParaCancelar }
  return { nivel: 'normal', minutosParaCancelar }
}
