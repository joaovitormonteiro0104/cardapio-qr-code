import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { AvisoFlutuante, type Aviso } from '@/components/AvisoFlutuante'
import { Carregando } from '@/components/Carregando'
import { FotoItem } from '@/components/FotoItem'
import { LayoutEquipe } from '@/components/LayoutEquipe'
import { Modal } from '@/components/Modal'
import { nomeCorresponde } from '@/domain/cardapio/busca'
import { mover } from '@/domain/cardapio/validacao'
import { useCardapio } from '@/hooks/useCardapio'
import { formatarReal } from '@/lib/formato'
import * as cardapioRepo from '@/repositories/cardapioRepo'
import { CategoriaFormSchema, type Categoria, type ItemCardapio, type ItemForm } from '@/schemas/cardapio'
import { ItemFormModal } from './ItemFormModal'

type EdicaoItem = { item: ItemCardapio | null; categoriaId: string | null } | null
type EdicaoCategoria = { categoria: Categoria | null } | null

/**
 * Cardápio da gerência. Uso mais comum durante o serviço: achar um item e
 * marcar como esgotado. Por isso: busca no topo, "Esgotados agora" primeiro,
 * linha com só a chave "Disponível" (tocar na linha edita) e "Desfazer".
 * Reordenar categorias fica no modo "Organizar".
 */
export default function CardapioPage() {
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const { categorias, itens, carregando, erro, recarregar } = useCardapio('gerencia', mostrarInativos)

  const [ordem, setOrdem] = useState<Categoria[]>([])
  const [organizando, setOrganizando] = useState(false)
  const [arrastando, setArrastando] = useState<number | null>(null)
  const [busca, setBusca] = useState('')
  const [edicaoItem, setEdicaoItem] = useState<EdicaoItem>(null)
  const [edicaoCategoria, setEdicaoCategoria] = useState<EdicaoCategoria>(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState<ItemCardapio | null>(null)
  const [confirmarDesativar, setConfirmarDesativar] = useState<Categoria | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  useEffect(() => setOrdem(categorias), [categorias])
  const limparAviso = useCallback(() => setAviso(null), [])

  /** Grava, avisa e SEMPRE recarrega (se falhar, a tela volta ao que está no banco). */
  async function executar(chave: string, acao: () => Promise<unknown>, sucesso?: Aviso) {
    setOcupado(chave)
    setAviso(null)
    try {
      await acao()
      if (sucesso) setAviso(sucesso)
    } catch (falha) {
      console.error(falha)
      setAviso({ tipo: 'erro', texto: 'Não foi possível salvar a alteração. Verifique a conexão e tente de novo.' })
    } finally {
      setOcupado(null)
      await recarregar()
    }
  }

  async function reordenar(de: number, para: number) {
    if (de === para || para < 0 || para >= ordem.length) return
    const nova = mover(ordem, de, para)
    setOrdem(nova)
    await executar('ordem', () => cardapioRepo.reordenarCategorias(nova.map(c => c.id)))
  }

  function alternarDisponivel(item: ItemCardapio) {
    const esgotar = item.disponivel
    void executar(
      item.id,
      () => (esgotar ? cardapioRepo.marcarEsgotado(item) : cardapioRepo.reativarItem(item)),
      {
        tipo: 'ok',
        texto: esgotar ? `${item.nome}: esgotado.` : `${item.nome} voltou ao cardápio.`,
        acao: {
          rotulo: 'Desfazer',
          aoClicar: () =>
            void executar(item.id, () =>
              esgotar ? cardapioRepo.reativarItem({ ...item, disponivel: false }) : cardapioRepo.marcarEsgotado({ ...item, disponivel: true }),
            ),
        },
      },
    )
  }

  async function salvarItem(form: ItemForm) {
    const atual = edicaoItem?.item
    await (atual ? cardapioRepo.atualizarItem(atual, form) : cardapioRepo.criarItem(form))
    setEdicaoItem(null)
    setAviso({ tipo: 'ok', texto: atual ? `${form.nome} salvo.` : `${form.nome} adicionado ao cardápio.` })
    await recarregar()
  }

  const termo = busca.trim()
  const visivel = (item: ItemCardapio) => nomeCorresponde(item.nome, termo)
  const itensPorCategoria = (id: string) => itens.filter(item => item.categoriaId === id && visivel(item))
  const esgotados = itens.filter(item => item.ativo && !item.disponivel && visivel(item))
  const semCategoria = ordem.length === 0

  const linha = (item: ItemCardapio) => (
    <LinhaItem
      key={item.id}
      item={item}
      ocupado={ocupado === item.id}
      aoEditar={() => setEdicaoItem({ item, categoriaId: null })}
      aoAlternar={() => alternarDisponivel(item)}
      aoRestaurar={() =>
        void executar(item.id, () => cardapioRepo.restaurarItem(item), { tipo: 'ok', texto: `${item.nome} voltou ao cardápio.` })
      }
    />
  )

  return (
    <LayoutEquipe titulo="Cardápio">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={semCategoria ? 'botao-secundario' : 'botao-primario'}
          disabled={semCategoria}
          onClick={() => setEdicaoItem({ item: null, categoriaId: null })}
        >
          Novo item
        </button>
        <button
          type="button"
          className={semCategoria ? 'botao-primario' : 'botao-secundario'}
          onClick={() => setEdicaoCategoria({ categoria: null })}
        >
          Nova categoria
        </button>
        <button
          type="button"
          className="botao-secundario"
          aria-pressed={organizando}
          disabled={semCategoria}
          onClick={() => setOrganizando(v => !v)}
        >
          {organizando ? 'Concluir organização' : 'Organizar categorias'}
        </button>
        <label className="ml-auto flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5 accent-brasa" checked={mostrarInativos} onChange={e => setMostrarInativos(e.target.checked)} />
          Mostrar excluídos e categorias desativadas
        </label>
      </div>

      {!semCategoria && (
        <div className="mb-4">
          <label htmlFor="busca-item" className="sr-only">
            Buscar item
          </label>
          <input
            id="busca-item"
            type="search"
            className="campo"
            placeholder="Buscar item pelo nome (ex.: coca)"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
      )}

      {carregando && <Carregando texto="Carregando cardápio…" />}
      {erro && (
        <div role="alert" className="rounded-xl bg-perigo-clara px-4 py-3 text-perigo">
          {erro}{' '}
          <button type="button" className="font-semibold underline" onClick={() => void recarregar()}>
            Tentar de novo
          </button>
        </div>
      )}

      {!carregando && !erro && semCategoria && (
        <div className="rounded-2xl border border-dashed border-borda px-6 py-10 text-center">
          <p className="font-medium">Nenhuma categoria ainda.</p>
          <p className="mt-1 text-sm text-tinta-suave">Crie categorias como “Lanches” e “Bebidas” e depois adicione os itens.</p>
        </div>
      )}

      {esgotados.length > 0 && !organizando && (
        <section aria-labelledby="titulo-esgotados" className="mb-6 rounded-2xl border-2 border-alerta bg-superficie">
          <h2 id="titulo-esgotados" className="border-b border-borda px-3 py-2 text-lg font-semibold">
            Esgotados agora <span className="tabular-nums text-tinta-suave">({esgotados.length})</span>
          </h2>
          <ul className="divide-y divide-borda">{esgotados.map(linha)}</ul>
        </section>
      )}

      <ol className="space-y-6">
        {ordem.map((categoria, indice) => {
          const doGrupo = itensPorCategoria(categoria.id)
          if (termo && doGrupo.length === 0 && !organizando) return null
          const total = itens.filter(i => i.categoriaId === categoria.id && i.ativo).length
          return (
            <li
              key={categoria.id}
              onDragOver={evento => {
                if (organizando && arrastando !== null) evento.preventDefault()
              }}
              onDrop={evento => {
                evento.preventDefault()
                if (organizando && arrastando !== null) void reordenar(arrastando, indice)
                setArrastando(null)
              }}
              className={`rounded-2xl border bg-superficie ${arrastando === indice ? 'border-brasa' : 'border-borda'}`}
            >
              <section aria-labelledby={`cat-${categoria.id}`}>
                <header className="flex flex-wrap items-center gap-2 border-b border-borda px-3 py-2">
                  {organizando && (
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
                  )}
                  <h2 id={`cat-${categoria.id}`} className="mr-auto text-lg font-semibold">
                    {categoria.nome}
                    <span className="ml-2 text-sm font-normal tabular-nums text-tinta-suave">
                      {total === 1 ? '1 item' : `${total} itens`}
                    </span>
                    {!categoria.ativa && (
                      <span className="ml-2 rounded-md bg-alerta-clara px-2 py-0.5 align-middle text-sm font-medium text-tinta">
                        Desativada: o cliente não vê
                      </span>
                    )}
                  </h2>
                  {organizando ? (
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
                  ) : (
                    <details className="relative">
                      <summary className="botao-secundario min-h-11 list-none text-sm" aria-label={`Opções de ${categoria.nome}`}>
                        ⋯ Opções
                      </summary>
                      <div
                        className="absolute right-0 z-20 mt-1 flex w-56 flex-col gap-1 rounded-xl bg-superficie p-2 shadow-lg ring-1 ring-borda"
                        onClick={e => e.currentTarget.closest('details')?.removeAttribute('open')}
                      >
                        <button type="button" className="botao justify-start text-sm hover:bg-fundo" onClick={() => setEdicaoCategoria({ categoria })}>
                          Renomear
                        </button>
                        <button
                          type="button"
                          className="botao justify-start text-sm hover:bg-fundo"
                          disabled={ocupado === categoria.id}
                          onClick={() =>
                            categoria.ativa
                              ? setConfirmarDesativar(categoria)
                              : void executar(categoria.id, () => cardapioRepo.definirCategoriaAtiva(categoria, true), {
                                  tipo: 'ok',
                                  texto: `${categoria.nome} voltou ao cardápio.`,
                                })
                          }
                        >
                          {categoria.ativa ? 'Tirar do cardápio do cliente' : 'Mostrar de novo ao cliente'}
                        </button>
                      </div>
                    </details>
                  )}
                </header>

                {!organizando && (
                  <>
                    <ul className="divide-y divide-borda">{doGrupo.map(linha)}</ul>
                    {!termo && (
                      <div className="px-3 py-2">
                        <button
                          type="button"
                          className="botao min-h-11 px-2 text-sm text-brasa-forte hover:bg-brasa-clara"
                          onClick={() => setEdicaoItem({ item: null, categoriaId: categoria.id })}
                        >
                          + Adicionar item em {categoria.nome}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            </li>
          )
        })}
      </ol>
      {termo && !carregando && itens.every(i => !visivel(i)) && (
        <p className="mt-4 rounded-2xl border border-dashed border-borda px-4 py-6 text-center text-tinta-suave">
          Nenhum item com “{termo}”.
        </p>
      )}

      <ItemFormModal
        aberto={edicaoItem !== null}
        item={edicaoItem?.item ?? null}
        categoriaInicial={edicaoItem?.categoriaId ?? null}
        categorias={ordem}
        aoFechar={() => setEdicaoItem(null)}
        aoSalvar={salvarItem}
        aoExcluir={item => {
          setEdicaoItem(null)
          setConfirmarExclusao(item)
        }}
      />

      <CategoriaModal
        edicao={edicaoCategoria}
        aoFechar={() => setEdicaoCategoria(null)}
        aoSalvar={async nome => {
          const atual = edicaoCategoria?.categoria
          await (atual ? cardapioRepo.renomearCategoria(atual, { nome }) : cardapioRepo.criarCategoria({ nome }))
          setEdicaoCategoria(null)
          setAviso({ tipo: 'ok', texto: atual ? `Categoria renomeada para ${nome}.` : `Categoria ${nome} criada.` })
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
                if (alvo)
                  void executar(alvo.id, () => cardapioRepo.removerItem(alvo), {
                    tipo: 'ok',
                    texto: `${alvo.nome} excluído.`,
                    acao: { rotulo: 'Desfazer', aoClicar: () => void executar(alvo.id, () => cardapioRepo.restaurarItem({ ...alvo, ativo: false })) },
                  })
              }}
            >
              Excluir
            </button>
          </>
        }
      >
        <p>
          <strong>{confirmarExclusao?.nome}</strong> sai do cardápio e das listagens. Pedidos antigos continuam mostrando o item. Dá
          para restaurar depois em “Mostrar excluídos e categorias desativadas”.
        </p>
      </Modal>

      <Modal
        aberto={confirmarDesativar !== null}
        titulo="Tirar a categoria do cardápio?"
        aoFechar={() => setConfirmarDesativar(null)}
        acoes={
          <>
            <button type="button" className="botao-secundario" onClick={() => setConfirmarDesativar(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="botao-perigo"
              onClick={() => {
                const alvo = confirmarDesativar
                setConfirmarDesativar(null)
                if (alvo)
                  void executar(alvo.id, () => cardapioRepo.definirCategoriaAtiva(alvo, false), {
                    tipo: 'ok',
                    texto: `${alvo.nome} saiu do cardápio do cliente.`,
                    acao: {
                      rotulo: 'Desfazer',
                      aoClicar: () => void executar(alvo.id, () => cardapioRepo.definirCategoriaAtiva({ ...alvo, ativa: false }, true)),
                    },
                  })
              }}
            >
              Tirar do cardápio
            </button>
          </>
        }
      >
        {confirmarDesativar && (
          <p>
            Os {itens.filter(i => i.categoriaId === confirmarDesativar.id && i.ativo).length} itens de{' '}
            <strong>{confirmarDesativar.nome}</strong> somem do cardápio do cliente. Para ver de novo aqui, marque “Mostrar excluídos e
            categorias desativadas”.
          </p>
        )}
      </Modal>

      <AvisoFlutuante aviso={aviso} aoSumir={limparAviso} />
    </LayoutEquipe>
  )
}

interface PropsLinha {
  item: ItemCardapio
  ocupado: boolean
  aoEditar: () => void
  aoAlternar: () => void
  aoRestaurar: () => void
}

/** Linha enxuta: tocar no item edita; à direita, só a chave "Disponível" (ou "Restaurar" se excluído). */
function LinhaItem({ item, ocupado, aoEditar, aoAlternar, aoRestaurar }: PropsLinha) {
  const esgotado = item.ativo && !item.disponivel
  return (
    <li className={`flex items-center gap-2 px-2 py-2 ${esgotado ? 'bg-alerta-clara/60' : ''}`}>
      <button
        type="button"
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-1 text-left hover:bg-fundo"
        onClick={aoEditar}
        aria-label={`Editar ${item.nome}`}
      >
        <FotoItem url={item.fotoUrl} nome={item.nome} className={`size-14 rounded-lg ${item.ativo ? '' : 'opacity-50 grayscale'}`} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-medium ${item.ativo ? '' : 'line-through'}`}>{item.nome}</span>
          <span className="block text-sm tabular-nums text-tinta-suave">
            {formatarReal(item.precoCentavos)}
            {esgotado && <span className="ml-2 rounded bg-alerta px-1.5 py-0.5 text-sm font-semibold text-white">Esgotado</span>}
            {!item.ativo && <span className="ml-2 font-semibold text-tinta">Excluído</span>}
          </span>
        </span>
      </button>
      {item.ativo ? (
        <button
          type="button"
          role="switch"
          aria-checked={item.disponivel}
          aria-label={`${item.nome} disponível`}
          disabled={ocupado}
          onClick={aoAlternar}
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-2 text-sm font-medium"
        >
          <span
            aria-hidden
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${item.disponivel ? 'bg-sucesso' : 'bg-borda-campo'}`}
          >
            <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${item.disponivel ? 'translate-x-6' : 'translate-x-1'}`} />
          </span>
          <span className="hidden w-20 text-left sm:inline">{item.disponivel ? 'Disponível' : 'Esgotado'}</span>
        </button>
      ) : (
        <button type="button" className="botao-secundario shrink-0 text-sm" disabled={ocupado} onClick={aoRestaurar}>
          Restaurar
        </button>
      )}
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
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : undefined}
        />
        <p id={`${id}-erro`} role="alert" className="mt-2 min-h-5 text-sm font-medium text-perigo">
          {erro}
        </p>
      </form>
    </Modal>
  )
}
