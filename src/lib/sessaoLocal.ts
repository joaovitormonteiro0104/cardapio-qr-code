// Conveniências da UI do cliente no localStorage, chave sessao-mesa-{numero}
// (AGENTS.md §6.1). A sessão de Auth é guardada pelo próprio SDK.
// Tudo protegido por try/catch: aba anônima ou armazenamento bloqueado não quebra o app.

export interface SessaoLocal {
  nome: string
  carrinho: { itemId: string; quantidade: number }[]
}

const VAZIA: SessaoLocal = { nome: '', carrinho: [] }

function chave(numeroMesa: number): string {
  return `sessao-mesa-${numeroMesa}`
}

export function lerSessaoLocal(numeroMesa: number): SessaoLocal {
  try {
    const texto = localStorage.getItem(chave(numeroMesa))
    if (!texto) return VAZIA
    const dados: unknown = JSON.parse(texto)
    if (typeof dados !== 'object' || dados === null) return VAZIA
    const nome = 'nome' in dados && typeof dados.nome === 'string' ? dados.nome : ''
    const bruto = 'carrinho' in dados && Array.isArray(dados.carrinho) ? (dados.carrinho as unknown[]) : []
    const carrinho = bruto.flatMap(item => {
      if (typeof item !== 'object' || item === null) return []
      const { itemId, quantidade } = item as Record<string, unknown>
      return typeof itemId === 'string' && typeof quantidade === 'number' && Number.isInteger(quantidade) && quantidade > 0
        ? [{ itemId, quantidade }]
        : []
    })
    return { nome, carrinho }
  } catch {
    return VAZIA
  }
}

export function salvarSessaoLocal(numeroMesa: number, sessao: SessaoLocal): void {
  try {
    localStorage.setItem(chave(numeroMesa), JSON.stringify(sessao))
  } catch {
    // sem armazenamento: segue só em memória
  }
}
