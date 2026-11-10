import { createContext, useContext } from 'react'
import type { UsuarioAtual } from '@/repositories/authRepo'
import type { Papel } from '@/schemas/auth'

export interface EstadoAuth {
  carregando: boolean
  usuario: UsuarioAtual | null
  /** null = não é funcionário ativo (cliente anônimo ou deslogado). */
  papel: Papel | null
  entrarComoFuncionario: (matricula: string, pin: string) => Promise<Papel>
  sair: () => Promise<void>
}

export const AuthContext = createContext<EstadoAuth | null>(null)

/** Lê a sessão atual. Só funciona dentro do <AuthProvider>. */
export function useAuth(): EstadoAuth {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return contexto
}
