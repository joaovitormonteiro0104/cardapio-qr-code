import { describe, expect, it } from 'vitest'
import {
  itensAtivos,
  quantidadeCarrinho,
  subtotalLinha,
  totalCarrinho,
  totalComanda,
  totalPedido,
  type PedidoCalculo,
} from '@/domain/pedido/calculo'

const REMOVIDO = new Date('2026-11-10T12:00:00Z')
const linha = (quantidade: number, preco: number, removido = false) => ({
  quantidade,
  precoCentavosSnapshot: preco,
  removidoEm: removido ? REMOVIDO : null,
})

describe('subtotalLinha / totalPedido', () => {
  it('multiplica quantidade pelo preço congelado', () => {
    expect(subtotalLinha(linha(3, 1250))).toBe(3750)
  })

  it('item removido vale zero', () => {
    expect(subtotalLinha(linha(2, 1000, true))).toBe(0)
    expect(totalPedido({ itens: [linha(2, 1000), linha(1, 500, true)] })).toBe(2000)
  })

  it('pedido sem itens vale zero', () => {
    expect(totalPedido({ itens: [] })).toBe(0)
  })
})

describe('totalComanda', () => {
  const pedidos: PedidoCalculo[] = [
    { estado: 'Entregue', itens: [linha(2, 1000)] },
    { estado: 'Cancelado', itens: [linha(5, 9999)] },
    { estado: 'Preparando', itens: [linha(1, 450), linha(1, 700, true)] },
  ]

  it('ignora cancelados e itens removidos', () => {
    expect(totalComanda(pedidos)).toBe(2450)
  })

  it('comanda sem pedidos vale zero', () => {
    expect(totalComanda([])).toBe(0)
  })

  it('só cancelados vale zero', () => {
    expect(totalComanda([{ estado: 'Cancelado', itens: [linha(1, 100)] }])).toBe(0)
  })
})

describe('carrinho', () => {
  const carrinho = [
    { itemId: 'a', quantidade: 2, precoCentavos: 1250 },
    { itemId: 'b', quantidade: 1, precoCentavos: 600 },
  ]

  it('soma total e quantidade', () => {
    expect(totalCarrinho(carrinho)).toBe(3100)
    expect(quantidadeCarrinho(carrinho)).toBe(3)
  })
})

describe('itensAtivos', () => {
  it('filtra removidos', () => {
    expect(itensAtivos([linha(1, 1), linha(1, 1, true)])).toHaveLength(1)
  })
})
