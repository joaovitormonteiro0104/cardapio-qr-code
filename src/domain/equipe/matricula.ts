// Matrícula digitada no login (revisão de design do Login, 2026-11-12). Puro.
// Quem foi cadastrado como "001" costuma digitar "1" (e vice-versa). Em vez de
// mudar o cadastro, o login tenta as formas mais prováveis, nesta ordem.

const TAMANHO_COM_ZEROS = 3

/** Formas a tentar: como digitada, sem zeros à esquerda e com 3 dígitos. Sem repetição. */
export function variantesMatricula(digitada: string): string[] {
  const limpa = digitada.trim()
  if (!/^\d+$/.test(limpa)) return []
  const semZeros = limpa.replace(/^0+(?=\d)/, '')
  const comZeros = semZeros.padStart(TAMANHO_COM_ZEROS, '0')
  return [...new Set([limpa, semZeros, comZeros])]
}
