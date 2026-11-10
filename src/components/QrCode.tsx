import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface Props {
  texto: string
  /** Texto alternativo para leitores de tela. */
  descricao: string
  tamanho?: number
  className?: string
}

/** Desenha um QR Code (lib `qrcode`, decisão 16 de AGENTS.md §15) como imagem PNG. */
export function QrCode({ texto, descricao, tamanho = 240, className = '' }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    QRCode.toDataURL(texto, { width: tamanho * 2, margin: 1, errorCorrectionLevel: 'M' })
      .then(gerada => {
        if (ativo) setUrl(gerada)
      })
      .catch((falha: unknown) => console.error('QrCode', falha))
    return () => {
      ativo = false
    }
  }, [texto, tamanho])

  return url ? (
    <img src={url} alt={descricao} width={tamanho} height={tamanho} className={`bg-white ${className}`} />
  ) : (
    <div style={{ width: tamanho, height: tamanho }} className={`animate-pulse rounded-lg bg-borda ${className}`} aria-hidden />
  )
}
