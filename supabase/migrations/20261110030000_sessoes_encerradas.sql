-- =============================================================================
-- Fechar mesa encerra as sessões dos clientes (§6.4, pendência C decidida em
-- 2026-11-10: "encerrar e bloquear")
--
-- 1. Operação pode preencher sessoes_mesa.encerrada_em ao fechar a mesa.
-- 2. minhas_comandas() ignora sessões encerradas: depois do fechamento, a RLS
--    corta o acesso do celular à comanda antiga (antes só o app bloqueava).
-- Continua sendo só identidade/autorização, sem regra de negócio.
-- =============================================================================

create policy "operacao encerra sessoes" on public.sessoes_mesa
  for update to authenticated
  using      (public.papel_atual() in ('operacao', 'gerencia'))
  with check (public.papel_atual() in ('operacao', 'gerencia'));

-- Mesmo nome, mesma assinatura: só acrescenta "and encerrada_em is null".
create or replace function public.minhas_comandas() returns setof uuid
language sql stable security definer set search_path = public as $$
  select comanda_id from sessoes_mesa where usuario_id = auth.uid() and encerrada_em is null
$$;

comment on function public.minhas_comandas() is
  'IDs das comandas às quais o usuário logado está vinculado por sessão NÃO encerrada. Usada pela RLS.';
