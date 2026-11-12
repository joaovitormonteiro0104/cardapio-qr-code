-- Descrição opcional do item do cardápio (revisão de design de 2026-11-12):
-- o cliente vê o que vem no lanche ("pão brioche, cheddar e bacon").
-- Texto curto, até 200 caracteres. Nulo = sem descrição.
alter table public.itens_cardapio
  add column descricao text check (descricao is null or char_length(descricao) between 1 and 200);

comment on column public.itens_cardapio.descricao is
  'Descrição curta opcional (até 200 caracteres) exibida ao cliente abaixo do nome.';
