-- =============================================================================
-- Motivo do cancelamento no próprio pedido (itens 9 e 10)
--
-- O cancelamento pela cozinha tem 2 etapas (§6.6). Se o tablet fechar entre
-- elas, o card precisa mostrar o motivo escolhido na 1ª etapa, e a operação
-- não lê eventos_auditoria (só a gerência). Por isso o motivo fica no pedido.
-- A auditoria continua recebendo o motivo em cada evento.
-- Formato: "<motivo da lista>" ou "<motivo>: <texto livre>" (ver
-- motivoParaRegistro em src/domain/pedido/cancelamento.ts).
-- =============================================================================
alter table public.pedidos
  add column cancelamento_motivo text
    check (cancelamento_motivo is null or char_length(cancelamento_motivo) between 1 and 330);

comment on column public.pedidos.cancelamento_motivo is
  'Motivo do cancelamento (pendente ou concluído). null se o pedido não está sendo/foi cancelado.';
