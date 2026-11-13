// Foto do item reduzida no próprio aparelho antes do envio (revisão de design
// do cardápio da gerência, 2026-11-12): foto da câmera do celular (3–6 MB)
// passa a caber no limite de 2 MB. Puro.

/** Lado maior da foto depois de reduzida, em pixels. */
export const FOTO_LADO_MAX = 1200

/** Novas dimensões mantendo a proporção; nunca aumenta a foto. */
export function dimensoesReduzidas(largura: number, altura: number, ladoMax = FOTO_LADO_MAX): { largura: number; altura: number } {
  const maior = Math.max(largura, altura)
  if (maior <= ladoMax || maior <= 0) return { largura, altura }
  const escala = ladoMax / maior
  return { largura: Math.round(largura * escala), altura: Math.round(altura * escala) }
}
