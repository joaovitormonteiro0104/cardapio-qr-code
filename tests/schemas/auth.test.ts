import { describe, expect, it } from 'vitest'
import { LoginSchema, MatriculaSchema, PinSchema, emailSintetico } from '@/schemas/auth'

describe('MatriculaSchema', () => {
  it.each(['1', '001', '123456'])('aceita %s', valor => {
    expect(MatriculaSchema.safeParse(valor).success).toBe(true)
  })

  it('ignora espaços nas pontas', () => {
    expect(MatriculaSchema.parse(' 042 ')).toBe('042')
  })

  it.each(['', '1234567', '12a', '-1', '1.0', '12 3'])('rejeita "%s"', valor => {
    expect(MatriculaSchema.safeParse(valor).success).toBe(false)
  })
})

describe('PinSchema', () => {
  it('aceita exatamente 6 dígitos', () => {
    expect(PinSchema.safeParse('012345').success).toBe(true)
  })

  it.each([
    ['5 dígitos', '12345'],
    ['7 dígitos', '1234567'],
    ['letras', '12345a'],
    ['espaço', '12345 '],
    ['vazio', ''],
  ])('rejeita PIN com %s', (_caso, valor) => {
    expect(PinSchema.safeParse(valor).success).toBe(false)
  })
})

describe('LoginSchema', () => {
  it('aceita matrícula e PIN válidos', () => {
    expect(LoginSchema.parse({ matricula: '001', pin: '123456' })).toEqual({
      matricula: '001',
      pin: '123456',
    })
  })

  it('rejeita quando falta o PIN', () => {
    expect(LoginSchema.safeParse({ matricula: '001' }).success).toBe(false)
  })
})

describe('emailSintetico', () => {
  it('monta o email interno a partir da matrícula', () => {
    expect(emailSintetico('001')).toBe('001@restaurante.local')
  })

  it('lança erro para matrícula inválida', () => {
    expect(() => emailSintetico('abc')).toThrow()
  })
})
