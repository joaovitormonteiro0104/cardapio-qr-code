-- =============================================================================
-- Roteiro de teste da RLS (item 3). NÃO é migration: o CLI não lê esta pasta.
--
-- Como rodar: cole TUDO no SQL Editor do dashboard e execute. (Diferente das
-- migrations, este arquivo pode ir no SQL Editor: ele não deixa nada gravado.)
--
-- Como funciona:
--   * Cria dados de teste (2 mesas, 2 clientes anônimos, 1 gerente, 3 itens).
--   * Para cada teste, "vira" um usuário: troca o papel do Postgres para
--     authenticated e define o auth.uid() via request.jwt.claims, exatamente
--     como a API do Supabase faz numa requisição real.
--   * No fim, LANÇA UM ERRO DE PROPÓSITO com o relatório. O erro desfaz tudo
--     (inclusive os dados de teste), então o banco fica como estava.
--     Leia o relatório na mensagem de erro: "ERROR: RELATORIO RLS ...".
-- =============================================================================

do $$
declare
  c1    uuid := '00000000-0000-0000-0000-0000000000c1'; -- cliente da mesa 1
  c2    uuid := '00000000-0000-0000-0000-0000000000c2'; -- cliente da mesa 2
  g1    uuid := '00000000-0000-0000-0000-0000000000a1'; -- gerente
  m1    uuid := gen_random_uuid();
  m2    uuid := gen_random_uuid();
  cat   uuid := gen_random_uuid();
  com1  uuid := gen_random_uuid();
  com2  uuid := gen_random_uuid();
  dono  text := current_user;  -- papel original, para voltar depois de cada teste
  n     int;
  u     uuid;
  r     text := E'RELATORIO RLS\n';
begin
  -- 0. Dados de teste (como dono, sem RLS) -----------------------------------
  insert into auth.users (id, aud, role, email, is_anonymous) values
    (c1, 'authenticated', 'authenticated', null, true),
    (c2, 'authenticated', 'authenticated', null, true),
    (g1, 'authenticated', 'authenticated', '999999@restaurante.local', false);
  insert into funcionarios (usuario_id, matricula, nome, papel)
    values (g1, '999999', 'Gerente Teste', 'gerencia');
  -- números altos para não colidir com mesas reais
  insert into mesas (id, numero) values (m1, 9001), (m2, 9002);
  insert into categorias (id, nome) values (cat, 'Teste RLS');
  insert into itens_cardapio (categoria_id, nome, preco_centavos, disponivel, ativo) values
    (cat, 'ativo e disponivel', 1000, true,  true),
    (cat, 'esgotado',           1000, false, true),
    (cat, 'inativo',            1000, true,  false);
  insert into comandas (id, mesa_id) values (com1, m1), (com2, m2);
  insert into sessoes_mesa (usuario_id, comanda_id) values (c1, com1), (c2, com2);
  insert into eventos_auditoria (ator_tipo, tipo_evento) values ('sistema', 'teste_rls');


  -- 1. Cliente anônimo faz UPDATE em itens_cardapio — deve falhar -------------
  -- Sem política de UPDATE, a RLS esconde as linhas: o UPDATE "não acha" nada.
  perform set_config('request.jwt.claims', json_build_object('sub', c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update itens_cardapio set nome = 'hackeado' where categoria_id = cat;
    get diagnostics n = row_count;
    r := r || format(E'1. cliente UPDATE itens_cardapio: %s linha(s) alterada(s) -> %s\n',
                     n, case when n = 0 then 'OK' else 'FALHOU' end);
  exception when others then
    r := r || format(E'1. cliente UPDATE itens_cardapio: bloqueado (%s) -> OK\n', sqlerrm);
  end;
  execute format('set local role %I', dono);


  -- 2. Gerência faz INSERT em itens_cardapio — deve passar --------------------
  perform set_config('request.jwt.claims', json_build_object('sub', g1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into itens_cardapio (categoria_id, nome, preco_centavos)
      values (cat, 'criado pela gerencia', 2500);
    r := r || E'2. gerencia INSERT itens_cardapio: inserido -> OK\n';
  exception when others then
    r := r || format(E'2. gerencia INSERT itens_cardapio: erro (%s) -> FALHOU\n', sqlerrm);
  end;
  execute format('set local role %I', dono);


  -- 3. Cliente anônimo SELECT em itens_cardapio — só ativos e disponíveis -----
  perform set_config('request.jwt.claims', json_build_object('sub', c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from itens_cardapio where categoria_id = cat;
  -- visíveis: 'ativo e disponivel' e 'criado pela gerencia' (padrão ativo+disponível)
  r := r || format(E'3. cliente SELECT itens_cardapio: ve %s de 4 itens (esperado 2) -> %s\n',
                   n, case when n = 2 then 'OK' else 'FALHOU' end);
  execute format('set local role %I', dono);


  -- 4. Cliente da mesa 1 tenta ler a comanda da mesa 2 — deve retornar vazio --
  perform set_config('request.jwt.claims', json_build_object('sub', c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from comandas where id = com2;
  r := r || format(E'4a. cliente mesa 1 le comanda da mesa 2: %s linha(s) (esperado 0) -> %s\n',
                   n, case when n = 0 then 'OK' else 'FALHOU' end);
  select count(*) into n from comandas where id = com1;
  r := r || format(E'4b. cliente mesa 1 le a propria comanda: %s linha(s) (esperado 1) -> %s\n',
                   n, case when n = 1 then 'OK' else 'FALHOU' end);
  select count(*) into n from comandas;
  r := r || format(E'4c. cliente mesa 1 lista todas as comandas: ve %s (esperado 1) -> %s\n',
                   n, case when n = 1 then 'OK' else 'FALHOU' end);
  -- Por design (§6.1): sabendo o número da mesa, descobre SÓ o id dela para entrar.
  select comanda_aberta_da_mesa(9002) into u;
  r := r || format(E'4d. comanda_aberta_da_mesa(mesa 2) devolve o id da comanda dela -> %s\n',
                   case when u = com2 then 'OK (por design)' else 'FALHOU' end);
  execute format('set local role %I', dono);


  -- 5. Qualquer um tenta UPDATE/DELETE em eventos_auditoria — deve falhar -----
  foreach u in array array[c1, g1] loop
    perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      update eventos_auditoria set motivo = 'adulterado';
      r := r || format(E'5. %s UPDATE eventos_auditoria: passou -> FALHOU\n',
                       case when u = c1 then 'cliente' else 'gerencia' end);
    exception when others then
      r := r || format(E'5. %s UPDATE eventos_auditoria: bloqueado (%s) -> OK\n',
                       case when u = c1 then 'cliente' else 'gerencia' end, sqlerrm);
    end;
    begin
      delete from eventos_auditoria;
      r := r || format(E'5. %s DELETE eventos_auditoria: passou -> FALHOU\n',
                       case when u = c1 then 'cliente' else 'gerencia' end);
    exception when others then
      r := r || format(E'5. %s DELETE eventos_auditoria: bloqueado (%s) -> OK\n',
                       case when u = c1 then 'cliente' else 'gerencia' end, sqlerrm);
    end;
    execute format('set local role %I', dono);
  end loop;


  -- Fim: erro proposital = relatório + desfaz TUDO o que foi criado acima.
  raise exception '%', r;
end;
$$;
