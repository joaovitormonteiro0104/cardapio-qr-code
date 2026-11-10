// Export CSV da auditoria (AGENTS.md §6.10, PRD GER-08). Puro.
import type { AtorTipo } from './evento'

export interface EventoParaCsv {
  criadoEm: Date
  tipoEvento: string
  atorTipo: AtorTipo
  atorId: string | null
  comandaId: string | null
  pedidoId: string | null
  motivo: string | null
  payload: unknown
}

/** BOM UTF-8: faz o Excel reconhecer os acentos. */
export const BOM = '﻿'
/** Excel em português usa ";" como separador. */
export const SEPARADOR = ';'

/** Escapa um campo: aspas duplicadas e envolve em aspas se tiver separador, aspas ou quebra de linha. */
export function campoCsv(valor: string | null): string {
  const texto = valor ?? ''
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/** "09/11/2026 14:05:33" no fuso informado. */
export function dataHoraCsv(data: Date, fuso: string): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(data)
  const p = (tipo: Intl.DateTimeFormatPartTypes) => partes.find(x => x.type === tipo)?.value ?? ''
  return `${p('day')}/${p('month')}/${p('year')} ${p('hour')}:${p('minute')}:${p('second')}`
}

const CABECALHO = ['data_hora', 'tipo_evento', 'ator_tipo', 'ator_id', 'comanda_id', 'pedido_id', 'motivo', 'detalhes']

export function eventosParaCsv(eventos: readonly EventoParaCsv[], fuso: string): string {
  const linhas = eventos.map(e =>
    [
      dataHoraCsv(e.criadoEm, fuso),
      e.tipoEvento,
      e.atorTipo,
      e.atorId,
      e.comandaId,
      e.pedidoId,
      e.motivo,
      JSON.stringify(e.payload ?? {}),
    ]
      .map(campoCsv)
      .join(SEPARADOR),
  )
  return BOM + [CABECALHO.join(SEPARADOR), ...linhas].join('\r\n') + '\r\n'
}

/**
 * Converte datas do formulário ("2026-11-09", dia local) num intervalo UTC
 * [desde, ate) cobrindo os dias inteiros. `offset` é o deslocamento fixo do
 * fuso (Fortaleza não tem horário de verão: "-03:00").
 */
export function intervaloDeDias(inicio: string, fim: string, offset: string): { desde: Date; ate: Date } | null {
  const valido = /^\d{4}-\d{2}-\d{2}$/
  if (!valido.test(inicio) || !valido.test(fim)) return null
  const desde = new Date(`${inicio}T00:00:00${offset}`)
  const fimDia = new Date(`${fim}T00:00:00${offset}`)
  if (Number.isNaN(desde.getTime()) || Number.isNaN(fimDia.getTime())) return null
  const ate = new Date(fimDia.getTime() + 24 * 60 * 60 * 1000)
  return ate > desde ? { desde, ate } : null
}
