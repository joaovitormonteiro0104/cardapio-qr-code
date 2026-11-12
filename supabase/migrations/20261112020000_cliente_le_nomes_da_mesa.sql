-- Revisão de design de 2026-11-12 ("Minha conta"): na conta dividida, cada
-- pedido mostra quem pediu ("Seu pedido" / "Pedido de Ana"). Para isso o
-- cliente precisa ler as sessões da PRÓPRIA comanda (nome e id de quem está
-- na mesa). Sessões de outras mesas continuam invisíveis.
-- minhas_comandas() é security definer, então não há recursão de RLS aqui.
create policy "cliente le as sessoes da propria comanda" on public.sessoes_mesa
  for select to authenticated
  using (comanda_id in (select public.minhas_comandas()));
