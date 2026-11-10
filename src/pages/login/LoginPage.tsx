import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ErroLogin } from '@/repositories/authRepo'
import { LoginSchema, type Papel } from '@/schemas/auth'

const MENSAGENS: Record<ErroLogin['motivo'], string> = {
  // Igual para matrícula inexistente, PIN errado ou funcionário desativado.
  credenciais: 'Matrícula ou PIN incorretos.',
  limite: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  rede: 'Não foi possível conectar. Verifique a internet e tente de novo.',
}

function destinoPadrao(papel: Papel): string {
  return papel === 'gerencia' ? '/gerencia' : '/cozinha'
}

function lerDestino(estado: unknown): string | null {
  if (typeof estado === 'object' && estado !== null && 'de' in estado && typeof estado.de === 'string') {
    return estado.de
  }
  return null
}

export default function LoginPage() {
  const { papel, carregando, entrarComoFuncionario } = useAuth()
  const navegar = useNavigate()
  const local = useLocation()
  const destino = lerDestino(local.state)

  const [matricula, setMatricula] = useState('')
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (!carregando && papel) return <Navigate to={destino ?? destinoPadrao(papel)} replace />

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro(null)

    const validacao = LoginSchema.safeParse({ matricula, pin })
    if (!validacao.success) {
      setErro(validacao.error.issues[0]?.message ?? 'Confira a matrícula e o PIN.')
      return
    }

    setEnviando(true)
    try {
      const novoPapel = await entrarComoFuncionario(validacao.data.matricula, validacao.data.pin)
      navegar(destino ?? destinoPadrao(novoPapel), { replace: true })
    } catch (falha) {
      console.error(falha)
      setErro(falha instanceof ErroLogin ? MENSAGENS[falha.motivo] : MENSAGENS.rede)
      setPin('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight">Acesso da equipe</h1>
        <p className="mt-1 text-tinta-suave">Entre com sua matrícula e o PIN de 6 números.</p>

        <form onSubmit={enviar} noValidate className="mt-8 space-y-5">
          <div>
            <label htmlFor="matricula" className="rotulo">
              Matrícula
            </label>
            <input
              id="matricula"
              name="username"
              className="campo text-lg tracking-wider"
              inputMode="numeric"
              autoComplete="username"
              maxLength={6}
              value={matricula}
              onChange={e => setMatricula(e.target.value.replace(/\D/g, ''))}
              autoFocus
              required
            />
          </div>

          <div>
            <label htmlFor="pin" className="rotulo">
              PIN
            </label>
            <input
              id="pin"
              name="password"
              type="password"
              className="campo text-lg tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>

          <p role="alert" aria-live="assertive" className="min-h-6 text-sm font-medium text-perigo">
            {erro}
          </p>

          <button type="submit" className="botao-primario w-full text-lg" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}
