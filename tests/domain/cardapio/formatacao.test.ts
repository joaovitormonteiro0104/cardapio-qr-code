import { describe, expect, it } from 'vitest'
import { centavosParaCampo, parseReal } from '@/domain/cardapio/formatacao'
import { formatarDuracao, formatarReal } from '@/lib/formato'

describe('parseReal', () => {
  it.each([
    ['12,50', 1250],
    ['12.50', 1250],
    ['R$ 12,50', 1250],
    ['r$12,5', 1250],
    ['12', 1200],
    ['0,5', 50],
    ['0,05', 5],
    ['1.234,56', 123456],
    ['1.234', 123400],
    ['12.5', 1250],
    ['  8,90 ', 890],
    ['12,', 1200],
  ])('"%s" → %i centavos', (texto, esperado) => {
    expect(parseReal(texto)).toBe(esperado)
  })

  it.each(['', 'abc', '12,505', '-5', '1,234.56', '12,50,1', '1.23.4', 'R$', '12 50x'])(
    'rejeita "%s"',
    texto => {
      expect(parseReal(texto)).toBeNull()
    },
  )

  it('aceita zero (quem barra é precoValido)', () => {
    expect(parseReal('0')).toBe(0)
  })
})

describe('centavosParaCampo', () => {
  it.each([
    [1250, '12,50'],
    [5, '0,05'],
    [100000, '1000,00'],
  ])('%i → "%s"', (centavos, esperado) => {
    expect(centavosParaCampo(centavos)).toBe(esperado)
  })

  it('ida e volta com parseReal', () => {
    for (const valor of [1, 99, 1250, 123456]) {
      expect(parseReal(centavosParaCampo(valor))).toBe(valor)
    }
  })
})

describe('formatarReal', () => {
  it('formata centavos em reais', () => {
    expect(formatarReal(1250).replace(/\s/g, ' ')).toBe('R$ 12,50')
  })
})

describe('formatarDuracao', () => {
  it.each([
    [0, 'agora'],
    [59_000, 'agora'],
    [60_000, '1 min'],
    [3_600_000, '1 h'],
    [4_320_000, '1 h 12 min'],
    [-5000, 'agora'],
  ])('%i ms → "%s"', (ms, esperado) => {
    expect(formatarDuracao(ms)).toBe(esperado)
  })
})
