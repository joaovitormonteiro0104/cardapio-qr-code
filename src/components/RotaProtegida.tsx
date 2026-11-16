import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { Papel } from '@/schemas/auth'
import { Carregando } from './Carregando'

interface Props {
  papeis: readonly Papel[]
  children: ReactNode
}

/**
 * Só renderiza o conteúdo para funcionário com um dos papéis. Sem login vai
 * pro /login; logado sem permissão (operação abrindo /gerencia) vai para a
 * própria tela inicial. Mandar este para o /login criava um loop: o login
 * devolve quem já está logado para a página de onde veio.
 */
export function RotaProtegida({ papeis, children }: Props) {
  const { carregando, papel } = useAuth()
  const local = useLocation()

  if (carregando) return <Carregando />
  if (!papel) return <Navigate to="/login" replace state={{ de: local.pathname }} />
  if (!papeis.includes(papel)) return <Navigate to="/cozinha" replace />
  return <>{children}</>
}
