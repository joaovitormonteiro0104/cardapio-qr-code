import { describe, expect, it } from 'vitest'
import {
  MOTIVOS_CANCELAMENTO,
  confirmacaoPorNumeroValida,
  motivoParaRegistro,
  podeCancelar,
  precisaDuasEtapas,
  validaMotivo,
} from '@/domain/pedido/cancelamento'
import type { EstadoPedido } from '@/domain/pedido/estado'

describe('podeCancelar', () => {
  it.each<[EstadoPedido, boolean]>([
    ['Recebido', true],
    ['Preparando', true],
    ['Pronto', true],
    ['Entregue', false],
    ['Finalizado', false],
    ['Cancelado', false],
    ['EdicaoSolicitada', false],
    ['CancelamentoPendente', false],
  ])('%s → %s', (estado, esperado) => {
    expect(podeCancelar({ estado })).toBe(esperado)
  })
})

describe('precisaDuasEtapas', () => {
  it('Recebido é 1 etapa; Preparando e Pronto são 2', () => {
    expect(precisaDuasEtapas({ estado: 'Recebido' })).toBe(false)
    expect(precisaDuasEtapas({ estado: 'Preparando' })).toBe(true)
    expect(precisaDuasEtapas({ estado: 'Pronto' })).toBe(true)
  })
})

describe('validaMotivo', () => {
  it('lista fixa tem os 5 motivos', () => {
    expect(MOTIVOS_CANCELAMENTO).toEqual(['sem_ingrediente', 'erro_de_pedido', 'cliente_desistiu', 'atraso', 'outro'])
  })

  it('aceita motivo da lista sem texto', () => {
    expect(validaMotivo('atraso')).toBeNull()
    expect(validaMotivo('sem_ingrediente', '  ')).toBeNull()
  })

  it('"outro" exige texto', () => {
    expect(validaMotivo('outro')).toBe('texto_obrigatorio')
    expect(validaMotivo('outro', '   ')).toBe('texto_obrigatorio')
    expect(validaMotivo('outro', 'cliente passou mal')).toBeNull()
  })

  it('rejeita motivo fora da lista', () => {
    expect(validaMotivo('porque sim')).toBe('motivo_invalido')
    expect(validaMotivo('')).toBe('motivo_invalido')
  })

  it('rejeita texto longo demais', () => {
    expect(validaMotivo('atraso', 'x'.repeat(301))).toBe('texto_longo')
  })
})

describe('confirmacaoPorNumeroValida', () => {
  it('aceita o número exato, com ou sem # e espaços', () => {
    expect(confirmacaoPorNumeroValida('1248', 1248)).toBe(true)
    expect(confirmacaoPorNumeroValida(' #1248 ', 1248)).toBe(true)
  })

  it('rejeita número diferente ou texto', () => {
    expect(confirmacaoPorNumeroValida('1249', 1248)).toBe(false)
    expect(confirmacaoPorNumeroValida('', 1248)).toBe(false)
    expect(confirmacaoPorNumeroValida('12a48', 1248)).toBe(false)
  })
})

describe('motivoParaRegistro', () => {
  it('junta motivo e texto', () => {
    expect(motivoParaRegistro('outro', ' queimou ')).toBe('outro: queimou')
    expect(motivoParaRegistro('atraso')).toBe('atraso')
  })
})
