import { FunctionsHttpError } from '@supabase/supabase-js'
import { z } from 'zod'
import { supabase } from './supabase'
import { MatriculaSchema, PapelSchema, PinSchema, type Papel } from '@/schemas/auth'

// Leitura direto da tabela (a RLS só deixa a gerência). Escrita SEMPRE pela
// Edge Function "equipe", que tem a service_role (AGENTS.md §6.9).

const FuncionarioSchema = z.object({
  id: z.uuid(),
  usuarioId: z.uuid(),
  matricula: z.string(),
  nome: z.string(),
  papel: PapelSchema,
  ativo: z.boolean(),
})
export type Funcionario = z.infer<typeof FuncionarioSchema>

export async function listarFuncionarios(): Promise<Funcionario[]> {
  const { data, error } = await supabase
    .from('funcionarios')
    .select('id, usuario_id, matricula, nome, papel, ativo')
    .order('ativo', { ascending: false })
    .order('matricula')
  if (error) throw new Error(`listarFuncionarios: ${error.message}`)
  return (data as { id: string; usuario_id: string; matricula: string; nome: string; papel: string; ativo: boolean }[]).map(
    l => FuncionarioSchema.parse({ id: l.id, usuarioId: l.usuario_id, matricula: l.matricula, nome: l.nome, papel: l.papel, ativo: l.ativo }),
  )
}

/** Erro devolvido pela Edge Function, com mensagem pronta pra UI. */
export class ErroEquipe extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroEquipe'
  }
}

async function chamar(corpo: Record<string, string>): Promise<void> {
  const { error } = await supabase.functions.invoke('equipe', { body: corpo })
  if (!error) return
  if (error instanceof FunctionsHttpError) {
    const dados: unknown = await error.context.json().catch(() => null)
    const mensagem =
      typeof dados === 'object' && dados !== null && 'erro' in dados && typeof dados.erro === 'string' ? dados.erro : null
    throw new ErroEquipe(mensagem ?? 'Não foi possível concluir. Tente de novo.')
  }
  throw new Error(`equipe: ${error.message}`)
}

export const NovoFuncionarioSchema = z.object({
  matricula: MatriculaSchema,
  nome: z.string().trim().min(1, 'Informe o nome.').max(80, 'Nome muito longo.'),
  papel: PapelSchema,
  pin: PinSchema,
})

export async function criarFuncionario(dados: { matricula: string; nome: string; papel: Papel; pin: string }): Promise<void> {
  const validado = NovoFuncionarioSchema.parse(dados)
  await chamar({ acao: 'criar', ...validado })
}

export async function trocarPin(funcionarioId: string, pin: string): Promise<void> {
  await chamar({ acao: 'trocarPin', funcionarioId, pin: PinSchema.parse(pin) })
}

export async function desativar(funcionarioId: string): Promise<void> {
  await chamar({ acao: 'desativar', funcionarioId })
}
