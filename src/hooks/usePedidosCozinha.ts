import { useCallback, useEffect, useRef, useState } from 'react'
import { itensAtivos } from '@/domain/pedido/calculo'
import * as pedidoRepo from '@/repositories/pedidoRepo'
import type { PedidoCozinha } from '@/repositories/pedidoRepo'

interface EstadoCozinha {
  pedidos: PedidoCozinha[]
  carregando: boolean
  erro: string | null
  conectado: boolean
  recarregar: () => Promise<void>
}

/**
 * Carga inicial + tempo real + reconexão da tela da cozinha. Ao (re)conectar,
 * recarrega a lista inteira para não perder eventos. Também recarrega a cada
 * 60 s como rede de segurança e ao voltar para a aba/internet.
 */
export function usePedidosCozinha(): EstadoCozinha {
  const [pedidos, setPedidos] = useState<PedidoCozinha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [conectado, setConectado] = useState(true)
  const emAndamento = useRef(false)
  const pendente = useRef(false)

  const recarregar = useCallback(async () => {
    // várias notificações seguidas viram uma recarga só (e mais uma no fim)
    if (emAndamento.current) {
      pendente.current = true
      return
    }
    emAndamento.current = true
    try {
      do {
        pendente.current = false
        const lista = await pedidoRepo.listarPedidosCozinha()
        // Pedido sem itens (envio interrompido) é ignorado; o auto-cancelamento limpa (decisão 9).
        setPedidos(lista.filter(p => !(p.estado === 'Recebido' && itensAtivos(p.itens).length === 0)))
        setErro(null)
      } while (pendente.current)
    } catch (falha) {
      console.error(falha)
      setErro('Não foi possível atualizar os pedidos.')
    } finally {
      emAndamento.current = false
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void recarregar()
    const cancelar = pedidoRepo.assinarPedidosAbertos({
      aoMudar: () => void recarregar(),
      aoConectar: () => {
        setConectado(true)
        void recarregar()
      },
      aoDesconectar: () => setConectado(false),
    })
    const intervalo = setInterval(() => void recarregar(), 60_000)
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void recarregar()
    }
    window.addEventListener('online', aoVoltar)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      cancelar()
      clearInterval(intervalo)
      window.removeEventListener('online', aoVoltar)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [recarregar])

  return { pedidos, carregando, erro, conectado, recarregar }
}

/** Relógio que atualiza a cada `ms` (para "há 3 min" e contagens). */
export function useAgora(ms = 30_000): Date {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), ms)
    return () => clearInterval(id)
  }, [ms])
  return agora
}
