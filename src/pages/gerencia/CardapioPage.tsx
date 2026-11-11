import { useEffect, useId, useState, type FormEvent } from 'react'
import { FotoItem } from '@/components/FotoItem'
import { LayoutEquipe } from '@/components/LayoutEquipe'
import { Modal } from '@/components/Modal'
import { mover } from '@/domain/cardapio/validacao'
import { useCardapio } from '@/hooks/useCardapio'
import { formatarReal } from '@/lib/formato'
import * as cardapioRepo from '@/repositories/cardapioRepo'
import { CategoriaFormSchema, type Categoria, type ItemCardapio, type ItemForm } from '@/schemas/cardapio'
import { ItemFormModal } from './ItemFormModal'

type EdicaoItem = { item: ItemCardapio | null; categoriaId: string | null } | null
type EdicaoCategoria = { categoria: Categoria | null } | null

export default function CardapioPage() {
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const { categorias, itens, carregando, erro, recarregar } = useCardapio('gerencia', mostrarInativos)

  const [ordem, setOrdem] = useState<Categoria[]>([])
  const [arrastando, setArrastando] = useState<number | null>(null)
  const [edicaoItem, setEdicaoItem] = useState<EdicaoItem>(null)
  const [edicaoCategoria, setEdicaoCategoria] = useState<EdicaoCategoria>(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState<ItemCardapio | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  useEffect(() => setOrdem(categorias), [categorias])

  async function executar(chave: string, acao: () => Promise<unknown>) {
    setOcupado(chave)
    setAviso(null)
    try {
      await acao()
      await recarregar()
    } catch (falha) {
      console.error(falha)
      setAviso('Não foi possível salvar a alteração. Tente de novo.')
    } finally {
      setOcupado(null)
    }
  }

  async function reordenar(de: number, para: number) {
    if (de === para || para < 0 || para >= ordem.length) return
    const nova = mover(ordem, de, para)
    setOrdem(nova)
    await executar('ordem', () => cardapioRepo.reordenarCategorias(nova.map(c => c.id)))
  }

  async function salvarItem(form: ItemForm) {
    const atual = edicaoItem?.item
    await (atual ? cardapioRepo.atualizarItem(atual, form) : cardapioRepo.criarItem(form))
    setEdicaoItem(null)
    await recarregar()
  }

  const itensPorCategoria = (id: string) => itens.filter(item => item.categoriaId === id)
  const semCategoriaAtiva = ordem.length === 0

  return (
    <LayoutEquipe titulo="Cardápio">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button type="button" className="botao-primario" onClick={() => setEdicaoCategoria({ categoria: null })}>
          Nova categoria
        </button>
        <button
          type="button"
          className="botao-secundario"
          disabled={semCategoriaAtiva}
          onClick={() => setEdicaoItem({ item: null, categoriaId: null })}
        >
          Novo item
        </button>
        <label className="ml-auto flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-brasa"
            checked={mostrarInativos}
            onChange={e => setMostrarInativos(e.target.checked)}
          />
          Mostrar inativos
        </label>
      </div>

      <p role="status" aria-live="polite" className={aviso ? 'mb-4 rounded-xl bg-perigo-clara px-4 py-3 text-sm text-perigo' : 'sr-only'}>
        {aviso}
      </p>

      {carregando && <p className="text-tinta-suave">Carregando cardápio…</p>}
      {erro && (
        <div className="rounded-xl bg-perigo-clara px-4 py-3 text-perigo">
          {erro}{' '}
          <button type="button" className="font-semibold underline" onClick={() => void recarregar()}>
            Tentar de novo
          </button>
        </div>
      )}

      {!carregando && !erro && semCategoriaAtiva && (
        <div className="rounded-2xl border border-dashed border-borda px-6 py-10 text-center">
          <p className="font-medium">Nenhuma categoria ainda.</p>
          <p className="mt-1 text-sm text-tinta-suave">Crie categorias como “Lanches” e “Bebidas” e depois adicione os itens.</p>
        </div>
      )}

      <ol className="space-y-6">
        {ordem.map((categoria, indice) => (
          <li
            key={categoria.id}
            onDragOver={evento => {
              if (arrastando !== null) evento.preventDefault()
            }}
            onDrop={evento => {
              evento.preventDefault()
              if (arrastando !== null) void reordenar(arrastando, indice)
              setArrastando(null)
            }}
            className={`rounded-2xl border bg-superficie ${arrastando === indice ? 'border-brasa opacity-60' : 'border-borda'}`}
          >
            <section aria-labelledby={`cat-${categoria.id}`}>
              <header className="flex flex-wrap items-center gap-2 border-b border-borda px-3 py-2">
                <span
                  draggable
                  onDragStart={() => setArrastando(indice)}
                  onDragEnd={() => setArrastando(null)}
                  className="hidden cursor-grab select-none px-1 text-tinta-suave sm:inline"
                  title="Arraste para reordenar"
                  aria-hidden
                >
                  ⠿
                </span>
                <h2 id={`cat-${categoria.id}`} className="mr-auto text-lg font-semibold">
                  {categoria.nome}
                  {!categoria.ativa && (
                    <span className="ml-2 rounded-md bg-fundo px-2 py-0.5 align-middle text-xs font-medium text-tinta-suave">
                      Inativa
                    </span>
                  )}
                </h2>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="botao-secundario size-11 px-0"
                    aria-label={`Subir ${categoria.nome}`}
                    disabled={indice === 0 || ocupado === 'ordem'}
                    onClick={() => void reordenar(indice, indice - 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="botao-secundario size-11 px-0"
                    aria-label={`Descer ${categoria.nome}`}
                    disabled={indice === ordem.length - 1 || ocupado === 'ordem'}
                    onClick={() => void reordenar(indice, indice + 1)}
                  >
                    ↓
                  </button>
                </div>
                <button type="button" className="botao-secundario text-sm" onClick={() => setEdicaoCategoria({ categoria })}>
                  Renomear
                </button>
                <button
                  type="button"
                  className="botao-secundario text-sm"
                  disabled={ocupado === categoria.id}
                  onClick={() =>
                    void executar(categoria.id, () => cardapioRepo.definirCategoriaAtiva(categoria, !categoria.ativa))
                  }
                >
                  {categoria.ativa ? 'Desativar' : 'Ativar'}
                </button>
              </header>

              <ul className="divide-y divide-borda">
                {itensPorCategoria(categoria.id).map(item => (
                  <LinhaItem
                    key={item.id}
                    item={item}
                    ocupado={ocupado === item.id}
                    aoEditar={() => setEdicaoItem({ item, categoriaId: null })}
                    aoAlternarEsgotado={() =>
                      void executar(item.id, () =>
                        item.disponivel ? cardapioRepo.marcarEsgotado(item) : cardapioRepo.reativarItem(item),
                      )
                    }
                    aoExcluir={() => setConfirmarExclusao(item)}
                    aoRestaurar={() => void executar(item.id, () => cardapioRepo.restaurarItem(item))}
                  />
                ))}
              </ul>
              <div className="px-3 py-2">
                <button
                  type="button"
                  className="botao min-h-11 px-2 text-sm text-brasa-forte hover:bg-brasa-clara"
                  onClick={() => setEdicaoItem({ item: null, categoriaId: categoria.id })}
                >
                  + Adicionar item em {categoria.nome}
                </button>
              </div>
            </section>
          </li>
        ))}
      </ol>

      <ItemFormModal
        aberto={edicaoItem !== null}
        item={edicaoItem?.item ?? null}
        categoriaInicial={edicaoItem?.categoriaId ?? null}
        categorias={ordem}
        aoFechar={() => setEdicaoItem(null)}
        aoSalvar={salvarItem}
      />

      <CategoriaModal
        edicao={edicaoCategoria}
        aoFechar={() => setEdicaoCategoria(null)}
        aoSalvar={async nome => {
          const atual = edicaoCategoria?.categoria
          await (atual
            ? cardapioRepo.renomearCategoria(atual, { nome })
            : cardapioRepo.criarCategoria({ nome }))
          setEdicaoCategoria(null)
          await recarregar()
        }}
      />

      <Modal
        aberto={confirmarExclusao !== null}
        titulo="Excluir item?"
        aoFechar={() => setConfirmarExclusao(null)}
        acoes={
          <>
            <button type="button" className="botao-secundario" onClick={() => setConfirmarExclusao(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="botao-perigo"
              onClick={() => {
                const alvo = confirmarExclusao
                setConfirmarExclusao(null)
                if (alvo) void executar(alvo.id, () => cardapioRepo.removerItem(alvo))
              }}
            >
              Excluir
            </button>
          </>
        }
      >
        <p>
          <strong>{confirmarExclusao?.nome}</strong> sai do cardápio e das listagens. Pedidos antigos continuam
          mostrando o item. Dá pra restaurar depois em “Mostrar inativos”.
        </p>
      </Modal>
    </LayoutEquipe>
  )
}

interface PropsLinha {
  item: ItemCardapio
  ocupado: boolean
  aoEditar: () => void
  aoAlternarEsgotado: () => void
  aoExcluir: () => void
  aoRestaurar: () => void
}

function LinhaItem({ item, ocupado, aoEditar, aoAlternarEsgotado, aoExcluir, aoRestaurar }: PropsLinha) {
  return (
    <li className={`flex flex-wrap items-center gap-3 px-3 py-3 ${item.ativo ? '' : 'opacity-60'}`}>
      <FotoItem url={item.fotoUrl} nome={item.nome} className="size-14 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.nome}</p>
        <p className="text-sm tabular-nums text-tinta-suave">
          {formatarReal(item.precoCentavos)}
          {!item.disponivel && <span className="ml-2 font-semibold text-alerta">Esgotado</span>}
          {!item.ativo && <span className="ml-2 font-semibold">Excluído</span>}
        </p>
      </div>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        {item.ativo ? (
          <>
            <button
              type="button"
              className={item.disponivel ? 'botao-secundario text-sm' : 'botao text-sm bg-alerta-clara text-tinta'}
              aria-pressed={!item.disponivel}
              disabled={ocupado}
              onClick={aoAlternarEsgotado}
            >
              {item.disponivel ? 'Marcar esgotado' : 'Voltou ao estoque'}
            </button>
            <button type="button" className="botao-secundario text-sm" onClick={aoEditar}>
              Editar
            </button>
            <button type="button" className="botao-secundario text-sm text-perigo" disabled={ocupado} onClick={aoExcluir}>
              Excluir
            </button>
          </>
        ) : (
          <button type="button" className="botao-secundario text-sm" disabled={ocupado} onClick={aoRestaurar}>
            Restaurar
          </button>
        )}
      </div>
    </li>
  )
}

interface PropsCategoriaModal {
  edicao: EdicaoCategoria
  aoFechar: () => void
  aoSalvar: (nome: string) => Promise<void>
}

function CategoriaModal({ edicao, aoFechar, aoSalvar }: PropsCategoriaModal) {
  const id = useId()
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setNome(edicao?.categoria?.nome ?? '')
    setErro(null)
  }, [edicao])

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const validacao = CategoriaFormSchema.safeParse({ nome })
    if (!validacao.success) {
      setErro(validacao.error.issues[0]?.message ?? 'Nome inválido.')
      return
    }
    setSalvando(true)
    try {
      await aoSalvar(validacao.data.nome)
    } catch (falha) {
      console.error(falha)
      setErro('Não foi possível salvar. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      aberto={edicao !== null}
      titulo={edicao?.categoria ? 'Renomear categoria' : 'Nova categoria'}
      aoFechar={aoFechar}
      acoes={
        <>
          <button type="button" className="botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" form={`${id}-form`} className="botao-primario" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={enviar} noValidate>
        <label htmlFor={`${id}-nome`} className="rotulo">
          Nome da categoria
        </label>
        <input
          id={`${id}-nome`}
          className="campo"
          value={nome}
          maxLength={60}
          onChange={e => setNome(e.target.value)}
          placeholder="Ex.: Lanches"
        />
        <p role="alert" className="mt-2 min-h-5 text-sm font-medium text-perigo">
          {erro}
        </p>
      </form>
    </Modal>
  )
}
