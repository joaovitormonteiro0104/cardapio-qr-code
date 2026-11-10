import { describe, expect, it } from 'vitest'
import { VALIDADORES_CONFIG, parseConfigs } from '@/schemas/config'

const LINHAS_PADRAO = [
  { chave: 'janela_edicao_preparando_min', valor: '2' },
  { chave: 'timeout_auto_cancelamento_min', valor: '15' },
  { chave: 'timeout_sessao_mesa_h', valor: '4' },
  { chave: 'chave_pix', valor: '' },
  { chave: 'nome_estabelecimento', valor: '' },
  { chave: 'cidade_estabelecimento', valor: '' },
  { chave: 'telefone_estabelecimento', valor: '' },
]

describe('parseConfigs', () => {
  it('converte os defaults do seed', () => {
    expect(parseConfigs(LINHAS_PADRAO)).toEqual({
      janelaEdicaoPreparandoMin: 2,
      timeoutAutoCancelamentoMin: 15,
      timeoutSessaoMesaH: 4,
      chavePix: '',
      nomeEstabelecimento: '',
      cidadeEstabelecimento: '',
      telefoneEstabelecimento: '',
    })
  })

  it('lança erro se faltar chave', () => {
    expect(() => parseConfigs(LINHAS_PADRAO.slice(1))).toThrow('janela_edicao_preparando_min')
  })

  it('lança erro com valor inválido', () => {
    const linhas = LINHAS_PADRAO.map(l => (l.chave === 'timeout_sessao_mesa_h' ? { ...l, valor: 'x' } : l))
    expect(() => parseConfigs(linhas)).toThrow('timeout_sessao_mesa_h')
  })
})

describe('VALIDADORES_CONFIG', () => {
  it('janela aceita 0, timeouts não', () => {
    expect(VALIDADORES_CONFIG.janela_edicao_preparando_min.safeParse('0').success).toBe(true)
    expect(VALIDADORES_CONFIG.timeout_auto_cancelamento_min.safeParse('0').success).toBe(false)
    expect(VALIDADORES_CONFIG.timeout_sessao_mesa_h.safeParse('0').success).toBe(false)
  })

  it('números negativos, decimais e texto são rejeitados', () => {
    for (const valor of ['-1', '2.5', 'dois', '']) {
      expect(VALIDADORES_CONFIG.timeout_auto_cancelamento_min.safeParse(valor).success).toBe(false)
    }
  })

  it('nome até 25 e cidade até 15 (limites do BR Code)', () => {
    expect(VALIDADORES_CONFIG.nome_estabelecimento.safeParse('a'.repeat(25)).success).toBe(true)
    expect(VALIDADORES_CONFIG.nome_estabelecimento.safeParse('a'.repeat(26)).success).toBe(false)
    expect(VALIDADORES_CONFIG.cidade_estabelecimento.safeParse('a'.repeat(15)).success).toBe(true)
    expect(VALIDADORES_CONFIG.cidade_estabelecimento.safeParse('a'.repeat(16)).success).toBe(false)
  })

  it('telefone aceita formatos comuns', () => {
    expect(VALIDADORES_CONFIG.telefone_estabelecimento.safeParse('(85) 99999-0000').success).toBe(true)
    expect(VALIDADORES_CONFIG.telefone_estabelecimento.safeParse('ligue já').success).toBe(false)
  })
})
