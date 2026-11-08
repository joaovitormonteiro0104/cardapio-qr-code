CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  senha_hash TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

CREATE TABLE categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE CHECK (length(nome) BETWEEN 2 AND 40),
  ordem INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE pratos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  nome TEXT NOT NULL CHECK (length(nome) BETWEEN 2 AND 80),
  descricao TEXT CHECK (descricao IS NULL OR length(descricao) <= 300),
  preco_centavos INTEGER NOT NULL CHECK (preco_centavos > 0),
  disponivel INTEGER NOT NULL DEFAULT 1 CHECK (disponivel IN (0, 1)),  -- 0 = acabou hoje (temporário)
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),            -- 0 = removido do cardápio
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (categoria_id, nome)
) STRICT;

CREATE TABLE mesas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero INTEGER NOT NULL UNIQUE CHECK (numero > 0),
  ativa INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1))
) STRICT;

CREATE TABLE pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mesa_id INTEGER NOT NULL REFERENCES mesas(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'recebido'
    CHECK (status IN ('recebido', 'preparando', 'pronto', 'entregue', 'cancelado')),
  total_centavos INTEGER NOT NULL CHECK (total_centavos > 0),
  pago INTEGER NOT NULL DEFAULT 0 CHECK (pago IN (0, 1)),
  pago_em TEXT,
  motivo_cancelamento TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
  -- cancelado exige motivo
  CHECK (status <> 'cancelado' OR length(trim(motivo_cancelamento)) > 0),
  -- só pedido entregue pode ser pago
  CHECK (pago = 0 OR status = 'entregue'),
  -- pago e pago_em andam juntos
  CHECK ((pago = 0 AND pago_em IS NULL) OR (pago = 1 AND pago_em IS NOT NULL))
) STRICT;

CREATE TABLE itens_pedido (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE RESTRICT,
  prato_id INTEGER NOT NULL REFERENCES pratos(id) ON DELETE RESTRICT,
  nome_prato TEXT NOT NULL,                       -- cópia do nome no momento do pedido
  quantidade INTEGER NOT NULL CHECK (quantidade BETWEEN 1 AND 20),
  preco_unitario_centavos INTEGER NOT NULL CHECK (preco_unitario_centavos > 0),
  observacao TEXT CHECK (observacao IS NULL OR length(observacao) <= 140)
) STRICT;

-- O SQLite NÃO cria índices automáticos para chaves estrangeiras.
CREATE INDEX idx_pratos_categoria ON pratos(categoria_id);
CREATE INDEX idx_pedidos_mesa ON pedidos(mesa_id);
CREATE INDEX idx_pedidos_status_criado ON pedidos(status, criado_em);
CREATE INDEX idx_pedidos_pago_em ON pedidos(pago_em);
CREATE INDEX idx_itens_pedido ON itens_pedido(pedido_id);
CREATE INDEX idx_itens_prato ON itens_pedido(prato_id);
