-- =============================================================================
-- Performance das políticas de sessoes_mesa (aviso do advisor 0003
-- auth_rls_initplan)
--
-- "auth.uid()" solto na política é recalculado para CADA linha. Dentro de
-- "(select auth.uid())" o Postgres calcula uma vez por consulta e reaproveita.
-- O resultado é o mesmo; só fica mais rápido.
-- =============================================================================

alter policy "cliente le as proprias sessoes" on public.sessoes_mesa
  using (usuario_id = (select auth.uid()));

alter policy "cliente cria a propria sessao" on public.sessoes_mesa
  with check (usuario_id = (select auth.uid()));
