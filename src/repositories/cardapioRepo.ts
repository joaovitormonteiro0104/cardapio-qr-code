import { supabase } from './supabase'
import * as auditoriaRepo from './auditoriaRepo'
import { criarEvento, type TipoEvento } from '@/domain/auditoria/evento'
import {
  CategoriaFormSchema,
  CategoriaSchema,
  ItemCardapioSchema,
  ItemFormSchema,
  type Categoria,
  type CategoriaForm,
  type ItemCardapio,
  type ItemForm,
} from '@/schemas/cardapio'

const COLUNAS_ITEM = 'id, nome, descricao, preco_centavos, categoria_id, disponivel, ativo, foto_url, criado_em'
const COLUNAS_CATEGORIA = 'id, nome, ordem, ativa'

interface LinhaItem {
  id: string
  nome: string
  descricao: string | null
  preco_centavos: number
  categoria_id: string
  disponivel: boolean
  ativo: boolean
  foto_url: string | null
  criado_em: string
}

interface LinhaCategoria {
  id: string
  nome: string
  ordem: number
  ativa: boolean
}

function paraItem(linha: LinhaItem): ItemCardapio {
  return ItemCardapioSchema.parse({
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao,
    precoCentavos: linha.preco_centavos,
    categoriaId: linha.categoria_id,
    disponivel: linha.disponivel,
    ativo: linha.ativo,
    fotoUrl: linha.foto_url,
    criadoEm: linha.criado_em,
  })
}

function paraCategoria(linha: LinhaCategoria): Categoria {
  return CategoriaSchema.parse(linha)
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/** Cardápio do cliente: só categorias ativas e itens ativos + disponíveis (a RLS já filtra). */
export async function listarCardapioCliente(): Promise<{ categorias: Categoria[]; itens: ItemCardapio[] }> {
  const [categorias, itens] = await Promise.all([
    supabase.from('categorias').select(COLUNAS_CATEGORIA).eq('ativa', true).order('ordem').order('nome'),
    supabase.from('itens_cardapio').select(COLUNAS_ITEM).eq('ativo', true).eq('disponivel', true).order('nome'),
  ])
  if (categorias.error) throw new Error(`listarCardapioCliente: ${categorias.error.message}`)
  if (itens.error) throw new Error(`listarCardapioCliente: ${itens.error.message}`)
  return {
    categorias: (categorias.data as LinhaCategoria[]).map(paraCategoria),
    itens: (itens.data as LinhaItem[]).map(paraItem),
  }
}

/** Cardápio da gerência: inclui esgotados; inativos (itens e categorias) só com o filtro. */
export async function listarCardapioGerencia(
  mostrarInativos: boolean,
): Promise<{ categorias: Categoria[]; itens: ItemCardapio[] }> {
  let consultaCategorias = supabase.from('categorias').select(COLUNAS_CATEGORIA).order('ordem').order('nome')
  let consultaItens = supabase.from('itens_cardapio').select(COLUNAS_ITEM).order('nome')
  if (!mostrarInativos) {
    consultaCategorias = consultaCategorias.eq('ativa', true)
    consultaItens = consultaItens.eq('ativo', true)
  }
  const [categorias, itens] = await Promise.all([consultaCategorias, consultaItens])
  if (categorias.error) throw new Error(`listarCardapioGerencia: ${categorias.error.message}`)
  if (itens.error) throw new Error(`listarCardapioGerencia: ${itens.error.message}`)
  return {
    categorias: (categorias.data as LinhaCategoria[]).map(paraCategoria),
    itens: (itens.data as LinhaItem[]).map(paraItem),
  }
}

/** Busca itens por id, inclusive inativos (operação/gerência; cliente só vê os visíveis). */
export async function buscarItens(ids: readonly string[]): Promise<ItemCardapio[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('itens_cardapio').select(COLUNAS_ITEM).in('id', [...ids])
  if (error) throw new Error(`buscarItens: ${error.message}`)
  return (data as LinhaItem[]).map(paraItem)
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export async function criarCategoria(form: CategoriaForm): Promise<Categoria> {
  const dados = CategoriaFormSchema.parse(form)
  // nova categoria vai pro fim da lista
  const { data: ultima, error: erroOrdem } = await supabase
    .from('categorias')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
  if (erroOrdem) throw new Error(`criarCategoria: ${erroOrdem.message}`)
  const ordem = ((ultima as { ordem: number }[])[0]?.ordem ?? -1) + 1

  const { data, error } = await supabase
    .from('categorias')
    .insert({ nome: dados.nome, ordem })
    .select(COLUNAS_CATEGORIA)
    .single()
  if (error) throw new Error(`criarCategoria: ${error.message}`)
  const categoria = paraCategoria(data as LinhaCategoria)

  await auditoriaRepo.registrar(
    criarEvento('categoria_criada', await auditoriaRepo.atorDaSessao(), {
      payload: { categoria_id: categoria.id, nome: categoria.nome },
    }),
  )
  return categoria
}

async function atualizarCategoria(
  id: string,
  mudancas: { nome?: string; ativa?: boolean },
  antes: Categoria,
): Promise<Categoria> {
  const { data, error } = await supabase
    .from('categorias')
    .update(mudancas)
    .eq('id', id)
    .select(COLUNAS_CATEGORIA)
    .single()
  if (error) throw new Error(`atualizarCategoria: ${error.message}`)
  const depois = paraCategoria(data as LinhaCategoria)

  await auditoriaRepo.registrar(
    criarEvento('categoria_atualizada', await auditoriaRepo.atorDaSessao(), {
      payload: { categoria_id: id, antes: { nome: antes.nome, ativa: antes.ativa }, depois: mudancas },
    }),
  )
  return depois
}

export async function renomearCategoria(categoria: Categoria, form: CategoriaForm): Promise<Categoria> {
  const dados = CategoriaFormSchema.parse(form)
  return atualizarCategoria(categoria.id, { nome: dados.nome }, categoria)
}

/** Desativar = ativa false (soft delete). Reativar = ativa true. */
export async function definirCategoriaAtiva(categoria: Categoria, ativa: boolean): Promise<Categoria> {
  return atualizarCategoria(categoria.id, { ativa }, categoria)
}

/** Grava a nova ordem: a posição na lista vira o campo `ordem`. */
export async function reordenarCategorias(idsEmOrdem: readonly string[]): Promise<void> {
  const resultados = await Promise.all(
    idsEmOrdem.map((id, ordem) => supabase.from('categorias').update({ ordem }).eq('id', id)),
  )
  const falha = resultados.find(r => r.error)
  if (falha?.error) throw new Error(`reordenarCategorias: ${falha.error.message}`)

  await auditoriaRepo.registrar(
    criarEvento('categorias_reordenadas', await auditoriaRepo.atorDaSessao(), {
      payload: { ordem: [...idsEmOrdem] },
    }),
  )
}

// ---------------------------------------------------------------------------
// Itens
// ---------------------------------------------------------------------------

function paraColunas(form: ItemForm) {
  return {
    nome: form.nome,
    descricao: form.descricao,
    preco_centavos: form.precoCentavos,
    categoria_id: form.categoriaId,
    disponivel: form.disponivel,
    foto_url: form.fotoUrl,
  }
}

export async function criarItem(form: ItemForm): Promise<ItemCardapio> {
  const dados = ItemFormSchema.parse(form)
  const { data, error } = await supabase
    .from('itens_cardapio')
    .insert(paraColunas(dados))
    .select(COLUNAS_ITEM)
    .single()
  if (error) throw new Error(`criarItem: ${error.message}`)
  const item = paraItem(data as LinhaItem)

  await auditoriaRepo.registrar(
    criarEvento('item_cardapio_criado', await auditoriaRepo.atorDaSessao(), {
      payload: { item_id: item.id, ...paraColunas(dados) },
    }),
  )
  return item
}

export async function atualizarItem(antes: ItemCardapio, form: ItemForm): Promise<ItemCardapio> {
  const dados = ItemFormSchema.parse(form)
  const { data, error } = await supabase
    .from('itens_cardapio')
    .update(paraColunas(dados))
    .eq('id', antes.id)
    .select(COLUNAS_ITEM)
    .single()
  if (error) throw new Error(`atualizarItem: ${error.message}`)
  const depois = paraItem(data as LinhaItem)

  await auditoriaRepo.registrar(
    criarEvento('item_cardapio_atualizado', await auditoriaRepo.atorDaSessao(), {
      payload: {
        item_id: antes.id,
        antes: {
          nome: antes.nome,
          descricao: antes.descricao,
          preco_centavos: antes.precoCentavos,
          categoria_id: antes.categoriaId,
          disponivel: antes.disponivel,
          foto_url: antes.fotoUrl,
        },
        depois: paraColunas(dados),
      },
    }),
  )
  return depois
}

async function alterarFlag(
  item: ItemCardapio,
  mudanca: { disponivel: boolean } | { ativo: boolean },
  tipoEvento: TipoEvento,
): Promise<ItemCardapio> {
  const { data, error } = await supabase
    .from('itens_cardapio')
    .update(mudanca)
    .eq('id', item.id)
    .select(COLUNAS_ITEM)
    .single()
  if (error) throw new Error(`${tipoEvento}: ${error.message}`)
  const depois = paraItem(data as LinhaItem)

  await auditoriaRepo.registrar(
    criarEvento(tipoEvento, await auditoriaRepo.atorDaSessao(), {
      payload: { item_id: item.id, nome: item.nome, ...mudanca },
    }),
  )
  return depois
}

/** "Esgotado": some do cardápio do cliente, continua no banco. */
export const marcarEsgotado = (item: ItemCardapio) =>
  alterarFlag(item, { disponivel: false }, 'item_cardapio_esgotado')

export const reativarItem = (item: ItemCardapio) =>
  alterarFlag(item, { disponivel: true }, 'item_cardapio_reativado')

/** "Excluir" = soft delete (ativo false). Pedidos antigos mantêm a referência. */
export const removerItem = (item: ItemCardapio) => alterarFlag(item, { ativo: false }, 'item_cardapio_removido')

export const restaurarItem = (item: ItemCardapio) =>
  alterarFlag(item, { ativo: true }, 'item_cardapio_restaurado')
