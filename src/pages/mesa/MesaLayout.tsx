import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom'
import { Carregando } from '@/components/Carregando'
import { useAuth } from '@/hooks/useAuth'
import { useCarrinho, type Carrinho } from '@/hooks/useCarrinho'
import { useComanda, type EstadoComandaCliente } from '@/hooks/useComanda'
import { useConfig } from '@/lib/config'
import { lerSessaoLocal, salvarSessaoLocal } from '@/lib/sessaoLocal'
import { NOME_CLIENTE_MAX } from '@/schemas/comanda'
import type { Configs } from '@/schemas/config'

export interface ContextoMesa extends EstadoComandaCliente {
  numeroMesa: number
  carrinho: Carrinho
  configs: Configs | null
  aviso: string | null
  setAviso: (aviso: string | null) => void
}

const DURACAO_AVISO_MS = 8000

/** Usado pelas páginas filhas de /mesa/:numero. */
export function useMesa(): ContextoMesa {
  return useOutletContext<ContextoMesa>()
}

export default function MesaLayout() {
  const params = useParams()
  const numeroMesa = Number(params.numero)
  const estado = useComanda(numeroMesa)
  const carrinho = useCarrinho(numeroMesa)
  const { configs } = useConfig()
  const [aviso, setAviso] = useState<string | null>(null)

  // Mesa fechada: o carrinho que sobrou não vale para a próxima visita.
  const { limpar } = carrinho
  useEffect(() => {
    if (estado.fase === 'encerrada') limpar()
  }, [estado.fase, limpar])

  // Aviso de confirmação ("Pedido #N enviado") some sozinho: depois de alguns
  // segundos ele já não descreve o estado do pedido, que pode ter mudado.
  useEffect(() => {
    if (!aviso) return
    const timer = setTimeout(() => setAviso(null), DURACAO_AVISO_MS)
    return () => clearTimeout(timer)
  }, [aviso])

  if (estado.fase === 'carregando') return <Carregando texto="Abrindo o cardápio…" />
  if (estado.fase === 'mesa_indisponivel') return <MesaIndisponivel />
  if (estado.fase === 'erro') return <ErroConexao />
  if (estado.fase === 'encerrada') return <MesaEncerrada />
  if (estado.fase === 'funcionario') return <AparelhoDaEquipe />
  if (estado.fase === 'pedir_nome') return <PedirNome numeroMesa={numeroMesa} entrar={estado.entrar} />

  const nomeCasa = configs?.nomeEstabelecimento || 'Cardápio'
  const pedidosAtivos = estado.pedidos.filter(p => p.estado !== 'Cancelado' && p.estado !== 'Finalizado').length
  const contexto: ContextoMesa = { ...estado, numeroMesa, carrinho, configs, aviso, setAviso }

  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-28">
      <header className="sticky top-0 z-20 border-b border-borda bg-fundo/95 backdrop-blur">
        <div className="flex items-baseline justify-between gap-3 px-4 pt-3">
          <p className="truncate text-lg font-bold tracking-tight">{nomeCasa}</p>
          <p className="shrink-0 text-sm text-tinta-suave">
            Mesa {numeroMesa}
            {estado.comanda && <span className="tabular-nums"> · conta #{estado.comanda.numero}</span>}
          </p>
        </div>
        <nav aria-label="Seções da mesa" className="flex gap-1 px-2 pt-2">
          <Aba para="." fim>
            Cardápio
          </Aba>
          <Aba para="comanda">
            Minha conta
            {pedidosAtivos > 0 && (
              <span className="ml-1.5 rounded-full bg-brasa px-1.5 text-xs font-bold text-white tabular-nums">
                {pedidosAtivos}
              </span>
            )}
          </Aba>
          <Aba para="pagamento">Pagar</Aba>
        </nav>
        {!estado.conectado && (
          <p role="status" className="bg-alerta-clara px-4 py-1.5 text-center text-sm">
            Sem conexão. Tentando reconectar…
          </p>
        )}
      </header>

      <main className="px-4 pt-4">
        {aviso && (
          <div role="status" className="mb-4 flex items-start justify-between gap-3 rounded-xl bg-sucesso-clara px-4 py-3 text-sucesso">
            <span className="font-medium">{aviso}</span>
            <button type="button" className="-my-2 -mr-2 flex size-11 items-center justify-center text-lg" onClick={() => setAviso(null)} aria-label="Fechar aviso">
              ×
            </button>
          </div>
        )}
        <Outlet context={contexto} />
      </main>
    </div>
  )
}

function Aba({ para, fim = false, children }: { para: string; fim?: boolean; children: ReactNode }) {
  return (
    <NavLink
      to={para}
      end={fim}
      className={({ isActive }) =>
        `flex min-h-11 flex-1 items-center justify-center border-b-2 text-sm font-semibold ${
          isActive ? 'border-brasa text-brasa-forte' : 'border-transparent text-tinta-suave'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

function PedirNome({ numeroMesa, entrar }: { numeroMesa: number; entrar: (nome: string) => Promise<void> }) {
  const [nome, setNome] = useState(() => lerSessaoLocal(numeroMesa).nome)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      salvarSessaoLocal(numeroMesa, { ...lerSessaoLocal(numeroMesa), nome: nome.trim() })
      await entrar(nome)
    } catch (falha) {
      console.error(falha)
      setErro('Não foi possível abrir a mesa. Verifique a internet e tente de novo.')
      setEnviando(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-brasa-forte">Mesa {numeroMesa}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Bem-vindo!</h1>
      <p className="mt-2 text-tinta-suave">
        Peça pelo celular e acompanhe o preparo. Todos nesta mesa compartilham a mesma conta.
      </p>
      <form onSubmit={enviar} className="mt-8 space-y-4">
        <div>
          <label htmlFor="nome-cliente" className="rotulo">
            Seu nome <span className="font-normal text-tinta-suave">(opcional)</span>
          </label>
          <input
            id="nome-cliente"
            className="campo"
            autoComplete="given-name"
            maxLength={NOME_CLIENTE_MAX}
            value={nome}
            onChange={e => setNome(e.target.value)}
          />
          <p className="mt-1 text-xs text-tinta-suave">Aparece para a cozinha junto aos seus pedidos.</p>
        </div>
        <p role="alert" className="min-h-5 text-sm font-medium text-perigo">
          {erro}
        </p>
        <button type="submit" className="botao-primario w-full text-lg" disabled={enviando}>
          {enviando ? 'Abrindo…' : 'Ver o cardápio'}
        </button>
      </form>
    </main>
  )
}

function MesaEncerrada() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">Conta encerrada</h1>
      <p className="mt-2 text-tinta-suave">Esta mesa foi fechada. Obrigado pela visita!</p>
      <button type="button" className="botao-secundario mx-auto mt-6" onClick={() => window.location.reload()}>
        Abrir uma nova conta
      </button>
    </main>
  )
}

function AparelhoDaEquipe() {
  const { sair } = useAuth()
  const [saindo, setSaindo] = useState(false)

  async function sairEAbrir() {
    setSaindo(true)
    try {
      await sair()
    } finally {
      window.location.reload()
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">Este aparelho está com login da equipe</h1>
      <p className="mt-2 text-tinta-suave">
        Para pedir como cliente, saia da conta da equipe. Para só testar, abra o QR numa janela anônima.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <button type="button" className="botao-primario" disabled={saindo} onClick={() => void sairEAbrir()}>
          {saindo ? 'Saindo…' : 'Sair da equipe e abrir a mesa'}
        </button>
        <Link to="/cozinha" className="botao-secundario">
          Voltar para a cozinha
        </Link>
      </div>
    </main>
  )
}

function MesaIndisponivel() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">Mesa indisponível</h1>
      <p className="mt-2 text-tinta-suave">Este QR Code não está ativo. Por favor, chame um atendente.</p>
    </main>
  )
}

function ErroConexao() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">Não foi possível abrir o cardápio</h1>
      <p className="mt-2 text-tinta-suave">Verifique a internet do celular e tente de novo.</p>
      <button type="button" className="botao-primario mx-auto mt-6" onClick={() => window.location.reload()}>
        Tentar de novo
      </button>
    </main>
  )
}
