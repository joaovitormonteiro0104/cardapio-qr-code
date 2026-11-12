// Como a conta da mesa é apresentada ao cliente (revisão de design de
// "Minha conta", 2026-11-12). Puro.
import type { EstadoPedido } from './estado'

/**
 * Quem pediu, para a conta dividida: "Seu pedido", "Pedido de Ana" ou
 * "Pedido de outra pessoa" (entrou sem nome). Pedido sem autor gravado
 * (feito pela equipe) vira "Pedido da mesa".
 */
export function rotuloAutor(
  criadoPor: string | null,
  usuarioAtual: string | null,
  nomes: ReadonlyMap<string, string | null>,
): string {
  if (!criadoPor) return 'Pedido da mesa'
  if (criadoPor === usuarioAtual) return 'Seu pedido'
  const nome = nomes.get(criadoPor)?.trim()
  return nome ? `Pedido de ${nome}` : 'Pedido de outra pessoa'
}

const ENCERRADOS: readonly EstadoPedido[] = ['Entregue', 'Finalizado', 'Cancelado']

/** Separa os pedidos em andamento (ficam abertos) dos já servidos/cancelados (ficam recolhidos). */
export function separarPedidos<T extends { estado: EstadoPedido }>(pedidos: readonly T[]): { andamento: T[]; encerrados: T[] } {
  return {
    andamento: pedidos.filter(p => !ENCERRADOS.includes(p.estado)),
    encerrados: pedidos.filter(p => ENCERRADOS.includes(p.estado)),
  }
}
