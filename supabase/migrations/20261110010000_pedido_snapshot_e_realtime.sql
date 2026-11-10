-- =============================================================================
-- Item 6: ajustes para o fluxo do cliente
-- =============================================================================

-- Nome do item congelado no envio, como o preço (§6.2). Sem isso o cliente não
-- conseguiria mostrar o nome de um item que ficou esgotado/inativo depois do
-- pedido (a RLS só deixa o cliente ler itens ativos e disponíveis), e uma
-- renomeação mudaria o histórico. (Tabela vazia: o NOT NULL é seguro.)
alter table public.itens_pedido
  add column nome_snapshot text not null
    check (char_length(nome_snapshot) between 1 and 100);

comment on column public.itens_pedido.nome_snapshot is
  'Nome do item do cardápio no momento do envio (congelado, como preco_centavos_snapshot).';

-- Quem enviou o pedido (celular/cliente anônimo). A cozinha cruza com
-- sessoes_mesa para mostrar o nome opcional do cliente (PRD CLI-07).
alter table public.pedidos
  add column criado_por uuid references auth.users (id) on delete set null;

comment on column public.pedidos.criado_por is
  'auth.uid() de quem enviou o pedido. Cruza com sessoes_mesa.nome_cliente para exibir o nome.';

-- Realtime: cliente e cozinha recebem mudanças sem recarregar (PRD CLI-05, OPE-02).
-- O Realtime respeita a RLS: cada um só recebe as linhas que pode ler.
alter publication supabase_realtime add table public.comandas, public.pedidos, public.itens_pedido;
