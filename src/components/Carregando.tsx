export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center p-6 text-tinta-suave">
      <span className="mr-3 size-5 animate-spin rounded-full border-2 border-borda border-t-brasa" aria-hidden />
      {texto}
    </div>
  )
}
