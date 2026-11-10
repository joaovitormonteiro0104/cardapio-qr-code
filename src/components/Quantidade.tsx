interface Props {
  valor: number
  aoMudar: (valor: number) => void
  rotulo: string
  minimo?: number
  maximo?: number
  desabilitado?: boolean
}

/** Seletor − n + com alvos de 44px. */
export function Quantidade({ valor, aoMudar, rotulo, minimo = 0, maximo = 99, desabilitado = false }: Props) {
  return (
    <div className="inline-flex items-center rounded-xl border border-borda bg-superficie" role="group" aria-label={rotulo}>
      <button
        type="button"
        className="flex size-11 items-center justify-center rounded-l-xl text-xl font-semibold text-brasa-forte hover:bg-brasa-clara disabled:opacity-40"
        onClick={() => aoMudar(valor - 1)}
        disabled={desabilitado || valor <= minimo}
        aria-label={`Diminuir ${rotulo}`}
      >
        −
      </button>
      <span className="min-w-7 text-center font-semibold tabular-nums" aria-live="polite">
        {valor}
      </span>
      <button
        type="button"
        className="flex size-11 items-center justify-center rounded-r-xl text-xl font-semibold text-brasa-forte hover:bg-brasa-clara disabled:opacity-40"
        onClick={() => aoMudar(valor + 1)}
        disabled={desabilitado || valor >= maximo}
        aria-label={`Aumentar ${rotulo}`}
      >
        +
      </button>
    </div>
  )
}
