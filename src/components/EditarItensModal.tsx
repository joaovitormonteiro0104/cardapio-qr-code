import { useState } from 'react'
import { Modal } from './Modal'
import { Quantidade } from './Quantidade'
import { itensAtivos } from '@/domain/pedido/calculo'
import { formatarReal } from '@/lib/formato'
import type { Pedido } from '@/schemas/pedido'

interface Props {
  pedido: Pedido | null
  /** Texto de ajuda no topo (regras de quem está editando). */
  ajuda: string
  /** Garçom não pode remover o último item (deve cancelar com motivo). */
  permitirEsvaziar: boolean
  aoFechar: () => void
  aoAlterarQuantidade: (itemId: string, quantidade: number) => Promise<void>
  aoRemover: (itemId: string) => Promise<void>
}

/** Edição de itens de um pedido: muda quantidade ou remove (nunca apaga a linha). */
export function EditarItensModal({ pedido, ajuda, permitirEsvaziar, aoFechar, aoAlterarQuantidade, aoRemover }: Props) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const ativos = pedido ? itensAtivos(pedido.itens) : []

  async function executar(itemId: string, acao: () => Promise<void>) {
    setOcupado(itemId)
    setErro(null)
    try {
      await acao()
    } catch (falha) {
      console.error(falha)
      setErro(falha instanceof Error && falha.name !== 'Error' ? falha.message : 'Não foi possível salvar. Tente de novo.')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <Modal
      aberto={pedido !== null}
      titulo={pedido ? `Editar pedido #${pedido.numero}` : ''}
      aoFechar={aoFechar}
      acoes={
        <button type="button" className="botao-primario" onClick={aoFechar}>
          Pronto
        </button>
      }
    >
      <p className="mb-3 text-sm text-tinta-suave">{ajuda}</p>
      <ul className="divide-y divide-borda">
        {ativos.map(item => {
          const ultimo = ativos.length === 1
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.nomeSnapshot}</p>
                <p className="text-sm tabular-nums text-tinta-suave">
                  {formatarReal(item.precoCentavosSnapshot)} cada
                </p>
              </div>
              <Quantidade
                valor={item.quantidade}
                minimo={1}
                rotulo={item.nomeSnapshot}
                desabilitado={ocupado !== null}
                aoMudar={q => void executar(item.id, () => aoAlterarQuantidade(item.id, q))}
              />
              <button
                type="button"
                className="botao-secundario text-sm text-perigo"
                disabled={ocupado !== null || (ultimo && !permitirEsvaziar)}
                onClick={() => void executar(item.id, () => aoRemover(item.id))}
              >
                {ultimo && permitirEsvaziar ? 'Remover e cancelar pedido' : 'Remover'}
              </button>
            </li>
          )
        })}
      </ul>
      <p role="alert" className="mt-2 min-h-5 text-sm font-medium text-perigo">
        {erro}
      </p>
    </Modal>
  )
}
