/** PIN de 6 dígitos sorteado com o gerador seguro do navegador. */
export function gerarPin(): string {
  const valores = new Uint32Array(6)
  crypto.getRandomValues(valores)
  return Array.from(valores, v => String(v % 10)).join('')
}
