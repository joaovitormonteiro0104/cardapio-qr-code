import { useEffect } from 'react'
import { ATOR_SISTEMA } from '@/domain/auditoria/evento'
import { comandaInativa, podeFecharAutomaticamente } from '@/domain/comanda/sessao'
import { pedidosExpirados } from '@/domain/pedido/autoCancelamento'
import type { ConfigsTempo } from '@/domain/config'
import * as comandaRepo from '@/repositories/comandaRepo'
import * as pedidoRepo from '@/repositories/pedidoRepo'

const INTERVALO_MS = 60_000

/**
 * Rotinas automáticas (AGENTS.md §6.11). Rodam em QUALQUER tela da equipe
 * (LayoutEquipe), a cada 60 s:
 *  1. cancela (ator "sistema") pedidos que ficaram em Recebido além do prazo;
 *  2. fecha comandas inativas que estão pagas ou com total zero.
 * As escritas são condicionais: com 2 tablets abertos, só um consegue e só
 * um evento é gravado.
 */
export function useRotinasAutomaticas(configs: ConfigsTempo | null): void {
  useEffect(() => {
    if (!configs) return
    let rodando = false

    async function rodar() {
      if (rodando || !configs) return
      rodando = true
      const agora = new Date()
      try {
        // Inclui os pedidos sem itens, que a tela esconde mas a rotina limpa.
        const todos = await pedidoRepo.listarPedidosCozinha()
        for (const pedido of pedidosExpirados(todos, configs, agora)) {
          try {
            await pedidoRepo.cancelarAutomaticamente(pedido.id, configs)
          } catch (falha) {
            console.error('auto-cancelamento', pedido.numero, falha)
          }
        }
      } catch (falha) {
        console.error('auto-cancelamento', falha)
      }
      try {
        for (const item of await comandaRepo.listarComandasAbertas()) {
          if (comandaInativa(item.comanda, configs, agora) && podeFecharAutomaticamente(item.comanda, item.pedidos)) {
            try {
              await comandaRepo.fecharMesa(item.comanda.id, ATOR_SISTEMA)
            } catch (falha) {
              console.error('fechamento automático', item.comanda.numero, falha)
            }
          }
        }
      } catch (falha) {
        console.error('fechamento automático', falha)
      } finally {
        rodando = false
      }
    }

    void rodar()
    const id = setInterval(() => void rodar(), INTERVALO_MS)
    return () => clearInterval(id)
  }, [configs])
}
