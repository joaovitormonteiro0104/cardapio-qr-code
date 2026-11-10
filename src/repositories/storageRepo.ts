import { supabase } from './supabase'
import { problemaFoto } from '@/domain/cardapio/validacao'

const BUCKET = 'cardapio-fotos'

const EXTENSOES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export class ErroFoto extends Error {
  constructor(readonly motivo: 'tipo' | 'tamanho' | 'envio', mensagem: string) {
    super(mensagem)
    this.name = 'ErroFoto'
  }
}

/**
 * Sobe a foto de um item para o bucket público e devolve a URL pública.
 * Valida tipo (jpeg/png/webp) e tamanho (2 MB) antes de enviar; o bucket
 * também recusa fora desses limites.
 */
export async function uploadFotoItem(arquivo: File): Promise<string> {
  const problema = problemaFoto(arquivo.type, arquivo.size)
  if (problema) throw new ErroFoto(problema, `uploadFotoItem: foto inválida (${problema})`)

  const caminho = `itens/${crypto.randomUUID()}.${EXTENSOES[arquivo.type] ?? 'jpg'}`
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
    contentType: arquivo.type,
    cacheControl: '31536000', // nome único por upload: pode cachear por 1 ano
  })
  if (error) throw new ErroFoto('envio', `uploadFotoItem: ${error.message}`)

  return supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl
}
