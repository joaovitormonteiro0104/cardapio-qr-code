import { describe, expect, it } from 'vitest'
import {
  ESTADOS_PEDIDO,
  TransicaoInvalidaError,
  aplicarCancelamentoPeloClienteNaJanela,
  aplicarTransicao,
  proximosEstados,
  transicaoValida,
  type EstadoPedido,
  type SituacaoPedido,
} from '@/domain/pedido/estado'

const s = (estado: EstadoPedido, estadoAnterior: EstadoPedido | null = null): SituacaoPedido => ({
  estado,
  estadoAnterior,
})
const AGORA = new Date('2026-11-10T12:00:00Z')

describe('transicaoValida — caminho feliz e laterais', () => {
  it.each<[EstadoPedido, EstadoPedido]>([
    ['Recebido', 'Preparando'],
    ['Preparando', 'Pronto'],
    ['Pronto', 'Entregue'],
    ['Entregue', 'Finalizado'],
    ['Recebido', 'Cancelado'],
    ['Preparando', 'CancelamentoPendente'],
    ['Pronto', 'CancelamentoPendente'],
    ['Recebido', 'EdicaoSolicitada'],
    ['Preparando', 'EdicaoSolicitada'],
    ['Pronto', 'EdicaoSolicitada'],
  ])('%s → %s é válida', (de, para) => {
    expect(transicaoValida(s(de), para)).toBe(true)
  })

  it.each<[EstadoPedido, EstadoPedido]>([
    ['Recebido', 'Pronto'],
    ['Recebido', 'Entregue'],
    ['Recebido', 'CancelamentoPendente'],
    ['Preparando', 'Cancelado'],
    ['Preparando', 'Recebido'],
    ['Pronto', 'Cancelado'],
    ['Pronto', 'Preparando'],
    ['Entregue', 'Cancelado'],
    ['Entregue', 'CancelamentoPendente'],
    ['Entregue', 'EdicaoSolicitada'],
    ['Entregue', 'Pronto'],
    ['Preparando', 'Finalizado'],
  ])('%s → %s é inválida', (de, para) => {
    expect(transicaoValida(s(de), para)).toBe(false)
  })

  it('Finalizado e Cancelado são finais', () => {
    for (const para of ESTADOS_PEDIDO) {
      expect(transicaoValida(s('Finalizado'), para)).toBe(false)
      expect(transicaoValida(s('Cancelado'), para)).toBe(false)
    }
  })
})

describe('transicaoValida — volta de estados temporários', () => {
  it.each<EstadoPedido>(['Recebido', 'Preparando', 'Pronto'])(
    'EdicaoSolicitada volta só para %s quando veio de lá',
    origem => {
      const pedido = s('EdicaoSolicitada', origem)
      for (const para of ['Recebido', 'Preparando', 'Pronto'] as const) {
        expect(transicaoValida(pedido, para)).toBe(para === origem)
      }
      expect(transicaoValida(pedido, 'Cancelado')).toBe(false)
    },
  )

  it.each<EstadoPedido>(['Preparando', 'Pronto'])('CancelamentoPendente vindo de %s', origem => {
    const pedido = s('CancelamentoPendente', origem)
    expect(transicaoValida(pedido, 'Cancelado')).toBe(true)
    expect(transicaoValida(pedido, origem)).toBe(true)
    const outro = origem === 'Preparando' ? 'Pronto' : 'Preparando'
    expect(transicaoValida(pedido, outro)).toBe(false)
    expect(transicaoValida(pedido, 'Recebido')).toBe(false)
  })

  it('temporário sem estadoAnterior não volta para lugar nenhum', () => {
    expect(transicaoValida(s('EdicaoSolicitada', null), 'Recebido')).toBe(false)
    expect(proximosEstados(s('CancelamentoPendente', null))).toEqual(['Cancelado'])
  })
})

describe('proximosEstados', () => {
  it('lista só as transições válidas', () => {
    expect(proximosEstados(s('Recebido'))).toEqual(['Preparando', 'Cancelado', 'EdicaoSolicitada'])
    expect(proximosEstados(s('Entregue'))).toEqual(['Finalizado'])
    expect(proximosEstados(s('EdicaoSolicitada', 'Pronto'))).toEqual(['Pronto'])
    expect(proximosEstados(s('CancelamentoPendente', 'Preparando'))).toEqual(['Cancelado', 'Preparando'])
  })
})

describe('aplicarTransicao', () => {
  it('entrando em temporário grava a origem', () => {
    expect(aplicarTransicao(s('Preparando'), 'EdicaoSolicitada', AGORA)).toEqual({
      estado: 'EdicaoSolicitada',
      estadoAnterior: 'Preparando',
      estadoDesde: AGORA,
    })
    expect(aplicarTransicao(s('Pronto'), 'CancelamentoPendente', AGORA).estadoAnterior).toBe('Pronto')
  })

  it('saindo de temporário limpa estadoAnterior', () => {
    expect(aplicarTransicao(s('EdicaoSolicitada', 'Recebido'), 'Recebido', AGORA)).toEqual({
      estado: 'Recebido',
      estadoAnterior: null,
      estadoDesde: AGORA,
    })
    expect(aplicarTransicao(s('CancelamentoPendente', 'Pronto'), 'Cancelado', AGORA).estadoAnterior).toBeNull()
  })

  it('transição normal não tem estadoAnterior', () => {
    expect(aplicarTransicao(s('Recebido'), 'Preparando', AGORA).estadoAnterior).toBeNull()
  })

  it('lança erro em transição inválida', () => {
    expect(() => aplicarTransicao(s('Entregue'), 'Cancelado', AGORA)).toThrow(TransicaoInvalidaError)
    expect(() => aplicarTransicao(s('EdicaoSolicitada', 'Recebido'), 'Pronto', AGORA)).toThrow()
  })
})

describe('aplicarCancelamentoPeloClienteNaJanela', () => {
  it('cancela direto em Recebido e em Preparando', () => {
    expect(aplicarCancelamentoPeloClienteNaJanela(s('Preparando'), AGORA).estado).toBe('Cancelado')
    expect(aplicarCancelamentoPeloClienteNaJanela(s('Recebido'), AGORA).estado).toBe('Cancelado')
  })

  it('recusa nos demais estados', () => {
    expect(() => aplicarCancelamentoPeloClienteNaJanela(s('Pronto'), AGORA)).toThrow()
    expect(() => aplicarCancelamentoPeloClienteNaJanela(s('Entregue'), AGORA)).toThrow()
  })
})
