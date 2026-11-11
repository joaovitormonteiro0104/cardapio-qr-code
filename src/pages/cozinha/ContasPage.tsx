import { useCallback, useEffect, useState } from 'react'
import { LayoutEquipe } from '@/components/LayoutEquipe'
import { Modal } from '@/components/Modal'
import { ATOR_SISTEMA } from '@/domain/auditoria/evento'
import { motivoNaoPodeFechar, temPedidoPendente, type EstadoComanda } from '@/domain/comanda/estado'
import { comandaInativa, podeFecharAutomaticamente } from '@/domain/comanda/sessao'
import { totalComanda } from '@/domain/pedido/calculo'
import { useAgora } from '@/hooks/usePedidosCozinha'
import { useConfig } from '@/lib/config'
import { formatarDuracao, formatarReal } from '@/lib/formato'
import * as comandaRepo from '@/repositories/comandaRepo'
import type { ComandaOperacao } from '@/repositories/comandaRepo'
import * as pedidoRepo from '@/repositories/pedidoRepo'

const GRUPOS: { estado: EstadoComanda; titulo: string; vazio: string }[] = [
  { estado: 'AguardandoPagamento', titulo: 'Aguardando confirmação', vazio: 'Nenhum cliente avisou que pagou.' },
  { estado: 'Paga', titulo: 'Pagas (fechar mesa)', vazio: 'Nenhuma conta paga esperando fechamento.' },
  { estado: 'Aberta', titulo: 'Abertas', vazio: 'Nenhuma mesa aberta.' },
]

const INTERVALO_ROTINA_MS = 60_000

export default function ContasPage() {
  const { configs } = useConfig()
  const agora = useAgora()
  const [comandas, setComandas] = useState<ComandaOperacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  // Marcar como pago e fechar mesa não têm desfazer: pedem confirmação mostrando mesa e valor.
  const [confirmacao, setConfirmacao] = useState<{ tipo: 'pago' | 'fechar'; item: ComandaOperacao } | null>(null)

  const recarregar = useCallback(async () => {
    try {
      setComandas(await comandaRepo.listarComandasAbertas())
    } catch (falha) {
      console.error(falha)
      setAviso({ tipo: 'erro', texto: 'Não foi possível atualizar as contas.' })
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void recarregar()
    return pedidoRepo.assinarPedidosAbertos({
      aoMudar: () => void recarregar(),
      aoConectar: () => void recarregar(),
    })
  }, [recarregar])

  // Rotina (§6.11): comanda inativa, paga ou com total zero, sem pendentes → fecha sozinha (ator sistema).
  useEffect(() => {
    if (!configs) return
    async function rodar() {
      if (!configs) return
      try {
        const lista = await comandaRepo.listarComandasAbertas()
        const agoraRotina = new Date()
        for (const item of lista) {
          if (comandaInativa(item.comanda, configs, agoraRotina) && podeFecharAutomaticamente(item.comanda, item.pedidos)) {
            try {
              await comandaRepo.fecharMesa(item.comanda.id, ATOR_SISTEMA)
            } catch (falha) {
              console.error('fechamento automático', item.comanda.numero, falha)
            }
          }
        }
      } catch (falha) {
        console.error('fechamento automático', falha)
      }
    }
    void rodar()
    const id = setInterval(() => void rodar(), INTERVALO_ROTINA_MS)
    return () => clearInterval(id)
  }, [configs])

  async function executar(id: string, acao: () => Promise<unknown>, sucesso: string) {
    setOcupado(id)
    setAviso(null)
    try {
      await acao()
      setAviso({ tipo: 'ok', texto: sucesso })
    } catch (falha) {
      console.error(falha)
      setAviso({
        tipo: 'erro',
        texto: falha instanceof comandaRepo.ErroComanda ? falha.message : 'Não foi possível salvar. Tente de novo.',
      })
    } finally {
      setOcupado(null)
      await recarregar()
    }
  }

  return (
    <LayoutEquipe titulo="Contas">
      {aviso && (
        <p
          role={aviso.tipo === 'erro' ? 'alert' : 'status'}
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
            aviso.tipo === 'erro' ? 'bg-perigo-clara text-perigo' : 'bg-sucesso-clara text-sucesso'
          }`}
        >
          {aviso.texto}
        </p>
      )}
      {carregando ? (
        <p className="text-tinta-suave">Carregando contas…</p>
      ) : (
      <div className="grid gap-6 lg:grid-cols-3">
        {GRUPOS.map(grupo => {
          const doGrupo = comandas.filter(c => c.comanda.estado === grupo.estado)
          return (
            <section key={grupo.estado} aria-labelledby={`grupo-${grupo.estado}`}>
              <h2 id={`grupo-${grupo.estado}`} className="mb-3 flex items-baseline gap-2 text-lg font-semibold">
                {grupo.titulo}
                <span className="text-sm font-normal tabular-nums text-tinta-suave">{doGrupo.length}</span>
              </h2>
              {doGrupo.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-borda px-4 py-6 text-center text-sm text-tinta-suave">{grupo.vazio}</p>
              ) : (
                <ul className="space-y-3">
                  {doGrupo.map(item => {
                    const { comanda } = item
                    const total = totalComanda(item.pedidos)
                    const inativa = configs ? comandaInativa(comanda, configs, agora) : false
                    const naoFecha = motivoNaoPodeFechar(comanda.estado, item.pedidos)
                    const pendentes = temPedidoPendente(item.pedidos)
                    const parado = formatarDuracao(agora.getTime() - comanda.ultimaAtividadeEm.getTime())
                    const ativos = item.pedidos.filter(p => p.estado !== 'Cancelado').length
                    return (
                      <li
                        key={comanda.id}
                        className={`rounded-2xl bg-superficie p-4 shadow-sm ${inativa ? 'ring-2 ring-alerta' : 'ring-1 ring-borda'}`}
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-xl font-bold tabular-nums">Mesa {item.mesaNumero}</p>
                          <p className="text-xl font-bold tabular-nums">{formatarReal(total)}</p>
                        </div>
                        <p className="mt-1 text-sm tabular-nums text-tinta-suave">
                          conta #{comanda.numero} · {ativos === 1 ? '1 pedido' : `${ativos} pedidos`} ·última atividade {parado === 'agora' ? 'agora' : `há ${parado}`}
                        </p>
                        {inativa && (
                          <p className="mt-2 rounded-lg bg-alerta-clara px-3 py-1.5 text-sm">
                            Mesa parada há muito tempo{pendentes ? ' com pedidos em andamento' : comanda.estado === 'Paga' ? '' : ' e sem pagamento'}. Verifique.
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {comanda.estado === 'AguardandoPagamento' && (
                            <>
                              <button
                                type="button"
                                className="botao-primario"
                                disabled={ocupado === comanda.id}
                                onClick={() => setConfirmacao({ tipo: 'pago', item })}
                              >
                                Marcar como pago
                              </button>
                              <button
                                type="button"
                                className="botao-secundario"
                                disabled={ocupado === comanda.id}
                                onClick={() => void executar(comanda.id, () => comandaRepo.reabrir(comanda.id), `Mesa ${item.mesaNumero} reaberta para pedidos.`)}
                              >
                                Reabrir
                              </button>
                            </>
                          )}
                          {(comanda.estado === 'Paga' || (comanda.estado === 'Aberta' && naoFecha !== 'nao_paga')) && (
                            <button
                              type="button"
                              className="botao-primario"
                              disabled={ocupado === comanda.id || naoFecha !== null}
                              onClick={() => setConfirmacao({ tipo: 'fechar', item })}
                            >
                              Fechar mesa
                            </button>
                          )}
                        </div>
                        {naoFecha === 'pendentes' && comanda.estado !== 'AguardandoPagamento' && (
                          <p className="mt-2 text-sm text-tinta-suave">Para fechar, todos os pedidos precisam estar entregues ou cancelados.</p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>
      )}

      <Modal
        aberto={confirmacao !== null}
        titulo={confirmacao?.tipo === 'pago' ? 'Confirmar pagamento?' : 'Fechar a mesa?'}
        aoFechar={() => setConfirmacao(null)}
        acoes={
          <>
            <button type="button" className="botao-secundario" onClick={() => setConfirmacao(null)}>
              Voltar
            </button>
            <button
              type="button"
              className="botao-primario"
              onClick={() => {
                const alvo = confirmacao
                setConfirmacao(null)
                if (!alvo) return
                const { comanda } = alvo.item
                if (alvo.tipo === 'pago') {
                  void executar(comanda.id, () => comandaRepo.marcarComoPaga(comanda.id), `Mesa ${alvo.item.mesaNumero} marcada como paga.`)
                } else {
                  void executar(comanda.id, () => comandaRepo.fecharMesa(comanda.id), `Mesa ${alvo.item.mesaNumero} fechada.`)
                }
              }}
            >
              {confirmacao?.tipo === 'pago' ? 'Sim, recebi o Pix' : 'Sim, fechar a mesa'}
            </button>
          </>
        }
      >
        {confirmacao && (
          <>
            <div className="flex items-baseline justify-between gap-3 rounded-xl bg-fundo px-4 py-3">
              <span className="text-2xl font-bold tabular-nums">Mesa {confirmacao.item.mesaNumero}</span>
              <span className="text-2xl font-bold tabular-nums">{formatarReal(totalComanda(confirmacao.item.pedidos))}</span>
            </div>
            <p className="mt-3 text-tinta-suave">
              {confirmacao.tipo === 'pago'
                ? 'Confira no extrato do banco que este valor entrou antes de confirmar.'
                : 'A conta é encerrada e os celulares da mesa perdem o acesso. A próxima leitura do QR abre uma conta nova.'}
            </p>
          </>
        )}
      </Modal>
    </LayoutEquipe>
  )
}
