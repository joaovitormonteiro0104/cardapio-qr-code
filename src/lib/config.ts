import { createContext, useContext } from 'react'
import type { Configs } from '@/schemas/config'

// Configurações runtime carregadas no boot (AGENTS.md §10). O provider fica em
// components/ConfigProvider.tsx; aqui só o contexto e o hook.

export interface EstadoConfig {
  configs: Configs | null
  erro: string | null
  recarregar: () => Promise<void>
}

export const ConfigContext = createContext<EstadoConfig | null>(null)

export function useConfig(): EstadoConfig {
  const contexto = useContext(ConfigContext)
  if (!contexto) throw new Error('useConfig precisa estar dentro de <ConfigProvider>')
  return contexto
}
