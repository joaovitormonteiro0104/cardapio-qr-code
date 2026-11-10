// Cancelamento pela cozinha (AGENTS.md §6.6). Puro.
import type { EstadoPedido } from './estado'

export const MOTIVOS_CANCELAMENTO = [
  'sem_ingrediente',
  'erro_de_pedido',
  'cliente_desistiu',
  'atraso',
  'outro',
] as const

export type MotivoCancelamento = (typeof MOTIVOS_CANCELAMENTO)[number]

export const ROTULOS_MOTIVO: Record<MotivoCancelamento, string> = {
  sem_ingrediente: 'Sem ingrediente',
  erro_de_pedido: 'Erro no pedido',
  cliente_desistiu: 'Cliente desistiu',
  atraso: 'Atraso',
  outro: 'Outro',
}

export const TEXTO_MOTIVO_MAX = 300

/** Cozinha pode iniciar cancelamento? Nunca em Entregue, Finalizado ou Cancelado. */
export function podeCancelar(pedido: { estado: EstadoPedido }): boolean {
  return pedido.estado === 'Recebido' || pedido.estado === 'Preparando' || pedido.estado === 'Pronto'
}

/** Recebido cancela em 1 etapa; Preparando e Pronto exigem 2. */
export function precisaDuasEtapas(pedido: { estado: EstadoPedido }): boolean {
  return pedido.estado === 'Preparando' || pedido.estado === 'Pronto'
}

export type ProblemaMotivo = 'motivo_invalido' | 'texto_obrigatorio' | 'texto_longo'

/** null = motivo aceito. Texto livre é obrigatório quando o motivo é "outro". */
export function validaMotivo(motivo: string, textoLivre?: string | null): ProblemaMotivo | null {
  if (!(MOTIVOS_CANCELAMENTO as readonly string[]).includes(motivo)) return 'motivo_invalido'
  const texto = (textoLivre ?? '').trim()
  if (texto.length > TEXTO_MOTIVO_MAX) return 'texto_longo'
  if (motivo === 'outro' && texto.length === 0) return 'texto_obrigatorio'
  return null
}

/**
 * Confirmação explícita da 2ª etapa: o número digitado tem que bater com o do
 * pedido (espaços e "#" ignorados).
 */
export function confirmacaoPorNumeroValida(digitado: string, numeroPedido: number): boolean {
  const limpo = digitado.replace(/[\s#]/g, '')
  return /^\d+$/.test(limpo) && Number(limpo) === numeroPedido
}

/** Texto gravado em eventos_auditoria.motivo: "erro_de_pedido: cliente pediu errado". */
export function motivoParaRegistro(motivo: MotivoCancelamento, textoLivre?: string | null): string {
  const texto = (textoLivre ?? '').trim()
  return texto ? `${motivo}: ${texto}` : motivo
}
