import { describe, expect, it } from 'vitest'
import { pedidoExpirado, pedidosExpirados } from '@/domain/pedido/autoCancelamento'
import type { EstadoPedido } from '@/domain/pedido/estado'

const INICIO = new Date('2026-11-10T12:00:00.000Z')
const MIN = 60_000
const depois = (ms: number) => new Date(INICIO.getTime() + ms)
const configs = { timeoutAutoCancelamentoMin: 15 }

describe('pedidoExpirado', () => {
  const recebido = { estado: 'Recebido' as const, estadoDesde: INICIO, estadoComanda: 'Aberta' as const }

  it('não expira antes do limite', () => {
    expect(pedidoExpirado(recebido, configs, depois(15 * MIN - 1))).toBe(false)
  })

  it('expira exatamente no limite', () => {
    expect(pedidoExpirado(recebido, configs, depois(15 * MIN))).toBe(true)
  })

  it.each<EstadoPedido>(['Preparando', 'Pronto', 'EdicaoSolicitada', 'Cancelado'])(
    '%s nunca expira',
    estado => {
      expect(pedidoExpirado({ estado, estadoDesde: INICIO, estadoComanda: 'Aberta' as const }, configs, depois(999 * MIN))).toBe(false)
    },
  )
})

describe('conta que já avisou o pagamento (decisão 20)', () => {
  it.each(['AguardandoPagamento', 'Paga'] as const)('em %s o pedido não é cancelado sozinho', estadoComanda => {
    expect(pedidoExpirado({ estado: 'Recebido', estadoDesde: INICIO, estadoComanda }, configs, depois(999 * MIN))).toBe(false)
  })
})

describe('pedidosExpirados', () => {
  it('filtra só os vencidos e preserva os objetos', () => {
    const pedidos = [
      { id: 'velho', estado: 'Recebido' as const, estadoDesde: INICIO, estadoComanda: 'Aberta' as const },
      { id: 'novo', estado: 'Recebido' as const, estadoDesde: depois(10 * MIN), estadoComanda: 'Aberta' as const },
      { id: 'aceito', estado: 'Preparando' as const, estadoDesde: INICIO, estadoComanda: 'Aberta' as const },
    ]
    expect(pedidosExpirados(pedidos, configs, depois(20 * MIN)).map(p => p.id)).toEqual(['velho'])
  })
})
