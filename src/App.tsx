import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/components/AuthProvider'
import { LayoutEquipe } from '@/components/LayoutEquipe'
import { RotaProtegida } from '@/components/RotaProtegida'
import LoginPage from '@/pages/login/LoginPage'

const OPERACAO = ['operacao', 'gerencia'] as const
const GERENCIA = ['gerencia'] as const

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/cozinha"
          element={
            <RotaProtegida papeis={OPERACAO}>
              <LayoutEquipe titulo="Pedidos">
                <p className="text-tinta-suave">O painel de pedidos chega no item 7.</p>
              </LayoutEquipe>
            </RotaProtegida>
          }
        />

        <Route path="/gerencia" element={<Navigate to="/gerencia/cardapio" replace />} />
        <Route
          path="/gerencia/*"
          element={
            <RotaProtegida papeis={GERENCIA}>
              <LayoutEquipe titulo="Gerência">
                <p className="text-tinta-suave">As telas da gerência chegam nos próximos itens.</p>
              </LayoutEquipe>
            </RotaProtegida>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
