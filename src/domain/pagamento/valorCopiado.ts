// Conta dividida: o total pode mudar enquanto o cliente está no app do banco
// (revisão de design da tela Pagar, 2026-11-12). Puro.

export type SituacaoValorCopiado = 'nao_copiado' | 'igual' | 'mudou'

/** Compara o total do momento em que o código Pix foi copiado com o total de agora (centavos). */
export function situacaoValorCopiado(copiado: number | null, atual: number): SituacaoValorCopiado {
  if (copiado === null) return 'nao_copiado'
  return copiado === atual ? 'igual' : 'mudou'
}
