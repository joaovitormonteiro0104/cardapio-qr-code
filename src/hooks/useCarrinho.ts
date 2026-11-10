import { useCallback, useEffect, useState } from 'react'
import { lerSessaoLocal, salvarSessaoLocal } from '@/lib/sessaoLocal'
import { QUANTIDADE_MAX_POR_ITEM, type NovoItemPedido } from '@/schemas/pedido'

export interface Carrinho {
  itens: NovoItemPedido[]
  quantidadeDe: (itemId: string) => number
  definir: (itemId: string, quantidade: number) => void
  limpar: () => void
  remover: (itemIds: readonly string[]) => void
}

/** Carrinho local (só na tela, AGENTS.md §6.2), guardado no localStorage pra sobreviver a um recarregamento. */
export function useCarrinho(numeroMesa: number): Carrinho {
  const [itens, setItens] = useState<NovoItemPedido[]>(() => lerSessaoLocal(numeroMesa).carrinho)

  useEffect(() => {
    salvarSessaoLocal(numeroMesa, { ...lerSessaoLocal(numeroMesa), carrinho: itens })
  }, [numeroMesa, itens])

  const definir = useCallback((itemId: string, quantidade: number) => {
    const limitada = Math.max(0, Math.min(QUANTIDADE_MAX_POR_ITEM, Math.trunc(quantidade)))
    setItens(atuais => {
      const sem = atuais.filter(i => i.itemId !== itemId)
      if (limitada === 0) return sem
      const existente = atuais.findIndex(i => i.itemId === itemId)
      const novo = { itemId, quantidade: limitada }
      if (existente === -1) return [...sem, novo]
      const copia = [...atuais]
      copia[existente] = novo
      return copia
    })
  }, [])

  const quantidadeDe = useCallback((itemId: string) => itens.find(i => i.itemId === itemId)?.quantidade ?? 0, [itens])
  const limpar = useCallback(() => setItens([]), [])
  const remover = useCallback(
    (ids: readonly string[]) => setItens(atuais => atuais.filter(i => !ids.includes(i.itemId))),
    [],
  )

  return { itens, quantidadeDe, definir, limpar, remover }
}
