interface Props {
  url: string | null
  nome: string
  /** Classes de tamanho, ex.: "size-20 rounded-xl" */
  className?: string
}

/**
 * Foto do item do cardápio. Sem foto, mostra um quadro neutro com a inicial,
 * pra manter o alinhamento das listas.
 */
export function FotoItem({ url, nome, className = 'size-14 rounded-lg' }: Props) {
  if (url) {
    return <img src={url} alt="" loading="lazy" className={`shrink-0 bg-borda object-cover ${className}`} />
  }
  return (
    <div
      aria-hidden
      className={`flex shrink-0 items-center justify-center bg-brasa-clara font-bold text-brasa-forte ${className}`}
    >
      {nome.trim().charAt(0).toUpperCase()}
    </div>
  )
}
