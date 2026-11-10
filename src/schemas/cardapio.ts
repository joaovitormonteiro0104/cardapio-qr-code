import { z } from 'zod'
import { NOME_CATEGORIA_MAX, NOME_ITEM_MAX } from '@/domain/cardapio/validacao'

const Timestamp = z.iso.datetime({ offset: true })

export const CategoriaSchema = z.object({
  id: z.uuid(),
  nome: z.string().min(1).max(NOME_CATEGORIA_MAX),
  ordem: z.number().int(),
  ativa: z.boolean(),
})
export type Categoria = z.infer<typeof CategoriaSchema>

export const ItemCardapioSchema = z.object({
  id: z.uuid(),
  nome: z.string().min(1).max(NOME_ITEM_MAX),
  precoCentavos: z.number().int().positive(),
  categoriaId: z.uuid(),
  disponivel: z.boolean(),
  ativo: z.boolean(),
  fotoUrl: z.url().nullable(),
  criadoEm: Timestamp,
})
export type ItemCardapio = z.infer<typeof ItemCardapioSchema>

/** Dados de formulário (criar/editar item), já convertidos pra centavos. */
export const ItemFormSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.').max(NOME_ITEM_MAX, 'Nome muito longo.'),
  precoCentavos: z.number().int().positive('O preço precisa ser maior que zero.'),
  categoriaId: z.uuid('Escolha uma categoria.'),
  disponivel: z.boolean(),
  fotoUrl: z.url().nullable(),
})
export type ItemForm = z.infer<typeof ItemFormSchema>

export const CategoriaFormSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.').max(NOME_CATEGORIA_MAX, 'Nome muito longo.'),
})
export type CategoriaForm = z.infer<typeof CategoriaFormSchema>
