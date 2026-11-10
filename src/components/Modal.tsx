import { useEffect, useId, useRef, type ReactNode } from 'react'

interface Props {
  aberto: boolean
  titulo: string
  aoFechar: () => void
  children: ReactNode
  /** Rodapé com os botões de ação. */
  acoes?: ReactNode
}

/**
 * Modal acessível sobre o <dialog> nativo: prende o foco, fecha com Esc e
 * devolve o foco a quem abriu. Em celular vira uma folha que sobe de baixo.
 */
export function Modal({ aberto, titulo, aoFechar, children, acoes }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (aberto && !dialogo.open) dialogo.showModal()
    if (!aberto && dialogo.open) dialogo.close()
  }, [aberto])

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onCancel={evento => {
        evento.preventDefault()
        aoFechar()
      }}
      onClick={evento => {
        if (evento.target === ref.current) aoFechar() // clique no fundo escuro
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-2xl bg-superficie p-0 text-tinta shadow-xl backdrop:bg-tinta/40 sm:m-auto sm:max-w-lg sm:rounded-2xl"
    >
      {aberto && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-borda px-5 py-3">
            <h2 id={idTitulo} className="text-lg font-semibold">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={aoFechar}
              className="-mr-2 flex size-11 items-center justify-center rounded-lg text-2xl leading-none text-tinta-suave hover:bg-fundo"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {acoes && (
            <div className="flex flex-col-reverse gap-2 border-t border-borda px-5 py-3 sm:flex-row sm:justify-end">
              {acoes}
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}
