import { describe, expect, it } from 'vitest'
import { TIPOS_EVENTO } from '@/domain/auditoria/evento'
import { ROTULOS_TIPO_EVENTO, rotuloEstado, rotuloMotivo, rotuloTipoEvento } from '@/domain/auditoria/rotulos'

describe('rotuloTipoEvento', () => {
  it('todo tipo de evento tem rótulo sem "_"', () => {
    for (const tipo of TIPOS_EVENTO) {
      expect(ROTULOS_TIPO_EVENTO[tipo]).toBeTruthy()
      expect(rotuloTipoEvento(tipo)).not.toContain('_')
    }
  })

  it('código desconhecido vira texto com espaços', () => {
    expect(rotuloTipoEvento('algo_novo')).toBe('algo novo')
  })
})

describe('rotuloEstado', () => {
  it('separa as palavras dos estados compostos', () => {
    expect(rotuloEstado('AguardandoPagamento')).toBe('Aguardando pagamento')
    expect(rotuloEstado('Preparando')).toBe('Preparando')
  })
})

describe('rotuloMotivo', () => {
  it('vazio quando não há motivo', () => {
    expect(rotuloMotivo(null)).toBe('')
  })

  it('traduz a categoria e mantém o texto livre', () => {
    expect(rotuloMotivo('sem_ingrediente')).toBe('Sem ingrediente')
    expect(rotuloMotivo('outro: forno quebrou')).toBe('Outro: forno quebrou')
    expect(rotuloMotivo('atraso: 40 min')).toBe('Atraso: 40 min')
  })

  it('motivos do cliente e do sistema', () => {
    expect(rotuloMotivo('cliente_janela_livre')).toContain('Cliente')
    expect(rotuloMotivo('auto_cancelamento')).toContain('Automático')
  })

  it('texto fora da lista passa como está', () => {
    expect(rotuloMotivo('qualquer coisa')).toBe('qualquer coisa')
  })
})
