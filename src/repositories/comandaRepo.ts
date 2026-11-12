import { supabase } from './supabase'
import * as auditoriaRepo from './auditoriaRepo'
import { criarEvento, type Ator } from '@/domain/auditoria/evento'
import {
  motivoNaoPodeFechar,
  podeInformarPagamento,
  transicaoComandaValida,
  type EstadoComanda,
  type MotivoNaoFecha,
} from '@/domain/comanda/estado'
import type { PedidoCalculo } from '@/domain/pedido/calculo'
import { ComandaSchema, NomeClienteSchema, ObservacaoSchema, type Comanda, type Mesa } from '@/schemas/comanda'
import { EstadoPedidoSchema } from '@/schemas/pedido'
import { DataHoraOpcionalSchema } from '@/schemas/comum'

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

/**
 * Nome de quem está na mesa, por usuário (conta dividida: "Pedido de Ana").
 * A RLS só mostra as sessões da própria comanda.
 */
export async function nomesDaComanda(comandaId: string): Promise<Map<string, string | null>> {
  const { data, error } = await supabase.from('sessoes_mesa').select('usuario_id, nome_cliente').eq('comanda_id', comandaId)
  if (error) throw new Error(`nomesDaComanda: ${error.message}`)
  return new Map(
    (data as { usuario_id: string; nome_cliente: string | null }[]).map(s => [s.usuario_id, s.nome_cliente]),
  )
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

// ===========================================================================
// Pagamento e fechamento (item 12)
// ===========================================================================

export class ErroComanda extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroComanda'
  }
}

/** Pedido resumido o bastante para calcular total e pendências. */
interface LinhaPedidoResumo {
  numero: number
  estado: string
  itens_pedido: { quantidade: number; preco_centavos_snapshot: number; removido_em: string | null }[]
}

function paraCalculo(linhas: readonly LinhaPedidoResumo[]): (PedidoCalculo & { numero: number })[] {
  return linhas.map(l => ({
    numero: l.numero,
    estado: EstadoPedidoSchema.parse(l.estado),
    itens: l.itens_pedido.map(i => ({
      quantidade: i.quantidade,
      precoCentavosSnapshot: i.preco_centavos_snapshot,
      removidoEm: DataHoraOpcionalSchema.parse(i.removido_em),
    })),
  }))
}

const RESUMO_PEDIDOS = 'pedidos (numero, estado, itens_pedido (quantidade, preco_centavos_snapshot, removido_em))'

async function lerComandaComPedidos(comandaId: string) {
  const { data, error } = await supabase
    .from('comandas')
    .select(`${COLUNAS}, ${RESUMO_PEDIDOS}`)
    .eq('id', comandaId)
    .single()
  if (error) throw new Error(`lerComandaComPedidos: ${error.message}`)
  const linha = data as unknown as LinhaComanda & { pedidos: LinhaPedidoResumo[] }
  return { comanda: paraComanda(linha), pedidos: paraCalculo(linha.pedidos) }
}

/** Muda o estado da comanda com UPDATE condicional e registra o evento. Devolve false se outro mudou antes. */
async function mudarEstado(comanda: Comanda, para: EstadoComanda, ator: Ator, extra: Record<string, string> = {}): Promise<boolean> {
  if (!transicaoComandaValida(comanda.estado, para)) {
    throw new ErroComanda(`Não é possível ir de ${comanda.estado} para ${para}.`)
  }
  const { data, error } = await supabase
    .from('comandas')
    .update({ estado: para, ultima_atividade_em: new Date().toISOString(), ...extra })
    .eq('id', comanda.id)
    .eq('estado', comanda.estado)
    .select('id')
  if (error) throw new Error(`mudarEstado: ${error.message}`)
  if (!data || data.length === 0) return false

  await auditoriaRepo.registrar(
    criarEvento(para === 'Fechada' ? 'comanda_fechada' : 'comanda_estado_alterado', ator, {
      comandaId: comanda.id,
      payload: { numero: comanda.numero, de: comanda.estado, para },
    }),
  )
  return true
}

async function mudarOuFalhar(comanda: Comanda, para: EstadoComanda): Promise<void> {
  const ok = await mudarEstado(comanda, para, await auditoriaRepo.atorDaSessao())
  if (!ok) throw new ErroComanda('A conta foi alterada por outra pessoa. Recarregue.')
}

/** Cliente toca "já paguei": Aberta → AguardandoPagamento (para de aceitar pedidos). */
export async function informarPagamento(comandaId: string): Promise<void> {
  const { comanda, pedidos } = await lerComandaComPedidos(comandaId)
  if (!podeInformarPagamento(comanda.estado, pedidos)) throw new ErroComanda('Não há valor a pagar nesta conta.')
  await mudarOuFalhar(comanda, 'AguardandoPagamento')
}

/** Caixa conferiu o extrato: AguardandoPagamento → Paga. */
export async function marcarComoPaga(comandaId: string): Promise<void> {
  const { comanda } = await lerComandaComPedidos(comandaId)
  await mudarOuFalhar(comanda, 'Paga')
}

/** Cliente quer pedir mais: AguardandoPagamento → Aberta. */
export async function reabrir(comandaId: string): Promise<void> {
  const { comanda } = await lerComandaComPedidos(comandaId)
  await mudarOuFalhar(comanda, 'Aberta')
}

const MENSAGENS_NAO_FECHA: Record<MotivoNaoFecha, string> = {
  pendentes: 'Ainda há pedidos em andamento nesta mesa.',
  nao_paga: 'A conta ainda não foi marcada como paga.',
  ja_fechada: 'Esta mesa já foi fechada.',
}

/**
 * "Fechar mesa" (§6.4): valida podeFecharComanda com dados frescos, fecha a
 * comanda (condicional), passa os pedidos Entregue → Finalizado e encerra as
 * sessões dos clientes. `ator` = sistema na rotina de inatividade.
 * Devolve false se outro tablet fechou antes.
 */
export async function fecharMesa(comandaId: string, ator?: Ator): Promise<boolean> {
  const quem = ator ?? (await auditoriaRepo.atorDaSessao())
  const { comanda, pedidos } = await lerComandaComPedidos(comandaId)
  const motivo = motivoNaoPodeFechar(comanda.estado, pedidos)
  if (motivo) throw new ErroComanda(MENSAGENS_NAO_FECHA[motivo])

  if (!(await mudarEstado(comanda, 'Fechada', quem))) return false

  const agora = new Date().toISOString()
  const { data: finalizados, error: erroPedidos } = await supabase
    .from('pedidos')
    .update({ estado: 'Finalizado', estado_desde: agora })
    .eq('comanda_id', comandaId)
    .eq('estado', 'Entregue')
    .select('id, numero')
  if (erroPedidos) console.error(`fecharMesa: pedidos não finalizados: ${erroPedidos.message}`)
  for (const p of (finalizados ?? []) as { id: string; numero: number }[]) {
    await auditoriaRepo.registrar(
      criarEvento('pedido_estado_alterado', quem, {
        comandaId,
        pedidoId: p.id,
        payload: { numero: p.numero, de: 'Entregue', para: 'Finalizado' },
      }),
    )
  }

  const { error: erroSessoes } = await supabase
    .from('sessoes_mesa')
    .update({ encerrada_em: agora })
    .eq('comanda_id', comandaId)
    .is('encerrada_em', null)
  if (erroSessoes) console.error(`fecharMesa: sessões não encerradas: ${erroSessoes.message}`)
  return true
}

export interface ComandaOperacao {
  comanda: Comanda
  mesaNumero: number
  pedidos: (PedidoCalculo & { numero: number })[]
}

/** Comandas não-Fechadas com mesa e pedidos (aba "Contas" e rotina de inatividade). */
export async function listarComandasAbertas(): Promise<ComandaOperacao[]> {
  const { data, error } = await supabase
    .from('comandas')
    .select(`${COLUNAS}, mesas (numero), ${RESUMO_PEDIDOS}`)
    .neq('estado', 'Fechada')
    .order('ultima_atividade_em', { ascending: true })
  if (error) throw new Error(`listarComandasAbertas: ${error.message}`)
  const linhas = data as unknown as (LinhaComanda & { mesas: { numero: number } | null; pedidos: LinhaPedidoResumo[] })[]
  return linhas.map(l => ({
    comanda: paraComanda(l),
    mesaNumero: l.mesas?.numero ?? 0,
    pedidos: paraCalculo(l.pedidos),
  }))
}

