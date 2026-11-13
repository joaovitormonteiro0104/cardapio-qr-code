// Como um evento de auditoria é mostrado (tela e CSV) — revisão de design da
// Auditoria, 2026-11-13. Puro: recebe o payload gravado e devolve texto legível.
import type { AtorTipo, TipoEvento } from './evento'
import { rotuloEstado } from './rotulos'

export interface ResumoEvento {
  mesa: number | null
  conta: number | null
  pedido: number | null
  /** Detalhes em português, sem códigos. */
  texto: string
}

/** Nome legível das chaves de configuração (as mesmas da tela Configurações). */
export const ROTULOS_CHAVE_CONFIG: Record<string, string> = {
  janela_edicao_preparando_min: 'Janela de edição em preparo (min)',
  timeout_auto_cancelamento_min: 'Cancelar pedido não aceito após (min)',
  timeout_sessao_mesa_h: 'Mesa inativa após (h)',
  chave_pix: 'Chave Pix',
  nome_estabelecimento: 'Nome do estabelecimento',
  cidade_estabelecimento: 'Cidade',
  telefone_estabelecimento: 'Telefone',
}

/** Grupos para a lista de tipos do filtro. */
export const GRUPOS_TIPO_EVENTO: { titulo: string; tipos: readonly TipoEvento[] }[] = [
  {
    titulo: 'Pedidos',
    tipos: [
      'pedido_criado',
      'pedido_estado_alterado',
      'pedido_cancelado',
      'pedido_cancelamento_solicitado',
      'pedido_cancelamento_desistido',
      'pedido_edicao_solicitada',
      'pedido_edicao_aplicada',
      'pedido_edicao_negada',
      'item_pedido_quantidade_alterada',
      'item_pedido_removido',
    ],
  },
  { titulo: 'Contas e mesas', tipos: ['comanda_aberta', 'cliente_entrou', 'comanda_observacao_editada', 'comanda_estado_alterado', 'comanda_fechada', 'mesa_criada', 'mesa_atualizada'] },
  {
    titulo: 'Cardápio',
    tipos: [
      'item_cardapio_criado',
      'item_cardapio_atualizado',
      'item_cardapio_esgotado',
      'item_cardapio_reativado',
      'item_cardapio_removido',
      'item_cardapio_restaurado',
      'categoria_criada',
      'categoria_atualizada',
      'categorias_reordenadas',
    ],
  },
  {
    titulo: 'Equipe e configurações',
    tipos: [
      'funcionario_criado',
      'funcionario_pin_trocado',
      'funcionario_desativado',
      'funcionario_reativado',
      'funcionario_papel_alterado',
      'configuracao_alterada',
      'correcao',
    ],
  },
]

const SENSIVEIS = new Set<string>([
  'pedido_cancelado',
  'pedido_cancelamento_solicitado',
  'item_pedido_removido',
  'funcionario_criado',
  'funcionario_pin_trocado',
  'funcionario_desativado',
  'funcionario_reativado',
  'funcionario_papel_alterado',
  'configuracao_alterada',
])

/** Eventos que merecem destaque ao investigar (cancelamentos, equipe, configurações). */
export function eventoSensivel(tipo: string): boolean {
  return SENSIVEIS.has(tipo)
}

type Registro = Record<string, unknown>

const comoRegistro = (v: unknown): Registro => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Registro) : {})
const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const inteiro = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN
  return Number.isInteger(n) ? n : null
}

function reais(centavos: unknown): string | null {
  const n = inteiro(centavos)
  return n === null ? null : (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function itensResumidos(itens: unknown): string | null {
  if (!Array.isArray(itens)) return null
  const partes = itens.map(comoRegistro).flatMap(i => {
    const nome = texto(i.nome)
    return nome ? [`${inteiro(i.quantidade) ?? 1}× ${nome}`] : []
  })
  return partes.length ? partes.join(', ') : null
}

/** Diferenças entre antes/depois de um item do cardápio, em português. */
function mudancasItem(antes: Registro, depois: Registro): string[] {
  const mudancas: string[] = []
  if (antes.nome !== depois.nome && texto(depois.nome)) mudancas.push(`nome: ${String(antes.nome ?? '')} → ${String(depois.nome)}`)
  if (antes.preco_centavos !== depois.preco_centavos && reais(depois.preco_centavos)) {
    mudancas.push(`preço: ${reais(antes.preco_centavos) ?? '?'} → ${reais(depois.preco_centavos)}`)
  }
  if (antes.disponivel !== depois.disponivel && typeof depois.disponivel === 'boolean') {
    mudancas.push(depois.disponivel ? 'voltou a ficar disponível' : 'esgotado')
  }
  if (antes.descricao !== depois.descricao) mudancas.push('descrição alterada')
  if (antes.foto_url !== depois.foto_url) mudancas.push('foto alterada')
  if (antes.categoria_id !== depois.categoria_id) mudancas.push('categoria alterada')
  return mudancas
}

export function resumirEvento(tipo: string, payload: unknown): ResumoEvento {
  const p = comoRegistro(payload)
  const numero = inteiro(p.numero)
  const ehPedido = tipo.startsWith('pedido_') || tipo.startsWith('item_pedido_')
  const ehConta = tipo.startsWith('comanda_')
  const resumo: ResumoEvento = {
    mesa: inteiro(p.mesa) ?? (tipo.startsWith('mesa_') ? numero : null),
    conta: ehConta ? numero : inteiro(p.conta),
    pedido: ehPedido ? numero : null,
    texto: '',
  }
  const partes: string[] = []
  const de = texto(p.de)
  const para = texto(p.para)

  switch (tipo) {
    case 'pedido_criado': {
      const itens = itensResumidos(p.itens)
      if (itens) partes.push(itens)
      const total = reais(p.total_centavos)
      if (total) partes.push(`total ${total}`)
      break
    }
    case 'item_pedido_quantidade_alterada':
      partes.push(`${texto(p.item) ?? 'item'}: ${String(p.de ?? '?')} → ${String(p.para ?? '?')}`)
      break
    case 'item_pedido_removido':
      partes.push(`${inteiro(p.quantidade) ?? 1}× ${texto(p.item) ?? 'item'}`)
      break
    case 'comanda_aberta':
    case 'cliente_entrou':
      if (texto(p.nome)) partes.push(`cliente: ${String(p.nome)}`)
      break
    case 'comanda_observacao_editada':
      partes.push(texto(p.depois) ? `“${String(p.depois)}”` : 'observação apagada')
      break
    case 'configuracao_alterada': {
      const chave = texto(p.chave) ?? ''
      partes.push(`${ROTULOS_CHAVE_CONFIG[chave] ?? chave}: ${String(p.antes ?? '') || '(vazio)'} → ${String(p.depois ?? '') || '(vazio)'}`)
      break
    }
    case 'mesa_atualizada':
      if (typeof p.ativa === 'boolean') partes.push(p.ativa ? 'ativada' : 'desativada')
      break
    case 'item_cardapio_atualizado':
    case 'categoria_atualizada': {
      const antes = comoRegistro(p.antes)
      const depois = comoRegistro(p.depois)
      const nome = texto(depois.nome) ?? texto(antes.nome) ?? texto(p.nome)
      if (nome) partes.push(nome)
      partes.push(...mudancasItem(antes, depois))
      break
    }
    case 'funcionario_papel_alterado':
      partes.push(`${texto(p.matricula) ?? ''} ${texto(p.antes) ? `${rotuloPapel(String(p.antes))} → ` : ''}${rotuloPapel(String(p.depois ?? ''))}`.trim())
      break
    default: {
      if (de && para) partes.push(`${rotuloEstado(de)} → ${rotuloEstado(para)}`)
      const nome = texto(p.nome) ?? texto(p.item)
      if (nome) partes.push(nome)
      const preco = reais(p.preco_centavos)
      if (preco && tipo === 'item_cardapio_criado') partes.push(preco)
      if (texto(p.matricula) && tipo.startsWith('funcionario_')) partes.push(`matrícula ${String(p.matricula)}`)
    }
  }
  resumo.texto = partes.filter(Boolean).join(' · ')
  return resumo
}

function rotuloPapel(papel: string): string {
  return papel === 'gerencia' ? 'Gerência' : papel === 'operacao' ? 'Operação' : papel
}

/**
 * Quem fez: "Ana (004)", "Funcionário 004" (sem nome conhecido), "Cliente
 * Maria" (nome digitado na mesa, quando o evento traz), "Cliente" ou "Sistema".
 */
export function rotuloAtor(
  atorTipo: AtorTipo,
  atorId: string | null,
  nomesFuncionarios: ReadonlyMap<string, string>,
  payload?: unknown,
): string {
  if (atorTipo === 'sistema') return 'Sistema'
  if (atorTipo === 'funcionario') {
    const nome = atorId ? nomesFuncionarios.get(atorId) : undefined
    return nome ? `${nome} (${atorId})` : `Funcionário ${atorId ?? ''}`.trim()
  }
  const nomeCliente = texto(comoRegistro(payload).nome)
  return nomeCliente && atorId ? `Cliente ${nomeCliente}` : 'Cliente'
}
