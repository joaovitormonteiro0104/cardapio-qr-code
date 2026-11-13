import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface Props {
  texto: string
  /** Texto alternativo para leitores de tela. */
  descricao: string
  tamanho?: number
  className?: string
  /** Texto se o QR não puder ser desenhado. */
  textoFalha?: string
}

/** Desenha um QR Code (lib `qrcode`, decisão 16 de AGENTS.md §15) como imagem PNG. */
export function QrCode({ texto, descricao, tamanho = 240, className = '', textoFalha = 'Não foi possível desenhar o QR Code.' }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    let ativo = true
    setFalhou(false)
    // margin 2 + o respiro do cartão ≈ 4 módulos de margem branca (recomendado pela especificação)
    QRCode.toDataURL(texto, { width: tamanho * 2, margin: 2, errorCorrectionLevel: 'M' })
      .then(gerada => {
        if (ativo) setUrl(gerada)
      })
      .catch((falha: unknown) => {
        console.error('QrCode', falha)
        if (ativo) setFalhou(true)
      })
    return () => {
      ativo = false
    }
  }, [texto, tamanho])

  if (falhou) {
    return (
      <div
        style={{ width: tamanho, height: tamanho }}
        className={`flex items-center justify-center rounded-lg bg-fundo p-4 text-center text-sm text-tinta-suave ${className}`}
      >
        {textoFalha}
      </div>
    )
  }
  return url ? (
    <img src={url} alt={descricao} width={tamanho} height={tamanho} className={`bg-white ${className}`} />
  ) : (
    <div style={{ width: tamanho, height: tamanho }} className={`motion-safe:animate-pulse rounded-lg bg-borda ${className}`} aria-hidden />
  )
}
