-- =============================================================================
-- Schema inicial (item 2 do roadmap)
--
-- Regras seguidas (AGENTS.md §3, §6, §8):
--   * snake_case, tabelas no plural, timestamptz (UTC).
--   * Dinheiro sempre em centavos (integer).
--   * Estados como text + check, com os MESMOS valores dos tipos TypeScript.
--   * Nenhuma regra de negócio em trigger. O único trigger aqui só preenche
--     atualizado_em (ver função set_atualizado_em abaixo).
--   * Nada de DELETE no fluxo normal: soft delete por colunas (ativo, ativa,
--     removido_em, encerrada_em). Por isso as FKs usam o padrão (restrict).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Helper: atualizado_em automático
--
-- Por que um trigger aqui: atualizado_em é metadado técnico ("quando esta linha
-- mudou pela última vez"), não regra de negócio. Deixar o banco preencher evita
-- que algum repository esqueça. Ele NÃO decide nada sobre o domínio.
-- (ultima_atividade_em da comanda NÃO é preenchida por trigger: é regra de
-- negócio e fica a cargo dos repositories, §6.4.)
-- -----------------------------------------------------------------------------
create function public.set_atualizado_em() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

comment on function public.set_atualizado_em() is
  'Trigger técnico: preenche atualizado_em em todo UPDATE. Sem regra de negócio.';


-- -----------------------------------------------------------------------------
-- mesas
-- -----------------------------------------------------------------------------
create table public.mesas (
  id            uuid primary key default gen_random_uuid(),
  numero        integer not null unique check (numero > 0),
  ativa         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.mesas is
  'Mesas físicas do estabelecimento. O QR de cada mesa aponta para /mesa/{numero}. Mesa inativa mostra "mesa indisponível" (§6.7).';


-- -----------------------------------------------------------------------------
-- categorias
-- -----------------------------------------------------------------------------
create table public.categorias (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (char_length(nome) between 1 and 60),
  ordem         integer not null default 0,
  ativa         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.categorias is
  'Categorias do cardápio, ordenadas pelo campo ordem (reordenadas pela gerência). Desativar = ativa false (§6.7).';


-- -----------------------------------------------------------------------------
-- itens_cardapio
-- -----------------------------------------------------------------------------
create table public.itens_cardapio (
  id             uuid primary key default gen_random_uuid(),
  categoria_id   uuid not null references public.categorias (id),
  nome           text not null check (char_length(nome) between 1 and 100),
  preco_centavos integer not null check (preco_centavos > 0),
  disponivel     boolean not null default true,  -- false = esgotado (some do cliente)
  ativo          boolean not null default true,  -- false = soft delete
  foto_url       text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index itens_cardapio_categoria_id_idx on public.itens_cardapio (categoria_id);

comment on table public.itens_cardapio is
  'Itens vendáveis. Sem modelo de variação: tamanhos diferentes são itens separados. disponivel controla "esgotado"; ativo é soft delete (§6.7).';


-- -----------------------------------------------------------------------------
-- comandas
-- -----------------------------------------------------------------------------
create table public.comandas (
  id                  uuid primary key default gen_random_uuid(),
  numero              bigint generated always as identity unique,
  mesa_id             uuid not null references public.mesas (id),
  estado              text not null default 'Aberta'
                        check (estado in ('Aberta', 'AguardandoPagamento', 'Paga', 'Fechada')),
  observacao          text,
  ultima_atividade_em timestamptz not null default now(),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

-- Garante UMA comanda não-Fechada por mesa. Se dois celulares abrirem a mesa
-- ao mesmo tempo, o segundo INSERT falha e o app relê e entra na existente (§6.1).
create unique index comandas_uma_aberta_por_mesa
  on public.comandas (mesa_id)
  where estado <> 'Fechada';

create index comandas_mesa_id_idx on public.comandas (mesa_id);
create index comandas_estado_idx  on public.comandas (estado);

comment on table public.comandas is
  'A conta da mesa, do primeiro pedido até o fechamento. Estados: Aberta → AguardandoPagamento → Paga → Fechada (§6.4). Número sequencial global.';


-- -----------------------------------------------------------------------------
-- sessoes_mesa
-- -----------------------------------------------------------------------------
create table public.sessoes_mesa (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references auth.users (id) on delete cascade,
  comanda_id   uuid not null references public.comandas (id),
  nome_cliente text check (nome_cliente is null or char_length(nome_cliente) between 1 and 40),
  criado_em    timestamptz not null default now(),
  encerrada_em timestamptz,
  unique (usuario_id, comanda_id)
);

create index sessoes_mesa_comanda_id_idx on public.sessoes_mesa (comanda_id);

comment on table public.sessoes_mesa is
  'Vínculo cliente anônimo (auth.uid) ↔ comanda. É o que a RLS usa para saber de qual comanda o cliente é (§6.1). encerrada_em é preenchida ao fechar a mesa. on delete cascade: se o usuário anônimo for limpo do Auth, o vínculo some junto (a comanda e a auditoria permanecem).';


-- -----------------------------------------------------------------------------
-- pedidos
-- -----------------------------------------------------------------------------
create table public.pedidos (
  id              uuid primary key default gen_random_uuid(),
  numero          bigint generated always as identity unique,
  comanda_id      uuid not null references public.comandas (id),
  estado          text not null default 'Recebido'
                    check (estado in (
                      'Recebido', 'Preparando', 'Pronto', 'Entregue', 'Finalizado',
                      'Cancelado', 'EdicaoSolicitada', 'CancelamentoPendente'
                    )),
  -- Só preenchido nos estados temporários: guarda para onde o pedido volta.
  estado_anterior text
                    check (estado_anterior in ('Recebido', 'Preparando', 'Pronto')),
  estado_desde    timestamptz not null default now(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),

  -- Integridade do dado (não regra de negócio): estado_anterior existe se, e
  -- somente se, o pedido está num estado temporário (§6.3).
  constraint pedidos_estado_anterior_so_em_temporario check (
    (estado in ('EdicaoSolicitada', 'CancelamentoPendente')) = (estado_anterior is not null)
  )
);

create index pedidos_comanda_id_idx on public.pedidos (comanda_id);
create index pedidos_estado_idx     on public.pedidos (estado);

comment on table public.pedidos is
  'Cada envio de itens ("rodada") de uma comanda. O estado de preparo vive aqui (8 estados, §6.3). estado_desde mede janela de edição e auto-cancelamento. Número sequencial global.';


-- -----------------------------------------------------------------------------
-- itens_pedido
-- -----------------------------------------------------------------------------
create table public.itens_pedido (
  id                      uuid primary key default gen_random_uuid(),
  pedido_id               uuid not null references public.pedidos (id),
  item_cardapio_id        uuid not null references public.itens_cardapio (id),
  quantidade              integer not null check (quantidade > 0),
  preco_centavos_snapshot integer not null check (preco_centavos_snapshot > 0),
  removido_em             timestamptz,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);

create index itens_pedido_pedido_id_idx        on public.itens_pedido (pedido_id);
create index itens_pedido_item_cardapio_id_idx on public.itens_pedido (item_cardapio_id);

comment on table public.itens_pedido is
  'Linhas de um pedido. preco_centavos_snapshot congela o preço do momento do envio. Remover item = preencher removido_em, nunca DELETE (§6.2).';


-- -----------------------------------------------------------------------------
-- funcionarios
-- -----------------------------------------------------------------------------
create table public.funcionarios (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null unique references auth.users (id),
  matricula     text not null unique check (matricula ~ '^[0-9]{1,6}$'),
  nome          text not null check (char_length(nome) between 1 and 80),
  papel         text not null check (papel in ('operacao', 'gerencia')),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.funcionarios is
  'Equipe. Liga o usuário do Supabase Auth (email sintético {matricula}@restaurante.local) a matrícula, nome e papel. É a fonte do papel usada por papel_atual() na RLS; ativo false bloqueia na hora (§6.9).';


-- -----------------------------------------------------------------------------
-- configuracoes
-- -----------------------------------------------------------------------------
create table public.configuracoes (
  chave          text primary key,
  valor          text not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por text
);

comment on table public.configuracoes is
  'Configurações runtime editadas pela gerência (§10). Chave natural como PK. Valores em text; a conversão/validação de tipo é feita com Zod no app.';


-- -----------------------------------------------------------------------------
-- eventos_auditoria
-- -----------------------------------------------------------------------------
create table public.eventos_auditoria (
  id          uuid primary key default gen_random_uuid(),
  comanda_id  uuid references public.comandas (id),
  pedido_id   uuid references public.pedidos (id),
  ator_tipo   text not null check (ator_tipo in ('cliente', 'funcionario', 'sistema')),
  ator_id     text,
  tipo_evento text not null check (char_length(tipo_evento) > 0),
  payload     jsonb not null default '{}'::jsonb,
  motivo      text,
  criado_em   timestamptz not null default now()
);

create index eventos_auditoria_criado_em_idx  on public.eventos_auditoria (criado_em);
create index eventos_auditoria_comanda_id_idx on public.eventos_auditoria (comanda_id);
create index eventos_auditoria_pedido_id_idx  on public.eventos_auditoria (pedido_id);

comment on table public.eventos_auditoria is
  'Log append-only de toda modificação (§6.10). Nunca UPDATE nem DELETE; correções são novos eventos com payload.corrige_id. Retenção de 1 ano.';


-- -----------------------------------------------------------------------------
-- Triggers de atualizado_em (eventos_auditoria não tem: é append-only)
-- -----------------------------------------------------------------------------
create trigger mesas_atualizado_em          before update on public.mesas          for each row execute function public.set_atualizado_em();
create trigger categorias_atualizado_em     before update on public.categorias     for each row execute function public.set_atualizado_em();
create trigger itens_cardapio_atualizado_em before update on public.itens_cardapio for each row execute function public.set_atualizado_em();
create trigger comandas_atualizado_em       before update on public.comandas       for each row execute function public.set_atualizado_em();
create trigger pedidos_atualizado_em        before update on public.pedidos        for each row execute function public.set_atualizado_em();
create trigger itens_pedido_atualizado_em   before update on public.itens_pedido   for each row execute function public.set_atualizado_em();
create trigger funcionarios_atualizado_em   before update on public.funcionarios   for each row execute function public.set_atualizado_em();
create trigger configuracoes_atualizado_em  before update on public.configuracoes  for each row execute function public.set_atualizado_em();


-- -----------------------------------------------------------------------------
-- RLS ligada já, SEM políticas (= ninguém via API acessa nada).
--
-- Por quê agora e não só no item 3: no Supabase, tabela em "public" sem RLS
-- fica aberta para qualquer um com a anon key (que é pública). Ligar aqui
-- fecha essa janela entre o item 2 e o item 3. As políticas de §7 entram no
-- item 3; repetir "enable row level security" lá é inofensivo.
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
