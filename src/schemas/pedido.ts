import { z } from 'zod'
import { ESTADOS_PEDIDO, type EstadoPedido } from '@/domain/pedido/estado'
import { DataHoraOpcionalSchema, DataHoraSchema } from './comum'

export const EstadoPedidoSchema = z.enum(ESTADOS_PEDIDO as [EstadoPedido, ...EstadoPedido[]])

export const ItemPedidoSchema = z.object({
  id: z.uuid(),
  pedidoId: z.uuid(),
  itemCardapioId: z.uuid(),
  nomeSnapshot: z.string().min(1),
  quantidade: z.number().int().positive(),
  precoCentavosSnapshot: z.number().int().positive(),
  removidoEm: DataHoraOpcionalSchema,
  fotoUrl: z.url().nullable(),
})
export type ItemPedido = z.infer<typeof ItemPedidoSchema>

export const PedidoSchema = z.object({
  id: z.uuid(),
  numero: z.number().int().positive(),
  comandaId: z.uuid(),
  estado: EstadoPedidoSchema,
  estadoAnterior: EstadoPedidoSchema.nullable(),
  estadoDesde: DataHoraSchema,
  criadoEm: DataHoraSchema,
  criadoPor: z.uuid().nullable(),
  cancelamentoMotivo: z.string().nullable(),
  itens: z.array(ItemPedidoSchema),
})
export type Pedido = z.infer<typeof PedidoSchema>

export const QUANTIDADE_MAX_POR_ITEM = 99

/** Item do carrinho enviado ao criar um pedido. */
export const NovoItemPedidoSchema = z.object({
  itemId: z.uuid(),
  quantidade: z.number().int().min(1).max(QUANTIDADE_MAX_POR_ITEM),
})
export type NovoItemPedido = z.infer<typeof NovoItemPedidoSchema>

export const NovoPedidoSchema = z.array(NovoItemPedidoSchema).min(1, 'O carrinho está vazio.')
