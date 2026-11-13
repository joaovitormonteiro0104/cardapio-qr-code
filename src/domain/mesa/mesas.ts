// Regras da tela de mesas da gerência (revisão de design, 2026-11-13). Puro.

export const MESA_MIN = 1
export const MESA_MAX = 9999
/** Quantas mesas dá para criar de uma vez ("1-15"). */
export const MESAS_POR_VEZ_MAX = 100

export type ResultadoNumeros = { numeros: number[] } | { erro: string }

/** "7" → [7]; "1-15" ou "1 a 15" → [1..15]. */
export function interpretarNumerosMesa(texto: string): ResultadoNumeros {
  const limpo = texto.trim().toLowerCase()
  const intervalo = /^(\d+)\s*(?:-|a|até)\s*(\d+)$/.exec(limpo)
  const unico = /^\d+$/.exec(limpo)
  if (!intervalo && !unico) return { erro: 'Digite um número (ex.: 7) ou um intervalo (ex.: 1-15).' }
  const de = Number(intervalo ? intervalo[1] : limpo)
  const ate = Number(intervalo ? intervalo[2] : limpo)
  if (de < MESA_MIN || ate > MESA_MAX || de > ate) return { erro: `Use números de ${MESA_MIN} a ${MESA_MAX}, do menor para o maior.` }
  if (ate - de + 1 > MESAS_POR_VEZ_MAX) return { erro: `Crie no máximo ${MESAS_POR_VEZ_MAX} mesas de uma vez.` }
  return { numeros: Array.from({ length: ate - de + 1 }, (_, i) => de + i) }
}

/** Menor número livre depois do maior já cadastrado (1 se não houver mesas). */
export function proximoNumeroLivre(existentes: readonly number[]): number {
  return existentes.length === 0 ? 1 : Math.min(MESA_MAX, Math.max(...existentes) + 1)
}

/**
 * O endereço de onde a página está aberta vai dentro do QR. Se for o
 * computador local ou a rede interna, o QR não abre no celular do cliente.
 */
export function enderecoServeParaQr(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h === '::1' || h === '[::1]') return false
  const ip = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h)
  if (ip) {
    const [a, b] = [Number(ip[1]), Number(ip[2])]
    if (a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)) return false
  }
  return true
}
