// Busca de item por nome na tela da gerência. Puro.

/** Minúsculas e sem acento: "Açaí" → "acai". */
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

/** O nome contém o termo buscado (ignorando acento e maiúsculas). Termo vazio casa com tudo. */
export function nomeCorresponde(nome: string, termo: string): boolean {
  const alvo = normalizarTexto(termo)
  return alvo === '' || normalizarTexto(nome).includes(alvo)
}
