export const NOME_ITEM_MAX = 100
export const NOME_CATEGORIA_MAX = 60
export const FOTO_TAMANHO_MAX_BYTES = 2 * 1024 * 1024
export const FOTO_TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'] as const

export function nomeItemValido(nome: string): boolean {
  const limpo = nome.trim()
  return limpo.length >= 1 && limpo.length <= NOME_ITEM_MAX
}

export function nomeCategoriaValido(nome: string): boolean {
  const limpo = nome.trim()
  return limpo.length >= 1 && limpo.length <= NOME_CATEGORIA_MAX
}

/** Preço em centavos: inteiro e maior que zero. */
export function precoValido(centavos: number | null): centavos is number {
  return centavos !== null && Number.isInteger(centavos) && centavos > 0
}

export type ProblemaFoto = 'tipo' | 'tamanho'

/** null = foto aceita. */
export function problemaFoto(tipo: string, tamanhoBytes: number): ProblemaFoto | null {
  if (!(FOTO_TIPOS_ACEITOS as readonly string[]).includes(tipo)) return 'tipo'
  if (tamanhoBytes > FOTO_TAMANHO_MAX_BYTES) return 'tamanho'
  return null
}

/**
 * Move o elemento da posição `de` para `para`, devolvendo uma lista nova.
 * Índices fora da lista devolvem a lista original (cópia).
 */
export function mover<T>(lista: readonly T[], de: number, para: number): T[] {
  const copia = [...lista]
  if (de < 0 || de >= copia.length || para < 0 || para >= copia.length || de === para) return copia
  const [elemento] = copia.splice(de, 1)
  if (elemento === undefined) return [...lista]
  copia.splice(para, 0, elemento)
  return copia
}
