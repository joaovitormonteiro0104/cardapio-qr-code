import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { Papel } from '@/schemas/auth'
import { Carregando } from './Carregando'

interface Props {
  papeis: readonly Papel[]
  children: ReactNode
}

/** Só renderiza o conteúdo para funcionário com um dos papéis; senão vai pro /login. */
export function RotaProtegida({ papeis, children }: Props) {
  const { carregando, papel } = useAuth()
  const local = useLocation()

  if (carregando) return <Carregando />
  if (!papel || !papeis.includes(papel)) {
    return <Navigate to="/login" replace state={{ de: local.pathname }} />
  }
  return <>{children}</>
}
