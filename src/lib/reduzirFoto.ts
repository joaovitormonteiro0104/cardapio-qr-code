// Reduz a foto escolhida no navegador (canvas), sem biblioteca. A regra de
// tamanho está em domain/cardapio/foto.ts.
import { dimensoesReduzidas } from '@/domain/cardapio/foto'

const QUALIDADE = 0.82

function paraBlob(canvas: HTMLCanvasElement, tipo: string): Promise<Blob | null> {
  return new Promise(resolver => canvas.toBlob(resolver, tipo, QUALIDADE))
}

/**
 * Devolve a foto com o lado maior em até 1200 px, em WebP (ou JPEG se o
 * navegador não gerar WebP). Lança erro se o navegador não conseguir abrir
 * a imagem (ex.: formato HEIC em alguns aparelhos).
 */
export async function reduzirFoto(arquivo: File): Promise<File> {
  const imagem = await createImageBitmap(arquivo)
  const { largura, altura } = dimensoesReduzidas(imagem.width, imagem.height)
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const contexto = canvas.getContext('2d')
  if (!contexto) throw new Error('reduzirFoto: canvas indisponível')
  contexto.drawImage(imagem, 0, 0, largura, altura)
  imagem.close()

  let blob = await paraBlob(canvas, 'image/webp')
  if (!blob || blob.type !== 'image/webp') blob = await paraBlob(canvas, 'image/jpeg')
  if (!blob) throw new Error('reduzirFoto: não foi possível gerar a imagem')
  const extensao = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const nomeBase = arquivo.name.replace(/\.[^.]+$/, '') || 'foto'
  return new File([blob], `${nomeBase}.${extensao}`, { type: blob.type })
}
