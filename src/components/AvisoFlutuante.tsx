import { useEffect } from 'react'

export interface Aviso {
  tipo: 'ok' | 'erro'
  texto: string
  /** Botão opcional no aviso, ex.: "Desfazer". */
  acao?: { rotulo: string; aoClicar: () => void }
}

const DURACAO_MS = 5000
const DURACAO_COM_ACAO_MS = 8000

/**
 * Resultado de uma ação da equipe, flutuando embaixo da tela (não empurra o
 * layout e aparece mesmo com a página rolada). Some sozinho em 5 s.
 */
export function AvisoFlutuante({ aviso, aoSumir }: { aviso: Aviso | null; aoSumir: () => void }) {
  useEffect(() => {
    if (!aviso) return
    // Com "Desfazer", fica um pouco mais na tela.
    const id = setTimeout(aoSumir, aviso.acao ? DURACAO_COM_ACAO_MS : DURACAO_MS)
    return () => clearTimeout(id)
  }, [aviso, aoSumir])

  if (!aviso) return null
  return (
    <div
      role={aviso.tipo === 'erro' ? 'alert' : 'status'}
      className={`fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl px-4 py-3 text-base font-medium shadow-lg ring-1 ${
        aviso.tipo === 'erro' ? 'bg-perigo-clara text-perigo ring-perigo/30' : 'bg-sucesso-clara text-sucesso ring-sucesso/30'
      }`}
    >
      <span>{aviso.texto}</span>
      {aviso.acao && (
        <button
          type="button"
          className="botao-secundario min-h-11 shrink-0 text-sm"
          onClick={() => {
            aviso.acao?.aoClicar()
            aoSumir()
          }}
        >
          {aviso.acao.rotulo}
        </button>
      )}
    </div>
  )
}

/** Faixa larga de "sem conexão" das telas da equipe: os dados podem estar velhos. */
export function FaixaSemConexao({ assunto }: { assunto: string }) {
  return (
    <p role="alert" className="mb-4 rounded-xl bg-perigo px-4 py-3 text-base font-semibold text-white">
      Sem conexão: {assunto} podem estar desatualizados. Reconectando…
    </p>
  )
}
