import { describe, expect, it } from 'vitest'
import { TIPOS_EVENTO } from '@/domain/auditoria/evento'
// O formato de moeda do navegador usa espaço não separável depois de "R$".
const sem = (t: string) => t.replace(/\u00a0/g, ' ')

import { GRUPOS_TIPO_EVENTO, eventoSensivel, resumirEvento, rotuloAtor } from '@/domain/auditoria/resumo'

describe('resumirEvento', () => {
  it('pedido enviado: itens e total, com mesa e conta quando gravados', () => {
    const r = resumirEvento('pedido_criado', {
      numero: 1248,
      mesa: 7,
      conta: 530,
      total_centavos: 4970,
      itens: [
        { nome: 'X-Burguer', quantidade: 2 },
        { nome: 'Suco', quantidade: 1 },
      ],
    })
    expect(r).toMatchObject({ mesa: 7, conta: 530, pedido: 1248 })
    expect(sem(r.texto)).toBe('2× X-Burguer, 1× Suco · total R$ 49,70')
  })

  it('mudança de estado do pedido', () => {
    expect(resumirEvento('pedido_estado_alterado', { numero: 9, de: 'Preparando', para: 'Pronto' }).texto).toBe('Preparando → Pronto')
  })

  it('conta: número é da conta, estados legíveis', () => {
    const r = resumirEvento('comanda_estado_alterado', { numero: 530, de: 'AguardandoPagamento', para: 'Paga' })
    expect(r).toMatchObject({ conta: 530, pedido: null })
    expect(r.texto).toBe('Aguardando pagamento → Paga')
  })

  it('quantidade alterada mostra o item e os números', () => {
    expect(resumirEvento('item_pedido_quantidade_alterada', { numero: 3, item: 'Coca', de: 2, para: 1 }).texto).toBe('Coca: 2 → 1')
  })

  it('configuração usa o nome legível da chave', () => {
    expect(resumirEvento('configuracao_alterada', { chave: 'cidade_estabelecimento', antes: '', depois: 'S GONCALO AMAR' }).texto).toBe(
      'Cidade: (vazio) → S GONCALO AMAR',
    )
  })

  it('item do cardápio editado lista o que mudou', () => {
    const r = resumirEvento('item_cardapio_atualizado', {
      antes: { nome: 'Coca', preco_centavos: 600, disponivel: true },
      depois: { nome: 'Coca', preco_centavos: 650, disponivel: true },
    })
    expect(sem(r.texto)).toBe('Coca · preço: R$ 6,00 → R$ 6,50')
  })

  it('mesa criada e desativada', () => {
    expect(resumirEvento('mesa_criada', { numero: 12 }).mesa).toBe(12)
    expect(resumirEvento('mesa_atualizada', { numero: 12, ativa: false }).texto).toBe('desativada')
  })
})

describe('rotuloAtor', () => {
  const nomes = new Map([['004', 'Ana']])
  it('funcionário com e sem nome conhecido', () => {
    expect(rotuloAtor('funcionario', '004', nomes)).toBe('Ana (004)')
    expect(rotuloAtor('funcionario', '009', nomes)).toBe('Funcionário 009')
  })
  it('cliente com nome digitado na mesa e sistema', () => {
    expect(rotuloAtor('cliente', 'uuid', nomes, { nome: 'Maria' })).toBe('Cliente Maria')
    expect(rotuloAtor('cliente', 'uuid', nomes, {})).toBe('Cliente')
    expect(rotuloAtor('sistema', null, nomes)).toBe('Sistema')
  })
})

describe('grupos e destaque', () => {
  it('todo tipo de evento está em exatamente um grupo', () => {
    const agrupados = GRUPOS_TIPO_EVENTO.flatMap(g => g.tipos)
    expect([...agrupados].sort()).toEqual([...TIPOS_EVENTO].sort())
  })
  it('cancelamento e equipe são sensíveis; cliente entrando não', () => {
    expect(eventoSensivel('pedido_cancelado')).toBe(true)
    expect(eventoSensivel('funcionario_pin_trocado')).toBe(true)
    expect(eventoSensivel('cliente_entrou')).toBe(false)
  })
})
