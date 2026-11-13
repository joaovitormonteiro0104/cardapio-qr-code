import { useEffect, useId, useState, type FormEvent } from 'react'
import { Modal } from '@/components/Modal'
import { centavosParaCampo, parseReal } from '@/domain/cardapio/formatacao'
import { DESCRICAO_ITEM_MAX, nomeItemValido, precoValido, problemaFoto } from '@/domain/cardapio/validacao'
import { reduzirFoto } from '@/lib/reduzirFoto'
import { ItemFormSchema, type Categoria, type ItemCardapio, type ItemForm } from '@/schemas/cardapio'
import { ErroFoto, uploadFotoItem } from '@/repositories/storageRepo'

interface Props {
  aberto: boolean
  /** null = criar item novo */
  item: ItemCardapio | null
  categoriaInicial: string | null
  categorias: Categoria[]
  aoFechar: () => void
  aoSalvar: (form: ItemForm) => Promise<void>
  /** Item existente e ativo: mostra "Excluir item" no fim da janela (longe da lista). */
  aoExcluir?: (item: ItemCardapio) => void
}

const MENSAGEM_FOTO = {
  tipo: 'Não foi possível abrir esta imagem. Tente outra foto (JPG, PNG ou WebP).',
  tamanho: 'Esta foto continua grande demais mesmo reduzida. Tente outra.',
  envio: 'Não foi possível enviar a foto. Tente de novo.',
} as const

/** Erro de cada campo, mostrado embaixo dele. `geral` = falha ao salvar. */
type Erros = Partial<Record<'nome' | 'preco' | 'categoria' | 'foto' | 'geral', string>>

export function ItemFormModal({ aberto, item, categoriaInicial, categorias, aoFechar, aoSalvar, aoExcluir }: Props) {
  const ids = useId()
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [preco, setPreco] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [disponivel, setDisponivel] = useState(true)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [erros, setErros] = useState<Erros>({})
  const [salvando, setSalvando] = useState(false)
  const [preparandoFoto, setPreparandoFoto] = useState(false)
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false)
  const [inicial, setInicial] = useState('')

  useEffect(() => {
    if (!aberto) return
    setNome(item?.nome ?? '')
    setDescricao(item?.descricao ?? '')
    setPreco(item ? centavosParaCampo(item.precoCentavos) : '')
    // Item novo pelo botão geral começa sem categoria: o gerente escolhe (não cai em "Lanches" sem perceber).
    const categoria = item?.categoriaId ?? categoriaInicial ?? ''
    setCategoriaId(categoria)
    setDisponivel(item?.disponivel ?? true)
    setFotoUrl(item?.fotoUrl ?? null)
    setArquivo(null)
    setErros({})
    setConfirmandoDescarte(false)
    setInicial(
      JSON.stringify([item?.nome ?? '', item?.descricao ?? '', item ? centavosParaCampo(item.precoCentavos) : '', categoria, item?.disponivel ?? true, item?.fotoUrl ?? null]),
    )
  }, [aberto, item, categoriaInicial, categorias])

  const alterado = JSON.stringify([nome, descricao, preco, categoriaId, disponivel, fotoUrl]) !== inicial || arquivo !== null

  /** Fechar (Esc, fundo, ×, Cancelar) com alterações pede confirmação. */
  function pedirFechar() {
    if (alterado && !salvando) setConfirmandoDescarte(true)
    else aoFechar()
  }

  // prévia local da foto escolhida (antes do upload)
  useEffect(() => {
    if (!arquivo) {
      setPrevia(null)
      return
    }
    const url = URL.createObjectURL(arquivo)
    setPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [arquivo])

  // Qualquer foto do celular serve: ela é reduzida aqui antes de validar e enviar.
  async function escolherArquivo(lista: FileList | null) {
    const escolhido = lista?.[0] ?? null
    if (!escolhido) return
    setPreparandoFoto(true)
    try {
      const reduzida = await reduzirFoto(escolhido)
      const problema = problemaFoto(reduzida.type, reduzida.size)
      if (problema) {
        setErros(e => ({ ...e, foto: MENSAGEM_FOTO[problema] }))
        return
      }
      setErros(e => ({ ...e, foto: undefined }))
      setArquivo(reduzida)
    } catch (falha) {
      console.error(falha)
      setErros(e => ({ ...e, foto: MENSAGEM_FOTO.tipo }))
    } finally {
      setPreparandoFoto(false)
    }
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    // Confere todos os campos de uma vez, para mostrar todos os erros juntos.
    const centavos = parseReal(preco)
    const novos: Erros = {}
    if (!nomeItemValido(nome)) novos.nome = 'Informe o nome do item.'
    if (!precoValido(centavos)) novos.preco = 'Preço inválido. Use, por exemplo, 12,50.'
    if (!categoriaId) novos.categoria = 'Escolha uma categoria.'
    setErros(novos)
    if (Object.keys(novos).length > 0 || !precoValido(centavos)) {
      document.getElementById(`${ids}-${novos.nome ? 'nome' : novos.preco ? 'preco' : 'categoria'}`)?.focus()
      return
    }

    setSalvando(true)
    try {
      const urlFinal = arquivo ? await uploadFotoItem(arquivo) : fotoUrl
      const validacao = ItemFormSchema.safeParse({
        nome,
        descricao,
        precoCentavos: centavos,
        categoriaId,
        disponivel,
        fotoUrl: urlFinal,
      })
      if (!validacao.success) {
        setErros({ geral: validacao.error.issues[0]?.message ?? 'Confira os campos.' })
        return
      }
      await aoSalvar(validacao.data)
    } catch (falha) {
      console.error(falha)
      setErros(falha instanceof ErroFoto ? { foto: MENSAGEM_FOTO[falha.motivo] } : { geral: 'Não foi possível salvar. Tente de novo.' })
    } finally {
      setSalvando(false)
    }
  }

  const imagem = previa ?? fotoUrl
  const idForm = `${ids}-form`

  return (
    <Modal
      aberto={aberto}
      titulo={item ? 'Editar item' : 'Novo item'}
      aoFechar={pedirFechar}
      acoes={
        confirmandoDescarte ? (
          <>
            <button type="button" className="botao-secundario" onClick={() => setConfirmandoDescarte(false)}>
              Continuar editando
            </button>
            <button type="button" className="botao-perigo" onClick={aoFechar}>
              Descartar alterações
            </button>
          </>
        ) : (
        <>
          <button type="button" className="botao-secundario" onClick={pedirFechar}>
            Cancelar
          </button>
          <button type="submit" form={idForm} className="botao-primario" disabled={salvando || preparandoFoto}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
        )
      }
    >
      {confirmandoDescarte && (
        <p role="alert" className="mb-4 rounded-xl border border-perigo/40 bg-perigo-clara px-4 py-3 text-sm font-medium text-perigo">
          Você mudou este item e ainda não salvou. Descartar as alterações?
        </p>
      )}
      <form id={idForm} onSubmit={enviar} noValidate className="space-y-4">
        <div>
          <label htmlFor={`${ids}-nome`} className="rotulo">
            Nome
          </label>
          <input
            id={`${ids}-nome`}
            className="campo"
            value={nome}
            maxLength={100}
            onChange={e => setNome(e.target.value)}
            required
            aria-invalid={erros.nome ? true : undefined}
            aria-describedby={erros.nome ? `${ids}-nome-erro` : undefined}
          />
          <ErroCampo id={`${ids}-nome-erro`} texto={erros.nome} />
          <p className="mt-1 text-sm text-tinta-suave">Tamanhos diferentes são itens separados (ex.: “X-Burguer grande”).</p>
        </div>

        <div>
          <label htmlFor={`${ids}-descricao`} className="rotulo">
            Descrição <span className="font-normal text-tinta-suave">(opcional)</span>
          </label>
          <textarea
            id={`${ids}-descricao`}
            className="campo min-h-20 py-2"
            value={descricao}
            maxLength={DESCRICAO_ITEM_MAX}
            placeholder="Ex.: pão brioche, hambúrguer 150 g, cheddar e bacon"
            onChange={e => setDescricao(e.target.value)}
          />
          <p className="mt-1 text-sm tabular-nums text-tinta-suave">
            O que vem no item ou quanto serve. {descricao.length}/{DESCRICAO_ITEM_MAX}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${ids}-preco`} className="rotulo">
              Preço (R$)
            </label>
            <input
              id={`${ids}-preco`}
              className="campo tabular-nums"
              inputMode="decimal"
              placeholder="12,50"
              value={preco}
              onChange={e => setPreco(e.target.value)}
              required
              aria-invalid={erros.preco ? true : undefined}
              aria-describedby={erros.preco ? `${ids}-preco-erro` : undefined}
            />
            <ErroCampo id={`${ids}-preco-erro`} texto={erros.preco} />
          </div>
          <div>
            <label htmlFor={`${ids}-categoria`} className="rotulo">
              Categoria
            </label>
            <select
              id={`${ids}-categoria`}
              className="campo"
              value={categoriaId}
              onChange={e => setCategoriaId(e.target.value)}
              required
              aria-invalid={erros.categoria ? true : undefined}
              aria-describedby={erros.categoria ? `${ids}-categoria-erro` : undefined}
            >
              <option value="" disabled>
                Escolha…
              </option>
              {categorias.map(categoria => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                  {categoria.ativa ? '' : ' (desativada)'}
                </option>
              ))}
            </select>
            <ErroCampo id={`${ids}-categoria-erro`} texto={erros.categoria} />
          </div>
        </div>

        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            className="size-5 accent-brasa"
            checked={disponivel}
            onChange={e => setDisponivel(e.target.checked)}
          />
          <span>Disponível para pedir agora</span>
        </label>

        <div>
          <span id={`${ids}-foto-rotulo`} className="rotulo">
            Foto (opcional)
          </span>
          <div className="flex items-center gap-3">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-borda bg-fundo text-sm text-tinta-suave">
              {imagem ? <img src={imagem} alt="" className="size-full object-cover" /> : 'Sem foto'}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="botao-secundario cursor-pointer text-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brasa">
                {preparandoFoto ? 'Preparando foto…' : imagem ? 'Trocar foto' : 'Escolher foto'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={preparandoFoto}
                  aria-describedby={erros.foto ? `${ids}-foto-erro` : `${ids}-foto-ajuda`}
                  onChange={e => void escolherArquivo(e.target.files)}
                />
              </label>
              {imagem && (
                <button
                  type="button"
                  className="botao-secundario text-sm"
                  onClick={() => {
                    setArquivo(null)
                    setFotoUrl(null)
                  }}
                >
                  Remover foto
                </button>
              )}
            </div>
          </div>
          <ErroCampo id={`${ids}-foto-erro`} texto={erros.foto} />
          <p id={`${ids}-foto-ajuda`} className="mt-1 text-sm text-tinta-suave">
            Qualquer foto do celular serve: ela é reduzida antes de enviar.
          </p>
        </div>

        {item && item.ativo && aoExcluir && (
          <div className="border-t border-borda pt-4">
            <button type="button" className="botao-secundario w-full text-perigo" onClick={() => aoExcluir(item)}>
              Excluir item do cardápio
            </button>
          </div>
        )}

        {erros.geral && (
          <p role="alert" className="text-sm font-medium text-perigo">
            {erros.geral}
          </p>
        )}
      </form>
    </Modal>
  )
}

function ErroCampo({ id, texto }: { id: string; texto: string | undefined }) {
  if (!texto) return null
  return (
    <p id={id} role="alert" className="mt-1 text-sm font-medium text-perigo">
      {texto}
    </p>
  )
}
