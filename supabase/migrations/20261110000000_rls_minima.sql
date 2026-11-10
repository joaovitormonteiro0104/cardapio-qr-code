-- =============================================================================
-- RLS mínima (item 3 do roadmap, AGENTS.md §7)
--
-- Só AUTORIZAÇÃO: quem pode ler/escrever quais linhas. Nenhuma regra de
-- negócio (janela de edição, transições de estado etc. ficam em src/domain).
--
-- Papéis do Postgres no Supabase:
--   anon          = requisição SEM login (nenhuma política aqui é para ele)
--   authenticated = qualquer usuário logado, INCLUSIVE o cliente anônimo
--                   (signInAnonymously gera um usuário "authenticated")
-- Por isso todas as políticas são "to authenticated".
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Funções auxiliares de identidade
--
-- Por que SECURITY DEFINER: a função roda com as permissões de quem a criou
-- (o dono do schema), e não de quem chama. Sem isso, a política de comandas
-- chamaria minhas_comandas(), que lê sessoes_mesa, que tem RLS própria, que
-- por sua vez poderia chamar funções que leem outras tabelas com RLS... e o
-- Postgres entraria em recursão ou negaria a leitura. Como definer, a função
-- lê funcionarios/sessoes_mesa direto, mas SEMPRE filtrando por auth.uid(),
-- então só devolve dados do próprio usuário.
--
-- "set search_path = public" impede que alguém "sequestre" nomes de tabela
-- criando objetos em outro schema (ponto clássico de ataque em funções definer).
-- -----------------------------------------------------------------------------

-- papel do funcionário logado, ou null se não for funcionário ativo
create function public.papel_atual() returns text
language sql stable security definer set search_path = public as $$
  select papel from funcionarios where usuario_id = auth.uid() and ativo
$$;

-- comandas às quais o usuário (cliente anônimo) está vinculado
create function public.minhas_comandas() returns setof uuid
language sql stable security definer set search_path = public as $$
  select comanda_id from sessoes_mesa where usuario_id = auth.uid()
$$;

comment on function public.papel_atual() is
  'Papel (operacao|gerencia) do funcionário logado e ativo; null para os demais. Usada pela RLS.';
comment on function public.minhas_comandas() is
  'IDs das comandas às quais o usuário logado está vinculado via sessoes_mesa. Usada pela RLS.';

-- id da comanda não-Fechada de uma mesa ativa, ou null.
--
-- Por que existe (decisão de 2026-11-10, acrescentada ao §7): a política de
-- SELECT em comandas só mostra comandas às quais o cliente JÁ está vinculado.
-- Quem escaneia a mesa pela primeira vez precisaria descobrir a comanda aberta
-- para entrar nela (§6.1). Esta função devolve SÓ o id da comanda daquela mesa
-- (não lista as outras mesas). Mesmo risco já aceito no §6.1: quem sabe o
-- número da mesa entra na comanda dela.
-- O filtro "estado <> 'Fechada'" é o mesmo do índice comandas_uma_aberta_por_mesa.
create function public.comanda_aberta_da_mesa(numero_mesa integer) returns uuid
language sql stable security definer set search_path = public as $$
  select c.id
  from comandas c
  join mesas m on m.id = c.mesa_id
  where m.numero = numero_mesa and m.ativa and c.estado <> 'Fechada'
$$;

comment on function public.comanda_aberta_da_mesa(integer) is
  'Id da comanda não-Fechada da mesa (ativa) informada, ou null. Permite ao cliente entrar na comanda existente da mesa (§6.1).';

-- Só usuários logados chamam (inclusive via /rest/v1/rpc). Nada para "anon".
revoke execute on function public.papel_atual()                     from public, anon;
revoke execute on function public.minhas_comandas()                 from public, anon;
revoke execute on function public.comanda_aberta_da_mesa(integer)   from public, anon;
grant  execute on function public.papel_atual()                     to authenticated;
grant  execute on function public.minhas_comandas()                 to authenticated;
grant  execute on function public.comanda_aberta_da_mesa(integer)   to authenticated;


-- -----------------------------------------------------------------------------
-- RLS ligada em todas as tabelas (já estava desde o item 2; repetir é inofensivo)
-- -----------------------------------------------------------------------------
alter table public.mesas             enable row level security;
alter table public.categorias        enable row level security;
alter table public.itens_cardapio    enable row level security;
alter table public.comandas          enable row level security;
alter table public.sessoes_mesa      enable row level security;
alter table public.pedidos           enable row level security;
alter table public.itens_pedido      enable row level security;
alter table public.funcionarios      enable row level security;
alter table public.configuracoes     enable row level security;
alter table public.eventos_auditoria enable row level security;


-- =============================================================================
-- Todos os usuários autenticados (inclusive cliente anônimo)
-- =============================================================================
create policy "autenticado le itens ativos e disponiveis" on public.itens_cardapio
  for select to authenticated using (ativo and disponivel);

create policy "autenticado le categorias ativas" on public.categorias
  for select to authenticated using (ativa);

create policy "autenticado le mesas ativas" on public.mesas
  for select to authenticated using (ativa);

create policy "autenticado le configuracoes" on public.configuracoes
  for select to authenticated using (true);

create policy "autenticado registra evento de auditoria" on public.eventos_auditoria
  for insert to authenticated with check (true);


-- =============================================================================
-- Cliente (vínculo em sessoes_mesa)
-- =============================================================================
create policy "cliente le as proprias sessoes" on public.sessoes_mesa
  for select to authenticated using (usuario_id = auth.uid());

create policy "cliente cria a propria sessao" on public.sessoes_mesa
  for insert to authenticated with check (usuario_id = auth.uid());

create policy "cliente abre comanda" on public.comandas
  for insert to authenticated with check (true);

create policy "cliente le a propria comanda" on public.comandas
  for select to authenticated using (id in (select public.minhas_comandas()));

create policy "cliente atualiza a propria comanda" on public.comandas
  for update to authenticated
  using      (id in (select public.minhas_comandas()))
  with check (id in (select public.minhas_comandas()));

create policy "cliente le pedidos da propria comanda" on public.pedidos
  for select to authenticated using (comanda_id in (select public.minhas_comandas()));

create policy "cliente cria pedido na propria comanda" on public.pedidos
  for insert to authenticated with check (comanda_id in (select public.minhas_comandas()));

create policy "cliente atualiza pedido da propria comanda" on public.pedidos
  for update to authenticated
  using      (comanda_id in (select public.minhas_comandas()))
  with check (comanda_id in (select public.minhas_comandas()));

-- itens_pedido não tem comanda_id: chega na comanda pelo pedido.
create policy "cliente le itens da propria comanda" on public.itens_pedido
  for select to authenticated using (
    pedido_id in (select id from public.pedidos where comanda_id in (select public.minhas_comandas()))
  );

create policy "cliente cria itens na propria comanda" on public.itens_pedido
  for insert to authenticated with check (
    pedido_id in (select id from public.pedidos where comanda_id in (select public.minhas_comandas()))
  );

create policy "cliente atualiza itens da propria comanda" on public.itens_pedido
  for update to authenticated
  using (
    pedido_id in (select id from public.pedidos where comanda_id in (select public.minhas_comandas()))
  )
  with check (
    pedido_id in (select id from public.pedidos where comanda_id in (select public.minhas_comandas()))
  );


-- =============================================================================
-- Operação (operacao ou gerencia)
-- =============================================================================
create policy "operacao le todas as comandas" on public.comandas
  for select to authenticated using (public.papel_atual() in ('operacao', 'gerencia'));

create policy "operacao atualiza comandas" on public.comandas
  for update to authenticated
  using      (public.papel_atual() in ('operacao', 'gerencia'))
  with check (public.papel_atual() in ('operacao', 'gerencia'));

create policy "operacao le todos os pedidos" on public.pedidos
  for select to authenticated using (public.papel_atual() in ('operacao', 'gerencia'));

create policy "operacao atualiza pedidos" on public.pedidos
  for update to authenticated
  using      (public.papel_atual() in ('operacao', 'gerencia'))
  with check (public.papel_atual() in ('operacao', 'gerencia'));

create policy "operacao le todos os itens de pedido" on public.itens_pedido
  for select to authenticated using (public.papel_atual() in ('operacao', 'gerencia'));

create policy "operacao atualiza itens de pedido" on public.itens_pedido
  for update to authenticated
  using      (public.papel_atual() in ('operacao', 'gerencia'))
  with check (public.papel_atual() in ('operacao', 'gerencia'));

create policy "operacao le todas as sessoes" on public.sessoes_mesa
  for select to authenticated using (public.papel_atual() in ('operacao', 'gerencia'));

-- Inclusive indisponíveis/inativos, para exibir pedidos antigos.
create policy "operacao le todo o cardapio" on public.itens_cardapio
  for select to authenticated using (public.papel_atual() in ('operacao', 'gerencia'));

create policy "operacao le todas as categorias" on public.categorias
  for select to authenticated using (public.papel_atual() in ('operacao', 'gerencia'));

-- Inclusive inativas: se uma mesa for desativada com comanda aberta, a cozinha
-- continua vendo o número dela (decisão de 2026-11-10, acrescentada ao §7).
create policy "operacao le todas as mesas" on public.mesas
  for select to authenticated using (public.papel_atual() in ('operacao', 'gerencia'));


-- =============================================================================
-- Gerência
-- =============================================================================

-- CRUD de itens_cardapio
create policy "gerencia cria itens do cardapio" on public.itens_cardapio
  for insert to authenticated with check (public.papel_atual() = 'gerencia');
create policy "gerencia atualiza itens do cardapio" on public.itens_cardapio
  for update to authenticated
  using (public.papel_atual() = 'gerencia') with check (public.papel_atual() = 'gerencia');
create policy "gerencia apaga itens do cardapio" on public.itens_cardapio
  for delete to authenticated using (public.papel_atual() = 'gerencia');
-- (SELECT da gerência já está coberto por "operacao le todo o cardapio".)

-- CRUD de categorias
create policy "gerencia cria categorias" on public.categorias
  for insert to authenticated with check (public.papel_atual() = 'gerencia');
create policy "gerencia atualiza categorias" on public.categorias
  for update to authenticated
  using (public.papel_atual() = 'gerencia') with check (public.papel_atual() = 'gerencia');
create policy "gerencia apaga categorias" on public.categorias
  for delete to authenticated using (public.papel_atual() = 'gerencia');

-- CRUD de mesas (SELECT da gerência já coberto por "operacao le todas as mesas")
create policy "gerencia cria mesas" on public.mesas
  for insert to authenticated with check (public.papel_atual() = 'gerencia');
create policy "gerencia atualiza mesas" on public.mesas
  for update to authenticated
  using (public.papel_atual() = 'gerencia') with check (public.papel_atual() = 'gerencia');
create policy "gerencia apaga mesas" on public.mesas
  for delete to authenticated using (public.papel_atual() = 'gerencia');

-- CRUD de configuracoes (SELECT já liberado para todos os autenticados)
create policy "gerencia cria configuracoes" on public.configuracoes
  for insert to authenticated with check (public.papel_atual() = 'gerencia');
create policy "gerencia atualiza configuracoes" on public.configuracoes
  for update to authenticated
  using (public.papel_atual() = 'gerencia') with check (public.papel_atual() = 'gerencia');
create policy "gerencia apaga configuracoes" on public.configuracoes
  for delete to authenticated using (public.papel_atual() = 'gerencia');

-- funcionarios: só leitura (escrita é pela Edge Function "equipe", item 14)
create policy "gerencia le funcionarios" on public.funcionarios
  for select to authenticated using (public.papel_atual() = 'gerencia');

create policy "gerencia le auditoria" on public.eventos_auditoria
  for select to authenticated using (public.papel_atual() = 'gerencia');


-- =============================================================================
-- Ninguém: UPDATE/DELETE em eventos_auditoria; DELETE em comandas, pedidos,
-- itens_pedido. Já está garantido por NÃO haver política para isso. Abaixo,
-- uma segunda trava: tirar o próprio privilégio da tabela (TRUNCATE inclusive,
-- que a RLS não cobre).
-- =============================================================================
revoke update, delete, truncate on public.eventos_auditoria from anon, authenticated;
revoke delete, truncate on public.comandas     from anon, authenticated;
revoke delete, truncate on public.pedidos      from anon, authenticated;
revoke delete, truncate on public.itens_pedido from anon, authenticated;


-- =============================================================================
-- Storage: bucket cardapio-fotos
--
-- Leitura pública não precisa de política: bucket "public" serve a URL pública
-- direto. As políticas abaixo controlam a API de storage (listar/subir/trocar/
-- remover), liberada só para gerência. SELECT entra porque o upload com
-- upsert precisa ler o objeto existente.
-- =============================================================================
create policy "gerencia le fotos do cardapio" on storage.objects
  for select to authenticated
  using (bucket_id = 'cardapio-fotos' and public.papel_atual() = 'gerencia');

create policy "gerencia sobe fotos do cardapio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cardapio-fotos' and public.papel_atual() = 'gerencia');

create policy "gerencia troca fotos do cardapio" on storage.objects
  for update to authenticated
  using      (bucket_id = 'cardapio-fotos' and public.papel_atual() = 'gerencia')
  with check (bucket_id = 'cardapio-fotos' and public.papel_atual() = 'gerencia');

create policy "gerencia remove fotos do cardapio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cardapio-fotos' and public.papel_atual() = 'gerencia');
