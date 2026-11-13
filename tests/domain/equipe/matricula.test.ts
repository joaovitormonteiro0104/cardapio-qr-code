import { describe, expect, it } from 'vitest'
import { matriculaEquivalente, proximaMatriculaLivre, variantesMatricula } from '@/domain/equipe/matricula'

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

describe('matriculaEquivalente', () => {
  it('"1" equivale a "001" já cadastrada', () => {
    expect(matriculaEquivalente('1', ['001', '002'])).toBe('001')
    expect(matriculaEquivalente('0002', ['001', '2'])).toBe('2')
  })
  it('matrícula nova sem equivalente', () => {
    expect(matriculaEquivalente('10', ['001', '100'])).toBeNull()
  })
})

describe('proximaMatriculaLivre', () => {
  it('segue a maior, com 3 dígitos', () => {
    expect(proximaMatriculaLivre(['001', '003'])).toBe('004')
    expect(proximaMatriculaLivre([])).toBe('001')
    expect(proximaMatriculaLivre(['1234'])).toBe('1235')
  })
})
