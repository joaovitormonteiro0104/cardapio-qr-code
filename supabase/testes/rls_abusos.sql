-- =============================================================================
-- Teste de abusos via API (revisão de 2026-11-12, migration rls_endurecimento).
-- NÃO é migration. Como o rls_roteiro.sql, termina com um erro proposital que
-- mostra o relatório e DESFAZ tudo: o banco fica como estava.
--
--   npx supabase db query --remote --yes -f supabase/testes/rls_abusos.sql
--
-- Parte A: o que um cliente/funcionário NÃO pode fazer chamando a API direto.
-- Parte B: os fluxos normais do app, que precisam continuar funcionando.
-- Todo item deve terminar em "-> OK".
-- =============================================================================

do $$
declare
  c1   uuid := '00000000-0000-0000-0000-0000000000c1'; -- cliente da mesa 9001
  c2   uuid := '00000000-0000-0000-0000-0000000000c2'; -- cliente que nunca entrou
  op   uuid := '00000000-0000-0000-0000-0000000000b1'; -- operação (matrícula 999998)
  m1   uuid := gen_random_uuid();
  m9   uuid := gen_random_uuid(); -- mesa inativa
  cat  uuid := gen_random_uuid();
  it   uuid := gen_random_uuid();
  com1 uuid := gen_random_uuid();
  velha uuid := gen_random_uuid(); -- conta já Fechada da mesma mesa
  pRec uuid := gen_random_uuid(); -- pedido Recebido
  pEnt uuid := gen_random_uuid(); -- pedido Entregue
  pPrep uuid := gen_random_uuid(); -- pedido Preparando
  ipRec uuid := gen_random_uuid();
  ipEnt uuid := gen_random_uuid();
  novo uuid;
  dono text := current_user;
  n    int;
  r    text := E'RELATORIO ABUSOS\n';

begin
  -- 0. Dados de teste (como dono, sem RLS) -----------------------------------
  insert into auth.users (id, aud, role, email, is_anonymous) values
    (c1, 'authenticated', 'authenticated', null, true),
    (c2, 'authenticated', 'authenticated', null, true),
    (op, 'authenticated', 'authenticated', '999998@restaurante.local', false);
  insert into funcionarios (usuario_id, matricula, nome, papel) values (op, '999998', 'Op Teste', 'operacao');
  insert into mesas (id, numero, ativa) values (m1, 9001, true), (m9, 9009, false);
  insert into categorias (id, nome) values (cat, 'Teste abusos');
  insert into itens_cardapio (id, categoria_id, nome, preco_centavos) values (it, cat, 'Item teste', 5000);
  insert into comandas (id, mesa_id, estado) values (velha, m1, 'Fechada');
  insert into comandas (id, mesa_id) values (com1, m1);
  insert into sessoes_mesa (usuario_id, comanda_id) values (c1, com1);
  insert into pedidos (id, comanda_id, estado) values (pRec, com1, 'Recebido'), (pEnt, com1, 'Entregue'), (pPrep, com1, 'Preparando');
  insert into itens_pedido (id, pedido_id, item_cardapio_id, nome_snapshot, quantidade, preco_centavos_snapshot) values
    (ipRec, pRec, it, 'Item teste', 1, 5000),
    (ipEnt, pEnt, it, 'Item teste', 1, 5000);

  -- ===================== PARTE A: abusos (devem falhar) =====================
  perform set_config('request.jwt.claims', json_build_object('sub', c1, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  set local role authenticated;

  begin update itens_pedido set preco_centavos_snapshot = 1 where id = ipRec;
    r := r || E'A1 cliente muda preço de item pedido: aceito -> FALHOU\n';
  exception when others then r := r || E'A1 cliente muda preço de item pedido: bloqueado -> OK\n'; end;

  begin insert into itens_pedido (pedido_id, item_cardapio_id, nome_snapshot, quantidade, preco_centavos_snapshot)
      values (pRec, it, 'Item teste', 10, 1);
    r := r || E'A2 cliente insere item a 1 centavo: aceito -> FALHOU\n';
  exception when others then r := r || E'A2 cliente insere item a 1 centavo: bloqueado -> OK\n'; end;

  begin insert into itens_pedido (pedido_id, item_cardapio_id, nome_snapshot, quantidade, preco_centavos_snapshot)
      values (pRec, it, 'Outro nome', 1, 5000);
    r := r || E'A2b cliente insere item com nome trocado: aceito -> FALHOU\n';
  exception when others then r := r || E'A2b cliente insere item com nome trocado: bloqueado -> OK\n'; end;

  begin update pedidos set estado = 'Cancelado' where id = pEnt; get diagnostics n = row_count;
    r := r || format(E'A3 cliente cancela pedido Entregue: %s linha -> %s\n', n, case when n = 0 then 'OK' else 'FALHOU' end);
  exception when others then r := r || E'A3 cliente cancela pedido Entregue: bloqueado -> OK\n'; end;

  begin update comandas set estado = 'Paga' where id = com1; get diagnostics n = row_count;
    r := r || format(E'A4 cliente marca conta como Paga: %s linha -> %s\n', n, case when n = 0 then 'OK' else 'FALHOU' end);
  exception when others then r := r || E'A4 cliente marca conta como Paga: bloqueado -> OK\n'; end;

  begin insert into eventos_auditoria (ator_tipo, ator_id, tipo_evento) values ('funcionario', '001', 'comanda_fechada');
    r := r || E'A5 cliente grava evento como funcionário: aceito -> FALHOU\n';
  exception when others then r := r || E'A5 cliente grava evento como funcionário: bloqueado -> OK\n'; end;

  begin insert into eventos_auditoria (ator_tipo, tipo_evento) values ('sistema', 'pedido_cancelado');
    r := r || E'A5b cliente grava evento como sistema: aceito -> FALHOU\n';
  exception when others then r := r || E'A5b cliente grava evento como sistema: bloqueado -> OK\n'; end;

  begin insert into eventos_auditoria (ator_tipo, ator_id, tipo_evento) values ('cliente', c2::text, 'pedido_criado');
    r := r || E'A5c cliente grava evento como outro cliente: aceito -> FALHOU\n';
  exception when others then r := r || E'A5c cliente grava evento como outro cliente: bloqueado -> OK\n'; end;

  begin insert into pedidos (comanda_id, estado) values (com1, 'Entregue');
    r := r || E'A6 cliente cria pedido já Entregue: aceito -> FALHOU\n';
  exception when others then r := r || E'A6 cliente cria pedido já Entregue: bloqueado -> OK\n'; end;

  begin insert into pedidos (comanda_id, criado_por) values (com1, c2);
    r := r || E'A6b cliente cria pedido em nome de outro: aceito -> FALHOU\n';
  exception when others then r := r || E'A6b cliente cria pedido em nome de outro: bloqueado -> OK\n'; end;

  begin update itens_pedido set quantidade = 99 where id = ipEnt; get diagnostics n = row_count;
    r := r || format(E'A7 cliente muda quantidade de pedido Entregue: %s linha -> %s\n', n, case when n = 0 then 'OK' else 'FALHOU' end);
  exception when others then r := r || E'A7 cliente muda quantidade de pedido Entregue: bloqueado -> OK\n'; end;

  begin insert into comandas (mesa_id) values (m9);
    r := r || E'A8 cliente abre conta em mesa inativa: aceito -> FALHOU\n';
  exception when others then r := r || E'A8 cliente abre conta em mesa inativa: bloqueado -> OK\n'; end;

  begin update pedidos set comanda_id = velha where id = pRec;
    r := r || E'A9 cliente move pedido para outra conta: aceito -> FALHOU\n';
  exception when others then r := r || E'A9 cliente move pedido para outra conta: bloqueado -> OK\n'; end;

  execute format('set local role %I', dono);

  -- cliente novo tentando se ligar à conta Fechada
  perform set_config('request.jwt.claims', json_build_object('sub', c2, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  set local role authenticated;
  begin insert into sessoes_mesa (usuario_id, comanda_id) values (c2, velha);
    r := r || E'A10 cliente se liga a conta Fechada: aceito -> FALHOU\n';
  exception when others then r := r || E'A10 cliente se liga a conta Fechada: bloqueado -> OK\n'; end;
  execute format('set local role %I', dono);

  -- operação
  perform set_config('request.jwt.claims', json_build_object('sub', op, 'role', 'authenticated', 'email', '999998@restaurante.local')::text, true);
  set local role authenticated;
  begin update itens_pedido set preco_centavos_snapshot = 1 where id = ipRec;
    r := r || E'A11 operação muda preço de item pedido: aceito -> FALHOU\n';
  exception when others then r := r || E'A11 operação muda preço de item pedido: bloqueado -> OK\n'; end;
  begin insert into eventos_auditoria (ator_tipo, ator_id, tipo_evento) values ('funcionario', '001', 'comanda_fechada');
    r := r || E'A12 operação grava evento em nome de outro funcionário: aceito -> FALHOU\n';
  exception when others then r := r || E'A12 operação grava evento em nome de outro: bloqueado -> OK\n'; end;
  execute format('set local role %I', dono);

  -- ================ PARTE B: fluxos do app (devem funcionar) ================
  -- Cliente que acabou de escanear: abre conta? (a mesa já tem uma aberta, então
  -- o índice único recusa; testamos em outra mesa ativa)
  perform set_config('request.jwt.claims', json_build_object('sub', c2, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  set local role authenticated;
  begin
    novo := gen_random_uuid();
    execute format('set local role %I', dono);
    insert into mesas (numero, ativa) values (9002, true);
    set local role authenticated;
    insert into comandas (id, mesa_id) select novo, id from mesas where numero = 9002;
    insert into sessoes_mesa (usuario_id, comanda_id, nome_cliente) values (c2, novo, 'Ana');
    r := r || E'B1 cliente abre conta e se vincula: ok -> OK\n';
  exception when others then r := r || format(E'B1 cliente abre conta e se vincula: erro (%s) -> FALHOU\n', sqlerrm); end;
  execute format('set local role %I', dono);

  perform set_config('request.jwt.claims', json_build_object('sub', c1, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  set local role authenticated;
  begin
    novo := gen_random_uuid();
    insert into pedidos (id, comanda_id, criado_por) values (novo, com1, c1);
    insert into itens_pedido (pedido_id, item_cardapio_id, nome_snapshot, quantidade, preco_centavos_snapshot)
      values (novo, it, 'Item teste', 2, 5000);
    insert into eventos_auditoria (ator_tipo, ator_id, tipo_evento, comanda_id, pedido_id)
      values ('cliente', c1::text, 'pedido_criado', com1, novo);
    r := r || E'B2 cliente envia pedido com preço certo + evento: ok -> OK\n';
  exception when others then r := r || format(E'B2 cliente envia pedido: erro (%s) -> FALHOU\n', sqlerrm); end;

  begin update itens_pedido set quantidade = 3 where id = ipRec; get diagnostics n = row_count;
    r := r || format(E'B3 cliente muda quantidade em Recebido: %s linha -> %s\n', n, case when n = 1 then 'OK' else 'FALHOU' end);
  exception when others then r := r || format(E'B3 cliente muda quantidade: erro (%s) -> FALHOU\n', sqlerrm); end;

  begin update pedidos set estado = 'EdicaoSolicitada', estado_anterior = 'Preparando', estado_desde = now() where id = pPrep;
    get diagnostics n = row_count;
    r := r || format(E'B4 cliente chama garçom (Preparando): %s linha -> %s\n', n, case when n = 1 then 'OK' else 'FALHOU' end);
  exception when others then r := r || format(E'B4 cliente chama garçom: erro (%s) -> FALHOU\n', sqlerrm); end;

  begin update pedidos set estado = 'Cancelado', estado_desde = now(), cancelamento_motivo = 'cliente_janela_livre' where id = pRec;
    get diagnostics n = row_count;
    r := r || format(E'B5 cliente cancela pedido Recebido: %s linha -> %s\n', n, case when n = 1 then 'OK' else 'FALHOU' end);
  exception when others then r := r || format(E'B5 cliente cancela: erro (%s) -> FALHOU\n', sqlerrm); end;

  begin update comandas set observacao = 'sem cebola', ultima_atividade_em = now() where id = com1;
    update comandas set estado = 'AguardandoPagamento' where id = com1 and estado = 'Aberta';
    get diagnostics n = row_count;
    r := r || format(E'B6 cliente edita observação e avisa "já paguei": %s linha -> %s\n', n, case when n = 1 then 'OK' else 'FALHOU' end);
  exception when others then r := r || format(E'B6 cliente já paguei: erro (%s) -> FALHOU\n', sqlerrm); end;
  execute format('set local role %I', dono);

  -- operação: cozinha e caixa
  perform set_config('request.jwt.claims', json_build_object('sub', op, 'role', 'authenticated', 'email', '999998@restaurante.local')::text, true);
  set local role authenticated;
  begin
    update itens_pedido set quantidade = 1 where pedido_id = pPrep;
    update pedidos set estado = 'Preparando', estado_anterior = null, estado_desde = now() where id = pPrep and estado = 'EdicaoSolicitada';
    update pedidos set estado = 'Pronto', estado_desde = now() where id = pPrep;
    update pedidos set estado = 'Entregue', estado_desde = now() where id = pPrep;
    insert into eventos_auditoria (ator_tipo, ator_id, tipo_evento, pedido_id) values ('funcionario', '999998', 'pedido_estado_alterado', pPrep);
    r := r || E'B7 cozinha resolve edição e avança até Entregue + evento: ok -> OK\n';
  exception when others then r := r || format(E'B7 cozinha: erro (%s) -> FALHOU\n', sqlerrm); end;

  begin
    update comandas set estado = 'Paga', ultima_atividade_em = now() where id = com1 and estado = 'AguardandoPagamento';
    get diagnostics n = row_count;
    update pedidos set estado = 'Finalizado', estado_desde = now() where comanda_id = com1 and estado = 'Entregue';
    update comandas set estado = 'Fechada' where id = com1 and estado = 'Paga';
    update sessoes_mesa set encerrada_em = now() where comanda_id = com1 and encerrada_em is null;
    insert into eventos_auditoria (ator_tipo, tipo_evento, comanda_id) values ('sistema', 'comanda_fechada', com1);
    r := r || format(E'B8 caixa marca paga, fecha mesa, encerra sessões + evento sistema: %s -> %s\n', n, case when n = 1 then 'OK' else 'FALHOU' end);
  exception when others then r := r || format(E'B8 caixa: erro (%s) -> FALHOU\n', sqlerrm); end;
  execute format('set local role %I', dono);

  -- Nomes da mesa: o cliente vê as sessões da própria conta, nunca de outra
  perform set_config('request.jwt.claims', json_build_object('sub', c1, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  set local role authenticated;
  select count(*) into n from sessoes_mesa where comanda_id <> com1;
  r := r || format(E'A13 cliente lê sessões de outra conta: %s linhas -> %s
', n, case when n = 0 then 'OK' else 'FALHOU' end);
  execute format('set local role %I', dono);

  -- O CLI corta mensagens longas: resumo primeiro, depois só as falhas.
  raise exception E'RESUMO: % OK, % FALHOU\n%',
    (length(r) - length(replace(r, '-> OK', ''))) / 5,
    (length(r) - length(replace(r, '-> FALHOU', ''))) / 9,
    (select coalesce(string_agg(linha, E'\n'), '(nenhuma falha)')
       from unnest(string_to_array(r, E'\n')) linha where linha like '%FALHOU%');
end $$;
