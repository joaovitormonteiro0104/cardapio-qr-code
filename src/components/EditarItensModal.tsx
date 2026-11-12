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
  /** Segundos que faltam da janela livre do cliente (mostra a contagem no topo). */
  segundosRestantes?: number | null
  aoFechar: () => void
  aoAlterarQuantidade: (itemId: string, quantidade: number) => Promise<void>
  aoRemover: (itemId: string) => Promise<void>
}

/** Edição de itens de um pedido: muda quantidade ou remove (nunca apaga a linha). */
export function EditarItensModal({
  pedido,
  ajuda,
  permitirEsvaziar,
  segundosRestantes = null,
  aoFechar,
  aoAlterarQuantidade,
  aoRemover,
}: Props) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  // Tirar o último item cancela o pedido inteiro: pede confirmação, como o botão do cartão.
  const [confirmandoEsvaziar, setConfirmandoEsvaziar] = useState(false)

  function fechar() {
    setConfirmandoEsvaziar(false)
    setErro(null)
    aoFechar()
  }
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
      aoFechar={fechar}
      acoes={
        <button type="button" className="botao-primario" onClick={fechar}>
          Concluído
        </button>
      }
    >
      {segundosRestantes !== null && (
        <p
          role="timer"
          className={`mb-3 rounded-lg px-3 py-2 text-sm font-medium tabular-nums ${segundosRestantes <= 30 ? 'bg-alerta-clara' : 'bg-fundo'}`}
        >
          Dá para mudar por mais {Math.floor(segundosRestantes / 60)}:{String(segundosRestantes % 60).padStart(2, '0')}
        </p>
      )}
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
                onClick={() => {
                  if (ultimo && permitirEsvaziar) setConfirmandoEsvaziar(true)
                  else void executar(item.id, () => aoRemover(item.id))
                }}
              >
                {ultimo && permitirEsvaziar ? 'Remover e cancelar pedido' : 'Remover'}
              </button>
              {ultimo && confirmandoEsvaziar && (
                <div role="alert" className="w-full rounded-xl bg-perigo-clara px-3 py-3 text-sm text-perigo">
                  <p className="font-medium">É o último item: o pedido inteiro será cancelado.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className="botao-secundario text-sm" onClick={() => setConfirmandoEsvaziar(false)}>
                      Voltar
                    </button>
                    <button
                      type="button"
                      className="botao-perigo text-sm"
                      disabled={ocupado !== null}
                      onClick={() =>
                        void executar(item.id, async () => {
                          await aoRemover(item.id)
                          setConfirmandoEsvaziar(false)
                        })
                      }
                    >
                      Sim, cancelar pedido
                    </button>
                  </div>
                </div>
              )}
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
