// Regras da gestão de equipe (AGENTS.md §6.9, item 14). Puro, SEM imports:
// a Edge Function "equipe" importa este mesmo arquivo para aplicar a regra no
// servidor também.

export interface FuncionarioRegra {
  id: string
  usuarioId: string
  papel: 'operacao' | 'gerencia'
  ativo: boolean
}

export type MotivoNaoDesativa = 'ja_inativo' | 'si_mesmo' | 'ultimo_gerente'

/**
 * Por que não dá para desativar `alvo` (null = pode):
 *  - gerente não desativa a si mesmo
 *  - não pode sobrar nenhum gerente ativo
 */
export function motivoNaoPodeDesativar(
  alvo: FuncionarioRegra,
  usuarioSolicitante: string,
  equipe: readonly FuncionarioRegra[],
): MotivoNaoDesativa | null {
  if (!alvo.ativo) return 'ja_inativo'
  if (alvo.usuarioId === usuarioSolicitante) return 'si_mesmo'
  if (alvo.papel === 'gerencia') {
    const gerentesAtivos = equipe.filter(f => f.papel === 'gerencia' && f.ativo).length
    if (gerentesAtivos <= 1) return 'ultimo_gerente'
  }
  return null
}

export const MENSAGENS_NAO_DESATIVA: Record<MotivoNaoDesativa, string> = {
  ja_inativo: 'Este funcionário já está desativado.',
  si_mesmo: 'Você não pode desativar o próprio acesso.',
  ultimo_gerente: 'Não é possível desativar o último gerente ativo.',
}

export type MotivoNaoMudaPapel = 'inativo' | 'mesmo_papel' | 'si_mesmo' | 'ultimo_gerente'

/**
 * Por que não dá para mudar o papel de `alvo` para `novoPapel` (null = pode):
 *  - só funcionário ativo
 *  - gerente não rebaixa a si mesmo
 *  - não pode sobrar nenhum gerente ativo
 */
export function motivoNaoPodeMudarPapel(
  alvo: FuncionarioRegra,
  novoPapel: 'operacao' | 'gerencia',
  usuarioSolicitante: string,
  equipe: readonly FuncionarioRegra[],
): MotivoNaoMudaPapel | null {
  if (!alvo.ativo) return 'inativo'
  if (alvo.papel === novoPapel) return 'mesmo_papel'
  if (alvo.papel === 'gerencia') {
    if (alvo.usuarioId === usuarioSolicitante) return 'si_mesmo'
    const gerentesAtivos = equipe.filter(f => f.papel === 'gerencia' && f.ativo).length
    if (gerentesAtivos <= 1) return 'ultimo_gerente'
  }
  return null
}

export const MENSAGENS_NAO_MUDA_PAPEL: Record<MotivoNaoMudaPapel, string> = {
  inativo: 'Reative o funcionário antes de mudar o papel.',
  mesmo_papel: 'O funcionário já tem esse papel.',
  si_mesmo: 'Você não pode tirar a própria gerência.',
  ultimo_gerente: 'Não é possível rebaixar o último gerente ativo.',
}
