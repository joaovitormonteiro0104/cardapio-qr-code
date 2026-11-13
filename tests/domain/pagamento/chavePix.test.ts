import { describe, expect, it } from 'vitest'
import { prontidaoPix, tipoChavePix } from '@/domain/pagamento/chavePix'

describe('tipoChavePix', () => {
  it('reconhece cada tipo', () => {
    expect(tipoChavePix('')).toBe('vazia')
    expect(tipoChavePix('123.456.789-09')).toBe('cpf')
    expect(tipoChavePix('12.345.678/0001-90')).toBe('cnpj')
    expect(tipoChavePix('lanche@exemplo.com')).toBe('email')
    expect(tipoChavePix('+55 (85) 99999-0000')).toBe('telefone')
    expect(tipoChavePix('123e4567-e89b-12d3-a456-426614174000')).toBe('aleatoria')
    expect(tipoChavePix('qualquer coisa')).toBe('desconhecida')
  })
})

describe('prontidaoPix', () => {
  it('pronto com chave, nome e cidade; mostra como fica no banco', () => {
    const r = prontidaoPix({ chave: 'lanche@exemplo.com', nome: 'Lanche do Espocado', cidade: 'São Luís' })
    expect(r.pronto).toBe(true)
    expect(r.cidadeNoBanco).toBe('Sao Luis')
  })
  it('lista o que falta', () => {
    expect(prontidaoPix({ chave: 'x', nome: 'Lanche', cidade: '' }).faltando).toEqual(['cidade'])
    expect(prontidaoPix({ chave: '', nome: '', cidade: '' }).faltando).toEqual(['chave Pix', 'nome do estabelecimento', 'cidade'])
  })
})
