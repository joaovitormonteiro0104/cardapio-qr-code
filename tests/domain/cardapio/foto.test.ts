import { describe, expect, it } from 'vitest'
import { dimensoesReduzidas } from '@/domain/cardapio/foto'
import { nomeCorresponde, normalizarTexto } from '@/domain/cardapio/busca'

describe('dimensoesReduzidas', () => {
  it('foto de celular em pé (3024x4032) fica com lado maior 1200', () => {
    expect(dimensoesReduzidas(3024, 4032)).toEqual({ largura: 900, altura: 1200 })
  })
  it('foto deitada', () => {
    expect(dimensoesReduzidas(4000, 3000)).toEqual({ largura: 1200, altura: 900 })
  })
  it('foto pequena não é aumentada', () => {
    expect(dimensoesReduzidas(800, 600)).toEqual({ largura: 800, altura: 600 })
  })
})

describe('busca por nome', () => {
  it('ignora acento e maiúsculas', () => {
    expect(normalizarTexto(' Açaí 300 ml ')).toBe('acai 300 ml')
    expect(nomeCorresponde('Açaí 300 ml', 'acai')).toBe(true)
    expect(nomeCorresponde('Refrigerante lata', 'LATA')).toBe(true)
  })
  it('termo vazio mostra tudo; termo que não existe não casa', () => {
    expect(nomeCorresponde('X-Burguer', '  ')).toBe(true)
    expect(nomeCorresponde('X-Burguer', 'pizza')).toBe(false)
  })
})
