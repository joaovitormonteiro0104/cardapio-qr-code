// Export CSV da auditoria (AGENTS.md §6.10, PRD GER-08). Puro.
import type { AtorTipo } from './evento'
import { resumirEvento, rotuloAtor } from './resumo'
import { rotuloMotivo, rotuloTipoEvento } from './rotulos'

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

/** Colunas em português, para abrir no Excel e mandar ao contador (decisão 25). */
const CABECALHO = ['Data e hora', 'Evento', 'Quem', 'Mesa', 'Conta', 'Pedido', 'Motivo', 'Detalhes']

const numeroOuVazio = (n: number | null) => (n === null ? null : String(n))

export function eventosParaCsv(
  eventos: readonly EventoParaCsv[],
  fuso: string,
  nomesFuncionarios: ReadonlyMap<string, string> = new Map(),
): string {
  const linhas = eventos.map(e => {
    const resumo = resumirEvento(e.tipoEvento, e.payload)
    return [
      dataHoraCsv(e.criadoEm, fuso),
      rotuloTipoEvento(e.tipoEvento),
      rotuloAtor(e.atorTipo, e.atorId, nomesFuncionarios, e.payload),
      numeroOuVazio(resumo.mesa),
      numeroOuVazio(resumo.conta),
      numeroOuVazio(resumo.pedido),
      rotuloMotivo(e.motivo),
      resumo.texto,
    ]
      .map(campoCsv)
      .join(SEPARADOR)
  })
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
