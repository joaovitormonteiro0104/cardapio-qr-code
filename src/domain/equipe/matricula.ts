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

/** "001", "01" e "1" são a mesma matrícula para quem digita: compara sem zeros à esquerda. */
function semZeros(matricula: string): string {
  return matricula.trim().replace(/^0+(?=\d)/, '')
}

/**
 * Matrícula já cadastrada que o login confundiria com `nova` (ex.: "1" e
 * "001"), ou null. O cadastro deve recusar, senão uma pessoa entra na conta
 * da outra ao digitar sem os zeros.
 */
export function matriculaEquivalente(nova: string, existentes: readonly string[]): string | null {
  const alvo = semZeros(nova)
  return existentes.find(m => semZeros(m) === alvo) ?? null
}

/** Próxima matrícula livre, com 3 dígitos (ex.: "004"); sem cadastro, "001". */
export function proximaMatriculaLivre(existentes: readonly string[]): string {
  const numeros = existentes.map(m => Number(semZeros(m))).filter(n => Number.isInteger(n))
  const proxima = (numeros.length ? Math.max(...numeros) : 0) + 1
  return String(proxima).padStart(TAMANHO_COM_ZEROS, '0')
}
