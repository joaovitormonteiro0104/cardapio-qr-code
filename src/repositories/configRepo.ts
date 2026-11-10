import { supabase } from './supabase'
import * as auditoriaRepo from './auditoriaRepo'
import { criarEvento } from '@/domain/auditoria/evento'
import { VALIDADORES_CONFIG, parseConfigs, type ChaveConfig, type Configs } from '@/schemas/config'

export async function listarConfigs(): Promise<Configs> {
  const { data, error } = await supabase.from('configuracoes').select('chave, valor')
  if (error) throw new Error(`listarConfigs: ${error.message}`)
  return parseConfigs(data as { chave: string; valor: string }[])
}

/** Valores crus (texto), como estão no banco — para a tela de edição. */
export async function listarConfigsBrutas(): Promise<Record<string, { valor: string; atualizadoEm: string; atualizadoPor: string | null }>> {
  const { data, error } = await supabase.from('configuracoes').select('chave, valor, atualizado_em, atualizado_por')
  if (error) throw new Error(`listarConfigsBrutas: ${error.message}`)
  const linhas = data as { chave: string; valor: string; atualizado_em: string; atualizado_por: string | null }[]
  return Object.fromEntries(
    linhas.map(l => [l.chave, { valor: l.valor, atualizadoEm: l.atualizado_em, atualizadoPor: l.atualizado_por }]),
  )
}

/** Grava uma configuração (só gerência, pela RLS) e registra auditoria. */
export async function setConfig(chave: ChaveConfig, valor: string): Promise<void> {
  const validado = VALIDADORES_CONFIG[chave].safeParse(valor)
  if (!validado.success) throw new Error(`setConfig: valor inválido para ${chave}`)
  const texto = String(validado.data)

  const ator = await auditoriaRepo.atorDaSessao()
  const { data: antes } = await supabase.from('configuracoes').select('valor').eq('chave', chave).maybeSingle()

  const { data, error } = await supabase
    .from('configuracoes')
    .update({ valor: texto, atualizado_por: ator.id })
    .eq('chave', chave)
    .select('chave')
  if (error) throw new Error(`setConfig: ${error.message}`)
  if (!data || data.length === 0) throw new Error('setConfig: sem permissão ou chave inexistente')

  await auditoriaRepo.registrar(
    criarEvento('configuracao_alterada', ator, {
      payload: { chave, antes: (antes as { valor: string } | null)?.valor ?? null, depois: texto },
    }),
  )
}
