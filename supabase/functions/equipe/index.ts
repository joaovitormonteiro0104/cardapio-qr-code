// Edge Function "equipe" (AGENTS.md §3 regra 5, §6.9, item 14).
//
// É a ÚNICA Edge Function do MVP: criar funcionário e trocar PIN exigem a
// service_role key (Admin API do Supabase Auth), que nunca pode ir pro
// navegador. Aqui ela existe só dentro do servidor, como variável de ambiente
// automática (SUPABASE_SERVICE_ROLE_KEY).
//
// Ações (POST JSON):
//   { acao: 'criar', matricula, nome, papel, pin }
//   { acao: 'trocarPin', funcionarioId, pin }
//   { acao: 'desativar', funcionarioId }
//   { acao: 'reativar', funcionarioId, pin }   (reativar sempre define PIN novo)
//   { acao: 'mudarPapel', funcionarioId, papel }
// Só gerente ATIVO pode chamar (senão 403).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@4'
import {
  MENSAGENS_NAO_DESATIVA,
  MENSAGENS_NAO_MUDA_PAPEL,
  motivoNaoPodeDesativar,
  motivoNaoPodeMudarPapel,
} from '../../../src/domain/equipe/regras.ts'
import { matriculaEquivalente } from '../../../src/domain/equipe/matricula.ts'

// --- Schemas -----------------------------------------------------------------
// Duplicados de src/schemas/auth.ts (o bundler da função não resolve o
// import "zod" daquele arquivo). Mantenha os dois iguais.
const DOMINIO_EMAIL_SINTETICO = 'restaurante.local'
const MatriculaSchema = z.string().trim().regex(/^\d{1,6}$/, 'A matrícula tem de 1 a 6 números.')
const PinSchema = z.string().regex(/^\d{6}$/, 'O PIN tem exatamente 6 números.')
const PapelSchema = z.enum(['operacao', 'gerencia'])
// -----------------------------------------------------------------------------

const CorpoSchema = z.discriminatedUnion('acao', [
  z.object({
    acao: z.literal('criar'),
    matricula: MatriculaSchema,
    nome: z.string().trim().min(1, 'Informe o nome.').max(80, 'Nome muito longo.'),
    papel: PapelSchema,
    pin: PinSchema,
  }),
  z.object({ acao: z.literal('trocarPin'), funcionarioId: z.uuid(), pin: PinSchema }),
  z.object({ acao: z.literal('desativar'), funcionarioId: z.uuid() }),
  z.object({ acao: z.literal('reativar'), funcionarioId: z.uuid(), pin: PinSchema }),
  z.object({ acao: z.literal('mudarPapel'), funcionarioId: z.uuid(), papel: PapelSchema }),
])

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function resposta(status: number, corpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

const BANIDO_PARA_SEMPRE = '876000h' // ~100 anos

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta(405, { erro: 'Método não permitido.' })

  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const servico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anon || !servico) return resposta(500, { erro: 'Função sem configuração.' })

  // 1. Quem está chamando? (JWT do usuário logado)
  const autorizacao = req.headers.get('Authorization') ?? ''
  const comoUsuario = createClient(url, anon, { global: { headers: { Authorization: autorizacao } } })
  const { data: quem, error: erroQuem } = await comoUsuario.auth.getUser()
  if (erroQuem || !quem.user) return resposta(401, { erro: 'Sessão inválida.' })

  const admin = createClient(url, servico, { auth: { persistSession: false, autoRefreshToken: false } })

  // 2. É gerente ativo?
  const { data: gerente } = await admin
    .from('funcionarios')
    .select('id, matricula, papel, ativo')
    .eq('usuario_id', quem.user.id)
    .maybeSingle()
  if (!gerente || !gerente.ativo || gerente.papel !== 'gerencia') {
    return resposta(403, { erro: 'Apenas a gerência pode gerenciar a equipe.' })
  }
  const ator = { ator_tipo: 'funcionario', ator_id: gerente.matricula as string }

  // 3. Corpo válido?
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return resposta(400, { erro: 'Corpo inválido.' })
  }
  const corpo = CorpoSchema.safeParse(json)
  if (!corpo.success) return resposta(400, { erro: corpo.error.issues[0]?.message ?? 'Dados inválidos.' })
  const dados = corpo.data

  async function auditar(tipo: string, payload: Record<string, unknown>) {
    const { error } = await admin.from('eventos_auditoria').insert({ ...ator, tipo_evento: tipo, payload })
    if (error) console.error(`[AUDITORIA] evento não gravado: ${tipo}`, error.message)
  }

  if (dados.acao === 'criar') {
    // "1" e "001" são a mesma pessoa no login: recusa matrícula equivalente.
    const { data: todas } = await admin.from('funcionarios').select('matricula')
    const igual = matriculaEquivalente(dados.matricula, (todas ?? []).map(f => f.matricula as string))
    if (igual) {
      return resposta(409, {
        erro: igual === dados.matricula ? `A matrícula ${igual} já existe.` : `A matrícula ${dados.matricula} é igual à ${igual}, que já existe.`,
      })
    }

    const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
      email: `${dados.matricula}@${DOMINIO_EMAIL_SINTETICO}`,
      password: dados.pin,
      email_confirm: true,
    })
    if (erroCriar || !criado.user) {
      return resposta(409, { erro: 'Não foi possível criar o acesso (a matrícula pode já existir no Auth).' })
    }
    const { data: funcionario, error: erroInserir } = await admin
      .from('funcionarios')
      .insert({ usuario_id: criado.user.id, matricula: dados.matricula, nome: dados.nome, papel: dados.papel })
      .select('id')
      .single()
    if (erroInserir) {
      await admin.auth.admin.deleteUser(criado.user.id) // desfaz o usuário órfão
      return resposta(500, { erro: 'Não foi possível salvar o funcionário.' })
    }
    await auditar('funcionario_criado', {
      funcionario_id: funcionario.id,
      matricula: dados.matricula,
      nome: dados.nome,
      papel: dados.papel,
    })
    return resposta(200, { ok: true, funcionarioId: funcionario.id })
  }

  const { data: alvo } = await admin
    .from('funcionarios')
    .select('id, usuario_id, matricula, papel, ativo')
    .eq('id', dados.funcionarioId)
    .maybeSingle()
  if (!alvo) return resposta(404, { erro: 'Funcionário não encontrado.' })

  if (dados.acao === 'trocarPin') {
    if (!alvo.ativo) return resposta(409, { erro: 'Funcionário desativado.' })
    const { error } = await admin.auth.admin.updateUserById(alvo.usuario_id, { password: dados.pin })
    if (error) return resposta(500, { erro: 'Não foi possível trocar o PIN.' })
    await auditar('funcionario_pin_trocado', { funcionario_id: alvo.id, matricula: alvo.matricula })
    return resposta(200, { ok: true })
  }

  if (dados.acao === 'reativar') {
    if (alvo.ativo) return resposta(409, { erro: 'Este funcionário já está ativo.' })
    // Volta sempre com PIN novo: quem ficou fora não reaproveita o antigo.
    const { error: erroDesbanir } = await admin.auth.admin.updateUserById(alvo.usuario_id, { ban_duration: 'none', password: dados.pin })
    if (erroDesbanir) return resposta(500, { erro: 'Não foi possível devolver o acesso.' })
    const { error } = await admin.from('funcionarios').update({ ativo: true }).eq('id', alvo.id)
    if (error) return resposta(500, { erro: 'Não foi possível reativar.' })
    await auditar('funcionario_reativado', { funcionario_id: alvo.id, matricula: alvo.matricula })
    return resposta(200, { ok: true })
  }

  const { data: equipe } = await admin.from('funcionarios').select('id, usuario_id, papel, ativo')
  const paraRegra = (equipe ?? []).map(f => ({ id: f.id, usuarioId: f.usuario_id, papel: f.papel, ativo: f.ativo }))
  const alvoRegra = { id: alvo.id, usuarioId: alvo.usuario_id, papel: alvo.papel, ativo: alvo.ativo }

  if (dados.acao === 'mudarPapel') {
    const motivoPapel = motivoNaoPodeMudarPapel(alvoRegra, dados.papel, quem.user.id, paraRegra)
    if (motivoPapel) return resposta(409, { erro: MENSAGENS_NAO_MUDA_PAPEL[motivoPapel] })
    const { error } = await admin.from('funcionarios').update({ papel: dados.papel }).eq('id', alvo.id)
    if (error) return resposta(500, { erro: 'Não foi possível mudar o papel.' })
    await auditar('funcionario_papel_alterado', {
      funcionario_id: alvo.id,
      matricula: alvo.matricula,
      antes: alvo.papel,
      depois: dados.papel,
    })
    return resposta(200, { ok: true })
  }

  // desativar
  const motivo = motivoNaoPodeDesativar(alvoRegra, quem.user.id, paraRegra)
  if (motivo) return resposta(409, { erro: MENSAGENS_NAO_DESATIVA[motivo] })

  const { error: erroDesativar } = await admin.from('funcionarios').update({ ativo: false }).eq('id', alvo.id)
  if (erroDesativar) return resposta(500, { erro: 'Não foi possível desativar.' })
  // A RLS já nega tudo (papel_atual() exige ativo); o banimento impede novos logins.
  const { error: erroBanir } = await admin.auth.admin.updateUserById(alvo.usuario_id, { ban_duration: BANIDO_PARA_SEMPRE })
  if (erroBanir) console.error('equipe: usuário desativado mas não banido', erroBanir.message)
  await auditar('funcionario_desativado', { funcionario_id: alvo.id, matricula: alvo.matricula })
  return resposta(200, { ok: true })
})
