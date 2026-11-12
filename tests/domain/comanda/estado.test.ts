import { describe, expect, it } from 'vitest'
import {
  aceitaNovosPedidos,
  motivoNaoPodeFechar,
  podeFecharComanda,
  podeInformarPagamento,
  podeMarcarComoPaga,
  transicaoComandaValida,
  type EstadoComanda,
} from '@/domain/comanda/estado'
import type { PedidoCalculo } from '@/domain/pedido/calculo'
import type { EstadoPedido } from '@/domain/pedido/estado'

const pedido = (estado: EstadoPedido, valor = 1000): PedidoCalculo => ({
  estado,
  itens: [{ quantidade: 1, precoCentavosSnapshot: valor, removidoEm: null }],
})

describe('aceitaNovosPedidos', () => {
  it.each<[EstadoComanda, boolean]>([
    ['Aberta', true],
    ['AguardandoPagamento', false],
    ['Paga', false],
    ['Fechada', false],
  ])('%s → %s', (estado, esperado) => {
    expect(aceitaNovosPedidos(estado)).toBe(esperado)
  })
})

describe('transicaoComandaValida', () => {
  it.each<[EstadoComanda, EstadoComanda, boolean]>([
    ['Aberta', 'AguardandoPagamento', true],
    ['AguardandoPagamento', 'Aberta', true],
    ['AguardandoPagamento', 'Paga', true],
    ['Paga', 'Fechada', true],
    ['Aberta', 'Fechada', true],
    ['Aberta', 'Paga', true],
    ['Paga', 'Aberta', false],
    ['AguardandoPagamento', 'Fechada', false],
    ['Fechada', 'Aberta', false],
  ])('%s → %s = %s', (de, para, esperado) => {
    expect(transicaoComandaValida(de, para)).toBe(esperado)
  })
})

describe('podeInformarPagamento', () => {
  it('só em Aberta com valor', () => {
    expect(podeInformarPagamento('Aberta', [pedido('Entregue')])).toBe(true)
    expect(podeInformarPagamento('Aberta', [])).toBe(false)
    expect(podeInformarPagamento('Aberta', [pedido('Cancelado')])).toBe(false)
    expect(podeInformarPagamento('AguardandoPagamento', [pedido('Entregue')])).toBe(false)
  })
})

describe('podeFecharComanda / motivoNaoPodeFechar', () => {
  it('Paga e tudo entregue: pode', () => {
    expect(podeFecharComanda('Paga', [pedido('Entregue'), pedido('Cancelado')])).toBe(true)
  })

  it.each<EstadoPedido>(['Recebido', 'Preparando', 'Pronto', 'EdicaoSolicitada', 'CancelamentoPendente'])(
    'pedido em %s impede fechar mesmo paga',
    estado => {
      expect(motivoNaoPodeFechar('Paga', [pedido('Entregue'), pedido(estado)])).toBe('pendentes')
    },
  )

  it('Aberta com valor a pagar não fecha', () => {
    expect(motivoNaoPodeFechar('Aberta', [pedido('Entregue')])).toBe('nao_paga')
  })

  it('AguardandoPagamento não fecha', () => {
    expect(motivoNaoPodeFechar('AguardandoPagamento', [pedido('Entregue')])).toBe('nao_paga')
  })

  it('Aberta com tudo cancelado (total zero) fecha direto', () => {
    expect(podeFecharComanda('Aberta', [pedido('Cancelado'), pedido('Cancelado')])).toBe(true)
  })

  it('Aberta sem pedidos fecha direto', () => {
    expect(podeFecharComanda('Aberta', [])).toBe(true)
  })

  it('Fechada não fecha de novo', () => {
    expect(motivoNaoPodeFechar('Fechada', [])).toBe('ja_fechada')
  })
})

describe('podeMarcarComoPaga (decisão 23)', () => {
  const comValor = [{ estado: 'Entregue' as const, itens: [{ quantidade: 1, precoCentavosSnapshot: 1000, removidoEm: null }] }]
  it('depois do "já paguei" sempre pode', () => {
    expect(podeMarcarComoPaga('AguardandoPagamento', comValor)).toBe(true)
  })
  it('conta aberta com valor: caixa achou o Pix', () => {
    expect(podeMarcarComoPaga('Aberta', comValor)).toBe(true)
  })
  it('conta aberta sem valor ou já paga: não', () => {
    expect(podeMarcarComoPaga('Aberta', [])).toBe(false)
    expect(podeMarcarComoPaga('Paga', comValor)).toBe(false)
    expect(podeMarcarComoPaga('Fechada', comValor)).toBe(false)
  })
})
