import { describe, expect, it } from 'vitest'
import { urgenciaPedido } from '@/domain/pedido/urgencia'

const INICIO = new Date('2026-11-12T20:00:00.000Z')
const MIN = 60_000
const depois = (ms: number) => new Date(INICIO.getTime() + ms)
const configs = { timeoutAutoCancelamentoMin: 15 }
const recebido = { estado: 'Recebido' as const, estadoDesde: INICIO, estadoComanda: 'Aberta' as const }

describe('urgenciaPedido', () => {
  it('pedido recém-chegado é normal e mostra o prazo inteiro', () => {
    expect(urgenciaPedido(recebido, configs, depois(0))).toEqual({ nivel: 'normal', minutosParaCancelar: 15 })
  })

  it('a partir de 60% do prazo pede atenção', () => {
    expect(urgenciaPedido(recebido, configs, depois(9 * MIN - 1)).nivel).toBe('normal')
    expect(urgenciaPedido(recebido, configs, depois(9 * MIN))).toEqual({ nivel: 'atencao', minutosParaCancelar: 6 })
  })

  it('nos últimos 3 minutos é crítico', () => {
    expect(urgenciaPedido(recebido, configs, depois(12 * MIN))).toEqual({ nivel: 'critico', minutosParaCancelar: 3 })
    expect(urgenciaPedido(recebido, configs, depois(20 * MIN))).toEqual({ nivel: 'critico', minutosParaCancelar: 0 })
  })

  it('fora de Recebido ou com conta já em pagamento não há prazo', () => {
    expect(urgenciaPedido({ ...recebido, estado: 'Preparando' }, configs, depois(14 * MIN))).toEqual({
      nivel: 'normal',
      minutosParaCancelar: null,
    })
    expect(urgenciaPedido({ ...recebido, estadoComanda: 'AguardandoPagamento' }, configs, depois(14 * MIN)).minutosParaCancelar).toBeNull()
  })
})
