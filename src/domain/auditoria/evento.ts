// Tipos e construtores de eventos de auditoria (AGENTS.md §6.10). Puro, sem I/O.

export type AtorTipo = 'cliente' | 'funcionario' | 'sistema'

export interface Ator {
  tipo: AtorTipo
  /** matrícula do funcionário, auth.uid() do cliente, ou null pro sistema */
  id: string | null
}

export const ATOR_SISTEMA: Ator = { tipo: 'sistema', id: null }

export const TIPOS_EVENTO = [
  // cardápio
  'categoria_criada',
  'categoria_atualizada',
  'categorias_reordenadas',
  'item_cardapio_criado',
  'item_cardapio_atualizado',
  'item_cardapio_esgotado',
  'item_cardapio_reativado',
  'item_cardapio_removido',
  'item_cardapio_restaurado',
  // comanda
  'comanda_aberta',
  'cliente_entrou',
  'comanda_observacao_editada',
  'comanda_estado_alterado',
  'comanda_fechada',
  // pedido
  'pedido_criado',
  'pedido_estado_alterado',
  'pedido_cancelado',
  'pedido_cancelamento_solicitado',
  'pedido_cancelamento_desistido',
  'pedido_edicao_solicitada',
  'pedido_edicao_aplicada',
  'pedido_edicao_negada',
  // item do pedido
  'item_pedido_quantidade_alterada',
  'item_pedido_removido',
  // gestão
  'configuracao_alterada',
  'mesa_criada',
  'mesa_atualizada',
  'funcionario_criado',
  'funcionario_pin_trocado',
  'funcionario_desativado',
  'funcionario_reativado',
  'funcionario_papel_alterado',
  // correção de evento anterior (payload.corrige_id)
  'correcao',
] as const

export type TipoEvento = (typeof TIPOS_EVENTO)[number]

export type ValorJson = string | number | boolean | null | ValorJson[] | { [chave: string]: ValorJson }
export type PayloadEvento = { [chave: string]: ValorJson }

export interface NovoEvento {
  tipoEvento: TipoEvento
  ator: Ator
  comandaId: string | null
  pedidoId: string | null
  payload: PayloadEvento
  motivo: string | null
}

interface Opcoes {
  comandaId?: string | null
  pedidoId?: string | null
  payload?: PayloadEvento
  motivo?: string | null
}

/** Construtor genérico: preenche os opcionais com null/{}. */
export function criarEvento(tipoEvento: TipoEvento, ator: Ator, opcoes: Opcoes = {}): NovoEvento {
  return {
    tipoEvento,
    ator,
    comandaId: opcoes.comandaId ?? null,
    pedidoId: opcoes.pedidoId ?? null,
    payload: opcoes.payload ?? {},
    motivo: opcoes.motivo ?? null,
  }
}
