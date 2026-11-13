import { supabase } from './supabase'
import * as auditoriaRepo from './auditoriaRepo'
import { criarEvento } from '@/domain/auditoria/evento'
import { MesaSchema, type Mesa } from '@/schemas/comanda'

const COLUNAS = 'id, numero, ativa'

/** Mesa ativa pelo número, ou null (inexistente ou inativa: a RLS esconde inativas do cliente). */
export async function buscarMesaAtivaPorNumero(numero: number): Promise<Mesa | null> {
  const { data, error } = await supabase.from('mesas').select(COLUNAS).eq('numero', numero).eq('ativa', true).maybeSingle()
  if (error) throw new Error(`buscarMesaAtivaPorNumero: ${error.message}`)
  return data ? MesaSchema.parse(data) : null
}

/** Todas as mesas (operação/gerência), ordenadas por número. */
export async function listarMesas(): Promise<Mesa[]> {
  const { data, error } = await supabase.from('mesas').select(COLUNAS).order('numero')
  if (error) throw new Error(`listarMesas: ${error.message}`)
  return data.map(linha => MesaSchema.parse(linha))
}

/** Conta não fechada de cada mesa (mesaId → número da conta). A RLS deixa a equipe ler todas. */
export async function contasAbertasPorMesa(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('comandas').select('mesa_id, numero').neq('estado', 'Fechada')
  if (error) throw new Error(`contasAbertasPorMesa: ${error.message}`)
  return new Map((data as { mesa_id: string; numero: number }[]).map(c => [c.mesa_id, c.numero]))
}

export class MesaDuplicadaError extends Error {
  constructor(numero: number) {
    super(`Já existe a mesa ${numero}`)
    this.name = 'MesaDuplicadaError'
  }
}

export async function criarMesa(numero: number): Promise<Mesa> {
  const { data, error } = await supabase.from('mesas').insert({ numero }).select(COLUNAS).single()
  if (error) {
    if (error.code === '23505') throw new MesaDuplicadaError(numero)
    throw new Error(`criarMesa: ${error.message}`)
  }
  const mesa = MesaSchema.parse(data)
  await auditoriaRepo.registrar(
    criarEvento('mesa_criada', await auditoriaRepo.atorDaSessao(), { payload: { mesa_id: mesa.id, numero } }),
  )
  return mesa
}

/** A mesa ainda tem conta não fechada: desativar tiraria o acesso dos clientes à conta e ao Pix. */
export class MesaComContaAbertaError extends Error {
  constructor(readonly numeroConta: number) {
    super(`Mesa com a conta #${numeroConta} aberta`)
    this.name = 'MesaComContaAbertaError'
  }
}

export async function definirMesaAtiva(mesa: Mesa, ativa: boolean): Promise<Mesa> {
  if (!ativa) {
    const { data: aberta, error: erroConta } = await supabase
      .from('comandas')
      .select('numero')
      .eq('mesa_id', mesa.id)
      .neq('estado', 'Fechada')
      .maybeSingle()
    if (erroConta) throw new Error(`definirMesaAtiva: ${erroConta.message}`)
    if (aberta) throw new MesaComContaAbertaError((aberta as { numero: number }).numero)
  }
  const { data, error } = await supabase.from('mesas').update({ ativa }).eq('id', mesa.id).select(COLUNAS).single()
  if (error) throw new Error(`definirMesaAtiva: ${error.message}`)
  await auditoriaRepo.registrar(
    criarEvento('mesa_atualizada', await auditoriaRepo.atorDaSessao(), {
      payload: { mesa_id: mesa.id, numero: mesa.numero, ativa },
    }),
  )
  return MesaSchema.parse(data)
}
