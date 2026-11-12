// Guarda o total do momento em que o cliente copiou o código Pix, por conta,
// no sessionStorage: sobrevive à ida ao app do banco e à troca de aba.
// try/catch: aba anônima ou armazenamento bloqueado não quebra o app.

function chave(comandaId: string): string {
  return `pix-copiado-${comandaId}`
}

export function lerValorCopiado(comandaId: string): number | null {
  try {
    const texto = sessionStorage.getItem(chave(comandaId))
    const valor = texto === null ? NaN : Number(texto)
    return Number.isInteger(valor) && valor > 0 ? valor : null
  } catch {
    return null
  }
}

export function salvarValorCopiado(comandaId: string, centavos: number): void {
  try {
    sessionStorage.setItem(chave(comandaId), String(centavos))
  } catch {
    // sem armazenamento: o aviso de total mudado só vale enquanto a tela estiver aberta
  }
}
