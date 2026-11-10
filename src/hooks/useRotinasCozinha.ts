import { useEffect } from 'react'
import { pedidosExpirados } from '@/domain/pedido/autoCancelamento'
import type { ConfigsTempo } from '@/domain/config'
import * as pedidoRepo from '@/repositories/pedidoRepo'

const INTERVALO_MS = 60_000

/**
 * Rotina automática que roda no tablet da cozinha (AGENTS.md §6.11):
 * a cada 60 s, cancela (ator "sistema") os pedidos que ficaram em Recebido
 * além do prazo. A escrita é condicional: com 2 tablets abertos, só um
 * consegue cancelar e só um evento é gravado.
 * (O fechamento de comandas inativas fica em useRotinaComandas, item 12.)
 */
export function useAutoCancelamento(configs: ConfigsTempo | null): void {
  useEffect(() => {
    if (!configs) return
    let rodando = false
    async function rodar() {
      if (rodando || !configs) return
      rodando = true
      try {
        // Inclui os pedidos sem itens, que a tela esconde mas a rotina limpa.
        const todos = await pedidoRepo.listarPedidosCozinha()
        for (const pedido of pedidosExpirados(todos, configs, new Date())) {
          try {
            await pedidoRepo.cancelarAutomaticamente(pedido.id, configs)
          } catch (falha) {
            console.error('auto-cancelamento', pedido.numero, falha)
          }
        }
      } catch (falha) {
        console.error('auto-cancelamento', falha)
      } finally {
        rodando = false
      }
    }
    void rodar()
    const id = setInterval(() => void rodar(), INTERVALO_MS)
    return () => clearInterval(id)
  }, [configs])
}
