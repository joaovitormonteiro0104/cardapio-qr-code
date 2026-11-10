import { z } from 'zod'
import { ESTADOS_COMANDA } from '@/domain/comanda/estado'
import { DataHoraSchema } from './comum'

export const MesaSchema = z.object({
  id: z.uuid(),
  numero: z.number().int().positive(),
  ativa: z.boolean(),
})
export type Mesa = z.infer<typeof MesaSchema>

export const EstadoComandaSchema = z.enum(ESTADOS_COMANDA as ['Aberta', 'AguardandoPagamento', 'Paga', 'Fechada'])

export const OBSERVACAO_MAX = 500

export const ComandaSchema = z.object({
  id: z.uuid(),
  numero: z.number().int().positive(),
  mesaId: z.uuid(),
  estado: EstadoComandaSchema,
  observacao: z.string().nullable(),
  ultimaAtividadeEm: DataHoraSchema,
  criadoEm: DataHoraSchema,
})
export type Comanda = z.infer<typeof ComandaSchema>

export const NOME_CLIENTE_MAX = 40

/** Nome opcional do cliente: vazio vira null. */
export const NomeClienteSchema = z
  .string()
  .trim()
  .max(NOME_CLIENTE_MAX, `Use até ${NOME_CLIENTE_MAX} caracteres.`)
  .transform(nome => (nome === '' ? null : nome))

export const ObservacaoSchema = z
  .string()
  .trim()
  .max(OBSERVACAO_MAX, `Use até ${OBSERVACAO_MAX} caracteres.`)
  .transform(texto => (texto === '' ? null : texto))
