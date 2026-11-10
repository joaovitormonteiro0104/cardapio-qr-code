import { describe, expect, it } from 'vitest'
import { motivoNaoPodeDesativar, type FuncionarioRegra } from '@/domain/equipe/regras'

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
