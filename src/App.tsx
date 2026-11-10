import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/components/AuthProvider'
import { Carregando } from '@/components/Carregando'
import { ConfigProvider } from '@/components/ConfigProvider'
import { LayoutEquipe } from '@/components/LayoutEquipe'
import { RotaProtegida } from '@/components/RotaProtegida'
import type { Papel } from '@/schemas/auth'

// Cada área carrega sob demanda: o celular do cliente não baixa o código da gerência.
const LoginPage = lazy(() => import('@/pages/login/LoginPage'))
const MesaLayout = lazy(() => import('@/pages/mesa/MesaLayout'))
const CardapioClientePage = lazy(() => import('@/pages/mesa/CardapioPage'))
const ComandaPage = lazy(() => import('@/pages/mesa/ComandaPage'))
const CardapioGerenciaPage = lazy(() => import('@/pages/gerencia/CardapioPage'))
const PedidosCozinhaPage = lazy(() => import('@/pages/cozinha/PedidosPage'))
const AuditoriaPage = lazy(() => import('@/pages/gerencia/AuditoriaPage'))
const ContasPage = lazy(() => import('@/pages/cozinha/ContasPage'))
const PagamentoPage = lazy(() => import('@/pages/mesa/PagamentoPage'))
const ConfigPage = lazy(() => import('@/pages/gerencia/ConfigPage'))
const MesasPage = lazy(() => import('@/pages/gerencia/MesasPage'))

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
      <ConfigProvider>
        <Suspense fallback={<Carregando />}>
          <Routes>
            <Route path="/mesa/:numero" element={<MesaLayout />}>
              <Route index element={<CardapioClientePage />} />
              <Route path="comanda" element={<ComandaPage />} />
              <Route path="pagamento" element={<PagamentoPage />} />
            </Route>

            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/cozinha"
              element={
                <Protegida papeis={OPERACAO}>
                  <PedidosCozinhaPage />
                </Protegida>
              }
            />

            <Route
              path="/cozinha/contas"
              element={
                <Protegida papeis={OPERACAO}>
                  <ContasPage />
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
              path="/gerencia/config"
              element={
                <Protegida papeis={GERENCIA}>
                  <ConfigPage />
                </Protegida>
              }
            />
            <Route
              path="/gerencia/mesas"
              element={
                <Protegida papeis={GERENCIA}>
                  <MesasPage />
                </Protegida>
              }
            />
            <Route
              path="/gerencia/auditoria"
              element={
                <Protegida papeis={GERENCIA}>
                  <AuditoriaPage />
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
      </ConfigProvider>
    </AuthProvider>
  )
}
