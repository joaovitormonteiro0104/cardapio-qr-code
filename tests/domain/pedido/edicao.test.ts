import { describe, expect, it } from 'vitest'
import { acaoDisponivel, dentroDaJanelaLivre, fimDaJanelaLivre } from '@/domain/pedido/edicao'
import type { EstadoPedido } from '@/domain/pedido/estado'

const INICIO = new Date('2026-11-10T12:00:00.000Z')
const depois = (ms: number) => new Date(INICIO.getTime() + ms)
const MIN = 60_000
const configs = { janelaEdicaoPreparandoMin: 2 }
const p = (estado: EstadoPedido) => ({ estado, estadoDesde: INICIO })

describe('dentroDaJanelaLivre', () => {
  it('Recebido está sempre na janela', () => {
    expect(dentroDaJanelaLivre(p('Recebido'), configs, depois(60 * MIN))).toBe(true)
  })

  it('Preparando: 1 ms antes do limite ainda está aberta', () => {
    expect(dentroDaJanelaLivre(p('Preparando'), configs, depois(2 * MIN - 1))).toBe(true)
  })

  it('Preparando: exatamente no limite já está fechada', () => {
    expect(dentroDaJanelaLivre(p('Preparando'), configs, depois(2 * MIN))).toBe(false)
  })

  it('Preparando: logo após entrar está aberta', () => {
    expect(dentroDaJanelaLivre(p('Preparando'), configs, INICIO)).toBe(true)
  })

  it('janela configurada como 0: Preparando nunca é livre', () => {
    expect(dentroDaJanelaLivre(p('Preparando'), { janelaEdicaoPreparandoMin: 0 }, INICIO)).toBe(false)
    expect(dentroDaJanelaLivre(p('Recebido'), { janelaEdicaoPreparandoMin: 0 }, INICIO)).toBe(true)
  })

  it.each<EstadoPedido>(['Pronto', 'Entregue', 'Finalizado', 'Cancelado', 'EdicaoSolicitada', 'CancelamentoPendente'])(
    '%s nunca está na janela',
    estado => {
      expect(dentroDaJanelaLivre(p(estado), configs, INICIO)).toBe(false)
    },
  )
})

describe('acaoDisponivel', () => {
  it('editar_livre dentro da janela', () => {
    expect(acaoDisponivel(p('Recebido'), configs, INICIO)).toBe('editar_livre')
    expect(acaoDisponivel(p('Preparando'), configs, depois(MIN))).toBe('editar_livre')
  })

  it('solicitar_edicao em Preparando fora da janela e em Pronto', () => {
    expect(acaoDisponivel(p('Preparando'), configs, depois(2 * MIN))).toBe('solicitar_edicao')
    expect(acaoDisponivel(p('Pronto'), configs, INICIO)).toBe('solicitar_edicao')
  })

  it.each<EstadoPedido>(['Entregue', 'Finalizado', 'Cancelado', 'EdicaoSolicitada', 'CancelamentoPendente'])(
    'bloqueado em %s',
    estado => {
      expect(acaoDisponivel(p(estado), configs, INICIO)).toBe('bloqueado')
    },
  )
})

describe('fimDaJanelaLivre', () => {
  it('é estadoDesde + janela em Preparando', () => {
    expect(fimDaJanelaLivre(p('Preparando'), configs)).toEqual(depois(2 * MIN))
  })

  it('não existe nos outros estados', () => {
    expect(fimDaJanelaLivre(p('Recebido'), configs)).toBeNull()
  })
})
