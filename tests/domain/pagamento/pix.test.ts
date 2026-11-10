import { describe, expect, it } from 'vitest'
import { PixInvalidoError, crc16, gerarPayloadPix, normalizarTexto, valorPix } from '@/domain/pagamento/pix'

describe('crc16', () => {
  it('valor de verificação padrão do CRC-16/CCITT-FALSE', () => {
    // "123456789" → 0x29B1 (check value publicado do algoritmo)
    expect(crc16('123456789')).toBe('29B1')
  })
})

describe('gerarPayloadPix', () => {
  it('reproduz o exemplo do manual do Banco Central (sem valor)', () => {
    expect(
      gerarPayloadPix({
        chave: '123e4567-e12b-12d1-a456-426655440000',
        nome: 'Fulano de Tal',
        cidade: 'BRASILIA',
      }),
    ).toBe(
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
    )
  })

  it('inclui o valor no campo 54 e o txid no 62', () => {
    const payload = gerarPayloadPix({
      chave: 'contato@exemplo.com',
      valorCentavos: 5630,
      nome: 'Lanchonete',
      cidade: 'Fortaleza',
      txid: 'C530',
    })
    expect(payload).toContain('540556.30')
    expect(payload).toContain('62080504C530')
    expect(payload).toContain('0119contato@exemplo.com')
    // CRC confere com o resto do texto
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)))
  })

  it('tira acentos e corta nome (25) e cidade (15)', () => {
    const payload = gerarPayloadPix({
      chave: 'x',
      nome: 'Restaurante São João da Praça Grande',
      cidade: 'São Gonçalo do Amarante',
      valorCentavos: 100,
    })
    expect(payload).toContain('5925Restaurante Sao Joao da P')
    expect(payload).toContain('6015Sao Goncalo do ')
  })

  it('txid vazio ou com símbolos', () => {
    expect(gerarPayloadPix({ chave: 'x', nome: 'A', cidade: 'B' })).toContain('0503***')
    expect(gerarPayloadPix({ chave: 'x', nome: 'A', cidade: 'B', txid: 'C-5 3/0' })).toContain('0504C530')
  })

  it('exige chave, nome e cidade', () => {
    expect(() => gerarPayloadPix({ chave: ' ', nome: 'A', cidade: 'B' })).toThrow(PixInvalidoError)
    expect(() => gerarPayloadPix({ chave: 'x', nome: '', cidade: 'B' })).toThrow(PixInvalidoError)
    expect(() => gerarPayloadPix({ chave: 'x', nome: 'A', cidade: ' ' })).toThrow(PixInvalidoError)
  })

  it('recusa valor negativo ou fracionado', () => {
    expect(() => gerarPayloadPix({ chave: 'x', nome: 'A', cidade: 'B', valorCentavos: -1 })).toThrow()
    expect(() => gerarPayloadPix({ chave: 'x', nome: 'A', cidade: 'B', valorCentavos: 1.5 })).toThrow()
  })
})

describe('valorPix e normalizarTexto', () => {
  it.each([
    [5630, '56.30'],
    [5, '0.05'],
    [100000, '1000.00'],
  ])('%i → %s', (centavos, esperado) => {
    expect(valorPix(centavos)).toBe(esperado)
  })

  it('remove acentos e emojis', () => {
    expect(normalizarTexto(' Açaí 🍧 ')).toBe('Acai')
  })
})
