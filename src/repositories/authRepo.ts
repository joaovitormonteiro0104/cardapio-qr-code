import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { variantesMatricula } from '@/domain/equipe/matricula'
import { LoginSchema, PapelSchema, emailSintetico, type Papel } from '@/schemas/auth'

export interface UsuarioAtual {
  id: string
  anonimo: boolean
}

export type MotivoErroLogin = 'credenciais' | 'limite' | 'rede'

/** Erro de login com motivo classificado, pra UI escolher a mensagem. */
export class ErroLogin extends Error {
  constructor(
    readonly motivo: MotivoErroLogin,
    mensagem: string,
  ) {
    super(mensagem)
    this.name = 'ErroLogin'
  }
}

function paraUsuario(sessao: Session | null): UsuarioAtual | null {
  if (!sessao) return null
  return { id: sessao.user.id, anonimo: sessao.user.is_anonymous ?? false }
}

/**
 * Login da equipe por matrícula + PIN. Só termina com sucesso se o usuário for
 * funcionário ATIVO; caso contrário desloga e lança 'credenciais' (a mensagem
 * não revela se a matrícula existe).
 */
export async function entrarComoFuncionario(matricula: string, pin: string): Promise<Papel> {
  const dados = LoginSchema.safeParse({ matricula, pin })
  if (!dados.success) throw new ErroLogin('credenciais', 'entrarComoFuncionario: formato inválido')

  // "1" e "001" são a mesma pessoa para quem digita: tenta as formas prováveis.
  let entrou = false
  for (const matriculaTentada of variantesMatricula(dados.data.matricula)) {
    const { error } = await supabase.auth.signInWithPassword({
      email: emailSintetico(matriculaTentada),
      password: dados.data.pin,
    })
    if (!error) {
      entrou = true
      break
    }
    if (error.code === 'invalid_credentials') continue
    if (error.status === 429 || error.code === 'over_request_rate_limit') {
      throw new ErroLogin('limite', `entrarComoFuncionario: ${error.message}`)
    }
    throw new ErroLogin('rede', `entrarComoFuncionario: ${error.message}`)
  }
  if (!entrou) throw new ErroLogin('credenciais', 'entrarComoFuncionario: credenciais inválidas')

  const papel = await getPapelAtual()
  if (!papel) {
    await sair()
    throw new ErroLogin('credenciais', 'entrarComoFuncionario: usuário sem papel ativo')
  }
  return papel
}

/** Garante uma sessão (anônima) para o cliente da mesa. Reaproveita a existente. */
export async function entrarComoCliente(): Promise<UsuarioAtual> {
  const atual = await usuarioAtual()
  if (atual) return atual

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw new Error(`entrarComoCliente: ${error.message}`)
  const usuario = paraUsuario(data.session)
  if (!usuario) throw new Error('entrarComoCliente: sessão anônima não criada')
  return usuario
}

export async function sair(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(`sair: ${error.message}`)
}

export async function usuarioAtual(): Promise<UsuarioAtual | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error(`usuarioAtual: ${error.message}`)
  return paraUsuario(data.session)
}

/**
 * Papel do usuário logado, ou null se não for funcionário ativo.
 * Usa a função SQL papel_atual() via RPC (decisão 13 de AGENTS.md §15): assim o
 * funcionário de operação não precisa ler a tabela funcionarios.
 */
export async function getPapelAtual(): Promise<Papel | null> {
  const { data: sessao } = await supabase.auth.getSession()
  if (!sessao.session) return null

  const { data, error } = await supabase.rpc('papel_atual')
  if (error) throw new Error(`getPapelAtual: ${error.message}`)
  return PapelSchema.nullable().parse(data)
}

/**
 * Avisa quando a sessão muda (login, logout, renovação de token).
 * Devolve a função que cancela a assinatura.
 */
export function assinarMudancasDeSessao(callback: (usuario: UsuarioAtual | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => {
    callback(paraUsuario(sessao))
  })
  return () => data.subscription.unsubscribe()
}
