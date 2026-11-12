import { describe, expect, it } from 'vitest'
import { rotuloAutor, separarPedidos } from '@/domain/pedido/apresentacao'

describe('rotuloAutor', () => {
  const nomes = new Map<string, string | null>([
    ['u-ana', 'Ana'],
    ['u-sem', null],
    ['u-branco', '  '],
  ])

  it('o próprio usuário vê "Seu pedido"', () => {
    expect(rotuloAutor('u-eu', 'u-eu', nomes)).toBe('Seu pedido')
  })

  it('outra pessoa com nome', () => {
    expect(rotuloAutor('u-ana', 'u-eu', nomes)).toBe('Pedido de Ana')
  })

  it('outra pessoa sem nome ou desconhecida', () => {
    expect(rotuloAutor('u-sem', 'u-eu', nomes)).toBe('Pedido de outra pessoa')
    expect(rotuloAutor('u-branco', 'u-eu', nomes)).toBe('Pedido de outra pessoa')
    expect(rotuloAutor('u-x', 'u-eu', nomes)).toBe('Pedido de outra pessoa')
  })

  it('sem autor gravado (equipe) é da mesa', () => {
    expect(rotuloAutor(null, 'u-eu', nomes)).toBe('Pedido da mesa')
  })
})

describe('separarPedidos', () => {
  it('entregue, finalizado e cancelado vão para encerrados', () => {
    const pedidos = [
      { id: 1, estado: 'Recebido' as const },
      { id: 2, estado: 'Entregue' as const },
      { id: 3, estado: 'EdicaoSolicitada' as const },
      { id: 4, estado: 'Cancelado' as const },
      { id: 5, estado: 'Pronto' as const },
      { id: 6, estado: 'Finalizado' as const },
    ]
    const { andamento, encerrados } = separarPedidos(pedidos)
    expect(andamento.map(p => p.id)).toEqual([1, 3, 5])
    expect(encerrados.map(p => p.id)).toEqual([2, 4, 6])
  })
})
