import { describe, expect, it } from 'vitest'
import { comandaInativa, podeFecharAutomaticamente } from '@/domain/comanda/sessao'
import type { PedidoCalculo } from '@/domain/pedido/calculo'

const INICIO = new Date('2026-11-10T12:00:00.000Z')
const HORA = 3_600_000
const depois = (ms: number) => new Date(INICIO.getTime() + ms)
const configs = { timeoutSessaoMesaH: 4 }

describe('comandaInativa', () => {
  const aberta = { estado: 'Aberta' as const, ultimaAtividadeEm: INICIO }

  it('ativa antes do limite', () => {
    expect(comandaInativa(aberta, configs, depois(4 * HORA - 1))).toBe(false)
  })

  it('inativa a partir do limite', () => {
    expect(comandaInativa(aberta, configs, depois(4 * HORA))).toBe(true)
  })

  it('Fechada nunca é inativa', () => {
    expect(comandaInativa({ estado: 'Fechada', ultimaAtividadeEm: INICIO }, configs, depois(99 * HORA))).toBe(false)
  })
})

describe('podeFecharAutomaticamente', () => {
  const entregue: PedidoCalculo = {
    estado: 'Entregue',
    itens: [{ quantidade: 1, precoCentavosSnapshot: 1000, removidoEm: null }],
  }
  const preparando: PedidoCalculo = { ...entregue, estado: 'Preparando' }
  const cancelado: PedidoCalculo = { ...entregue, estado: 'Cancelado' }

  it('paga e sem pendentes: fecha', () => {
    expect(podeFecharAutomaticamente({ estado: 'Paga', ultimaAtividadeEm: INICIO }, [entregue])).toBe(true)
  })

  it('total zero: fecha', () => {
    expect(podeFecharAutomaticamente({ estado: 'Aberta', ultimaAtividadeEm: INICIO }, [cancelado])).toBe(true)
  })

  it('não paga: fica destacada', () => {
    expect(podeFecharAutomaticamente({ estado: 'Aberta', ultimaAtividadeEm: INICIO }, [entregue])).toBe(false)
  })

  it('com pendente: fica destacada', () => {
    expect(podeFecharAutomaticamente({ estado: 'Paga', ultimaAtividadeEm: INICIO }, [preparando])).toBe(false)
  })
})
