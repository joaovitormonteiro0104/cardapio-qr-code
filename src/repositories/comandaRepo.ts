import { supabase } from './supabase'
import * as auditoriaRepo from './auditoriaRepo'
import { criarEvento } from '@/domain/auditoria/evento'
import { ComandaSchema, NomeClienteSchema, ObservacaoSchema, type Comanda, type Mesa } from '@/schemas/comanda'

const COLUNAS = 'id, numero, mesa_id, estado, observacao, ultima_atividade_em, criado_em'

export interface LinhaComanda {
  id: string
  numero: number
  mesa_id: string
  estado: string
  observacao: string | null
  ultima_atividade_em: string
  criado_em: string
}

export function paraComanda(linha: LinhaComanda): Comanda {
  return ComandaSchema.parse({
    id: linha.id,
    numero: linha.numero,
    mesaId: linha.mesa_id,
    estado: linha.estado,
    observacao: linha.observacao,
    ultimaAtividadeEm: linha.ultima_atividade_em,
    criadoEm: linha.criado_em,
  })
}

const VIOLACAO_UNICA = '23505'

async function usuarioId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('comandaRepo: ninguém logado')
  return id
}

export async function buscarComanda(id: string): Promise<Comanda | null> {
  const { data, error } = await supabase.from('comandas').select(COLUNAS).eq('id', id).maybeSingle()
  if (error) throw new Error(`buscarComanda: ${error.message}`)
  return data ? paraComanda(data as LinhaComanda) : null
}

/**
 * Comanda não-Fechada da mesa à qual o cliente JÁ está vinculado (a RLS só
 * mostra as próprias). null = ainda não entrou.
 */
export async function minhaComandaAbertaNaMesa(mesaId: string): Promise<Comanda | null> {
  const { data, error } = await supabase
    .from('comandas')
    .select(COLUNAS)
    .eq('mesa_id', mesaId)
    .neq('estado', 'Fechada')
    .maybeSingle()
  if (error) throw new Error(`minhaComandaAbertaNaMesa: ${error.message}`)
  return data ? paraComanda(data as LinhaComanda) : null
}

async function vincularSessao(comandaId: string, usuario: string, nome: string | null): Promise<void> {
  const { error } = await supabase
    .from('sessoes_mesa')
    .upsert(
      { usuario_id: usuario, comanda_id: comandaId, nome_cliente: nome },
      { onConflict: 'usuario_id,comanda_id', ignoreDuplicates: true },
    )
  if (error) throw new Error(`vincularSessao: ${error.message}`)
}

/**
 * Entra na comanda aberta da mesa ou abre uma nova (AGENTS.md §6.1, decisão 10):
 *  1. pergunta ao banco qual é a comanda aberta da mesa (comanda_aberta_da_mesa)
 *  2. se houver, cria o vínculo em sessoes_mesa
 *  3. se não, gera o id aqui e cria a comanda SEM .select() (o cliente só a
 *     enxerga depois do vínculo), depois cria o vínculo
 *  4. se dois celulares abrirem ao mesmo tempo, o índice único faz um falhar;
 *     esse relê a comanda criada pelo outro e entra nela
 */
export async function entrarNaMesa(mesa: Mesa, nomeDigitado: string): Promise<Comanda> {
  const nome = NomeClienteSchema.parse(nomeDigitado)
  const usuario = await usuarioId()
  const ator = await auditoriaRepo.atorDaSessao()

  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const { data: existente, error: erroBusca } = await supabase.rpc('comanda_aberta_da_mesa', {
      numero_mesa: mesa.numero,
    })
    if (erroBusca) throw new Error(`entrarNaMesa: ${erroBusca.message}`)

    if (typeof existente === 'string') {
      await vincularSessao(existente, usuario, nome)
      await auditoriaRepo.registrar(
        criarEvento('cliente_entrou', ator, { comandaId: existente, payload: { mesa: mesa.numero, nome } }),
      )
      const comanda = await buscarComanda(existente)
      if (!comanda) throw new Error('entrarNaMesa: comanda não visível após o vínculo')
      return comanda
    }

    const novoId = crypto.randomUUID()
    const { error: erroCriar } = await supabase.from('comandas').insert({ id: novoId, mesa_id: mesa.id })
    if (erroCriar) {
      if (erroCriar.code === VIOLACAO_UNICA) continue // outro celular abriu antes: entra na dele
      throw new Error(`entrarNaMesa: ${erroCriar.message}`)
    }
    await vincularSessao(novoId, usuario, nome)
    await auditoriaRepo.registrar(criarEvento('comanda_aberta', ator, { comandaId: novoId, payload: { mesa: mesa.numero, nome } }))
    const comanda = await buscarComanda(novoId)
    if (!comanda) throw new Error('entrarNaMesa: comanda criada não visível')
    return comanda
  }
  throw new Error('entrarNaMesa: não foi possível abrir nem entrar na comanda')
}

/** Atualiza ultima_atividade_em (base do fallback de inatividade, §6.4). */
export async function registrarAtividade(comandaId: string): Promise<void> {
  const { error } = await supabase
    .from('comandas')
    .update({ ultima_atividade_em: new Date().toISOString() })
    .eq('id', comandaId)
  if (error) console.error(`registrarAtividade: ${error.message}`)
}

export async function atualizarObservacao(comanda: Comanda, texto: string): Promise<Comanda> {
  const observacao = ObservacaoSchema.parse(texto)
  const { data, error } = await supabase
    .from('comandas')
    .update({ observacao, ultima_atividade_em: new Date().toISOString() })
    .eq('id', comanda.id)
    .select(COLUNAS)
    .single()
  if (error) throw new Error(`atualizarObservacao: ${error.message}`)

  await auditoriaRepo.registrar(
    criarEvento('comanda_observacao_editada', await auditoriaRepo.atorDaSessao(), {
      comandaId: comanda.id,
      payload: { antes: comanda.observacao, depois: observacao },
    }),
  )
  return paraComanda(data as LinhaComanda)
}

export interface CallbacksAssinatura {
  /** Alguma linha relevante mudou: recarregue. */
  aoMudar: () => void
  /** Canal (re)conectado: recarregue tudo, pode ter perdido eventos. */
  aoConectar: () => void
  /** Conexão caiu. */
  aoDesconectar?: () => void
}

/**
 * Tempo real de UMA comanda: a própria comanda, seus pedidos e itens. O
 * Realtime aplica a RLS, então o cliente só recebe o que pode ler.
 * Devolve a função que cancela a assinatura.
 */
export function assinarComanda(comandaId: string, callbacks: CallbacksAssinatura): () => void {
  const canal = supabase
    .channel(`comanda-${comandaId}-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas', filter: `id=eq.${comandaId}` }, () =>
      callbacks.aoMudar(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pedidos', filter: `comanda_id=eq.${comandaId}` },
      () => callbacks.aoMudar(),
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_pedido' }, () => callbacks.aoMudar())
    .subscribe(status => {
      if (status === 'SUBSCRIBED') callbacks.aoConectar()
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') callbacks.aoDesconectar?.()
    })
  return () => void supabase.removeChannel(canal)
}
