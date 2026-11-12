import { describe, expect, it } from 'vitest'
import { situacaoValorCopiado } from '@/domain/pagamento/valorCopiado'

describe('situacaoValorCopiado', () => {
  it('sem cópia ainda', () => {
    expect(situacaoValorCopiado(null, 4800)).toBe('nao_copiado')
  })

  it('mesmo valor', () => {
    expect(situacaoValorCopiado(4800, 4800)).toBe('igual')
  })

  it('alguém da mesa pediu mais (ou cancelou) depois da cópia', () => {
    expect(situacaoValorCopiado(4800, 5450)).toBe('mudou')
    expect(situacaoValorCopiado(4800, 3000)).toBe('mudou')
  })
})
