// Máquina de estados do pedido (AGENTS.md §6.3). Puro, sem I/O.

export type EstadoPedido =
  | 'Recebido'
  | 'Preparando'
  | 'Pronto'
  | 'Entregue'
  | 'Finalizado'
  | 'Cancelado'
  | 'EdicaoSolicitada'
  | 'CancelamentoPendente'

export const ESTADOS_PEDIDO: readonly EstadoPedido[] = [
  'Recebido',
  'Preparando',
  'Pronto',
  'Entregue',
  'Finalizado',
  'Cancelado',
  'EdicaoSolicitada',
  'CancelamentoPendente',
]

/** Estados para os quais um temporário pode voltar. */
export type EstadoRetornavel = 'Recebido' | 'Preparando' | 'Pronto'

export const ESTADOS_TEMPORARIOS: readonly EstadoPedido[] = ['EdicaoSolicitada', 'CancelamentoPendente']

/** Pedidos que ainda exigem ação: impedem fechar a comanda (§6.4). */
export const ESTADOS_PENDENTES: readonly EstadoPedido[] = [
  'Recebido',
  'Preparando',
  'Pronto',
  'EdicaoSolicitada',
  'CancelamentoPendente',
]

export interface SituacaoPedido {
  estado: EstadoPedido
  estadoAnterior: EstadoPedido | null // preenchido só nos estados temporários
}

const TRANSICOES: Record<EstadoPedido, readonly EstadoPedido[]> = {
  Recebido: ['Preparando', 'Cancelado', 'EdicaoSolicitada'],
  Preparando: ['Pronto', 'CancelamentoPendente', 'EdicaoSolicitada'],
  Pronto: ['Entregue', 'CancelamentoPendente', 'EdicaoSolicitada'],
  Entregue: ['Finalizado'],
  Finalizado: [],
  Cancelado: [],
  EdicaoSolicitada: ['Recebido', 'Preparando', 'Pronto'],
  CancelamentoPendente: ['Cancelado', 'Preparando', 'Pronto'],
}

export function transicaoValida(pedido: SituacaoPedido, para: EstadoPedido): boolean {
  if (!TRANSICOES[pedido.estado].includes(para)) return false
  // Estados temporários só podem voltar exatamente pra onde estavam
  if (pedido.estado === 'EdicaoSolicitada') return para === pedido.estadoAnterior
  if (pedido.estado === 'CancelamentoPendente') {
    return para === 'Cancelado' || para === pedido.estadoAnterior
  }
  return true
}

export function proximosEstados(pedido: SituacaoPedido): EstadoPedido[] {
  return TRANSICOES[pedido.estado].filter(para => transicaoValida(pedido, para))
}

export function ehTemporario(estado: EstadoPedido): boolean {
  return ESTADOS_TEMPORARIOS.includes(estado)
}

export function ehPendente(estado: EstadoPedido): boolean {
  return ESTADOS_PENDENTES.includes(estado)
}

export interface ResultadoTransicao {
  estado: EstadoPedido
  estadoAnterior: EstadoPedido | null
  estadoDesde: Date
}

export class TransicaoInvalidaError extends Error {
  constructor(de: EstadoPedido, para: EstadoPedido) {
    super(`Transição inválida: ${de} → ${para}`)
    this.name = 'TransicaoInvalidaError'
  }
}

/**
 * Calcula os novos valores ao mudar de estado:
 *  - entrando num temporário, grava de onde veio em estadoAnterior
 *  - saindo de um temporário (ou em qualquer outra mudança), estadoAnterior = null
 *  - estadoDesde = agora
 * Lança TransicaoInvalidaError se a transição não for permitida.
 */
export function aplicarTransicao(pedido: SituacaoPedido, para: EstadoPedido, agora: Date): ResultadoTransicao {
  if (!transicaoValida(pedido, para)) throw new TransicaoInvalidaError(pedido.estado, para)
  return {
    estado: para,
    estadoAnterior: ehTemporario(para) ? pedido.estado : null,
    estadoDesde: agora,
  }
}

/**
 * Exceção da janela livre (§6.5): o cliente cancela direto um pedido em
 * Preparando, sem passar por CancelamentoPendente. Só deve ser chamada por
 * edicao.ts depois de confirmar que a janela está aberta. Não afrouxa a tabela.
 */
export function aplicarCancelamentoPeloClienteNaJanela(
  pedido: SituacaoPedido,
  agora: Date,
): ResultadoTransicao {
  if (pedido.estado !== 'Recebido' && pedido.estado !== 'Preparando') {
    throw new TransicaoInvalidaError(pedido.estado, 'Cancelado')
  }
  return { estado: 'Cancelado', estadoAnterior: null, estadoDesde: agora }
}
