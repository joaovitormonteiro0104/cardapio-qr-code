import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/components/AuthProvider'
import { Carregando } from '@/components/Carregando'
import { LayoutEquipe } from '@/components/LayoutEquipe'
import { RotaProtegida } from '@/components/RotaProtegida'
import type { Papel } from '@/schemas/auth'

// Cada área carrega sob demanda: o celular do cliente não baixa o código da gerência.
const LoginPage = lazy(() => import('@/pages/login/LoginPage'))
const CardapioGerenciaPage = lazy(() => import('@/pages/gerencia/CardapioPage'))

const OPERACAO: readonly Papel[] = ['operacao', 'gerencia']
const GERENCIA: readonly Papel[] = ['gerencia']

function Protegida({ papeis, children }: { papeis: readonly Papel[]; children: ReactNode }) {
  return <RotaProtegida papeis={papeis}>{children}</RotaProtegida>
}

function EmBreve({ titulo, item }: { titulo: string; item: number }) {
  return (
    <LayoutEquipe titulo={titulo}>
      <p className="text-tinta-suave">Esta tela chega no item {item} do roadmap.</p>
    </LayoutEquipe>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<Carregando />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/cozinha"
            element={
              <Protegida papeis={OPERACAO}>
                <EmBreve titulo="Pedidos" item={7} />
              </Protegida>
            }
          />

          <Route path="/gerencia" element={<Navigate to="/gerencia/cardapio" replace />} />
          <Route
            path="/gerencia/cardapio"
            element={
              <Protegida papeis={GERENCIA}>
                <CardapioGerenciaPage />
              </Protegida>
            }
          />
          <Route
            path="/gerencia/*"
            element={
              <Protegida papeis={GERENCIA}>
                <EmBreve titulo="Gerência" item={11} />
              </Protegida>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
