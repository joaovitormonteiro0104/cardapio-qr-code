import { useEffect, useRef, useState, type FormEvent } from 'react'
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

const TAMANHO_PIN = 6

type Campo = 'matricula' | 'pin'

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
  const [mostrarPin, setMostrarPin] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [campoErro, setCampoErro] = useState<Campo | null>(null)
  const [enviando, setEnviando] = useState(false)
  const campoMatricula = useRef<HTMLInputElement>(null)
  const campoPin = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = 'Acesso da equipe'
  }, [])

  if (!carregando && papel) return <Navigate to={destino ?? destinoPadrao(papel)} replace />

  function marcarErro(texto: string, campo: Campo) {
    setErro(texto)
    setCampoErro(campo)
    // O foco vai para onde é preciso corrigir.
    ;(campo === 'pin' ? campoPin : campoMatricula).current?.focus()
  }

  async function entrar(matriculaDigitada: string, pinDigitado: string) {
    if (enviando) return
    setErro(null)
    setCampoErro(null)

    const validacao = LoginSchema.safeParse({ matricula: matriculaDigitada, pin: pinDigitado })
    if (!validacao.success) {
      const problema = validacao.error.issues[0]
      marcarErro(problema?.message ?? 'Confira a matrícula e o PIN.', problema?.path[0] === 'pin' ? 'pin' : 'matricula')
      return
    }

    setEnviando(true)
    try {
      const novoPapel = await entrarComoFuncionario(validacao.data.matricula, validacao.data.pin)
      navegar(destino ?? destinoPadrao(novoPapel), { replace: true })
    } catch (falha) {
      console.error(falha)
      setPin('')
      setEnviando(false)
      marcarErro(falha instanceof ErroLogin ? MENSAGENS[falha.motivo] : MENSAGENS.rede, 'pin')
    }
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    void entrar(matricula, pin)
  }

  const descreve = (campo: Campo) => (campoErro === campo ? 'erro-login' : undefined)

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm md:max-w-md">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Acesso da equipe</h1>
        <p className="mt-1 text-tinta-suave">Entre com sua matrícula e o PIN de 6 números.</p>

        <form onSubmit={enviar} noValidate className="mt-8 space-y-5">
          <div>
            <label htmlFor="matricula" className="rotulo md:text-base">
              Matrícula
            </label>
            <input
              ref={campoMatricula}
              id="matricula"
              name="username"
              className="campo text-lg tracking-wider md:min-h-14 md:text-xl"
              inputMode="numeric"
              autoComplete="username"
              maxLength={6}
              value={matricula}
              onChange={e => {
                setMatricula(e.target.value.replace(/\D/g, ''))
                if (campoErro === 'matricula') setCampoErro(null)
              }}
              aria-invalid={campoErro === 'matricula' ? true : undefined}
              aria-describedby={descreve('matricula')}
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="pin" className="rotulo md:text-base">
                PIN
              </label>
              <span aria-hidden className="flex gap-1.5">
                {Array.from({ length: TAMANHO_PIN }, (_, i) => (
                  <span key={i} className={`size-2 rounded-full ${i < pin.length ? 'bg-brasa' : 'bg-borda'}`} />
                ))}
              </span>
            </div>
            <div className="relative">
              <input
                ref={campoPin}
                id="pin"
                name="password"
                type={mostrarPin ? 'text' : 'password'}
                className="campo pr-24 text-lg tracking-[0.4em] md:min-h-14 md:text-xl"
                inputMode="numeric"
                autoComplete="current-password"
                maxLength={TAMANHO_PIN}
                value={pin}
                onChange={e => {
                  const novo = e.target.value.replace(/\D/g, '')
                  setPin(novo)
                  if (campoErro === 'pin') setCampoErro(null)
                  // Completou os 6 dígitos com a matrícula preenchida: entra direto.
                  if (novo.length === TAMANHO_PIN && matricula.length > 0) void entrar(matricula, novo)
                }}
                aria-invalid={campoErro === 'pin' ? true : undefined}
                aria-describedby={descreve('pin')}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex min-w-11 items-center px-3 text-sm font-semibold text-brasa-forte"
                onClick={() => setMostrarPin(v => !v)}
                aria-pressed={mostrarPin}
              >
                {mostrarPin ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <p className="mt-1 text-xs text-tinta-suave">Ao completar os 6 números, entra sozinho.</p>
          </div>

          <p id="erro-login" role="alert" aria-live="assertive" className="min-h-6 text-sm font-medium text-perigo">
            {erro}
          </p>

          <button type="submit" className="botao-primario w-full text-lg md:min-h-14" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
          <p className="text-center text-sm text-tinta-suave">Esqueceu o PIN? Peça para a gerência trocar.</p>
        </form>
      </div>
    </main>
  )
}
