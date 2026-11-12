import { describe, expect, it } from 'vitest'
import { motivoNaoPodeDesativar, motivoNaoPodeMudarPapel, type FuncionarioRegra } from '@/domain/equipe/regras'

const f = (id: string, papel: FuncionarioRegra['papel'], ativo = true): FuncionarioRegra => ({
  id,
  usuarioId: `u-${id}`,
  papel,
  ativo,
})

describe('motivoNaoPodeDesativar', () => {
  const gerenteA = f('a', 'gerencia')
  const gerenteB = f('b', 'gerencia')
  const cozinha = f('c', 'operacao')

  it('gerente desativa funcionário de operação', () => {
    expect(motivoNaoPodeDesativar(cozinha, 'u-a', [gerenteA, cozinha])).toBeNull()
  })

  it('gerente não desativa a si mesmo', () => {
    expect(motivoNaoPodeDesativar(gerenteA, 'u-a', [gerenteA, gerenteB])).toBe('si_mesmo')
  })

  it('desativa outro gerente quando sobra pelo menos um', () => {
    expect(motivoNaoPodeDesativar(gerenteB, 'u-a', [gerenteA, gerenteB])).toBeNull()
  })

  it('não desativa o último gerente ativo', () => {
    const inativo = f('x', 'gerencia', false)
    // solicitante hipotético que não é o alvo (ex.: sessão antiga): a regra protege mesmo assim
    expect(motivoNaoPodeDesativar(gerenteA, 'u-outro', [gerenteA, inativo, cozinha])).toBe('ultimo_gerente')
  })

  it('já inativo', () => {
    expect(motivoNaoPodeDesativar(f('c', 'operacao', false), 'u-a', [gerenteA])).toBe('ja_inativo')
  })
})

describe('motivoNaoPodeMudarPapel', () => {
  const g1 = { id: 'g1', usuarioId: 'u-g1', papel: 'gerencia' as const, ativo: true }
  const g2 = { id: 'g2', usuarioId: 'u-g2', papel: 'gerencia' as const, ativo: true }
  const op = { id: 'op', usuarioId: 'u-op', papel: 'operacao' as const, ativo: true }
  const inativo = { id: 'x', usuarioId: 'u-x', papel: 'operacao' as const, ativo: false }

  it('promove operação a gerência', () => {
    expect(motivoNaoPodeMudarPapel(op, 'gerencia', 'u-g1', [g1, op])).toBeNull()
  })

  it('rebaixa outro gerente quando sobra um', () => {
    expect(motivoNaoPodeMudarPapel(g2, 'operacao', 'u-g1', [g1, g2])).toBeNull()
  })

  it('não rebaixa a si mesmo', () => {
    expect(motivoNaoPodeMudarPapel(g1, 'operacao', 'u-g1', [g1, g2])).toBe('si_mesmo')
  })

  it('não rebaixa o último gerente', () => {
    expect(motivoNaoPodeMudarPapel(g2, 'operacao', 'u-g1', [{ ...g1, ativo: false }, g2])).toBe('ultimo_gerente')
  })

  it('recusa inativo e papel igual', () => {
    expect(motivoNaoPodeMudarPapel(inativo, 'gerencia', 'u-g1', [g1, inativo])).toBe('inativo')
    expect(motivoNaoPodeMudarPapel(op, 'operacao', 'u-g1', [g1, op])).toBe('mesmo_papel')
  })
})
