import { describe, expect, it } from 'vitest'
import { atalhoAtivo, periodoDoAtalho } from '@/domain/auditoria/periodo'

describe('periodoDoAtalho', () => {
  it('hoje, ontem, 7 dias e mês', () => {
    expect(periodoDoAtalho('hoje', '2026-11-13')).toEqual({ inicio: '2026-11-13', fim: '2026-11-13' })
    expect(periodoDoAtalho('ontem', '2026-11-01')).toEqual({ inicio: '2026-10-31', fim: '2026-10-31' })
    expect(periodoDoAtalho('semana', '2026-11-03')).toEqual({ inicio: '2026-10-28', fim: '2026-11-03' })
    expect(periodoDoAtalho('mes', '2026-11-13')).toEqual({ inicio: '2026-11-01', fim: '2026-11-13' })
  })
  it('reconhece o atalho do período escolhido', () => {
    expect(atalhoAtivo('2026-11-12', '2026-11-12', '2026-11-13')).toBe('ontem')
    expect(atalhoAtivo('2026-11-02', '2026-11-05', '2026-11-13')).toBeNull()
  })
})
