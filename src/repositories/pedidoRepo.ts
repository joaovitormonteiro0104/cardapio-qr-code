import { supabase } from './supabase'
import * as auditoriaRepo from './auditoriaRepo'
import { registrarAtividade, type CallbacksAssinatura } from './comandaRepo'
import { ATOR_SISTEMA, criarEvento, type Ator, type TipoEvento } from '@/domain/auditoria/evento'
import { aceitaNovosPedidos } from '@/domain/comanda/estado'
import type { ConfigsTempo } from '@/domain/config'
import { pedidoExpirado } from '@/domain/pedido/autoCancelamento'
import { totalPedido } from '@/domain/pedido/calculo'
import {
  motivoParaRegistro,
  podeCancelar,
  precisaDuasEtapas,
  validaMotivo,
  type MotivoCancelamento,
} from '@/domain/pedido/cancelamento'
import { dentroDaJanelaLivre, podeEditarItens, remocaoEsvaziaPedido } from '@/domain/pedido/edicao'
import {
  ESTADOS_PENDENTES,
  aplicarCancelamentoPeloClienteNaJanela,
  aplicarTransicao,
  transicaoValida,
  type EstadoPedido,
  type ResultadoTransicao,
} from '@/domain/pedido/estado'
import { EstadoComandaSchema } from '@/schemas/comanda'
import type { EstadoComanda } from '@/domain/comanda/estado'
import {
  NovoPedidoSchema,
  PedidoSchema,
  QUANTIDADE_MAX_POR_ITEM,
  type NovoItemPedido,
  type Pedido,
} from '@/schemas/pedido'

export const COLUNAS_PEDIDO =
  'id, numero, comanda_id, estado, estado_anterior, estado_desde, criado_em, criado_por, cancelamento_motivo, ' +
  'itens_pedido (id, pedido_id, item_cardapio_id, nome_snapshot, quantidade, preco_centavos_snapshot, removido_em, itens_cardapio (foto_url))'

export interface LinhaItemPedido {
  id: string
  pedido_id: string
  item_cardapio_id: string
  nome_snapshot: string
  quantidade: number
  preco_centavos_snapshot: number
  removido_em: string | null
  /** Foto atual do item (a RLS devolve null ao cliente se o item saiu do cardápio). */
  itens_cardapio: { foto_url: string | null } | null
}

export interface LinhaPedido {
  id: string
  numero: number
  comanda_id: string
  estado: string
  estado_anterior: string | null
  estado_desde: string
  criado_em: string
  criado_por: string | null
  cancelamento_motivo: string | null
  itens_pedido: LinhaItemPedido[]
}

export function paraPedido(linha: LinhaPedido): Pedido {
  return PedidoSchema.parse({
    id: linha.id,
    numero: linha.numero,
    comandaId: linha.comanda_id,
    estado: linha.estado,
    estadoAnterior: linha.estado_anterior,
    estadoDesde: linha.estado_desde,
    criadoEm: linha.criado_em,
    criadoPor: linha.criado_por,
    cancelamentoMotivo: linha.cancelamento_motivo,
    itens: [...linha.itens_pedido]
      .sort((a, b) => a.nome_snapshot.localeCompare(b.nome_snapshot, 'pt-BR'))
      .map(item => ({
        id: item.id,
        pedidoId: item.pedido_id,
        itemCardapioId: item.item_cardapio_id,
        nomeSnapshot: item.nome_snapshot,
        quantidade: item.quantidade,
        precoCentavosSnapshot: item.preco_centavos_snapshot,
        removidoEm: item.removido_em,
        fotoUrl: item.itens_cardapio?.foto_url ?? null,
      })),
  })
}

export async function listarPedidosDaComanda(comandaId: string): Promise<Pedido[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select(COLUNAS_PEDIDO)
    .eq('comanda_id', comandaId)
    .order('numero', { ascending: true })
  if (error) throw new Error(`listarPedidosDaComanda: ${error.message}`)
  return (data as unknown as LinhaPedido[]).map(paraPedido)
}

export type MotivoErroPedido = 'comanda_nao_aceita' | 'itens_indisponiveis' | 'falha'

export class ErroPedido extends Error {
  constructor(
    readonly motivo: MotivoErroPedido,
    mensagem: string,
    readonly itensIndisponiveis: readonly string[] = [],
  ) {
    super(mensagem)
    this.name = 'ErroPedido'
  }
}

/**
 * Envia um pedido (uma "rodada"): cria o pedido em Recebido e os itens com
 * preço e nome lidos do cardápio NESTE momento (snapshot, §6.2).
 * Recusa se a comanda não estiver Aberta ou se algum item ficou indisponível.
 */
export async function criarPedido(comandaId: string, itensCarrinho: readonly NovoItemPedido[]): Promise<Pedido> {
  const itens = NovoPedidoSchema.parse(itensCarrinho)
  const ator = await auditoriaRepo.atorDaSessao()

  const { data: comanda, error: erroComanda } = await supabase
    .from('comandas')
    .select('estado, numero, mesas (numero)')
    .eq('id', comandaId)
    .single()
  if (erroComanda) throw new ErroPedido('falha', `criarPedido: ${erroComanda.message}`)
  const dadosComanda = comanda as unknown as { estado: string; numero: number; mesas: { numero: number } | null }
  if (!aceitaNovosPedidos(EstadoComandaSchema.parse(dadosComanda.estado))) {
    throw new ErroPedido('comanda_nao_aceita', 'criarPedido: comanda não aceita pedidos')
  }

  const ids = [...new Set(itens.map(i => i.itemId))]
  const { data: cardapio, error: erroCardapio } = await supabase
    .from('itens_cardapio')
    .select('id, nome, preco_centavos')
    .in('id', ids)
    .eq('ativo', true)
    .eq('disponivel', true)
  if (erroCardapio) throw new ErroPedido('falha', `criarPedido: ${erroCardapio.message}`)
  const precos = new Map((cardapio as { id: string; nome: string; preco_centavos: number }[]).map(c => [c.id, c]))
  const faltando = ids.filter(id => !precos.has(id))
  if (faltando.length > 0) {
    throw new ErroPedido('itens_indisponiveis', 'criarPedido: itens indisponíveis', faltando)
  }

  const pedidoId = crypto.randomUUID()
  const { error: erroPedido } = await supabase
    .from('pedidos')
    .insert({ id: pedidoId, comanda_id: comandaId, criado_por: ator.tipo === 'cliente' ? ator.id : null })
  if (erroPedido) throw new ErroPedido('falha', `criarPedido: ${erroPedido.message}`)

  const linhas = itens.map(item => {
    const atual = precos.get(item.itemId)
    if (!atual) throw new ErroPedido('itens_indisponiveis', 'criarPedido: item sumiu', [item.itemId])
    return {
      pedido_id: pedidoId,
      item_cardapio_id: item.itemId,
      nome_snapshot: atual.nome,
      quantidade: item.quantidade,
      preco_centavos_snapshot: atual.preco_centavos,
    }
  })
  const { error: erroItens } = await supabase.from('itens_pedido').insert(linhas)
  if (erroItens) {
    // Pedido ficou sem itens (decisão 9 de §15): a cozinha ignora e o
    // auto-cancelamento limpa depois.
    throw new ErroPedido('falha', `criarPedido: itens não gravados: ${erroItens.message}`)
  }

  await registrarAtividade(comandaId)
  const { data: criado, error: erroLer } = await supabase.from('pedidos').select(COLUNAS_PEDIDO).eq('id', pedidoId).single()
  if (erroLer) throw new ErroPedido('falha', `criarPedido: ${erroLer.message}`)
  const pedido = paraPedido(criado as unknown as LinhaPedido)

  await auditoriaRepo.registrar(
    criarEvento('pedido_criado', ator, {
      comandaId,
      pedidoId,
      payload: {
        numero: pedido.numero,
        mesa: dadosComanda.mesas?.numero ?? null,
        conta: dadosComanda.numero,
        total_centavos: totalPedido(pedido),
        itens: linhas.map(l => ({
          item_id: l.item_cardapio_id,
          nome: l.nome_snapshot,
          quantidade: l.quantidade,
          preco_centavos: l.preco_centavos_snapshot,
        })),
      },
    }),
  )
  return pedido
}

// ===========================================================================
// Mudanças de estado (itens 8, 9 e 10)
// ===========================================================================

/** Outro tablet/celular mudou o pedido entre a leitura e a escrita. */
export class ErroConcorrencia extends Error {
  constructor() {
    super('O pedido foi alterado por outra pessoa. Recarregue.')
    this.name = 'ErroConcorrencia'
  }
}

/** A regra de domínio não permite a ação no estado atual. */
export class ErroRegra extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroRegra'
  }
}

interface SituacaoLida {
  id: string
  numero: number
  comandaId: string
  estado: EstadoPedido
  estadoAnterior: EstadoPedido | null
  estadoDesde: Date
  estadoDesdeTexto: string
  cancelamentoMotivo: string | null
  itens: Pedido['itens']
  estadoComanda: EstadoComanda
  /** Para a auditoria mostrar mesa e conta (decisão 25). */
  mesaNumero: number | null
  contaNumero: number | null
}

async function lerPedido(pedidoId: string): Promise<SituacaoLida> {
  const { data, error } = await supabase
    .from('pedidos')
    .select(`${COLUNAS_PEDIDO}, comandas (estado, numero, mesas (numero))`)
    .eq('id', pedidoId)
    .single()
  if (error) throw new Error(`lerPedido: ${error.message}`)
  const linha = data as unknown as LinhaPedido & {
    comandas: { estado: string; numero: number; mesas: { numero: number } | null } | null
  }
  const pedido = paraPedido(linha)
  return {
    id: pedido.id,
    numero: pedido.numero,
    comandaId: pedido.comandaId,
    estado: pedido.estado,
    estadoAnterior: pedido.estadoAnterior,
    estadoDesde: pedido.estadoDesde,
    estadoDesdeTexto: linha.estado_desde,
    cancelamentoMotivo: pedido.cancelamentoMotivo,
    itens: pedido.itens,
    estadoComanda: EstadoComandaSchema.parse(linha.comandas?.estado),
    mesaNumero: linha.comandas?.mesas?.numero ?? null,
    contaNumero: linha.comandas?.numero ?? null,
  }
}

interface Gravacao {
  atual: SituacaoLida
  novo: ResultadoTransicao
  cancelamentoMotivo?: string | null
  ator: Ator
  tipoEvento: TipoEvento
  motivo?: string | null
  /** true: também exige que estado_desde não tenha mudado (rotinas automáticas). */
  exigirMesmoInstante?: boolean
}

/**
 * Grava a transição com UPDATE condicional (where estado = estado lido): se
 * outro tablet mudou antes, nenhuma linha é afetada e nada é registrado.
 * Devolve false nesse caso.
 */
async function gravarTransicao(g: Gravacao): Promise<boolean> {
  const mudancas: Record<string, string | null> = {
    estado: g.novo.estado,
    estado_anterior: g.novo.estadoAnterior,
    estado_desde: g.novo.estadoDesde.toISOString(),
  }
  if (g.cancelamentoMotivo !== undefined) mudancas.cancelamento_motivo = g.cancelamentoMotivo

  let consulta = supabase.from('pedidos').update(mudancas).eq('id', g.atual.id).eq('estado', g.atual.estado)
  if (g.exigirMesmoInstante) consulta = consulta.eq('estado_desde', g.atual.estadoDesdeTexto)
  const { data, error } = await consulta.select('id')
  if (error) throw new Error(`gravarTransicao: ${error.message}`)
  if (!data || data.length === 0) return false

  await registrarAtividade(g.atual.comandaId)
  await auditoriaRepo.registrar(
    criarEvento(g.tipoEvento, g.ator, {
      comandaId: g.atual.comandaId,
      pedidoId: g.atual.id,
      motivo: g.motivo ?? null,
      payload: { numero: g.atual.numero, mesa: g.atual.mesaNumero, conta: g.atual.contaNumero, de: g.atual.estado, para: g.novo.estado },
    }),
  )
  return true
}

async function gravarOuFalhar(g: Gravacao): Promise<void> {
  if (!(await gravarTransicao(g))) throw new ErroConcorrencia()
}

const AVANCOS: readonly EstadoPedido[] = ['Preparando', 'Pronto', 'Entregue']

/** Cozinha: Aceitar (→Preparando), Pronto, Entregue. */
export async function avancarEstado(pedidoId: string, para: EstadoPedido): Promise<void> {
  if (!AVANCOS.includes(para)) throw new ErroRegra(`avancarEstado: use a função própria para ${para}`)
  const atual = await lerPedido(pedidoId)
  if (!transicaoValida(atual, para)) throw new ErroRegra(`Não é possível ir de ${atual.estado} para ${para}.`)
  await gravarOuFalhar({
    atual,
    novo: aplicarTransicao(atual, para, new Date()),
    ator: await auditoriaRepo.atorDaSessao(),
    tipoEvento: 'pedido_estado_alterado',
  })
}

/** Depois do "já paguei" o cliente não mexe mais nos pedidos (decisão 20). */
const MENSAGEM_CONTA_PAGA = 'A conta já foi enviada para pagamento. Para mudar algo, chame um atendente.'

/** Cliente fora da janela: "chamar garçom" → EdicaoSolicitada. */
export async function solicitarEdicao(pedidoId: string): Promise<void> {
  const atual = await lerPedido(pedidoId)
  if (atual.estadoComanda !== 'Aberta') throw new ErroRegra(MENSAGEM_CONTA_PAGA)
  if (!transicaoValida(atual, 'EdicaoSolicitada')) throw new ErroRegra('Este pedido não aceita mais pedidos de edição.')
  await gravarOuFalhar({
    atual,
    novo: aplicarTransicao(atual, 'EdicaoSolicitada', new Date()),
    ator: await auditoriaRepo.atorDaSessao(),
    tipoEvento: 'pedido_edicao_solicitada',
  })
}

/** Garçom resolve a edição (aplicada ou negada): volta ao estado anterior. */
export async function resolverEdicao(pedidoId: string, aplicada: boolean): Promise<void> {
  const atual = await lerPedido(pedidoId)
  if (atual.estado !== 'EdicaoSolicitada' || !atual.estadoAnterior) {
    throw new ErroRegra('Este pedido não está com edição solicitada.')
  }
  await gravarOuFalhar({
    atual,
    novo: aplicarTransicao(atual, atual.estadoAnterior, new Date()),
    ator: await auditoriaRepo.atorDaSessao(),
    tipoEvento: aplicada ? 'pedido_edicao_aplicada' : 'pedido_edicao_negada',
  })
}

/** Cliente cancela dentro da janela livre (Recebido ou Preparando recente). */
export async function cancelarPeloCliente(pedidoId: string, configs: ConfigsTempo): Promise<void> {
  const atual = await lerPedido(pedidoId)
  const agora = new Date()
  if (atual.estadoComanda !== 'Aberta') throw new ErroRegra(MENSAGEM_CONTA_PAGA)
  if (!dentroDaJanelaLivre(atual, configs, agora)) {
    throw new ErroRegra('O prazo para cancelar sem o garçom acabou. Use "chamar garçom".')
  }
  const novo =
    atual.estado === 'Recebido'
      ? aplicarTransicao(atual, 'Cancelado', agora)
      : aplicarCancelamentoPeloClienteNaJanela(atual, agora)
  await gravarOuFalhar({
    atual,
    novo,
    cancelamentoMotivo: 'cliente_janela_livre',
    ator: await auditoriaRepo.atorDaSessao(),
    tipoEvento: 'pedido_cancelado',
    motivo: 'cliente_janela_livre',
  })
}

/**
 * Cozinha, 1ª etapa (§6.6). Em Recebido cancela direto (1 etapa); em
 * Preparando/Pronto vai para CancelamentoPendente. Motivo sempre obrigatório.
 * Devolve o estado resultante.
 */
export async function solicitarCancelamento(
  pedidoId: string,
  motivo: MotivoCancelamento,
  textoLivre: string | null,
): Promise<'Cancelado' | 'CancelamentoPendente'> {
  if (validaMotivo(motivo, textoLivre)) throw new ErroRegra('Motivo de cancelamento inválido.')
  const atual = await lerPedido(pedidoId)
  if (!podeCancelar(atual)) throw new ErroRegra('Este pedido não pode mais ser cancelado.')
  const registro = motivoParaRegistro(motivo, textoLivre)
  const ator = await auditoriaRepo.atorDaSessao()
  const agora = new Date()

  if (!precisaDuasEtapas(atual)) {
    await gravarOuFalhar({
      atual,
      novo: aplicarTransicao(atual, 'Cancelado', agora),
      cancelamentoMotivo: registro,
      ator,
      tipoEvento: 'pedido_cancelado',
      motivo: registro,
    })
    return 'Cancelado'
  }
  await gravarOuFalhar({
    atual,
    novo: aplicarTransicao(atual, 'CancelamentoPendente', agora),
    cancelamentoMotivo: registro,
    ator,
    tipoEvento: 'pedido_cancelamento_solicitado',
    motivo: registro,
  })
  return 'CancelamentoPendente'
}

/** Cozinha, 2ª etapa: confirma (→ Cancelado). */
export async function confirmarCancelamento(pedidoId: string): Promise<void> {
  const atual = await lerPedido(pedidoId)
  if (atual.estado !== 'CancelamentoPendente') throw new ErroRegra('Este pedido não está aguardando confirmação.')
  await gravarOuFalhar({
    atual,
    novo: aplicarTransicao(atual, 'Cancelado', new Date()),
    ator: await auditoriaRepo.atorDaSessao(),
    tipoEvento: 'pedido_cancelado',
    motivo: atual.cancelamentoMotivo,
  })
}

/** Cozinha, 2ª etapa: desiste (volta ao estado anterior, limpa o motivo). */
export async function desistirCancelamento(pedidoId: string): Promise<void> {
  const atual = await lerPedido(pedidoId)
  if (atual.estado !== 'CancelamentoPendente' || !atual.estadoAnterior) {
    throw new ErroRegra('Este pedido não está aguardando confirmação.')
  }
  await gravarOuFalhar({
    atual,
    novo: aplicarTransicao(atual, atual.estadoAnterior, new Date()),
    cancelamentoMotivo: null,
    ator: await auditoriaRepo.atorDaSessao(),
    tipoEvento: 'pedido_cancelamento_desistido',
    motivo: atual.cancelamentoMotivo,
  })
}

/**
 * Rotina do tablet (§6.11): cancela com ator "sistema" se o pedido ainda
 * estiver expirado. Escrita condicional ao estado E ao instante lidos: se
 * outro tablet já cancelou (ou a cozinha aceitou), nada acontece.
 * Devolve true se ESTE tablet cancelou.
 */
export async function cancelarAutomaticamente(pedidoId: string, configs: ConfigsTempo): Promise<boolean> {
  const atual = await lerPedido(pedidoId)
  const agora = new Date()
  if (!pedidoExpirado(atual, configs, agora)) return false
  return gravarTransicao({
    atual,
    novo: aplicarTransicao(atual, 'Cancelado', agora),
    cancelamentoMotivo: 'auto_cancelamento',
    ator: ATOR_SISTEMA,
    tipoEvento: 'pedido_cancelado',
    motivo: 'auto_cancelamento',
    exigirMesmoInstante: true,
  })
}

// ===========================================================================
// Edição de itens (item 9)
// ===========================================================================

async function prepararEdicao(pedidoId: string, configs: ConfigsTempo) {
  const atual = await lerPedido(pedidoId)
  const ator = await auditoriaRepo.atorDaSessao()
  const quem: 'cliente' | 'funcionario' = ator.tipo === 'funcionario' ? 'funcionario' : 'cliente'
  if (!podeEditarItens(atual, quem, configs, new Date(), atual.estadoComanda)) {
    throw new ErroRegra(
      quem === 'cliente' && atual.estadoComanda !== 'Aberta'
        ? MENSAGEM_CONTA_PAGA
        : quem === 'cliente'
        ? 'O prazo para editar sem o garçom acabou. Use "chamar garçom".'
        : 'Só dá para editar itens com a edição solicitada.',
    )
  }
  return { atual, ator, quem }
}

export async function alterarQuantidadeItem(
  pedidoId: string,
  itemPedidoId: string,
  quantidade: number,
  configs: ConfigsTempo,
): Promise<void> {
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > QUANTIDADE_MAX_POR_ITEM) {
    throw new ErroRegra('Quantidade inválida.')
  }
  const { atual, ator } = await prepararEdicao(pedidoId, configs)
  const item = atual.itens.find(i => i.id === itemPedidoId && !i.removidoEm)
  if (!item) throw new ErroRegra('Item não encontrado.')
  if (item.quantidade === quantidade) return

  const { data, error } = await supabase
    .from('itens_pedido')
    .update({ quantidade })
    .eq('id', itemPedidoId)
    .eq('quantidade', item.quantidade)
    .is('removido_em', null)
    .select('id')
  if (error) throw new Error(`alterarQuantidadeItem: ${error.message}`)
  if (!data || data.length === 0) throw new ErroConcorrencia()

  await registrarAtividade(atual.comandaId)
  await auditoriaRepo.registrar(
    criarEvento('item_pedido_quantidade_alterada', ator, {
      comandaId: atual.comandaId,
      pedidoId,
      payload: {
        numero: atual.numero,
        mesa: atual.mesaNumero,
        conta: atual.contaNumero,
        item: item.nomeSnapshot,
        de: item.quantidade,
        para: quantidade,
      },
    }),
  )
}

/**
 * Remove um item (seta removido_em, nunca DELETE). Se for o último item ativo:
 * o cliente cancela o pedido inteiro (mesma regra do cancelamento total);
 * o garçom não pode (deve negar a edição e usar o cancelamento com motivo).
 */
export async function removerItemDoPedido(pedidoId: string, itemPedidoId: string, configs: ConfigsTempo): Promise<void> {
  const { atual, ator, quem } = await prepararEdicao(pedidoId, configs)
  const item = atual.itens.find(i => i.id === itemPedidoId && !i.removidoEm)
  if (!item) throw new ErroRegra('Item não encontrado.')

  if (remocaoEsvaziaPedido(atual.itens, itemPedidoId)) {
    if (quem === 'cliente') return cancelarPeloCliente(pedidoId, configs)
    throw new ErroRegra('Para tirar todos os itens, negue a edição e cancele o pedido com o motivo.')
  }

  const { data, error } = await supabase
    .from('itens_pedido')
    .update({ removido_em: new Date().toISOString() })
    .eq('id', itemPedidoId)
    .is('removido_em', null)
    .select('id')
  if (error) throw new Error(`removerItemDoPedido: ${error.message}`)
  if (!data || data.length === 0) throw new ErroConcorrencia()

  await registrarAtividade(atual.comandaId)
  await auditoriaRepo.registrar(
    criarEvento('item_pedido_removido', ator, {
      comandaId: atual.comandaId,
      pedidoId,
      payload: { numero: atual.numero, mesa: atual.mesaNumero, conta: atual.contaNumero, item: item.nomeSnapshot, quantidade: item.quantidade },
    }),
  )
}

// ===========================================================================
// Cozinha (item 7)
// ===========================================================================

export interface PedidoCozinha extends Pedido {
  mesaNumero: number
  comandaNumero: number
  observacao: string | null
  nomeCliente: string | null
  estadoComanda: EstadoComanda
}

interface LinhaPedidoCozinha extends LinhaPedido {
  comandas: { numero: number; estado: string; observacao: string | null; mesas: { numero: number } | null } | null
}

/** Pedidos que exigem ação da cozinha (Recebido até Pronto, mais os temporários). */
export async function listarPedidosCozinha(): Promise<PedidoCozinha[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select(`${COLUNAS_PEDIDO}, comandas (numero, estado, observacao, mesas (numero))`)
    .in('estado', [...ESTADOS_PENDENTES])
    .order('estado_desde', { ascending: true })
  if (error) throw new Error(`listarPedidosCozinha: ${error.message}`)
  const linhas = data as unknown as LinhaPedidoCozinha[]

  const comandaIds = [...new Set(linhas.map(l => l.comanda_id))]
  const nomes = new Map<string, string | null>()
  if (comandaIds.length > 0) {
    const { data: sessoes, error: erroSessoes } = await supabase
      .from('sessoes_mesa')
      .select('usuario_id, comanda_id, nome_cliente')
      .in('comanda_id', comandaIds)
    if (erroSessoes) throw new Error(`listarPedidosCozinha: ${erroSessoes.message}`)
    for (const s of sessoes as { usuario_id: string; comanda_id: string; nome_cliente: string | null }[]) {
      nomes.set(`${s.comanda_id}:${s.usuario_id}`, s.nome_cliente)
    }
  }

  return linhas.map(linha => ({
    ...paraPedido(linha),
    mesaNumero: linha.comandas?.mesas?.numero ?? 0,
    comandaNumero: linha.comandas?.numero ?? 0,
    observacao: linha.comandas?.observacao ?? null,
    estadoComanda: EstadoComandaSchema.parse(linha.comandas?.estado),
    nomeCliente: linha.criado_por ? (nomes.get(`${linha.comanda_id}:${linha.criado_por}`) ?? null) : null,
  }))
}

/**
 * Tempo real da cozinha: qualquer mudança em pedidos, itens ou comandas.
 * Na (re)conexão, aoConectar recarrega a lista inteira (não perde eventos).
 */
export function assinarPedidosAbertos(callbacks: CallbacksAssinatura): () => void {
  const canal = supabase
    .channel(`cozinha-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => callbacks.aoMudar())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_pedido' }, () => callbacks.aoMudar())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, () => callbacks.aoMudar())
    .subscribe(status => {
      if (status === 'SUBSCRIBED') callbacks.aoConectar()
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') callbacks.aoDesconectar?.()
    })
  return () => void supabase.removeChannel(canal)
}
