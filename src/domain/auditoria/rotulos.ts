// Textos legíveis para a tela de auditoria (gerência). Puro.
// O banco guarda os códigos ("sem_ingrediente"); a tela mostra português.
import { MOTIVO_AUTO_CANCELAMENTO, MOTIVO_CLIENTE_JANELA, MOTIVOS_CANCELAMENTO, ROTULOS_MOTIVO, type MotivoCancelamento } from '../pedido/cancelamento'
import type { TipoEvento } from './evento'

export const ROTULOS_TIPO_EVENTO: Record<TipoEvento, string> = {
  categoria_criada: 'Categoria criada',
  categoria_atualizada: 'Categoria alterada',
  categorias_reordenadas: 'Categorias reordenadas',
  item_cardapio_criado: 'Item do cardápio criado',
  item_cardapio_atualizado: 'Item do cardápio alterado',
  item_cardapio_esgotado: 'Item marcado como esgotado',
  item_cardapio_reativado: 'Item voltou ao cardápio',
  item_cardapio_removido: 'Item do cardápio excluído',
  item_cardapio_restaurado: 'Item do cardápio restaurado',
  comanda_aberta: 'Conta aberta',
  cliente_entrou: 'Cliente entrou na mesa',
  comanda_observacao_editada: 'Observação da conta editada',
  comanda_estado_alterado: 'Situação da conta alterada',
  comanda_fechada: 'Mesa fechada',
  pedido_criado: 'Pedido enviado',
  pedido_estado_alterado: 'Situação do pedido alterada',
  pedido_cancelado: 'Pedido cancelado',
  pedido_cancelamento_solicitado: 'Cancelamento iniciado',
  pedido_cancelamento_desistido: 'Cancelamento desfeito',
  pedido_edicao_solicitada: 'Cliente chamou o garçom para mudar',
  pedido_edicao_aplicada: 'Mudança no pedido aplicada',
  pedido_edicao_negada: 'Mudança no pedido negada',
  item_pedido_quantidade_alterada: 'Quantidade de item alterada',
  item_pedido_removido: 'Item removido do pedido',
  configuracao_alterada: 'Configuração alterada',
  mesa_criada: 'Mesa criada',
  mesa_atualizada: 'Mesa alterada',
  funcionario_criado: 'Funcionário cadastrado',
  funcionario_pin_trocado: 'PIN trocado',
  funcionario_desativado: 'Funcionário desativado',
  funcionario_reativado: 'Funcionário reativado',
  funcionario_papel_alterado: 'Papel do funcionário alterado',
  correcao: 'Correção de evento',
}

/** Rótulo do tipo de evento; código desconhecido aparece sem os "_". */
export function rotuloTipoEvento(tipo: string): string {
  return (ROTULOS_TIPO_EVENTO as Record<string, string>)[tipo] ?? tipo.replace(/_/g, ' ')
}

const ROTULOS_ESTADO: Record<string, string> = {
  AguardandoPagamento: 'Aguardando pagamento',
  EdicaoSolicitada: 'Mudança solicitada',
  CancelamentoPendente: 'Cancelamento pendente',
}

/** Estado de pedido ou comanda em português corrido ("AguardandoPagamento" → "Aguardando pagamento"). */
export function rotuloEstado(estado: string): string {
  return ROTULOS_ESTADO[estado] ?? estado
}

/**
 * Motivo gravado em eventos_auditoria.motivo, legível para a gerência.
 * Diferente do texto para o cliente, aqui o texto livre da cozinha aparece.
 */
export function rotuloMotivo(motivo: string | null): string {
  if (!motivo) return ''
  if (motivo === MOTIVO_CLIENTE_JANELA) return 'Cliente cancelou dentro do prazo livre'
  if (motivo === MOTIVO_AUTO_CANCELAMENTO) return 'Automático: cozinha não aceitou a tempo'
  const separador = motivo.indexOf(':')
  const categoria = (separador === -1 ? motivo : motivo.slice(0, separador)).trim()
  if (!(MOTIVOS_CANCELAMENTO as readonly string[]).includes(categoria)) return motivo
  const rotulo = ROTULOS_MOTIVO[categoria as MotivoCancelamento]
  const texto = separador === -1 ? '' : motivo.slice(separador + 1).trim()
  return texto ? `${rotulo}: ${texto}` : rotulo
}
