import { describe, expect, it } from 'vitest'
import { BOM, campoCsv, dataHoraCsv, eventosParaCsv, intervaloDeDias } from '@/domain/auditoria/csv'
import { ATOR_SISTEMA, TIPOS_EVENTO, criarEvento } from '@/domain/auditoria/evento'

const FUSO = 'America/Fortaleza'

describe('campoCsv', () => {
  it('deixa texto simples como está', () => {
    expect(campoCsv('pedido_criado')).toBe('pedido_criado')
  })

  it('null vira vazio', () => {
    expect(campoCsv(null)).toBe('')
  })

  it('escapa separador, aspas e quebra de linha', () => {
    expect(campoCsv('a;b')).toBe('"a;b"')
    expect(campoCsv('ele disse "oi"')).toBe('"ele disse ""oi"""')
    expect(campoCsv('linha1\nlinha2')).toBe('"linha1\nlinha2"')
  })
})

describe('dataHoraCsv', () => {
  it('formata no fuso de Fortaleza (UTC-3)', () => {
    expect(dataHoraCsv(new Date('2026-11-10T02:05:09Z'), FUSO)).toBe('09/11/2026 23:05:09')
  })
})

describe('eventosParaCsv', () => {
  const csv = eventosParaCsv(
    [
      {
        criadoEm: new Date('2026-11-10T15:00:00Z'),
        tipoEvento: 'pedido_cancelado',
        atorTipo: 'funcionario',
        atorId: '001',
        comandaId: null,
        pedidoId: null,
        motivo: 'outro: queimou; refazer',
        payload: { numero: 12 },
      },
    ],
    FUSO,
  )

  it('começa com BOM e cabeçalho em português', () => {
    expect(csv.startsWith(BOM + 'Data e hora;Evento;Quem;Mesa;Conta;Pedido;Motivo;Detalhes')).toBe(true)
  })

  it('usa CRLF, rótulos legíveis e escapa campos', () => {
    const [, linha] = csv.slice(1).split('\r\n')
    expect(linha).toBe('10/11/2026 12:00:00;Pedido cancelado;Funcionário 001;;;12;"Outro: queimou; refazer";')
  })

  it('usa o nome do funcionário quando conhecido', () => {
    const comNome = eventosParaCsv(
      [
        {
          criadoEm: new Date('2026-11-10T15:00:00Z'),
          tipoEvento: 'comanda_fechada',
          atorTipo: 'funcionario',
          atorId: '004',
          comandaId: null,
          pedidoId: null,
          motivo: null,
          payload: { numero: 530, mesa: 7, de: 'Paga', para: 'Fechada' },
        },
      ],
      FUSO,
      new Map([['004', 'Ana']]),
    )
    expect(comNome.split('\r\n')[1]).toBe('10/11/2026 12:00:00;Mesa fechada;Ana (004);7;530;;;Paga → Fechada')
  })

  it('lista vazia gera só o cabeçalho', () => {
    expect(eventosParaCsv([], FUSO).split('\r\n').filter(Boolean)).toHaveLength(1)
  })
})

describe('intervaloDeDias', () => {
  it('cobre os dias inteiros no fuso', () => {
    const intervalo = intervaloDeDias('2026-11-09', '2026-11-10', '-03:00')
    expect(intervalo?.desde.toISOString()).toBe('2026-11-09T03:00:00.000Z')
    expect(intervalo?.ate.toISOString()).toBe('2026-11-11T03:00:00.000Z')
  })

  it('um dia só', () => {
    const intervalo = intervaloDeDias('2026-11-09', '2026-11-09', '-03:00')
    expect(intervalo && intervalo.ate.getTime() - intervalo.desde.getTime()).toBe(86_400_000)
  })

  it('rejeita fim antes do início e formato inválido', () => {
    expect(intervaloDeDias('2026-11-10', '2026-11-08', '-03:00')).toBeNull()
    expect(intervaloDeDias('09/11/2026', '2026-11-10', '-03:00')).toBeNull()
  })
})

describe('criarEvento', () => {
  it('preenche opcionais com null e {}', () => {
    expect(criarEvento('pedido_criado', ATOR_SISTEMA)).toEqual({
      tipoEvento: 'pedido_criado',
      ator: { tipo: 'sistema', id: null },
      comandaId: null,
      pedidoId: null,
      payload: {},
      motivo: null,
    })
  })

  it('carrega comanda, pedido, payload e motivo', () => {
    const evento = criarEvento('pedido_cancelado', { tipo: 'funcionario', id: '001' }, {
      comandaId: 'c',
      pedidoId: 'p',
      payload: { numero: 1 },
      motivo: 'atraso',
    })
    expect(evento).toMatchObject({ comandaId: 'c', pedidoId: 'p', payload: { numero: 1 }, motivo: 'atraso' })
  })

  it('tipos de evento são únicos', () => {
    expect(new Set(TIPOS_EVENTO).size).toBe(TIPOS_EVENTO.length)
  })
})
