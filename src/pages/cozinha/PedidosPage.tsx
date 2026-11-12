import { useCallback, useEffect, useRef, useState } from 'react'
import { AvisoFlutuante, FaixaSemConexao, type Aviso } from '@/components/AvisoFlutuante'
import { EditarItensModal } from '@/components/EditarItensModal'
import { LayoutEquipe } from '@/components/LayoutEquipe'
import type { EstadoPedido } from '@/domain/pedido/estado'
import { useAgora, usePedidosCozinha } from '@/hooks/usePedidosCozinha'
import { bipe, liberarSom } from '@/lib/bipe'
import { useConfig } from '@/lib/config'
import * as pedidoRepo from '@/repositories/pedidoRepo'
import type { PedidoCozinha } from '@/repositories/pedidoRepo'
import { CancelamentoModal, type EtapaCancelamento } from './CancelamentoModal'
import { CartaoPedidoCozinha, type AvancoPendente } from './CartaoPedidoCozinha'

const COLUNAS: { titulo: string; estado: EstadoPedido; cor: string }[] = [
  { titulo: 'Novos', estado: 'Recebido', cor: 'border-info' },
  { titulo: 'Preparando', estado: 'Preparando', cor: 'border-alerta' },
  { titulo: 'Prontos', estado: 'Pronto', cor: 'border-sucesso' },
]

/** Segundos para desfazer um avanço antes de gravar (o cartão também não pula de lugar nesse meio-tempo). */
const SEGUNDOS_DESFAZER = 5
/** Quanto tempo um pedido recém-chegado fica destacado. */
const MS_DESTAQUE_NOVO = 8000

/** Coluna do pedido: estados temporários ficam na coluna de onde vieram. */
function colunaDe(pedido: PedidoCozinha): EstadoPedido {
  return pedido.estado === 'EdicaoSolicitada' || pedido.estado === 'CancelamentoPendente'
    ? (pedido.estadoAnterior ?? 'Recebido')
    : pedido.estado
}

function mensagemErro(falha: unknown): string {
  if (falha instanceof pedidoRepo.ErroConcorrencia || falha instanceof pedidoRepo.ErroRegra) return falha.message
  return 'Não foi possível salvar. Verifique a conexão e tente de novo.'
}

export default function PedidosPage() {
  const { pedidos, carregando, erro, conectado, recarregar } = usePedidosCozinha()
  const { configs } = useConfig()
  const agora = useAgora(1000)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [cancelamento, setCancelamento] = useState<EtapaCancelamento>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [pendentes, setPendentes] = useState<Record<string, { para: EstadoPedido; ate: number }>>({})
  const [novos, setNovos] = useState<Record<string, number>>({})
  const [anuncio, setAnuncio] = useState('')
  const [somLigado, setSomLigado] = useState(false)
  const temporizadores = useRef<Record<string, number>>({})
  const vistos = useRef<Set<string> | null>(null)

  // Pedido novo: destaca o cartão, anuncia ao leitor de tela e bipa (se o som estiver ligado).
  useEffect(() => {
    if (carregando) return
    const ids = new Set(pedidos.map(p => p.id))
    if (vistos.current === null) {
      vistos.current = ids // primeira carga: nada é "novo"
      return
    }
    const chegaram = pedidos.filter(p => p.estado === 'Recebido' && !vistos.current?.has(p.id))
    vistos.current = ids
    if (chegaram.length === 0) return
    const ate = Date.now() + MS_DESTAQUE_NOVO
    setNovos(atual => ({ ...atual, ...Object.fromEntries(chegaram.map(p => [p.id, ate])) }))
    setAnuncio(chegaram.map(p => `Novo pedido da mesa ${p.mesaNumero}`).join('. '))
    if (somLigado) bipe()
  }, [pedidos, carregando, somLigado])

  // Cancela os "desfazer" pendentes ao sair da tela.
  useEffect(() => {
    const ativos = temporizadores.current
    return () => Object.values(ativos).forEach(id => clearTimeout(id))
  }, [])

  const executar = useCallback(
    async (pedidoId: string, acao: () => Promise<void>, sucesso?: string) => {
      setOcupado(pedidoId)
      setAviso(null)
      try {
        await acao()
        if (sucesso) setAviso({ tipo: 'ok', texto: sucesso })
      } catch (falha) {
        console.error(falha)
        setAviso({ tipo: 'erro', texto: mensagemErro(falha) })
      } finally {
        setOcupado(null)
        await recarregar()
      }
    },
    [recarregar],
  )

  /** Avanço com "desfazer": grava só depois de alguns segundos. */
  function avancar(pedido: PedidoCozinha, para: EstadoPedido) {
    const ate = Date.now() + SEGUNDOS_DESFAZER * 1000
    setPendentes(atual => ({ ...atual, [pedido.id]: { para, ate } }))
    temporizadores.current[pedido.id] = window.setTimeout(() => {
      delete temporizadores.current[pedido.id]
      setPendentes(({ [pedido.id]: _feito, ...resto }) => resto)
      void executar(pedido.id, () => pedidoRepo.avancarEstado(pedido.id, para))
    }, SEGUNDOS_DESFAZER * 1000)
  }

  function desfazer(pedidoId: string) {
    clearTimeout(temporizadores.current[pedidoId])
    delete temporizadores.current[pedidoId]
    setPendentes(({ [pedidoId]: _desfeito, ...resto }) => resto)
  }

  function alternarSom() {
    if (somLigado) {
      setSomLigado(false)
      return
    }
    if (liberarSom()) {
      setSomLigado(true)
      bipe() // confirma que está tocando
    }
  }

  const limparAviso = useCallback(() => setAviso(null), [])
  const pedidoEditando = pedidos.find(p => p.id === editando) ?? null
  // Pedidos que pedem atenção aparecem primeiro na coluna
  const ordenar = (lista: PedidoCozinha[]) =>
    [...lista].sort((a, b) => Number(b.estado !== colunaDe(b)) - Number(a.estado !== colunaDe(a)))
  const agoraMs = agora.getTime()
  const travado = !conectado

  return (
    <LayoutEquipe titulo="Pedidos" tituloVisivel={false}>
      <p aria-live="assertive" className="sr-only">
        {anuncio}
      </p>

      {travado && <FaixaSemConexao assunto="os pedidos" />}

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        {!travado && (
          <span className="inline-flex items-center gap-2 font-medium text-sucesso">
            <span className="size-2.5 rounded-full bg-sucesso" aria-hidden />
            Ao vivo
          </span>
        )}
        {!carregando && (
          <span className="text-tinta-suave">
            {pedidos.length === 1 ? '1 pedido em aberto' : `${pedidos.length} pedidos em aberto`}
          </span>
        )}
        <button type="button" className="botao-secundario ml-auto min-h-11 text-sm" aria-pressed={somLigado} onClick={alternarSom}>
          {somLigado ? '🔔 Som ligado' : '🔕 Ativar som de pedido novo'}
        </button>
      </div>

      <AvisoFlutuante aviso={aviso} aoSumir={limparAviso} />
      {erro && (
        <p role="alert" className="mb-4 rounded-xl bg-perigo-clara px-4 py-3 text-sm text-perigo">
          {erro}
        </p>
      )}
      {carregando ? (
        <p className="text-tinta-suave">Carregando pedidos…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUNAS.map(coluna => {
            const daColuna = ordenar(pedidos.filter(p => colunaDe(p) === coluna.estado))
            return (
              <section
                key={coluna.estado}
                aria-labelledby={`coluna-${coluna.estado}`}
                className="min-w-0 md:max-h-[calc(100dvh-10rem)] md:overflow-y-auto md:pr-1"
              >
                <h2
                  id={`coluna-${coluna.estado}`}
                  className={`sticky top-0 z-10 mb-3 flex items-baseline gap-2 border-b-4 bg-fundo pb-1 text-xl font-bold ${coluna.cor}`}
                >
                  {coluna.titulo}
                  <span className="text-base font-semibold tabular-nums text-tinta-suave">{daColuna.length}</span>
                </h2>
                {daColuna.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-borda px-4 py-6 text-center text-sm text-tinta-suave">
                    Nada aqui.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {daColuna.map(pedido => {
                      const pendente = pendentes[pedido.id]
                      const avanco: AvancoPendente | null = pendente
                        ? { para: pendente.para, segundos: Math.max(0, Math.ceil((pendente.ate - agoraMs) / 1000)) }
                        : null
                      return (
                        <CartaoPedidoCozinha
                          key={pedido.id}
                          pedido={pedido}
                          configs={configs}
                          agora={agora}
                          ocupado={ocupado === pedido.id}
                          travado={travado}
                          novo={(novos[pedido.id] ?? 0) > agoraMs}
                          pendente={avanco}
                          aoAvancar={para => avancar(pedido, para)}
                          aoDesfazer={() => desfazer(pedido.id)}
                          aoCancelar={() => setCancelamento({ pedido, etapa: 1 })}
                          aoConcluirCancelamento={() => setCancelamento({ pedido, etapa: 2 })}
                          aoEditarItens={() => setEditando(pedido.id)}
                          aoResolverEdicao={aplicada =>
                            void executar(
                              pedido.id,
                              () => pedidoRepo.resolverEdicao(pedido.id, aplicada),
                              aplicada ? `Edição do pedido #${pedido.numero} aplicada.` : `Edição do pedido #${pedido.numero} negada.`,
                            )
                          }
                        />
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      <CancelamentoModal
        estado={cancelamento}
        aoMudarEtapa={setCancelamento}
        aoConcluir={texto => {
          setAviso({ tipo: 'ok', texto })
          void recarregar()
        }}
      />

      {configs && (
        <EditarItensModal
          pedido={pedidoEditando}
          ajuda="Mude as quantidades ou remova itens como o cliente pediu. Depois toque em “Aplicar edição” no card."
          permitirEsvaziar={false}
          aoFechar={() => setEditando(null)}
          aoAlterarQuantidade={async (itemId, q) => {
            if (!pedidoEditando) return
            await pedidoRepo.alterarQuantidadeItem(pedidoEditando.id, itemId, q, configs)
            await recarregar()
          }}
          aoRemover={async itemId => {
            if (!pedidoEditando) return
            await pedidoRepo.removerItemDoPedido(pedidoEditando.id, itemId, configs)
            await recarregar()
          }}
        />
      )}
    </LayoutEquipe>
  )
}
