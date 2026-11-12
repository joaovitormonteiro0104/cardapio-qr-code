-- =============================================================================
-- Endurecimento da RLS (revisão de 2026-11-12, decisão 19 do AGENTS.md §15).
--
-- A revisão mostrou que, chamando a API direto (sem passar pelas telas), um
-- cliente conseguia: mudar o preço de item já pedido, inserir item a R$ 0,01,
-- cancelar pedido já entregue, marcar a própria conta como "Paga" e gravar
-- auditoria em nome de funcionário. Esta migration fecha essas brechas.
--
-- EXCEÇÃO CONSCIENTE ao "nada de regra de negócio na RLS" (§3/§7): as travas
-- abaixo são listas simples de estados e uma igualdade de preço. A regra
-- completa (transições válidas, janela de edição) continua em src/domain/*;
-- aqui fica só o mínimo para o banco não aceitar dinheiro errado.
-- =============================================================================


-- 1. Colunas que podem ser alteradas por UPDATE ------------------------------
-- Privilégio por coluna vale para todos os usuários logados (cliente e
-- equipe). Preço, nome e item de um pedido nunca mudam depois de gravados.

revoke update on public.itens_pedido from anon, authenticated;
grant  update (quantidade, removido_em) on public.itens_pedido to authenticated;

revoke update on public.pedidos from anon, authenticated;
grant  update (estado, estado_anterior, estado_desde, cancelamento_motivo) on public.pedidos to authenticated;

revoke update on public.comandas from anon, authenticated;
grant  update (estado, observacao, ultima_atividade_em) on public.comandas to authenticated;

revoke update on public.sessoes_mesa from anon, authenticated;
grant  update (encerrada_em) on public.sessoes_mesa to authenticated;


-- 2. Função auxiliar: a comanda existe e não está Fechada? --------------------
-- security definer porque o cliente ainda não enxerga a comanda antes de
-- criar o vínculo (sessoes_mesa). Só consulta identidade/estado, sem regra.
create function public.comanda_nao_fechada(id_comanda uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from comandas where id = id_comanda and estado <> 'Fechada')
$$;

comment on function public.comanda_nao_fechada(uuid) is
  'true se a comanda existe e não está Fechada. Usada pela RLS de sessoes_mesa: impede religar a uma conta já fechada.';

revoke execute on function public.comanda_nao_fechada(uuid) from public, anon;
grant  execute on function public.comanda_nao_fechada(uuid) to authenticated;


-- 3. Cliente: sessões ---------------------------------------------------------
-- Só se vincula a conta que ainda não foi fechada.
alter policy "cliente cria a propria sessao" on public.sessoes_mesa
  with check (usuario_id = (select auth.uid()) and public.comanda_nao_fechada(comanda_id));


-- 4. Cliente: comandas --------------------------------------------------------
-- Abre conta só em estado Aberta e só em mesa ativa (o cliente só enxerga
-- mesas ativas, então o exists já filtra).
alter policy "cliente abre comanda" on public.comandas
  with check (estado = 'Aberta' and exists (select 1 from public.mesas m where m.id = mesa_id));

-- Cliente só mexe na conta enquanto ela está Aberta ou AguardandoPagamento,
-- e só pode deixá-la num desses dois estados ("Paga" é do caixa).
alter policy "cliente atualiza a propria comanda" on public.comandas
  using      (id in (select public.minhas_comandas()) and estado in ('Aberta', 'AguardandoPagamento'))
  with check (id in (select public.minhas_comandas()) and estado in ('Aberta', 'AguardandoPagamento'));


-- 5. Cliente: pedidos ---------------------------------------------------------
-- Pedido novo nasce em Recebido, numa conta Aberta, em nome de quem envia.
alter policy "cliente cria pedido na propria comanda" on public.pedidos
  with check (
    comanda_id in (select public.minhas_comandas())
    and estado = 'Recebido'
    and estado_anterior is null
    and (criado_por is null or criado_por = (select auth.uid()))
    and exists (select 1 from public.comandas c where c.id = comanda_id and c.estado = 'Aberta')
  );

-- Cliente só toca pedido que a cozinha ainda não entregou, e só pode levá-lo
-- a estados que ele próprio usa (cancelar na janela, chamar garçom).
alter policy "cliente atualiza pedido da propria comanda" on public.pedidos
  using (
    comanda_id in (select public.minhas_comandas())
    and estado in ('Recebido', 'Preparando', 'Pronto')
  )
  with check (
    comanda_id in (select public.minhas_comandas())
    and estado in ('Recebido', 'Preparando', 'Pronto', 'Cancelado', 'EdicaoSolicitada')
  );


-- 6. Cliente: itens do pedido -------------------------------------------------
-- Item novo: pedido da própria conta ainda em Recebido, e preço/nome IGUAIS
-- aos do cardápio agora (o cliente só enxerga itens ativos e disponíveis).
alter policy "cliente cria itens na propria comanda" on public.itens_pedido
  with check (
    pedido_id in (
      select id from public.pedidos
      where comanda_id in (select public.minhas_comandas()) and estado = 'Recebido'
    )
    and exists (
      select 1 from public.itens_cardapio c
      where c.id = item_cardapio_id
        and c.preco_centavos = preco_centavos_snapshot
        and c.nome = nome_snapshot
    )
  );

-- Editar/remover item: só enquanto o pedido está em Recebido ou Preparando
-- (o prazo exato da janela continua em src/domain/pedido/edicao.ts).
alter policy "cliente atualiza itens da propria comanda" on public.itens_pedido
  using (
    pedido_id in (
      select id from public.pedidos
      where comanda_id in (select public.minhas_comandas()) and estado in ('Recebido', 'Preparando')
    )
  )
  with check (
    pedido_id in (
      select id from public.pedidos
      where comanda_id in (select public.minhas_comandas()) and estado in ('Recebido', 'Preparando')
    )
  );


-- 7. Auditoria: ninguém grava em nome de outro --------------------------------
--  * funcionario: só funcionário ativo, e ator_id = a própria matrícula
--    (a matrícula é a parte antes do @ do email sintético)
--  * cliente: ator_id = o próprio auth.uid()
--  * sistema: só tablets da equipe (rotinas automáticas, §6.11)
-- A Edge Function "equipe" grava com a service_role e não passa pela RLS.
alter policy "autenticado registra evento de auditoria" on public.eventos_auditoria
  with check (
    (ator_tipo = 'funcionario'
      and public.papel_atual() is not null
      and ator_id = split_part((select auth.jwt()) ->> 'email', '@', 1))
    or (ator_tipo = 'cliente' and ator_id = (select auth.uid())::text)
    or (ator_tipo = 'sistema' and public.papel_atual() is not null)
  );
