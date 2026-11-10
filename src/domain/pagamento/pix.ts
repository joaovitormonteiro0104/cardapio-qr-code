// Payload do Pix estático no padrão BR Code (EMV MPM), montado à mão
// (decisão 16 de AGENTS.md §15). Puro, sem I/O. Referência: Manual de Padrões
// para Iniciação do Pix, do Banco Central.
//
// Cada campo é TLV: ID (2 dígitos) + tamanho (2 dígitos) + valor. O último
// campo (63) é o CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF) de todo
// o texto anterior, incluindo "6304".

export const NOME_MAX = 25
export const CIDADE_MAX = 15
export const TXID_MAX = 25

export interface DadosPix {
  chave: string
  /** 0 ou ausente = sem valor fixo (o pagador digita) */
  valorCentavos?: number
  nome: string
  cidade: string
  /** identificador alfanumérico; vazio vira "***" (sem identificador) */
  txid?: string
}

/** CRC16-CCITT-FALSE, resultado em 4 dígitos hexadecimais maiúsculos. */
export function crc16(texto: string): string {
  let crc = 0xffff
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Tira acentos e caracteres fora do ASCII imprimível (o BR Code pede ASCII). */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
}

function campo(id: string, valor: string): string {
  if (valor.length > 99) throw new Error(`Pix: campo ${id} longo demais`)
  return `${id}${String(valor.length).padStart(2, '0')}${valor}`
}

export class PixInvalidoError extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'PixInvalidoError'
  }
}

/** Formata centavos como "56.30" (ponto decimal, sem milhar). */
export function valorPix(centavos: number): string {
  return `${Math.trunc(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`
}

export function gerarPayloadPix(dados: DadosPix): string {
  const chave = dados.chave.trim()
  const nome = normalizarTexto(dados.nome).slice(0, NOME_MAX)
  const cidade = normalizarTexto(dados.cidade).slice(0, CIDADE_MAX)
  const txid = (dados.txid ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, TXID_MAX) || '***'
  const valor = dados.valorCentavos ?? 0

  if (!chave) throw new PixInvalidoError('Chave Pix não configurada.')
  if (!nome) throw new PixInvalidoError('Nome do estabelecimento não configurado.')
  if (!cidade) throw new PixInvalidoError('Cidade do estabelecimento não configurada.')
  if (!Number.isInteger(valor) || valor < 0) throw new PixInvalidoError('Valor inválido.')

  const contaComerciante = campo('00', 'br.gov.bcb.pix') + campo('01', chave)
  const semCrc =
    campo('00', '01') +
    campo('26', contaComerciante) +
    campo('52', '0000') +
    campo('53', '986') +
    (valor > 0 ? campo('54', valorPix(valor)) : '') +
    campo('58', 'BR') +
    campo('59', nome) +
    campo('60', cidade) +
    campo('62', campo('05', txid)) +
    '6304'
  return semCrc + crc16(semCrc)
}
