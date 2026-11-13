import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useRotinasAutomaticas } from '@/hooks/useRotinasCozinha'
import { useConfig } from '@/lib/config'

interface Link {
  para: string
  texto: string
}

const LINKS_OPERACAO: Link[] = [
  { para: '/cozinha', texto: 'Pedidos' },
  { para: '/cozinha/contas', texto: 'Contas' },
]

const LINKS_GERENCIA: Link[] = [
  { para: '/gerencia/cardapio', texto: 'Cardápio' },
  { para: '/gerencia/mesas', texto: 'Mesas' },
  { para: '/gerencia/equipe', texto: 'Equipe' },
  { para: '/gerencia/auditoria', texto: 'Auditoria' },
  { para: '/gerencia/config', texto: 'Configurações' },
]

/** Cabeçalho comum das telas da equipe (cozinha e gerência). */
export function LayoutEquipe({
  titulo,
  tituloVisivel = true,
  imprimirTitulo = true,
  children,
}: {
  titulo: string
  /** false: título só para leitor de tela (a aba ativa já diz onde se está), ganha altura. */
  tituloVisivel?: boolean
  /** false: o título não sai no papel (ex.: cartões de QR das Mesas). */
  imprimirTitulo?: boolean
  children: ReactNode
}) {
  const { papel, sair } = useAuth()
  const navegar = useNavigate()
  const { configs } = useConfig()
  // Rotinas automáticas rodam em qualquer tela da equipe (§6.11), não só em Pedidos.
  useRotinasAutomaticas(configs)
  const links = papel === 'gerencia' ? [...LINKS_OPERACAO, ...LINKS_GERENCIA] : LINKS_OPERACAO

  async function deslogar() {
    try {
      await sair()
    } finally {
      navegar('/login', { replace: true })
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-borda bg-superficie/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-2 sm:items-center">
          {/* flex-wrap: no celular as abas quebram em linhas em vez de esconder à direita */}
          <nav aria-label="Áreas" className="-mx-1 flex flex-1 flex-wrap gap-1">
            {links.map(link => (
              <NavLink
                key={link.para}
                to={link.para}
                end={link.para === '/cozinha'}
                className={({ isActive }) =>
                  `flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium ${
                    isActive ? 'bg-brasa-clara text-brasa-forte' : 'text-tinta-suave hover:bg-fundo'
                  }`
                }
              >
                {link.texto}
              </NavLink>
            ))}
          </nav>
          <span className="hidden text-xs text-tinta-suave sm:inline">
            {papel === 'gerencia' ? 'Gerência' : 'Operação'}
          </span>
          <button type="button" onClick={deslogar} className="botao-secundario min-h-11 px-3 text-sm">
            Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className={`${tituloVisivel ? 'mb-5 text-2xl font-bold tracking-tight' : 'sr-only'} ${imprimirTitulo ? '' : 'print:hidden'}`}>
          {titulo}
        </h1>
        {children}
      </main>
    </div>
  )
}
