import { useCallback, useEffect, useState } from 'react'
import { AvisoFlutuante, FaixaSemConexao, type Aviso } from '@/components/AvisoFlutuante'
import { Carregando } from '@/components/Carregando'
import { LayoutEquipe } from '@/components/LayoutEquipe'
import { Modal } from '@/components/Modal'
import { motivoNaoPodeFechar, podeMarcarComoPaga, temPedidoPendente, type EstadoComanda } from '@/domain/comanda/estado'
import { comandaInativa } from '@/domain/comanda/sessao'
import { totalComanda } from '@/domain/pedido/calculo'
import { useAgora } from '@/hooks/usePedidosCozinha'
import { useConfig } from '@/lib/config'
import { formatarDuracao, formatarHora, formatarReal } from '@/lib/formato'
import * as comandaRepo from '@/repositories/comandaRepo'
import type { ComandaOperacao } from '@/repositories/comandaRepo'
import * as pedidoRepo from '@/repositories/pedidoRepo'

const GRUPOS: { estado: EstadoComanda; titulo: string; vazio: string; cor: string }[] = [
  { estado: 'AguardandoPagamento', titulo: 'Aguardando confirmação', vazio: 'Nenhum cliente avisou que pagou.', cor: 'border-brasa' },
  { estado: 'Paga', titulo: 'Pagas: fechar mesa', vazio: 'Nenhuma conta paga esperando fechamento.', cor: 'border-sucesso' },
  { estado: 'Aberta', titulo: 'Abertas', vazio: 'Nenhuma mesa aberta.', cor: 'border-info' },
]

type TipoConfirmacao = 'pago' | 'fechar' | 'reabrir'
/** Guarda só o id e o valor visto ao abrir: a janela mostra sempre os dados atuais. */
type Confirmacao = { tipo: TipoConfirmacao; comandaId: string; totalAoAbrir: number } | null

const TITULOS: Record<TipoConfirmacao, string> = {
  pago: 'Confirmar pagamento?',
  fechar: 'Fechar a mesa?',
  reabrir: 'Voltar a conta para pedidos?',
}

const mesaTexto = (n: number) => (n > 0 ? `Mesa ${n}` : 'Mesa ?')

export default function ContasPage() {
  const { configs } = useConfig()
  const agora = useAgora()
  const [comandas, setComandas] = useState<ComandaOperacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState(false)
  const [conectado, setConectado] = useState(true)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [busca, setBusca] = useState('')
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null)

  const recarregar = useCallback(async () => {
    try {
      setComandas(await comandaRepo.listarComandasAbertas())
      setErroCarga(false)
    } catch (falha) {
      console.error(falha)
      setErroCarga(true)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void recarregar()
    return pedidoRepo.assinarPedidosAbertos({
      aoMudar: () => void recarregar(),
      aoConectar: () => {
        setConectado(true)
        void recarregar()
      },
      aoDesconectar: () => setConectado(false),
    })
  }, [recarregar])

  const limparAviso = useCallback(() => setAviso(null), [])

  // A conta da janela de confirmação, sempre com os dados atuais.
  const alvo = confirmacao ? (comandas.find(c => c.comanda.id === confirmacao.comandaId) ?? null) : null
  const estadoEsperado: Record<TipoConfirmacao, EstadoComanda[]> = {
    pago: ['AguardandoPagamento', 'Aberta'],
    fechar: ['Paga', 'Aberta'],
    reabrir: ['AguardandoPagamento'],
  }
  const alvoSumiu = confirmacao !== null && !carregando && (!alvo || !estadoEsperado[confirmacao.tipo].includes(alvo.comanda.estado))
  useEffect(() => {
    if (alvoSumiu) {
      setConfirmacao(null)
      setAviso({ tipo: 'erro', texto: 'Esta conta mudou enquanto a janela estava aberta. Confira de novo.' })
    }
  }, [alvoSumiu])

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
        texto: falha instanceof comandaRepo.ErroComanda ? falha.message : 'Não foi possível salvar. Verifique a conexão e tente de novo.',
      })
    } finally {
      setOcupado(null)
      await recarregar()
    }
  }

  function confirmar() {
    if (!confirmacao || !alvo) return
    const { comanda } = alvo
    const mesa = mesaTexto(alvo.mesaNumero)
    setConfirmacao(null)
    if (confirmacao.tipo === 'pago') void executar(comanda.id, () => comandaRepo.marcarComoPaga(comanda.id), `${mesa} marcada como paga.`)
    else if (confirmacao.tipo === 'fechar') void executar(comanda.id, () => comandaRepo.fecharMesa(comanda.id), `${mesa} fechada.`)
    else void executar(comanda.id, () => comandaRepo.reabrir(comanda.id), `${mesa} voltou para pedidos.`)
  }

  const abrir = (tipo: TipoConfirmacao, item: ComandaOperacao) =>
    setConfirmacao({ tipo, comandaId: item.comanda.id, totalAoAbrir: totalComanda(item.pedidos) })

  const termo = busca.trim()
  const visiveis = termo ? comandas.filter(c => String(c.mesaNumero).startsWith(termo)) : comandas
  const travado = !conectado
  const totalAguardando = totalComanda(
    comandas.filter(c => c.comanda.estado === 'AguardandoPagamento').flatMap(c => c.pedidos),
  )
  const totalAtualAlvo = alvo ? totalComanda(alvo.pedidos) : 0
  const valorMudou = confirmacao !== null && alvo !== null && totalAtualAlvo !== confirmacao.totalAoAbrir

  return (
    <LayoutEquipe titulo="Contas" tituloVisivel={false}>
      {travado && <FaixaSemConexao assunto="as contas" />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="busca-mesa" className="sr-only">
          Buscar mesa
        </label>
        <input
          id="busca-mesa"
          className="campo max-w-48"
          inputMode="numeric"
          placeholder="Buscar mesa…"
          value={busca}
          onChange={e => setBusca(e.target.value.replace(/\D/g, ''))}
        />
        {totalAguardando > 0 && (
          <p className="text-sm text-tinta-suave">
            Esperando confirmação: <strong className="tabular-nums text-tinta">{formatarReal(totalAguardando)}</strong>
          </p>
        )}
      </div>

      {carregando ? (
        <Carregando texto="Carregando contas…" />
      ) : erroCarga && comandas.length === 0 ? (
        <div role="alert" className="rounded-2xl bg-perigo-clara px-6 py-8 text-center text-perigo">
          <p className="font-semibold">Não foi possível carregar as contas.</p>
          <button type="button" className="botao-primario mt-4" onClick={() => void recarregar()}>
            Tentar de novo
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {GRUPOS.map(grupo => {
            const doGrupo = visiveis.filter(c => c.comanda.estado === grupo.estado)
            const urgente = grupo.estado === 'AguardandoPagamento' && doGrupo.length > 0
            return (
              <section
                key={grupo.estado}
                aria-labelledby={`grupo-${grupo.estado}`}
                className="min-w-0 md:max-h-[calc(100dvh-11rem)] md:overflow-y-auto md:pr-1"
              >
                <h2
                  id={`grupo-${grupo.estado}`}
                  className={`sticky top-0 z-10 mb-3 flex items-baseline gap-2 border-b-4 bg-fundo pb-1 text-xl font-bold ${grupo.cor}`}
                >
                  {grupo.titulo}
                  <span
                    className={`tabular-nums ${urgente ? 'rounded-full bg-brasa px-2 text-base text-white' : 'text-base font-semibold text-tinta-suave'}`}
                  >
                    {doGrupo.length}
                  </span>
                </h2>
                {doGrupo.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-borda px-4 py-6 text-center text-sm text-tinta-suave">
                    {termo ? 'Nenhuma mesa com esse número aqui.' : grupo.vazio}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {doGrupo.map(item => (
                      <CartaoConta
                        key={item.comanda.id}
                        item={item}
                        agora={agora}
                        inativa={configs ? comandaInativa(item.comanda, configs, agora) : false}
                        ocupado={ocupado === item.comanda.id}
                        travado={travado}
                        aoAbrir={tipo => abrir(tipo, item)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}

      <Modal
        aberto={confirmacao !== null && alvo !== null}
        titulo={confirmacao ? TITULOS[confirmacao.tipo] : ''}
        aoFechar={() => setConfirmacao(null)}
        acoes={
          <>
            <button type="button" className="botao-secundario" onClick={() => setConfirmacao(null)}>
              Voltar
            </button>
            <button type="button" className="botao-primario" onClick={confirmar}>
              {confirmacao?.tipo === 'pago' ? 'Sim, recebi o Pix' : confirmacao?.tipo === 'fechar' ? 'Sim, fechar a mesa' : 'Sim, vai pedir mais'}
            </button>
          </>
        }
      >
        {confirmacao && alvo && (
          <>
            <div className="flex items-baseline justify-between gap-3 rounded-xl bg-fundo px-4 py-3">
              <span className="text-2xl font-bold tabular-nums">{mesaTexto(alvo.mesaNumero)}</span>
              <span className="text-2xl font-bold tabular-nums">{formatarReal(totalAtualAlvo)}</span>
            </div>
            {valorMudou && (
              <p role="alert" className="mt-3 rounded-lg bg-perigo-clara px-3 py-2 text-sm font-medium text-perigo">
                O valor mudou de {formatarReal(confirmacao.totalAoAbrir)} para {formatarReal(totalAtualAlvo)} enquanto esta janela
                estava aberta. Confira de novo.
              </p>
            )}
            <p className="mt-3 text-tinta-suave">
              {confirmacao.tipo === 'pago'
                ? alvo.comanda.estado === 'Aberta'
                  ? 'O cliente não tocou em "Já paguei". Só confirme se o Pix deste valor já está no extrato do banco.'
                  : 'Confira no extrato do banco que este valor entrou antes de confirmar.'
                : confirmacao.tipo === 'fechar'
                  ? 'A conta é encerrada e os celulares da mesa perdem o acesso. A próxima leitura do QR abre uma conta nova.'
                  : 'A mesa volta a aceitar pedidos. Depois, o cliente precisa tocar em "Já paguei" de novo.'}
            </p>
          </>
        )}
      </Modal>

      <AvisoFlutuante aviso={aviso} aoSumir={limparAviso} />
    </LayoutEquipe>
  )
}

interface PropsCartao {
  item: ComandaOperacao
  agora: Date
  inativa: boolean
  ocupado: boolean
  travado: boolean
  aoAbrir: (tipo: TipoConfirmacao) => void
}

function CartaoConta({ item, agora, inativa, ocupado, travado, aoAbrir }: PropsCartao) {
  const { comanda } = item
  const total = totalComanda(item.pedidos)
  const naoFecha = motivoNaoPodeFechar(comanda.estado, item.pedidos)
  const pendentes = temPedidoPendente(item.pedidos)
  const ativos = item.pedidos.filter(p => p.estado !== 'Cancelado').length
  const parado = formatarDuracao(agora.getTime() - comanda.ultimaAtividadeEm.getTime())
  const desabilitado = ocupado || travado
  const aguardando = comanda.estado === 'AguardandoPagamento'
  const pagoDireto = comanda.estado === 'Aberta' && podeMarcarComoPaga(comanda.estado, item.pedidos)

  return (
    <li
      className={`rounded-2xl bg-superficie p-4 shadow-sm ${inativa ? 'ring-2 ring-alerta' : aguardando ? 'ring-2 ring-brasa' : 'ring-1 ring-borda-campo/40'} ${
        travado ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xl font-bold tabular-nums">{mesaTexto(item.mesaNumero)}</p>
        <p className="text-2xl font-bold tabular-nums">{formatarReal(total)}</p>
      </div>
      <p className="mt-1 text-sm tabular-nums text-tinta-suave">
        {aguardando ? (
          <>
            <strong className="text-tinta">Avisou que pagou às {formatarHora(comanda.ultimaAtividadeEm)}</strong> · conta #{comanda.numero}
          </>
        ) : (
          <>
            conta #{comanda.numero} · {ativos === 1 ? '1 pedido' : `${ativos} pedidos`} · última atividade{' '}
            {parado === 'agora' ? 'agora' : `há ${parado}`}
          </>
        )}
      </p>
      {inativa && (
        <p className="mt-2 rounded-lg border border-alerta bg-alerta-clara px-3 py-1.5 text-sm">
          Mesa parada há muito tempo{pendentes ? ' com pedidos em andamento' : comanda.estado === 'Paga' ? '' : ' e sem pagamento'}.
          Verifique.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {aguardando && (
          <>
            <button type="button" className="botao-primario min-h-12 flex-1" disabled={desabilitado} onClick={() => aoAbrir('pago')}>
              {ocupado ? 'Salvando…' : 'Marcar como pago'}
            </button>
            <button type="button" className="botao-secundario min-h-12" disabled={desabilitado} onClick={() => aoAbrir('reabrir')}>
              Cliente vai pedir mais
            </button>
          </>
        )}
        {(comanda.estado === 'Paga' || (comanda.estado === 'Aberta' && naoFecha !== 'nao_paga')) && (
          <button
            type="button"
            className="botao-primario min-h-12 flex-1"
            disabled={desabilitado || naoFecha !== null}
            onClick={() => aoAbrir('fechar')}
          >
            {ocupado ? 'Salvando…' : 'Fechar mesa'}
          </button>
        )}
        {pagoDireto && (
          <button type="button" className="botao-secundario min-h-12" disabled={desabilitado} onClick={() => aoAbrir('pago')}>
            Recebi o Pix
          </button>
        )}
      </div>
      {naoFecha === 'pendentes' && comanda.estado !== 'AguardandoPagamento' && (
        <p className="mt-2 text-sm font-medium text-tinta">Para fechar, todos os pedidos precisam estar entregues ou cancelados.</p>
      )}
      {pagoDireto && (
        <p className="mt-2 text-sm text-tinta-suave">
          O cliente ainda não avisou que pagou. Peça para tocar em “Já paguei” no celular, ou use “Recebi o Pix” se o valor já está
          no extrato.
        </p>
      )}
    </li>
  )
}
