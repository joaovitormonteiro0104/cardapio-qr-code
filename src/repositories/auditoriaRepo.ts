import { z } from 'zod'
import { supabase } from './supabase'
import type { Ator, NovoEvento } from '@/domain/auditoria/evento'
import { DOMINIO_EMAIL_SINTETICO } from '@/schemas/auth'
import { DataHoraSchema } from '@/schemas/comum'

const EventoSchema = z.object({
  id: z.uuid(),
  criadoEm: DataHoraSchema,
  tipoEvento: z.string(),
  atorTipo: z.enum(['cliente', 'funcionario', 'sistema']),
  atorId: z.string().nullable(),
  comandaId: z.uuid().nullable(),
  pedidoId: z.uuid().nullable(),
  motivo: z.string().nullable(),
  payload: z.unknown(),
})
export type EventoAuditoria = z.infer<typeof EventoSchema>

interface LinhaEvento {
  id: string
  criado_em: string
  tipo_evento: string
  ator_tipo: string
  ator_id: string | null
  comanda_id: string | null
  pedido_id: string | null
  motivo: string | null
  payload: unknown
}

function paraEvento(l: LinhaEvento): EventoAuditoria {
  return EventoSchema.parse({
    id: l.id,
    criadoEm: l.criado_em,
    tipoEvento: l.tipo_evento,
    atorTipo: l.ator_tipo,
    atorId: l.ator_id,
    comandaId: l.comanda_id,
    pedidoId: l.pedido_id,
    motivo: l.motivo,
    payload: l.payload,
  })
}

export interface FiltrosAuditoria {
  desde: Date
  ate: Date
  tipoEvento?: string | null
  atorId?: string | null
  /** Só um tipo de ator (ex.: todos os clientes, ou o sistema). */
  atorTipo?: 'cliente' | 'funcionario' | 'sistema' | null
  /** Mesa gravada no evento (eventos a partir de 13/11/2026). */
  mesa?: number | null
  /** Número da conta ou do pedido. */
  numero?: number | null
  /** começa em 0 */
  pagina: number
}

export const TAMANHO_PAGINA = 50
export const LIMITE_EXPORTACAO = 50_000
const COLUNAS = 'id, criado_em, tipo_evento, ator_tipo, ator_id, comanda_id, pedido_id, motivo, payload'

function base(contar: boolean) {
  return supabase.from('eventos_auditoria').select(COLUNAS, contar ? { count: 'exact' } : undefined)
}

function aplicarFiltros(consulta: ReturnType<typeof base>, f: Omit<FiltrosAuditoria, 'pagina'>) {
  let q = consulta.gte('criado_em', f.desde.toISOString()).lt('criado_em', f.ate.toISOString())
  if (f.tipoEvento) q = q.eq('tipo_evento', f.tipoEvento)
  if (f.atorId) q = q.eq('ator_id', f.atorId.trim())
  if (f.atorTipo) q = q.eq('ator_tipo', f.atorTipo)
  if (f.mesa) q = q.eq('payload->>mesa', String(f.mesa))
  if (f.numero) q = q.or(`payload->>numero.eq.${f.numero},payload->>conta.eq.${f.numero}`)
  return q
}

/** Página de eventos (só gerência, pela RLS), mais recentes primeiro. */
export async function listar(f: FiltrosAuditoria): Promise<{ eventos: EventoAuditoria[]; total: number }> {
  const inicio = f.pagina * TAMANHO_PAGINA
  const { data, error, count } = await aplicarFiltros(base(true), f)
    .order('criado_em', { ascending: false })
    .range(inicio, inicio + TAMANHO_PAGINA - 1)
  if (error) throw new Error(`auditoria.listar: ${error.message}`)
  return { eventos: (data as LinhaEvento[]).map(paraEvento), total: count ?? 0 }
}

/**
 * Todos os eventos do período (em lotes de 1000), mais antigos primeiro, para o CSV.
 * `aoProgredir` recebe quantos já vieram; `cortado` avisa se passou do limite.
 */
export async function listarParaExportacao(
  f: Omit<FiltrosAuditoria, 'pagina'>,
  aoProgredir?: (quantos: number) => void,
): Promise<{ eventos: EventoAuditoria[]; cortado: boolean }> {
  const todos: EventoAuditoria[] = []
  const lote = 1000
  for (let inicio = 0; inicio < LIMITE_EXPORTACAO; inicio += lote) {
    const { data, error } = await aplicarFiltros(base(false), f)
      .order('criado_em', { ascending: true })
      .order('id', { ascending: true })
      .range(inicio, inicio + lote - 1)
    if (error) throw new Error(`auditoria.exportar: ${error.message}`)
    const linhas = data as LinhaEvento[]
    todos.push(...linhas.map(paraEvento))
    aoProgredir?.(todos.length)
    if (linhas.length < lote) return { eventos: todos, cortado: false }
  }
  return { eventos: todos, cortado: true }
}

/**
 * Grava um evento no log append-only (AGENTS.md §6.10).
 *
 * Chamado pelo repository que fez a mutação, logo depois da escrita. NÃO lança
 * erro: a mutação já aconteceu e não pode ser desfeita daqui; uma falha aqui é
 * registrada no console de forma visível (limitação aceita no MVP).
 */
export async function registrar(evento: NovoEvento): Promise<void> {
  const { error } = await supabase.from('eventos_auditoria').insert({
    comanda_id: evento.comandaId,
    pedido_id: evento.pedidoId,
    ator_tipo: evento.ator.tipo,
    ator_id: evento.ator.id,
    tipo_evento: evento.tipoEvento,
    payload: evento.payload,
    motivo: evento.motivo,
  })
  if (error) {
    console.error(
      `%c[AUDITORIA] evento NÃO gravado: ${evento.tipoEvento}`,
      'color:#fff;background:#b91c1c;padding:2px 6px;border-radius:4px',
      error.message,
      evento,
    )
  }
}

/**
 * Ator da sessão atual: funcionário (pela matrícula do email sintético) ou
 * cliente (pelo auth.uid()).
 */
export async function atorDaSessao(): Promise<Ator> {
  const { data } = await supabase.auth.getSession()
  const usuario = data.session?.user
  if (!usuario) throw new Error('atorDaSessao: ninguém logado')

  const sufixo = `@${DOMINIO_EMAIL_SINTETICO}`
  const email = usuario.email ?? ''
  if (!usuario.is_anonymous && email.endsWith(sufixo)) {
    return { tipo: 'funcionario', id: email.slice(0, -sufixo.length) }
  }
  return { tipo: 'cliente', id: usuario.id }
}
