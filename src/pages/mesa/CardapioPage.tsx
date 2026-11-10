import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/Modal'
import { Quantidade } from '@/components/Quantidade'
import { aceitaNovosPedidos } from '@/domain/comanda/estado'
import { quantidadeCarrinho, totalCarrinho } from '@/domain/pedido/calculo'
import { useCardapio } from '@/hooks/useCardapio'
import { formatarReal } from '@/lib/formato'
import { ErroPedido, criarPedido } from '@/repositories/pedidoRepo'
import type { ItemCardapio } from '@/schemas/cardapio'
import { useMesa } from './MesaLayout'

export default function CardapioPage() {
  const { comanda, carrinho, recarregar: recarregarComanda, setAviso } = useMesa()
  const { categorias, itens, carregando, erro, recarregar } = useCardapio('cliente')
  const navegar = useNavigate()
  const [carrinhoAberto, setCarrinhoAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)

  const porId = useMemo(() => new Map(itens.map(item => [item.id, item])), [itens])
  const secoes = categorias
    .map(categoria => ({ categoria, itens: itens.filter(i => i.categoriaId === categoria.id) }))
    .filter(secao => secao.itens.length > 0)

  // Só entra no carrinho/total o que ainda está no cardápio
  const linhasCarrinho = carrinho.itens.flatMap(linha => {
    const item = porId.get(linha.itemId)
    return item ? [{ ...linha, item, precoCentavos: item.precoCentavos }] : []
  })
  const total = totalCarrinho(linhasCarrinho)
  const quantidade = quantidadeCarrinho(linhasCarrinho)
  const aceita = comanda ? aceitaNovosPedidos(comanda.estado) : false

  async function enviar() {
    if (!comanda) return
    setEnviando(true)
    setErroEnvio(null)
    try {
      const pedido = await criarPedido(
        comanda.id,
        linhasCarrinho.map(l => ({ itemId: l.itemId, quantidade: l.quantidade })),
      )
      carrinho.limpar()
      setCarrinhoAberto(false)
      setAviso(`Pedido #${pedido.numero} enviado para a cozinha.`)
      await recarregarComanda()
      navegar('comanda')
    } catch (falha) {
      console.error(falha)
      if (falha instanceof ErroPedido && falha.motivo === 'itens_indisponiveis') {
        const nomes = falha.itensIndisponiveis.map(id => porId.get(id)?.nome ?? 'um item').join(', ')
        carrinho.remover(falha.itensIndisponiveis)
        await recarregar()
        setErroEnvio(`Acabou de esgotar: ${nomes}. Tiramos do carrinho; confira e envie de novo.`)
      } else if (falha instanceof ErroPedido && falha.motivo === 'comanda_nao_aceita') {
        await recarregarComanda()
        setErroEnvio('A conta desta mesa está fechando e não aceita novos pedidos. Chame um atendente.')
      } else {
        setErroEnvio('Não foi possível enviar. Verifique a internet e tente de novo.')
      }
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) return <p className="py-8 text-center text-tinta-suave">Carregando cardápio…</p>
  if (erro) {
    return (
      <div className="rounded-xl bg-perigo-clara px-4 py-3 text-perigo">
        {erro}{' '}
        <button type="button" className="font-semibold underline" onClick={() => void recarregar()}>
          Tentar de novo
        </button>
      </div>
    )
  }

  return (
    <>
      {!aceita && (
        <p className="mb-4 rounded-xl bg-alerta-clara px-4 py-3 text-sm">
          A conta está em pagamento. Para pedir mais, chame um atendente para reabrir.
        </p>
      )}

      {secoes.length === 0 ? (
        <p className="py-10 text-center text-tinta-suave">O cardápio ainda está sendo preparado. Chame um atendente.</p>
      ) : (
        <>
          <nav aria-label="Categorias" className="sticky top-[6.25rem] z-10 -mx-4 mb-2 flex gap-2 overflow-x-auto bg-fundo/95 px-4 py-2 backdrop-blur">
            {secoes.map(({ categoria }) => (
              <a
                key={categoria.id}
                href={`#categoria-${categoria.id}`}
                className="flex min-h-11 shrink-0 items-center rounded-full border border-borda bg-superficie px-4 text-sm font-medium"
              >
                {categoria.nome}
              </a>
            ))}
          </nav>

          {secoes.map(({ categoria, itens: doGrupo }) => (
            <section key={categoria.id} id={`categoria-${categoria.id}`} className="scroll-mt-40 pb-4">
              <h2 className="pb-1 pt-4 text-xl font-bold tracking-tight">{categoria.nome}</h2>
              <ul className="divide-y divide-borda">
                {doGrupo.map(item => (
                  <LinhaCardapio
                    key={item.id}
                    item={item}
                    quantidade={carrinho.quantidadeDe(item.id)}
                    aoMudar={q => carrinho.definir(item.id, q)}
                    desabilitado={!aceita}
                  />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {quantidade > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-superficie/95 p-3 backdrop-blur">
          <div className="mx-auto max-w-2xl">
            <button type="button" className="botao-primario w-full justify-between text-base" onClick={() => setCarrinhoAberto(true)}>
              <span>
                Ver pedido <span className="tabular-nums">({quantidade})</span>
              </span>
              <span className="tabular-nums">{formatarReal(total)}</span>
            </button>
          </div>
        </div>
      )}

      <Modal
        aberto={carrinhoAberto}
        titulo="Seu pedido"
        aoFechar={() => setCarrinhoAberto(false)}
        acoes={
          <button
            type="button"
            className="botao-primario w-full justify-between sm:w-auto sm:min-w-64"
            disabled={enviando || !aceita || quantidade === 0}
            onClick={() => void enviar()}
          >
            <span>{enviando ? 'Enviando…' : 'Enviar para a cozinha'}</span>
            <span className="tabular-nums">{formatarReal(total)}</span>
          </button>
        }
      >
        {linhasCarrinho.length === 0 ? (
          <p className="text-tinta-suave">O carrinho está vazio.</p>
        ) : (
          <ul className="divide-y divide-borda">
            {linhasCarrinho.map(linha => (
              <li key={linha.itemId} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{linha.item.nome}</p>
                  <p className="text-sm tabular-nums text-tinta-suave">
                    {formatarReal(linha.item.precoCentavos * linha.quantidade)}
                  </p>
                </div>
                <Quantidade valor={linha.quantidade} rotulo={linha.item.nome} aoMudar={q => carrinho.definir(linha.itemId, q)} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-tinta-suave">
          Alguma observação (sem cebola, ponto da carne…)? Escreva em “Minha conta”.
        </p>
        <p role="alert" className="mt-2 min-h-5 text-sm font-medium text-perigo">
          {erroEnvio}
        </p>
      </Modal>
    </>
  )
}

interface PropsLinha {
  item: ItemCardapio
  quantidade: number
  aoMudar: (quantidade: number) => void
  desabilitado: boolean
}

function LinhaCardapio({ item, quantidade, aoMudar, desabilitado }: PropsLinha) {
  return (
    <li className="flex items-center gap-3 py-3">
      {item.fotoUrl && (
        <img src={item.fotoUrl} alt="" loading="lazy" className="size-20 shrink-0 rounded-xl bg-borda object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">{item.nome}</p>
        <p className="mt-0.5 tabular-nums text-tinta-suave">{formatarReal(item.precoCentavos)}</p>
      </div>
      {quantidade === 0 ? (
        <button
          type="button"
          className="botao-secundario shrink-0 border-brasa/40 text-brasa-forte"
          onClick={() => aoMudar(1)}
          disabled={desabilitado}
          aria-label={`Adicionar ${item.nome}`}
        >
          Adicionar
        </button>
      ) : (
        <Quantidade valor={quantidade} rotulo={item.nome} aoMudar={aoMudar} desabilitado={desabilitado} />
      )}
    </li>
  )
}
