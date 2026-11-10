import { describe, expect, it } from 'vitest'
import {
  FOTO_TAMANHO_MAX_BYTES,
  mover,
  nomeCategoriaValido,
  nomeItemValido,
  precoValido,
  problemaFoto,
} from '@/domain/cardapio/validacao'

describe('nomeItemValido / nomeCategoriaValido', () => {
  it('aceita nomes normais', () => {
    expect(nomeItemValido('X-Burguer grande')).toBe(true)
    expect(nomeCategoriaValido('Bebidas')).toBe(true)
  })

  it('rejeita vazio ou só espaços', () => {
    expect(nomeItemValido('   ')).toBe(false)
    expect(nomeCategoriaValido('')).toBe(false)
  })

  it('respeita os limites de tamanho', () => {
    expect(nomeItemValido('a'.repeat(100))).toBe(true)
    expect(nomeItemValido('a'.repeat(101))).toBe(false)
    expect(nomeCategoriaValido('a'.repeat(60))).toBe(true)
    expect(nomeCategoriaValido('a'.repeat(61))).toBe(false)
  })
})

describe('precoValido', () => {
  it.each([
    [1, true],
    [1250, true],
    [0, false],
    [-100, false],
    [12.5, false],
    [null, false],
  ])('%s → %s', (valor, esperado) => {
    expect(precoValido(valor)).toBe(esperado)
  })
})

describe('problemaFoto', () => {
  it('aceita jpeg, png e webp até 2 MB', () => {
    expect(problemaFoto('image/jpeg', 1000)).toBeNull()
    expect(problemaFoto('image/png', FOTO_TAMANHO_MAX_BYTES)).toBeNull()
    expect(problemaFoto('image/webp', 1)).toBeNull()
  })

  it('rejeita outros tipos', () => {
    expect(problemaFoto('image/gif', 1000)).toBe('tipo')
    expect(problemaFoto('application/pdf', 1000)).toBe('tipo')
  })

  it('rejeita acima de 2 MB', () => {
    expect(problemaFoto('image/jpeg', FOTO_TAMANHO_MAX_BYTES + 1)).toBe('tamanho')
  })
})

describe('mover', () => {
  const lista = ['a', 'b', 'c', 'd']

  it('move pra frente e pra trás', () => {
    expect(mover(lista, 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(mover(lista, 3, 0)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('não altera a lista original', () => {
    mover(lista, 0, 1)
    expect(lista).toEqual(['a', 'b', 'c', 'd'])
  })

  it('índices inválidos devolvem cópia igual', () => {
    expect(mover(lista, -1, 2)).toEqual(lista)
    expect(mover(lista, 0, 9)).toEqual(lista)
    expect(mover(lista, 1, 1)).toEqual(lista)
  })
})
