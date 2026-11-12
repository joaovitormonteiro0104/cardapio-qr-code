import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FotoItem } from '@/components/FotoItem'
import { Modal } from '@/components/Modal'
import { Quantidade } from '@/components/Quantidade'
import { aceitaNovosPedidos } from '@/domain/comanda/estado'
import { quantidadeCarrinho, totalCarrinho } from '@/domain/pedido/calculo'
import { useCardapio } from '@/hooks/useCardapio'
import { formatarReal } from '@/lib/formato'
import * as comandaRepo from '@/repositories/comandaRepo'
import { ErroPedido, criarPedido } from '@/repositories/pedidoRepo'
import type { ItemCardapio } from '@/schemas/cardapio'
import { OBSERVACAO_MAX } from '@/schemas/comanda'
import { useMesa } from './MesaLayout'

export default function CardapioPage() {
  const { comanda, carrinho, recarregar: recarregarComanda, setAviso, atualizarComanda } = useMesa()
  const { categorias, itens, carregando, erro, recarregar } = useCardapio('cliente')
  const navegar = useNavigate()
  const [carrinhoAberto, setCarrinhoAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [observacao, setObservacao] = useState('')
  const [mostrarObservacao, setMostrarObservacao] = useState(false)
  const [secaoAtiva, setSecaoAtiva] = useState<string | null>(null)
  const barraCategorias = useRef<HTMLElement>(null)

  // Ao abrir o pedido, a observação começa com a que a mesa já tem.
  const observacaoAtual = comanda?.observacao ?? ''
  useEffect(() => {
    if (!carrinhoAberto) return
    setObservacao(observacaoAtual)
    setMostrarObservacao(observacaoAtual.length > 0)
  }, [carrinhoAberto, observacaoAtual])

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

  // Destaca o chip da categoria que está na tela.
  const idsSecoes = secoes.map(secao => secao.categoria.id).join(',')
  useEffect(() => {
    if (!idsSecoes) return
    const visiveis = new Map<string, boolean>()
    const observador = new IntersectionObserver(
      entradas => {
        for (const entrada of entradas) visiveis.set(entrada.target.id, entrada.isIntersecting)
        const primeira = idsSecoes.split(',').find(id => visiveis.get(`categoria-${id}`))
        if (primeira) setSecaoAtiva(primeira)
      },
      { rootMargin: '-35% 0px -55% 0px' },
    )
    for (const id of idsSecoes.split(',')) {
      const el = document.getElementById(`categoria-${id}`)
      if (el) observador.observe(el)
    }
    return () => observador.disconnect()
  }, [idsSecoes])

  // Mantém o chip ativo à vista na barra que rola para o lado.
  useEffect(() => {
    if (!secaoAtiva) return
    barraCategorias.current
      ?.querySelector<HTMLElement>(`[data-categoria="${secaoAtiva}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [secaoAtiva])

  async function enviar() {
    if (!comanda) return
    setEnviando(true)
    setErroEnvio(null)
    try {
      // A observação vai junto com o pedido: grava antes, para a cozinha já ver.
      const texto = observacao.trim()
      if (texto !== observacaoAtual.trim()) {
        atualizarComanda(await comandaRepo.atualizarObservacao(comanda, texto))
      }
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
          A conta está em pagamento. Para pedir mais, chame um atendente para reabrir.{' '}
          <Link to="comanda" className="font-semibold underline">
            Ver minha conta
          </Link>
        </p>
      )}

      {secoes.length === 0 ? (
        <p className="py-10 text-center text-tinta-suave">O cardápio ainda está sendo preparado. Chame um atendente.</p>
      ) : (
        <>
          <nav
            ref={barraCategorias}
            aria-label="Categorias"
            className="sem-barra-rolagem sticky top-[var(--altura-cabecalho,5.8rem)] z-10 -mx-4 mb-2 flex gap-2 overflow-x-auto border-b border-borda bg-fundo/95 px-4 py-2 backdrop-blur"
          >
            {secoes.map(({ categoria }) => {
              const ativa = categoria.id === secaoAtiva
              return (
                <a
                  key={categoria.id}
                  href={`#categoria-${categoria.id}`}
                  data-categoria={categoria.id}
                  aria-current={ativa ? 'true' : undefined}
                  className={`flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors ${
                    ativa ? 'border-brasa bg-brasa-clara text-brasa-forte' : 'border-borda bg-superficie'
                  }`}
                >
                  {categoria.nome}
                </a>
              )
            })}
          </nav>

          {secoes.map(({ categoria, itens: doGrupo }) => (
            <section
              key={categoria.id}
              id={`categoria-${categoria.id}`}
              className="scroll-mt-[calc(var(--altura-cabecalho,5.8rem)+4rem)] pb-4"
            >
              <h2 className="pb-1 pt-4 text-xl font-bold tracking-tight">{categoria.nome}</h2>
              <ul className="divide-y divide-borda">
                {doGrupo.map(item => (
                  <LinhaCardapio
                    key={item.id}
                    item={item}
                    quantidade={carrinho.quantidadeDe(item.id)}
                    aoMudar={q => carrinho.definir(item.id, q)}
                    podePedir={aceita}
                  />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {quantidade > 0 && aceita && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-superficie/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
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
        <p className="mb-1 text-sm text-tinta-suave">Ainda não foi enviado. Confira e toque em “Enviar para a cozinha”.</p>
        {linhasCarrinho.length === 0 ? (
          <p className="text-tinta-suave">O carrinho está vazio.</p>
        ) : (
          <ul className="divide-y divide-borda">
            {linhasCarrinho.map(linha => (
              <li key={linha.itemId} className="flex items-center gap-3 py-3">
                <FotoItem url={linha.item.fotoUrl} nome={linha.item.nome} className="size-14 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{linha.item.nome}</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatarReal(linha.item.precoCentavos * linha.quantidade)}
                  </p>
                  {linha.quantidade > 1 && (
                    <p className="text-xs tabular-nums text-tinta-suave">
                      {linha.quantidade} × {formatarReal(linha.item.precoCentavos)}
                    </p>
                  )}
                </div>
                <Quantidade valor={linha.quantidade} rotulo={linha.item.nome} aoMudar={q => carrinho.definir(linha.itemId, q)} />
              </li>
            ))}
          </ul>
        )}
        {mostrarObservacao ? (
          <div className="mt-3">
            <label htmlFor="observacao-pedido" className="rotulo">
              Observação para a cozinha <span className="font-normal text-tinta-suave">(opcional)</span>
            </label>
            <textarea
              id="observacao-pedido"
              className="campo min-h-20 py-2"
              maxLength={OBSERVACAO_MAX}
              placeholder="Ex.: sem cebola no X-Burguer, carne ao ponto"
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
            />
            <p className="mt-1 text-xs text-tinta-suave">Vale para a mesa toda e vai junto com este pedido.</p>
          </div>
        ) : (
          <button
            type="button"
            className="mt-3 min-h-11 text-sm font-semibold text-brasa-forte underline-offset-2 hover:underline"
            onClick={() => setMostrarObservacao(true)}
          >
            + Adicionar observação (sem cebola, ponto da carne…)
          </button>
        )}
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
  podePedir: boolean
}

function LinhaCardapio({ item, quantidade, aoMudar, podePedir }: PropsLinha) {
  // Quando o "+" redondo vira o seletor, o foco vai junto (o leitor de tela não se perde).
  const [acabouDeAdicionar, setAcabouDeAdicionar] = useState(false)
  return (
    <li className="flex items-center gap-3 py-3">
      <FotoItem url={item.fotoUrl} nome={item.nome} className="size-20 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">{item.nome}</p>
        {item.descricao && <p className="mt-0.5 line-clamp-2 text-sm text-tinta-suave">{item.descricao}</p>}
        <p className="mt-1 font-semibold tabular-nums">{formatarReal(item.precoCentavos)}</p>
      </div>
      {podePedir &&
        (quantidade === 0 ? (
          <button
            type="button"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brasa-clara text-2xl font-semibold text-brasa-forte transition-colors hover:bg-brasa hover:text-white"
            onClick={() => {
              setAcabouDeAdicionar(true)
              aoMudar(1)
            }}
            aria-label={`Adicionar ${item.nome}`}
          >
            +
          </button>
        ) : (
          <Quantidade valor={quantidade} rotulo={item.nome} aoMudar={aoMudar} focarAoMontar={acabouDeAdicionar} />
        ))}
    </li>
  )
}
