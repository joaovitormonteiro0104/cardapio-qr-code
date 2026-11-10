import { useEffect, useId, useState, type FormEvent } from 'react'
import { Modal } from '@/components/Modal'
import { centavosParaCampo, parseReal } from '@/domain/cardapio/formatacao'
import { FOTO_TIPOS_ACEITOS, precoValido, problemaFoto } from '@/domain/cardapio/validacao'
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
}

const MENSAGEM_FOTO = {
  tipo: 'Use uma foto JPG, PNG ou WebP.',
  tamanho: 'A foto pode ter no máximo 2 MB.',
  envio: 'Não foi possível enviar a foto. Tente de novo.',
} as const

export function ItemFormModal({ aberto, item, categoriaInicial, categorias, aoFechar, aoSalvar }: Props) {
  const ids = useId()
  const [nome, setNome] = useState('')
  const [preco, setPreco] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [disponivel, setDisponivel] = useState(true)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setNome(item?.nome ?? '')
    setPreco(item ? centavosParaCampo(item.precoCentavos) : '')
    setCategoriaId(item?.categoriaId ?? categoriaInicial ?? categorias[0]?.id ?? '')
    setDisponivel(item?.disponivel ?? true)
    setFotoUrl(item?.fotoUrl ?? null)
    setArquivo(null)
    setErro(null)
  }, [aberto, item, categoriaInicial, categorias])

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

  function escolherArquivo(lista: FileList | null) {
    const escolhido = lista?.[0] ?? null
    if (!escolhido) return
    const problema = problemaFoto(escolhido.type, escolhido.size)
    if (problema) {
      setErro(MENSAGEM_FOTO[problema])
      return
    }
    setErro(null)
    setArquivo(escolhido)
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro(null)

    const centavos = parseReal(preco)
    if (!precoValido(centavos)) {
      setErro('Preço inválido. Use, por exemplo, 12,50.')
      return
    }

    setSalvando(true)
    try {
      const urlFinal = arquivo ? await uploadFotoItem(arquivo) : fotoUrl
      const validacao = ItemFormSchema.safeParse({
        nome,
        precoCentavos: centavos,
        categoriaId,
        disponivel,
        fotoUrl: urlFinal,
      })
      if (!validacao.success) {
        setErro(validacao.error.issues[0]?.message ?? 'Confira os campos.')
        return
      }
      await aoSalvar(validacao.data)
    } catch (falha) {
      console.error(falha)
      setErro(falha instanceof ErroFoto ? MENSAGEM_FOTO[falha.motivo] : 'Não foi possível salvar. Tente de novo.')
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
      aoFechar={aoFechar}
      acoes={
        <>
          <button type="button" className="botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" form={idForm} className="botao-primario" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
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
          />
          <p className="mt-1 text-xs text-tinta-suave">Tamanhos diferentes são itens separados (ex.: “X-Burguer grande”).</p>
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
            />
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
            >
              {categorias.map(categoria => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                  {categoria.ativa ? '' : ' (inativa)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            className="size-5 accent-brasa"
            checked={disponivel}
            onChange={e => setDisponivel(e.target.checked)}
          />
          <span>Disponível (desmarque se estiver esgotado)</span>
        </label>

        <div>
          <span className="rotulo">Foto (opcional)</span>
          <div className="flex items-center gap-3">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-borda bg-fundo text-xs text-tinta-suave">
              {imagem ? <img src={imagem} alt="" className="size-full object-cover" /> : 'Sem foto'}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="botao-secundario cursor-pointer text-sm">
                {imagem ? 'Trocar foto' : 'Escolher foto'}
                <input
                  type="file"
                  accept={FOTO_TIPOS_ACEITOS.join(',')}
                  className="sr-only"
                  onChange={e => escolherArquivo(e.target.files)}
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
          <p className="mt-1 text-xs text-tinta-suave">JPG, PNG ou WebP, até 2 MB.</p>
        </div>

        <p role="alert" className="min-h-5 text-sm font-medium text-perigo">
          {erro}
        </p>
      </form>
    </Modal>
  )
}
