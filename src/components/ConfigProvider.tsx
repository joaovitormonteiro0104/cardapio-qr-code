import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ConfigContext, type EstadoConfig } from '@/lib/config'
import { useAuth } from '@/hooks/useAuth'
import * as configRepo from '@/repositories/configRepo'
import type { Configs } from '@/schemas/config'

/**
 * Carrega as configurações quando há sessão (a RLS exige usuário logado,
 * inclusive anônimo) e recarrega a cada 60 s: uma mudança da gerência vale
 * sem novo deploy e sem recarregar a página (PRD critério 8).
 */
export function ConfigProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const [configs, setConfigs] = useState<Configs | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    try {
      setConfigs(await configRepo.listarConfigs())
      setErro(null)
    } catch (falha) {
      console.error(falha)
      setErro('Não foi possível carregar as configurações.')
    }
  }, [])

  useEffect(() => {
    if (!usuario) return
    void recarregar()
    const intervalo = setInterval(() => void recarregar(), 60_000)
    return () => clearInterval(intervalo)
  }, [usuario, recarregar])

  const valor = useMemo<EstadoConfig>(() => ({ configs, erro, recarregar }), [configs, erro, recarregar])
  return <ConfigContext.Provider value={valor}>{children}</ConfigContext.Provider>
}
