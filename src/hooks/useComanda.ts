import { useCallback, useEffect, useRef, useState } from 'react'
import * as authRepo from '@/repositories/authRepo'
import * as comandaRepo from '@/repositories/comandaRepo'
import * as mesaRepo from '@/repositories/mesaRepo'
import * as pedidoRepo from '@/repositories/pedidoRepo'
import type { Comanda, Mesa } from '@/schemas/comanda'
import type { Pedido } from '@/schemas/pedido'

export type FaseMesa = 'carregando' | 'mesa_indisponivel' | 'pedir_nome' | 'pronta' | 'encerrada' | 'erro'

export interface EstadoComandaCliente {
  fase: FaseMesa
  mesa: Mesa | null
  comanda: Comanda | null
  pedidos: Pedido[]
  conectado: boolean
  entrar: (nome: string) => Promise<void>
  recarregar: () => Promise<void>
  atualizarComanda: (comanda: Comanda) => void
}

/**
 * Fluxo do cliente na mesa: login anônimo → valida mesa → acha a comanda em
 * que já está (ou pede o nome e entra/abre) → carrega pedidos e assina o
 * tempo real. Ao reconectar, recarrega tudo.
 */
export function useComanda(numeroMesa: number): EstadoComandaCliente {
  const [fase, setFase] = useState<FaseMesa>('carregando')
  const [mesa, setMesa] = useState<Mesa | null>(null)
  const [comanda, setComanda] = useState<Comanda | null>(null)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [conectado, setConectado] = useState(true)
  const comandaId = comanda?.id ?? null
  const carregandoRef = useRef(false)

  // 1. Entrada: sessão anônima + mesa + comanda existente
  useEffect(() => {
    let cancelado = false
    async function iniciar() {
      try {
        if (!Number.isInteger(numeroMesa) || numeroMesa <= 0) {
          setFase('mesa_indisponivel')
          return
        }
        await authRepo.entrarComoCliente()
        const encontrada = await mesaRepo.buscarMesaAtivaPorNumero(numeroMesa)
        if (cancelado) return
        if (!encontrada) {
          setFase('mesa_indisponivel')
          return
        }
        setMesa(encontrada)
        const minha = await comandaRepo.minhaComandaAbertaNaMesa(encontrada.id)
        if (cancelado) return
        if (minha) {
          setComanda(minha)
          setFase('pronta')
        } else {
          setFase('pedir_nome')
        }
      } catch (falha) {
        console.error(falha)
        if (!cancelado) setFase('erro')
      }
    }
    void iniciar()
    return () => {
      cancelado = true
    }
  }, [numeroMesa])

  const recarregar = useCallback(async () => {
    if (!comandaId || carregandoRef.current) return
    carregandoRef.current = true
    try {
      const [atual, lista] = await Promise.all([
        comandaRepo.buscarComanda(comandaId),
        pedidoRepo.listarPedidosDaComanda(comandaId),
      ])
      // Mesa fechada: a sessão foi encerrada e a RLS já não mostra a comanda.
      if (!atual || atual.estado === 'Fechada') {
        setFase('encerrada')
        return
      }
      setComanda(atual)
      setPedidos(lista)
    } catch (falha) {
      console.error(falha)
    } finally {
      carregandoRef.current = false
    }
  }, [comandaId])

  // 2. Tempo real + recarga ao voltar para a aba ou à internet
  useEffect(() => {
    if (!comandaId) return
    void recarregar()
    const cancelar = comandaRepo.assinarComanda(comandaId, {
      aoMudar: () => void recarregar(),
      aoConectar: () => {
        setConectado(true)
        void recarregar()
      },
      aoDesconectar: () => setConectado(false),
    })
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void recarregar()
    }
    window.addEventListener('online', aoVoltar)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      cancelar()
      window.removeEventListener('online', aoVoltar)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [comandaId, recarregar])

  const entrar = useCallback(
    async (nome: string) => {
      if (!mesa) return
      const nova = await comandaRepo.entrarNaMesa(mesa, nome)
      setComanda(nova)
      setFase('pronta')
    },
    [mesa],
  )

  return { fase, mesa, comanda, pedidos, conectado, entrar, recarregar, atualizarComanda: setComanda }
}
