import { describe, expect, it } from 'vitest'
import {
  MOTIVOS_CANCELAMENTO,
  confirmacaoPorNumeroValida,
  motivoCancelamentoParaCliente,
  motivoParaRegistro,
  podeCancelar,
  precisaDuasEtapas,
  validaMotivo,
} from '@/domain/pedido/cancelamento'
import type { EstadoPedido } from '@/domain/pedido/estado'

describe('podeCancelar', () => {
  it.each<[EstadoPedido, boolean]>([
    ['Recebido', true],
    ['Preparando', true],
    ['Pronto', true],
    ['Entregue', false],
    ['Finalizado', false],
    ['Cancelado', false],
    ['EdicaoSolicitada', false],
    ['CancelamentoPendente', false],
  ])('%s → %s', (estado, esperado) => {
    expect(podeCancelar({ estado })).toBe(esperado)
  })
})

describe('precisaDuasEtapas', () => {
  it('Recebido é 1 etapa; Preparando e Pronto são 2', () => {
    expect(precisaDuasEtapas({ estado: 'Recebido' })).toBe(false)
    expect(precisaDuasEtapas({ estado: 'Preparando' })).toBe(true)
    expect(precisaDuasEtapas({ estado: 'Pronto' })).toBe(true)
  })
})

describe('validaMotivo', () => {
  it('lista fixa tem os 5 motivos', () => {
    expect(MOTIVOS_CANCELAMENTO).toEqual(['sem_ingrediente', 'erro_de_pedido', 'cliente_desistiu', 'atraso', 'outro'])
  })

  it('aceita motivo da lista sem texto', () => {
    expect(validaMotivo('atraso')).toBeNull()
    expect(validaMotivo('sem_ingrediente', '  ')).toBeNull()
  })

  it('"outro" exige texto', () => {
    expect(validaMotivo('outro')).toBe('texto_obrigatorio')
    expect(validaMotivo('outro', '   ')).toBe('texto_obrigatorio')
    expect(validaMotivo('outro', 'cliente passou mal')).toBeNull()
  })

  it('rejeita motivo fora da lista', () => {
    expect(validaMotivo('porque sim')).toBe('motivo_invalido')
    expect(validaMotivo('')).toBe('motivo_invalido')
  })

  it('rejeita texto longo demais', () => {
    expect(validaMotivo('atraso', 'x'.repeat(301))).toBe('texto_longo')
  })
})

describe('confirmacaoPorNumeroValida', () => {
  it('aceita o número exato, com ou sem # e espaços', () => {
    expect(confirmacaoPorNumeroValida('1248', 1248)).toBe(true)
    expect(confirmacaoPorNumeroValida(' #1248 ', 1248)).toBe(true)
  })

  it('rejeita número diferente ou texto', () => {
    expect(confirmacaoPorNumeroValida('1249', 1248)).toBe(false)
    expect(confirmacaoPorNumeroValida('', 1248)).toBe(false)
    expect(confirmacaoPorNumeroValida('12a48', 1248)).toBe(false)
  })
})

describe('motivoParaRegistro', () => {
  it('junta motivo e texto', () => {
    expect(motivoParaRegistro('outro', ' queimou ')).toBe('outro: queimou')
    expect(motivoParaRegistro('atraso')).toBe('atraso')
  })
})

describe('motivoCancelamentoParaCliente', () => {
  it('sem motivo não mostra nada', () => {
    expect(motivoCancelamentoParaCliente(null)).toBeNull()
  })

  it('cancelado pelo próprio cliente', () => {
    expect(motivoCancelamentoParaCliente('cliente_janela_livre')).toBe('Você cancelou este pedido.')
  })

  it('auto-cancelamento explica e convida a pedir de novo', () => {
    expect(motivoCancelamentoParaCliente('auto_cancelamento')).toContain('não confirmou a tempo')
  })

  it('motivo da cozinha mostra a categoria em português', () => {
    expect(motivoCancelamentoParaCliente('sem_ingrediente')).toBe('Cancelado pela cozinha: sem ingrediente.')
    expect(motivoCancelamentoParaCliente('atraso: forno quebrou')).toBe('Cancelado pela cozinha: atraso.')
  })

  it('texto livre da cozinha não vaza para o cliente', () => {
    const texto = motivoCancelamentoParaCliente('outro: cliente grosseiro')
    expect(texto).not.toContain('grosseiro')
    expect(texto).toContain('garçom')
  })

  it('valor desconhecido cai numa mensagem genérica', () => {
    expect(motivoCancelamentoParaCliente('algo_novo')).toBe('Cancelado pela cozinha.')
  })
})
