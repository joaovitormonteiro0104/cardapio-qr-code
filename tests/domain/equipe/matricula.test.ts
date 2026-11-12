import { describe, expect, it } from 'vitest'
import { variantesMatricula } from '@/domain/equipe/matricula'

describe('variantesMatricula', () => {
  it('"1" tenta também "001"', () => {
    expect(variantesMatricula('1')).toEqual(['1', '001'])
  })

  it('"001" tenta também "1"', () => {
    expect(variantesMatricula('001')).toEqual(['001', '1'])
  })

  it('"0007" tenta "7" e "007"', () => {
    expect(variantesMatricula('0007')).toEqual(['0007', '7', '007'])
  })

  it('matrícula longa sem zeros fica como está', () => {
    expect(variantesMatricula('1234')).toEqual(['1234'])
  })

  it('"0" continua "0" e ganha "000"', () => {
    expect(variantesMatricula('0')).toEqual(['0', '000'])
  })

  it('texto inválido não gera tentativa', () => {
    expect(variantesMatricula('')).toEqual([])
    expect(variantesMatricula('12a')).toEqual([])
  })
})
