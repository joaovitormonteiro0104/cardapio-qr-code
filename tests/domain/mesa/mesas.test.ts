import { describe, expect, it } from 'vitest'
import { enderecoServeParaQr, interpretarNumerosMesa, proximoNumeroLivre } from '@/domain/mesa/mesas'

describe('interpretarNumerosMesa', () => {
  it('número único', () => {
    expect(interpretarNumerosMesa(' 7 ')).toEqual({ numeros: [7] })
  })
  it('intervalo com hífen ou "a"', () => {
    expect(interpretarNumerosMesa('1-3')).toEqual({ numeros: [1, 2, 3] })
    expect(interpretarNumerosMesa('4 a 6')).toEqual({ numeros: [4, 5, 6] })
  })
  it('recusa texto, zero, invertido e grande demais', () => {
    expect('erro' in interpretarNumerosMesa('mesa')).toBe(true)
    expect('erro' in interpretarNumerosMesa('0')).toBe(true)
    expect('erro' in interpretarNumerosMesa('10-2')).toBe(true)
    expect('erro' in interpretarNumerosMesa('1-500')).toBe(true)
    expect('erro' in interpretarNumerosMesa('10000')).toBe(true)
  })
})

describe('proximoNumeroLivre', () => {
  it('começa em 1 e segue o maior', () => {
    expect(proximoNumeroLivre([])).toBe(1)
    expect(proximoNumeroLivre([1, 2, 5])).toBe(6)
  })
})

describe('enderecoServeParaQr', () => {
  it('endereço público serve', () => {
    expect(enderecoServeParaQr('cardapio-qr-code-p68a.vercel.app')).toBe(true)
    expect(enderecoServeParaQr('meulanche.com.br')).toBe(true)
  })
  it('computador local e rede interna não servem', () => {
    for (const h of ['localhost', '127.0.0.1', '192.168.0.10', '10.0.0.5', '172.20.1.1', 'pc.local']) {
      expect(enderecoServeParaQr(h)).toBe(false)
    }
  })
})
