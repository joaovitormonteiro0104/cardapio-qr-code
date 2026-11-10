import { supabase } from './supabase'
import * as auditoriaRepo from './auditoriaRepo'
import { registrarAtividade } from './comandaRepo'
import { criarEvento } from '@/domain/auditoria/evento'
import { aceitaNovosPedidos } from '@/domain/comanda/estado'
import { totalPedido } from '@/domain/pedido/calculo'
import { NovoPedidoSchema, PedidoSchema, type NovoItemPedido, type Pedido } from '@/schemas/pedido'
import { EstadoComandaSchema } from '@/schemas/comanda'

export const COLUNAS_PEDIDO =
  'id, numero, comanda_id, estado, estado_anterior, estado_desde, criado_em, criado_por, ' +
  'itens_pedido (id, pedido_id, item_cardapio_id, nome_snapshot, quantidade, preco_centavos_snapshot, removido_em)'

export interface LinhaItemPedido {
  id: string
  pedido_id: string
  item_cardapio_id: string
  nome_snapshot: string
  quantidade: number
  preco_centavos_snapshot: number
  removido_em: string | null
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
    .select('estado')
    .eq('id', comandaId)
    .single()
  if (erroComanda) throw new ErroPedido('falha', `criarPedido: ${erroComanda.message}`)
  if (!aceitaNovosPedidos(EstadoComandaSchema.parse((comanda as { estado: string }).estado))) {
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
