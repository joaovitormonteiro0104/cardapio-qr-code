import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authRepo from '@/repositories/authRepo'
import { AuthContext, type EstadoAuth } from '@/hooks/useAuth'
import type { Papel } from '@/schemas/auth'

/** Mantém usuário e papel atuais e os expõe via useAuth(). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true)
  const [usuario, setUsuario] = useState<authRepo.UsuarioAtual | null>(null)
  const [papel, setPapel] = useState<Papel | null>(null)

  const recarregar = useCallback(async (novoUsuario: authRepo.UsuarioAtual | null) => {
    setUsuario(novoUsuario)
    try {
      setPapel(novoUsuario && !novoUsuario.anonimo ? await authRepo.getPapelAtual() : null)
    } catch (erro) {
      console.error(erro)
      setPapel(null)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    // O callback do Supabase não pode chamar o SDK de forma síncrona (trava a
    // fila interna de auth). Por isso o setTimeout(0) antes de recarregar.
    const cancelar = authRepo.assinarMudancasDeSessao(novo => {
      setTimeout(() => void recarregar(novo), 0)
    })
    return cancelar
  }, [recarregar])

  const entrarComoFuncionario = useCallback(async (matricula: string, pin: string) => {
    const novoPapel = await authRepo.entrarComoFuncionario(matricula, pin)
    setPapel(novoPapel)
    return novoPapel
  }, [])

  const sair = useCallback(async () => {
    await authRepo.sair()
    setPapel(null)
  }, [])

  const valor = useMemo<EstadoAuth>(
    () => ({ carregando, usuario, papel, entrarComoFuncionario, sair }),
    [carregando, usuario, papel, entrarComoFuncionario, sair],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
