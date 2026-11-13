// Ajuda a configurar o Pix sem errar (revisão de design de Configurações,
// 2026-11-13). Puro.
import { CIDADE_MAX, NOME_MAX, normalizarTexto } from './pix'

export type TipoChavePix = 'vazia' | 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | 'desconhecida'

export const ROTULOS_TIPO_CHAVE: Record<TipoChavePix, string> = {
  vazia: 'Sem chave',
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Chave aleatória',
  desconhecida: 'Formato não reconhecido',
}

/** Reconhece o tipo da chave Pix pelo formato (não confere se a chave existe no banco). */
export function tipoChavePix(chave: string): TipoChavePix {
  const c = chave.trim()
  if (!c) return 'vazia'
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return 'aleatoria'
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return 'email'
  if (/^\+55\d{10,11}$/.test(c.replace(/[\s()-]/g, ''))) return 'telefone'
  const digitos = c.replace(/[.\-/\s]/g, '')
  if (/^\d{11}$/.test(digitos)) return 'cpf'
  if (/^\d{14}$/.test(digitos)) return 'cnpj'
  return 'desconhecida'
}

export interface ProntidaoPix {
  pronto: boolean
  /** O que falta, em português ("cidade"). */
  faltando: string[]
  /** Como o recebedor aparece no app do banco do cliente. */
  nomeNoBanco: string
  cidadeNoBanco: string
}

/** O Pix pelo celular só funciona com chave, nome e cidade preenchidos. */
export function prontidaoPix(dados: { chave: string; nome: string; cidade: string }): ProntidaoPix {
  const nomeNoBanco = normalizarTexto(dados.nome).slice(0, NOME_MAX)
  const cidadeNoBanco = normalizarTexto(dados.cidade).slice(0, CIDADE_MAX)
  const faltando = [
    !dados.chave.trim() ? 'chave Pix' : null,
    !nomeNoBanco ? 'nome do estabelecimento' : null,
    !cidadeNoBanco ? 'cidade' : null,
  ].filter((f): f is string => f !== null)
  return { pronto: faltando.length === 0, faltando, nomeNoBanco, cidadeNoBanco }
}
