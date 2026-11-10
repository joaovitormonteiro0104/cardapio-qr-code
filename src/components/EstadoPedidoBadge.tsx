import type { EstadoPedido } from '@/domain/pedido/estado'

export const ROTULOS_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  Recebido: 'Recebido',
  Preparando: 'Preparando',
  Pronto: 'Pronto',
  Entregue: 'Entregue',
  Finalizado: 'Finalizado',
  Cancelado: 'Cancelado',
  EdicaoSolicitada: 'Garçom chamado',
  CancelamentoPendente: 'Cancelando',
}

export const CORES_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  Recebido: 'bg-info-clara text-info',
  Preparando: 'bg-alerta-clara text-tinta',
  Pronto: 'bg-sucesso-clara text-sucesso',
  Entregue: 'bg-fundo text-tinta-suave',
  Finalizado: 'bg-fundo text-tinta-suave',
  Cancelado: 'bg-perigo-clara text-perigo',
  EdicaoSolicitada: 'bg-brasa-clara text-brasa-forte',
  CancelamentoPendente: 'bg-perigo-clara text-perigo',
}

export function EstadoPedidoBadge({ estado }: { estado: EstadoPedido }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${CORES_ESTADO_PEDIDO[estado]}`}
    >
      {ROTULOS_ESTADO_PEDIDO[estado]}
    </span>
  )
}
