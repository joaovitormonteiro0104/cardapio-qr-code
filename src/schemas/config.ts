import { z } from 'zod'

// Configurações runtime (AGENTS.md §10). No banco tudo é text; aqui cada chave
// tem o seu validador, que converte o texto para o tipo certo.

const inteiro = (minimo: number, mensagem: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, 'Use só números inteiros.')
    .transform(Number)
    .pipe(z.number().int().min(minimo, mensagem))

export const VALIDADORES_CONFIG = {
  janela_edicao_preparando_min: inteiro(0, 'Use 0 ou mais minutos.'),
  timeout_auto_cancelamento_min: inteiro(1, 'Use pelo menos 1 minuto.'),
  timeout_sessao_mesa_h: inteiro(1, 'Use pelo menos 1 hora.'),
  chave_pix: z.string().trim().max(77, 'Chave Pix longa demais.'),
  nome_estabelecimento: z.string().trim().max(25, 'Use até 25 caracteres (limite do Pix).'),
  cidade_estabelecimento: z.string().trim().max(15, 'Use até 15 caracteres (limite do Pix).'),
  telefone_estabelecimento: z
    .string()
    .trim()
    .max(20, 'Telefone longo demais.')
    .regex(/^[\d\s()+-]*$/, 'Use só números, espaços, parênteses, + e -.'),
} as const

export type ChaveConfig = keyof typeof VALIDADORES_CONFIG
export const CHAVES_CONFIG = Object.keys(VALIDADORES_CONFIG) as ChaveConfig[]

export interface Configs {
  janelaEdicaoPreparandoMin: number
  timeoutAutoCancelamentoMin: number
  timeoutSessaoMesaH: number
  chavePix: string
  nomeEstabelecimento: string
  cidadeEstabelecimento: string
  telefoneEstabelecimento: string
}

/**
 * Converte as linhas (chave, valor) da tabela em Configs tipadas.
 * Lança erro se faltar chave ou algum valor for inválido.
 */
export function parseConfigs(linhas: readonly { chave: string; valor: string }[]): Configs {
  const mapa = new Map(linhas.map(l => [l.chave, l.valor]))
  const ler = <K extends ChaveConfig>(chave: K): z.output<(typeof VALIDADORES_CONFIG)[K]> => {
    const valor = mapa.get(chave)
    if (valor === undefined) throw new Error(`Configuração ausente: ${chave}`)
    const resultado = VALIDADORES_CONFIG[chave].safeParse(valor)
    if (!resultado.success) throw new Error(`Configuração inválida: ${chave}`)
    return resultado.data as z.output<(typeof VALIDADORES_CONFIG)[K]>
  }
  return {
    janelaEdicaoPreparandoMin: ler('janela_edicao_preparando_min'),
    timeoutAutoCancelamentoMin: ler('timeout_auto_cancelamento_min'),
    timeoutSessaoMesaH: ler('timeout_sessao_mesa_h'),
    chavePix: ler('chave_pix'),
    nomeEstabelecimento: ler('nome_estabelecimento'),
    cidadeEstabelecimento: ler('cidade_estabelecimento'),
    telefoneEstabelecimento: ler('telefone_estabelecimento'),
  }
}
