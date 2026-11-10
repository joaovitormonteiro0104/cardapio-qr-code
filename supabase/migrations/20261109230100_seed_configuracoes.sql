-- =============================================================================
-- Seed das configurações runtime (AGENTS.md §10)
--
-- Este é o ÚNICO lugar onde os defaults existem. O app lê da tabela; nunca
-- hardcode esses valores no código. A gerência edita em /gerencia/config.
--
-- "on conflict do nothing": se a migration rodar de novo num banco que já tem
-- valores editados pela gerência, eles NÃO são sobrescritos.
-- =============================================================================

insert into public.configuracoes (chave, valor, atualizado_por) values
  ('janela_edicao_preparando_min',  '2',  'seed'),
  ('timeout_auto_cancelamento_min', '15', 'seed'),
  ('timeout_sessao_mesa_h',         '4',  'seed'),
  ('chave_pix',                     '',   'seed'),
  ('nome_estabelecimento',          '',   'seed'),
  ('cidade_estabelecimento',        '',   'seed'),
  ('telefone_estabelecimento',      '',   'seed')
on conflict (chave) do nothing;
