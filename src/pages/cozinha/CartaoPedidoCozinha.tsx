import type { ConfigsTempo } from '@/domain/config'
import { itensAtivos } from '@/domain/pedido/calculo'
import { podeCancelar } from '@/domain/pedido/cancelamento'
import { proximosEstados, type EstadoPedido } from '@/domain/pedido/estado'
import { urgenciaPedido, type NivelUrgencia } from '@/domain/pedido/urgencia'
import { formatarDuracao } from '@/lib/formato'
import type { PedidoCozinha } from '@/repositories/pedidoRepo'

export const ROTULO_AVANCO: Partial<Record<EstadoPedido, string>> = {
  Preparando: 'Aceitar',
  Pronto: 'Pronto',
  Entregue: 'Entregue',
}

/** Avanço esperando os segundos de "desfazer" antes de ser gravado. */
export interface AvancoPendente {
  para: EstadoPedido
  segundos: number
}

interface Props {
  pedido: PedidoCozinha
  configs: ConfigsTempo | null
  agora: Date
  ocupado: boolean
  /** Sem conexão: dados podem estar velhos, ações travadas. */
  travado: boolean
  /** Acabou de chegar: pulsa por alguns segundos. */
  novo: boolean
  pendente: AvancoPendente | null
  aoAvancar: (para: EstadoPedido) => void
  aoDesfazer: () => void
  aoCancelar: () => void
  aoConcluirCancelamento: () => void
  aoEditarItens: () => void
  aoResolverEdicao: (aplicada: boolean) => void
}

const MOLDURA: Record<NivelUrgencia, string> = {
  normal: 'ring-1 ring-borda-campo/40',
  atencao: 'ring-2 ring-alerta bg-alerta-clara/40',
  critico: 'ring-4 ring-perigo bg-perigo-clara/50',
}

export function CartaoPedidoCozinha({
  pedido,
  configs,
  agora,
  ocupado,
  travado,
  novo,
  pendente,
  aoAvancar,
  aoDesfazer,
  aoCancelar,
  aoConcluirCancelamento,
  aoEditarItens,
  aoResolverEdicao,
}: Props) {
  // Espera da mesa: desde que o cliente pediu (não reinicia com edições).
  const espera = formatarDuracao(agora.getTime() - pedido.criadoEm.getTime())
  const urgencia = configs ? urgenciaPedido(pedido, configs, agora) : { nivel: 'normal' as const, minutosParaCancelar: null }
  const avancos = proximosEstados(pedido).filter(e => ROTULO_AVANCO[e])
  const emEdicao = pedido.estado === 'EdicaoSolicitada'
  const emCancelamento = pedido.estado === 'CancelamentoPendente'
  const desabilitado = ocupado || travado || pendente !== null
  const moldura = emEdicao ? 'ring-2 ring-brasa' : emCancelamento ? 'ring-2 ring-perigo' : MOLDURA[urgencia.nivel]

  return (
    <article
      className={`flex flex-col rounded-2xl bg-superficie p-4 shadow-sm transition-opacity ${moldura} ${travado ? 'opacity-60' : ''} ${
        novo ? 'motion-safe:animate-[pulse_1s_ease-in-out_3] ring-4 ring-info' : ''
      }`}
      aria-label={`Pedido ${pedido.numero}, mesa ${pedido.mesaNumero}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl font-bold leading-none tabular-nums">Mesa {pedido.mesaNumero}</p>
          <p className="mt-1 text-sm tabular-nums text-tinta-suave">
            Pedido #{pedido.numero}
            {pedido.nomeCliente && <> · {pedido.nomeCliente}</>}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <span className="text-lg font-bold leading-none tabular-nums" title="Desde que o cliente pediu">
            {espera === 'agora' ? 'agora' : `há ${espera}`}
          </span>
          {urgencia.minutosParaCancelar !== null && urgencia.nivel !== 'normal' && (
            <span
              className={`rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ${
                urgencia.nivel === 'critico' ? 'bg-perigo text-white' : 'bg-alerta-clara text-tinta'
              }`}
            >
              {urgencia.minutosParaCancelar === 0 ? 'cancelando…' : `cancela em ${urgencia.minutosParaCancelar} min`}
            </span>
          )}
        </div>
      </header>

      {pedido.observacao && (
        <p className="mt-3 rounded-xl border-2 border-alerta bg-alerta-clara px-3 py-2 text-base">
          <span className="font-bold">Observação:</span> {pedido.observacao}
        </p>
      )}
      {emEdicao && (
        <p className="mt-3 rounded-xl bg-brasa-clara px-3 py-2 text-sm font-medium text-brasa-forte">
          Garçom chamado: o cliente quer mudar este pedido. Toque em “Editar itens”, ajuste e depois em “Aplicar edição”.
        </p>
      )}
      {emCancelamento && (
        <p className="mt-3 rounded-xl bg-perigo-clara px-3 py-2 text-sm text-perigo">
          Cancelamento pendente{pedido.cancelamentoMotivo && <>: <strong>{pedido.cancelamentoMotivo}</strong></>}
        </p>
      )}

      <ul className="mt-3 flex-1 space-y-1.5">
        {itensAtivos(pedido.itens).map(item => (
          <li key={item.id} className="flex gap-2 text-lg leading-snug">
            <span className="min-w-9 font-bold tabular-nums">{item.quantidade}×</span>
            <span>{item.nomeSnapshot}</span>
          </li>
        ))}
      </ul>

      {pendente ? (
        <div role="status" className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-fundo px-3 py-2">
          <span className="font-semibold">
            {ROTULO_AVANCO[pendente.para]} em <span className="tabular-nums">{pendente.segundos}</span> s…
          </span>
          <button type="button" className="botao-secundario min-h-12" onClick={aoDesfazer}>
            Desfazer
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {emEdicao ? (
            <>
              <button type="button" className="botao-secundario min-h-12" disabled={desabilitado} onClick={aoEditarItens}>
                Editar itens
              </button>
              <button type="button" className="botao-primario min-h-12" disabled={desabilitado} onClick={() => aoResolverEdicao(true)}>
                Aplicar edição
              </button>
              <button type="button" className="botao-secundario min-h-12" disabled={desabilitado} onClick={() => aoResolverEdicao(false)}>
                Negar
              </button>
            </>
          ) : emCancelamento ? (
            <button type="button" className="botao-perigo min-h-12" disabled={desabilitado} onClick={aoConcluirCancelamento}>
              Confirmar ou desistir do cancelamento
            </button>
          ) : (
            <>
              {avancos.map(para => (
                <button
                  key={para}
                  type="button"
                  className="botao-primario min-h-14 flex-1 text-lg"
                  disabled={desabilitado}
                  onClick={() => aoAvancar(para)}
                >
                  {ROTULO_AVANCO[para]}
                </button>
              ))}
              {podeCancelar(pedido) && (
                <button type="button" className="botao-secundario min-h-14 text-perigo" disabled={desabilitado} onClick={aoCancelar}>
                  Cancelar
                </button>
              )}
            </>
          )}
        </div>
      )}
    </article>
  )
}
