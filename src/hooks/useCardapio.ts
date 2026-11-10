import { useCallback, useEffect, useState } from 'react'
import * as cardapioRepo from '@/repositories/cardapioRepo'
import type { Categoria, ItemCardapio } from '@/schemas/cardapio'

interface EstadoCardapio {
  categorias: Categoria[]
  itens: ItemCardapio[]
  carregando: boolean
  erro: string | null
  recarregar: () => Promise<void>
}

/**
 * Carrega o cardápio. `modo` escolhe a consulta:
 *   'cliente'  → só ativos e disponíveis
 *   'gerencia' → inclui esgotados; inativos se mostrarInativos
 */
export function useCardapio(modo: 'cliente' | 'gerencia', mostrarInativos = false): EstadoCardapio {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [itens, setItens] = useState<ItemCardapio[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setErro(null)
    try {
      const resultado =
        modo === 'cliente'
          ? await cardapioRepo.listarCardapioCliente()
          : await cardapioRepo.listarCardapioGerencia(mostrarInativos)
      setCategorias(resultado.categorias)
      setItens(resultado.itens)
    } catch (falha) {
      console.error(falha)
      setErro('Não foi possível carregar o cardápio.')
    } finally {
      setCarregando(false)
    }
  }, [modo, mostrarInativos])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  return { categorias, itens, carregando, erro, recarregar }
}
