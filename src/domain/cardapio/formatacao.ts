/**
 * Converte o texto digitado pela gerência em centavos inteiros.
 * Aceita "12,50", "12.50", "R$ 12,50", "1.234,56", "12", "0,5".
 * Regras de separador:
 *   - com "." e "," juntos: "." é milhar e "," é decimal ("1.234,56")
 *   - só ",": é decimal ("12,5")
 *   - só ".": é milhar se vier em grupos de 3 ("1.234" = 1234), senão decimal ("12.50")
 * Devolve null para texto inválido, negativo ou com mais de 2 casas decimais.
 */
export function parseReal(texto: string): number | null {
  const limpo = texto.replace(/R\$/gi, '').replace(/\s/g, '')
  if (limpo === '' || !/^[\d.,]+$/.test(limpo)) return null

  let normalizado: string
  if (limpo.includes(',') && limpo.includes('.')) {
    if (limpo.lastIndexOf('.') > limpo.lastIndexOf(',')) return null
    if (!/^\d{1,3}(\.\d{3})*,\d*$/.test(limpo)) return null
    normalizado = limpo.replace(/\./g, '').replace(',', '.')
  } else if (limpo.includes(',')) {
    normalizado = limpo.replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) {
    normalizado = limpo.replace(/\./g, '')
  } else {
    normalizado = limpo
  }

  const partes = /^(\d+)(?:\.(\d{0,2}))?$/.exec(normalizado)
  if (!partes) return null
  const reais = Number(partes[1])
  const centavos = Number((partes[2] ?? '').padEnd(2, '0'))
  const total = reais * 100 + centavos
  return Number.isSafeInteger(total) ? total : null
}

/** Centavos → texto pra preencher campo de edição ("1250" → "12,50"). */
export function centavosParaCampo(centavos: number): string {
  const reais = Math.trunc(centavos / 100)
  const resto = Math.abs(centavos % 100)
  return `${reais},${String(resto).padStart(2, '0')}`
}
