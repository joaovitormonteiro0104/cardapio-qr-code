import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EstadoPedidoBadge } from '@/components/EstadoPedidoBadge'
import { totalComanda, totalPedido } from '@/domain/pedido/calculo'
import { formatarHora, formatarReal } from '@/lib/formato'
import * as comandaRepo from '@/repositories/comandaRepo'
import { OBSERVACAO_MAX } from '@/schemas/comanda'
import type { Pedido } from '@/schemas/pedido'
import { useMesa } from './MesaLayout'

export default function ComandaPage() {
  const { comanda, pedidos, atualizarComanda } = useMesa()
  if (!comanda) return null

  const total = totalComanda(pedidos)
  const visiveis = [...pedidos].reverse() // mais recente primeiro

  return (
    <div className="space-y-6">
      {visiveis.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-borda px-6 py-10 text-center">
          <p className="font-medium">Nenhum pedido ainda.</p>
          <Link to=".." relative="path" className="botao-primario mt-4">
            Ver o cardápio
          </Link>
        </div>
      ) : (
        <ol className="space-y-3" aria-label="Pedidos da mesa">
          {visiveis.map(pedido => (
            <CartaoPedido key={pedido.id} pedido={pedido} />
          ))}
        </ol>
      )}

      <div className="flex items-baseline justify-between rounded-2xl bg-superficie px-4 py-4 shadow-sm ring-1 ring-borda">
        <span className="font-semibold">Total da mesa</span>
        <span className="text-2xl font-bold tabular-nums">{formatarReal(total)}</span>
      </div>

      <Observacao
        valorInicial={comanda.observacao ?? ''}
        aoSalvar={async texto => atualizarComanda(await comandaRepo.atualizarObservacao(comanda, texto))}
      />
    </div>
  )
}

function CartaoPedido({ pedido }: { pedido: Pedido }) {
  const cancelado = pedido.estado === 'Cancelado'
  return (
    <li className="rounded-2xl bg-superficie px-4 py-3 shadow-sm ring-1 ring-borda">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">
          Pedido <span className="tabular-nums">#{pedido.numero}</span>
          <span className="ml-2 text-sm font-normal tabular-nums text-tinta-suave">{formatarHora(pedido.criadoEm)}</span>
        </p>
        <EstadoPedidoBadge estado={pedido.estado} />
      </div>
      <ul className={`mt-2 space-y-1 text-sm ${cancelado ? 'text-tinta-suave line-through' : ''}`}>
        {pedido.itens.map(item => (
          <li key={item.id} className={`flex justify-between gap-3 ${item.removidoEm ? 'text-tinta-suave line-through' : ''}`}>
            <span>
              <span className="tabular-nums">{item.quantidade}×</span> {item.nomeSnapshot}
            </span>
            <span className="tabular-nums">{formatarReal(item.quantidade * item.precoCentavosSnapshot)}</span>
          </li>
        ))}
      </ul>
      {!cancelado && (
        <p className="mt-2 border-t border-borda pt-2 text-right text-sm font-semibold tabular-nums">
          {formatarReal(totalPedido(pedido))}
        </p>
      )}
    </li>
  )
}

function Observacao({ valorInicial, aoSalvar }: { valorInicial: string; aoSalvar: (texto: string) => Promise<void> }) {
  const [texto, setTexto] = useState(valorInicial)
  const [estado, setEstado] = useState<'ocioso' | 'salvando' | 'salvo' | 'erro'>('ocioso')

  useEffect(() => setTexto(valorInicial), [valorInicial])

  const alterado = texto.trim() !== valorInicial.trim()

  async function salvar() {
    setEstado('salvando')
    try {
      await aoSalvar(texto)
      setEstado('salvo')
    } catch (falha) {
      console.error(falha)
      setEstado('erro')
    }
  }

  return (
    <div>
      <label htmlFor="observacao" className="rotulo">
        Observação para a cozinha
      </label>
      <textarea
        id="observacao"
        className="campo min-h-24 py-2"
        maxLength={OBSERVACAO_MAX}
        placeholder="Ex.: sem cebola no X-Burguer, carne ao ponto"
        value={texto}
        onChange={e => {
          setTexto(e.target.value)
          setEstado('ocioso')
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p role="status" className="text-sm text-tinta-suave">
          {estado === 'salvo' && 'Observação salva.'}
          {estado === 'erro' && <span className="text-perigo">Não foi possível salvar.</span>}
        </p>
        <button type="button" className="botao-secundario" disabled={!alterado || estado === 'salvando'} onClick={() => void salvar()}>
          {estado === 'salvando' ? 'Salvando…' : 'Salvar observação'}
        </button>
      </div>
    </div>
  )
}
