# Cardápio Digital — Contexto do projeto para assistentes de IA

Este arquivo é a fonte de verdade do projeto. Leia-o inteiro antes de sugerir ou gerar código.
Se um pedido do desenvolvedor contradizer este arquivo, aponte a contradição e pergunte antes de seguir.

## Informações do documento

| Campo | Valor |
| --- | --- |
| Projeto | Cardápio Digital (pedidos por QR Code na mesa) |
| Versão deste arquivo | 2.1 |
| Última atualização | 2026-11-08 |
| Equipe | 3 desenvolvedores (Parte 1, Parte 2, Parte 3 — ver seção 7) |
| Responsável pela Parte 1 | _preencher_ |
| Responsável pela Parte 2 | _preencher_ |
| Responsável pela Parte 3 | _preencher_ |
| Repositório | _preencher com a URL do GitHub_ |
| Duração prevista | 5 semanas |
| Arquivo para o Claude Code | `CLAUDE.md` na raiz contendo apenas a linha `@AGENTS.md` |
| Documentação para pessoas | `README.md` (visão geral e como rodar; aponta para este arquivo) |

Este arquivo muda por Pull Request, como qualquer código. Toda alteração atualiza a versão,
a data acima e o histórico da seção 13.

## Índice

| Seção | Tema | Consulte quando for... |
| --- | --- | --- |
| 1 | O que é o projeto | Entender o objetivo e o público |
| 2 | Stack | Escolher bibliotecas ou ferramentas |
| 3 | Estrutura de pastas | Criar um arquivo ou decidir onde colocar código; scripts do `package.json` |
| 4 | Banco de dados | Qualquer coisa que toque no SQLite |
| 4.1 | Conexão | Abrir o banco (pragmas obrigatórios) |
| 4.2 | Regras gerais do schema | Criar ou alterar tabelas; dinheiro, datas, booleanos, exclusão lógica |
| 4.3 | Schema inicial (`001_inicial.sql`) | Consultar tabelas, colunas, restrições e índices |
| 4.4 | Migrations | Mudar a estrutura do banco; regras do grupo para migrations |
| 4.5 | Seed | Dados falsos para desenvolvimento e testes |
| 5 | Convenções da API | Criar rotas; formato de erro e códigos HTTP |
| 6 | Arquivo `.env.example` | Configurar variáveis de ambiente |
| 7 | As três partes | Saber o escopo, rotas e regras de cada desenvolvedor |
| 7.1 | Parte 1 — Painel do dono | Login, JWT, categorias, pratos, mesas, QR Code |
| 7.2 | Parte 2 — Experiência do cliente | Cardápio público, carrinho, criação de pedidos |
| 7.3 | Parte 3 — Cozinha e operação | Fila, status, cancelamento, fechar conta, relatório |
| 8 | Segurança | Escrever SQL, lidar com senhas, tokens ou HTML |
| 9 | Testes | Escrever ou rodar testes |
| 10 | Fluxo de trabalho do grupo | Branches, commits e Pull Requests |
| 11 | Como o assistente deve ajudar | Regras de comportamento para a IA |
| 11.1 | Documentação | Manter `AGENTS.md`, `README.md` e `CLAUDE.md` em dia |
| 12 | Primeiros passos e comandos | Configurar o projeto do zero; referência rápida de comandos |
| 12.1 | Configurar o projeto pela primeira vez | Clonar, instalar e rodar pela primeira vez |
| 12.2 | Referência rápida | Lembrar o comando de uma tarefa do dia a dia |
| 12.3 | Problemas comuns | Resolver erros frequentes no Windows |
| 13 | Histórico de alterações | Ver o que mudou neste arquivo |

## 1. O que é o projeto

Cardápio digital acessado pelo QR Code da mesa de um restaurante:
- o **cliente** escaneia o QR Code, vê o cardápio no celular e faz o pedido;
- a **cozinha** acompanha os pedidos e atualiza o status;
- o **dono** (admin) cadastra pratos, categorias e mesas.

O projeto é feito por **3 desenvolvedores iniciantes**, cada um responsável por uma parte (seção 7).
O objetivo é aprender. Explique o código que gerar, prefira soluções simples e não use bibliotecas
fora da stack sem perguntar.

## 2. Stack (não trocar sem combinar com o grupo)

- Node.js com **ESM** (`import`/`export`, `"type": "module"` no package.json)
- Express
- SQLite com **better-sqlite3** (síncrono)
- Front-end em **HTML, CSS e JavaScript puro** (sem React, Vue ou frameworks CSS)
- **Zod** para validar entradas
- **bcrypt** para senhas e **jsonwebtoken** para JWT
- **qrcode** para gerar QR Codes
- **Vitest** + **Supertest** para testes
- Variáveis de ambiente lidas com `node --env-file=.env`

Ambiente dos desenvolvedores: Windows, VS Code, PowerShell 7.
Ao sugerir comandos de terminal, use sintaxe de PowerShell, um comando por linha.

## 3. Estrutura de pastas

```
cardapio-digital/
├── src/
│   ├── app.js                  # cria o Express e registra as rotas (exporta o app, sem listen)
│   ├── server.js               # importa o app e chama listen na porta do .env
│   ├── config.js               # constantes do projeto (ex.: fuso horário)
│   ├── db/
│   │   ├── conexao.js          # abre o banco com as configurações obrigatórias (seção 4.1)
│   │   ├── migrar.js           # função migrar(db): aplica as migrations pendentes
│   │   ├── migrar-cli.js       # chama migrar() no banco do .env (npm run db:migrar)
│   │   ├── resetar.js          # apaga o banco local, migra e roda o seed (npm run db:resetar)
│   │   ├── seed.js             # função seed(db): dados falsos (NÃO é migration)
│   │   └── migrations/
│   │       └── 001_inicial.sql
│   ├── middlewares/
│   │   ├── exigirAuth.js       # valida o JWT (criado pela Parte 1)
│   │   └── erros.js            # tratamento de erros padronizado
│   ├── admin/                  # Parte 1
│   ├── cliente/                # Parte 2
│   └── cozinha/                # Parte 3
├── public/
│   ├── admin/                  # telas da Parte 1
│   ├── mesa/                   # telas da Parte 2
│   └── cozinha/                # telas da Parte 3
├── tests/
├── .env.example
├── .gitignore                  # contém node_modules/, .env, *.db, *.db-wal, *.db-shm
├── AGENTS.md                   # este arquivo: referência completa do projeto
├── CLAUDE.md                   # contém só a linha @AGENTS.md (para o Claude Code)
└── README.md                   # porta de entrada para pessoas no GitHub
```

Cada pasta de parte (`admin/`, `cliente/`, `cozinha/`) segue as mesmas três camadas:
- `rotas.js` — recebe a requisição, valida com Zod, chama o service, devolve a resposta
- `service.js` — regras de negócio
- `repositorio.js` — único lugar com SQL

Scripts obrigatórios no `package.json`:

```json
"scripts": {
  "start": "node --env-file=.env src/server.js",
  "dev": "node --env-file=.env --watch src/server.js",
  "test": "vitest run",
  "db:migrar": "node --env-file=.env src/db/migrar-cli.js",
  "db:resetar": "node --env-file=.env src/db/resetar.js"
}
```

## 4. Banco de dados

### 4.1 Conexão (`src/db/conexao.js`)

Toda conexão aberta, inclusive nos testes, executa:

```js
db.pragma('journal_mode = WAL');   // permite ler enquanto alguém escreve
db.pragma('foreign_keys = ON');    // no SQLite as FKs vêm DESLIGADAS por padrão
db.pragma('busy_timeout = 5000');  // espera até 5 s se o banco estiver ocupado
```

O caminho do arquivo do banco vem do `.env` (`DB_ARQUIVO=cardapio.db`). Nos testes, use `:memory:`.

### 4.2 Regras gerais do schema

- Todas as tabelas são `STRICT` (o SQLite recusa tipo errado, como texto em coluna INTEGER).
- Dinheiro sempre em **centavos (INTEGER)**. R$ 25,90 = `2590`. Nunca use REAL para dinheiro.
- Booleanos são INTEGER com `CHECK (coluna IN (0, 1))`.
- Datas são TEXT no formato `AAAA-MM-DD HH:MM:SS`, **sempre em UTC** (`datetime('now')`).
  A conversão para o horário de Fortaleza (UTC-3, sem horário de verão) acontece só nos relatórios (seção 7.3).
- `atualizado_em` não muda sozinho: todo `UPDATE` no repositório define `atualizado_em = datetime('now')`.
- Nada é apagado de verdade quando já tem histórico: pratos usam `ativo = 0`, mesas usam `ativa = 0`.
- Chaves estrangeiras usam `ON DELETE RESTRICT`: o banco impede apagar um registro que tenha filhos.
- Toda regra que puder ser garantida por `CHECK`, `UNIQUE` ou `NOT NULL` fica no banco, além do Zod.
  O banco é a última linha de defesa contra bugs.
- Dados de histórico são copiados no momento do pedido (`nome_prato`, `preco_unitario_centavos`),
  para que mudanças futuras no cardápio não alterem pedidos antigos.

### 4.3 Schema inicial (`src/db/migrations/001_inicial.sql`)

```sql
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
```

### 4.4 Migrations

O banco é a soma de todas as migrations aplicadas em ordem. **Nunca existe um `schema.sql` editado à mão.**

**Nome dos arquivos:** três dígitos + descrição curta em minúsculas, em `src/db/migrations/`.
Exemplo: `002_observacao_cozinha.sql`. A ordem dos números é a ordem de execução.
Uma migration trata de um assunto só.

**Controle do que já rodou:** a tabela `_migrations` guarda o **nome do arquivo** de cada migration aplicada.
Não use `PRAGMA user_version` (ele perde migrations com o mesmo número criadas em branches diferentes).

```sql
CREATE TABLE IF NOT EXISTS _migrations (
  nome TEXT PRIMARY KEY,
  aplicada_em TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Comportamento obrigatório de `migrar(db)`:**
1. Cria `_migrations` se não existir.
2. Lista os arquivos `.sql` da pasta, em ordem alfabética, e filtra os que não estão em `_migrations`.
3. Executa `PRAGMA foreign_keys = OFF` **antes** do loop (esse pragma não funciona dentro de transação
   e precisa estar desligado para reconstruir tabelas).
4. Para cada migration pendente, numa **transação**: `db.exec(sql)` e insere o nome em `_migrations`.
   Se der erro, a transação é desfeita, o erro é mostrado e o script para.
5. Depois do loop, roda `PRAGMA foreign_key_check`; se retornar alguma linha, lança erro.
6. Executa `PRAGMA foreign_keys = ON`.
7. Recebe o `db` como parâmetro, para os testes usarem a mesma função com `:memory:`.
8. No Windows, monta o caminho da pasta com `fileURLToPath(new URL('./migrations', import.meta.url))`
   (de `node:url`), nunca com `URL.pathname`.

**`resetar.js`:** apaga o arquivo do banco (e os arquivos `-wal` e `-shm`), abre uma conexão nova,
roda `migrar(db)` e depois `seed(db)`. Recusa rodar se `NODE_ENV=production`.

**O que o `ALTER TABLE` do SQLite permite:**

| Mudança | Como fazer |
| --- | --- |
| Adicionar coluna | `ALTER TABLE ... ADD COLUMN` (sem `NOT NULL` sem `DEFAULT`, sem `UNIQUE`) |
| Renomear tabela ou coluna | `ALTER TABLE ... RENAME` |
| Remover coluna sem índice, FK ou CHECK | `ALTER TABLE ... DROP COLUMN` |
| Mudar tipo, CHECK, FK ou adicionar `UNIQUE` | Reconstruir a tabela (abaixo) |

Reconstrução de tabela, dentro de uma migration:

```sql
CREATE TABLE pedidos_novo ( ... nova definição completa ... ) STRICT;
INSERT INTO pedidos_novo (colunas...) SELECT colunas... FROM pedidos;
DROP TABLE pedidos;
ALTER TABLE pedidos_novo RENAME TO pedidos;
-- recriar todos os índices da tabela
```

Toda migration que altera tabela com dados também trata as linhas que já existem
(por exemplo, um `UPDATE` preenchendo a coluna nova).

**Regras do grupo para migrations:**
1. **Nunca edite uma migration que já entrou na `main`.** Para corrigir, crie uma nova.
2. Antes do merge, a migration pode ser editada à vontade; use `npm run db:resetar` para testar.
3. Reserve o número no grupo antes de criar ("vou criar a 004"). Se dois arquivos tiverem o mesmo número,
   quem fizer o merge por último renomeia o seu para o próximo número livre.
4. PR com migration avisa o grupo. Depois do merge, todos rodam `npm run db:migrar`.
5. Quem revisa um PR com migration roda `npm run db:resetar` e `npm test` antes de aprovar.
6. Não existem migrations de desfazer (down). Desfazer = nova migration ou reset do banco local.
7. Se o desenvolvedor pedir uma mudança no banco, gere uma **migration nova** e lembre-o de avisar o grupo.
   Nunca altere a `001_inicial.sql` depois que ela estiver na `main`.

### 4.5 Seed (`src/db/seed.js`)

O seed **não é migration**: só cria dados falsos para desenvolvimento e testes, e nunca roda em produção.
Conteúdo obrigatório:
- 1 admin: `admin@teste.com`, senha vinda do `.env` (`SEED_SENHA_ADMIN`), gravada com bcrypt;
- 3 categorias;
- 10 pratos: 2 com `disponivel = 0` e 1 com `ativo = 0`;
- 5 mesas: 1 com `ativa = 0`;
- 5 pedidos: um em cada status, sendo um `entregue` com `pago = 1` e `pago_em` preenchido,
  e o `cancelado` com motivo.

O seed é exportado como `seed(db)` e roda inteiro numa transação.

## 5. Convenções da API

- Todas as rotas da API começam com `/api`.
- Telas servidas como arquivos estáticos: `/admin`, `/mesa/:id`, `/cozinha`.
- Corpo e resposta sempre em JSON. Valores em dinheiro trafegam em centavos; o front converte para reais.
- Rotas do admin e da cozinha exigem `Authorization: Bearer <token>` (middleware `exigirAuth`).
- Toda entrada é validada com Zod antes de chegar ao service.
- Erros de restrição do banco (`SQLITE_CONSTRAINT_*`) são convertidos pelo middleware de erros
  em 409 com código claro, nunca devolvidos crus ao cliente.

**Formato único de erro** (todas as partes usam):

```json
{ "erro": { "codigo": "PRATO_INDISPONIVEL", "mensagem": "O prato 12 não está disponível" } }
```

| Status | Quando usar |
| --- | --- |
| 400 | Dados inválidos (falhou na validação do Zod) |
| 401 | Sem token ou token inválido |
| 404 | Recurso não existe (ou está inativo, para o cliente) |
| 409 | Conflito de regra (e-mail ou nome repetido, pular etapa de status, apagar com dependentes) |
| 422 | Pedido com prato indisponível ou inativo |

Códigos de erro em MAIÚSCULAS_COM_UNDERLINE. Respostas de criação usam 201; de exclusão, 204.

## 6. Arquivo `.env.example`

```
PORT=3000
DB_ARQUIVO=cardapio.db
JWT_SECRET=troque-por-um-valor-longo-e-aleatorio
SEED_SENHA_ADMIN=troque-esta-senha
```

## 7. As três partes

Antes de ajudar, pergunte (ou confirme) em qual parte o desenvolvedor está trabalhando.
**Não altere arquivos das outras partes** sem avisar; se for necessário, explique o motivo e sugira
combinar com o responsável. Mudanças no banco seguem a seção 4.4.

### 7.1 Parte 1 — Painel do dono (`src/admin/`, `public/admin/`)

Funcionalidades:
1. Login do admin com bcrypt; JWT com validade de 8 horas. E-mail convertido para minúsculas antes de buscar.
2. Middleware `exigirAuth` (é o primeiro PR desta parte, pois a Parte 3 depende dele).
3. CRUD de categorias (com campo `ordem`).
4. CRUD de pratos, alternar `disponivel` e remover (que define `ativo = 0`).
5. CRUD de mesas (remover define `ativa = 0`) e QR Code apontando para `http://<endereço>/mesa/<id>`.
6. Página de impressão com os QR Codes de todas as mesas ativas.

| Método | Rota | Corpo | Auth |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | email, senha | Não |
| GET, POST | `/api/admin/categorias` | nome, ordem | Sim |
| PUT, DELETE | `/api/admin/categorias/:id` | nome, ordem | Sim |
| GET, POST | `/api/admin/pratos` | categoria_id, nome, descricao, preco_centavos | Sim |
| PUT | `/api/admin/pratos/:id` | mesmos campos | Sim |
| DELETE | `/api/admin/pratos/:id` | — (define `ativo = 0`) | Sim |
| PATCH | `/api/admin/pratos/:id/disponibilidade` | disponivel | Sim |
| GET, POST | `/api/admin/mesas` | numero | Sim |
| DELETE | `/api/admin/mesas/:id` | — (define `ativa = 0`) | Sim |
| GET | `/api/admin/mesas/:id/qrcode` | — (responde imagem PNG) | Sim |

Regras:
- Login errado responde sempre "e-mail ou senha inválidos" (401), sem dizer qual campo errou.
- Preço maior que zero; nome do prato entre 2 e 80 caracteres; não repete na mesma categoria (409).
- Categoria com pratos ativos não pode ser apagada (409). Categoria sem pratos é apagada de verdade.
- Número de mesa não se repete (409).
- `GET /api/admin/pratos` lista só pratos ativos, a menos que receba `?incluirInativos=1`.

### 7.2 Parte 2 — Experiência do cliente (`src/cliente/`, `public/mesa/`)

Funcionalidades:
1. Página `/mesa/:id` com os pratos ativos e disponíveis, agrupados por categoria na ordem definida.
2. Carrinho no navegador (adicionar, remover, quantidade, observação por item), salvo em `sessionStorage`.
3. Total exibido em reais, calculado na hora.
4. Envio do pedido; **o servidor recalcula o total** e ignora qualquer preço vindo do navegador.
5. Tela de acompanhamento com o status, atualizando a cada 15 segundos.
6. Lista dos pedidos não pagos e não cancelados da mesa.

| Método | Rota | Corpo | Auth |
| --- | --- | --- | --- |
| GET | `/api/mesas/:id` | — (404 se inexistente ou inativa) | Não |
| GET | `/api/cardapio` | — (só pratos com `ativo = 1` e `disponivel = 1`) | Não |
| POST | `/api/pedidos` | mesa_id, itens: [{ prato_id, quantidade, observacao }] | Não |
| GET | `/api/pedidos/:id` | — | Não |
| GET | `/api/mesas/:id/pedidos` | — (pedidos não pagos e não cancelados) | Não |

Regras:
- De 1 a 30 itens por pedido; quantidade de 1 a 20 por item (400).
- Mesa inexistente ou inativa: 404.
- Prato inexistente, inativo ou indisponível: 422, informando qual prato.
- Ao criar o pedido, copie para `itens_pedido` o `nome_prato` e o `preco_unitario_centavos` atuais.
- Pedido e itens gravados numa **transação** (`db.transaction`). O `total_centavos` é a soma
  de `quantidade × preco_unitario_centavos` dos itens, calculada dentro da mesma transação.
- Pedido nasce com status `recebido`.
- Observação com no máximo 140 caracteres.
- Layout mobile-first a partir de 360px; botões com pelo menos 44px de altura.

### 7.3 Parte 3 — Cozinha e operação (`src/cozinha/`, `public/cozinha/`)

Funcionalidades:
1. Fila de pedidos em `recebido`, `preparando` e `pronto`, mais antigos primeiro, com mesa, itens,
   observações e minutos de espera.
2. Atualização automática a cada 10 segundos.
3. Avançar status: recebido → preparando → pronto → entregue.
4. Cancelar pedido em `recebido`, com motivo obrigatório.
5. Fechar a conta da mesa: pedidos `entregue` com `pago = 0` passam a `pago = 1` com `pago_em = datetime('now')`.
6. Resumo do dia: quantidade de pedidos pagos, faturamento, ticket médio, 5 pratos mais vendidos.

| Método | Rota | Corpo | Auth |
| --- | --- | --- | --- |
| GET | `/api/cozinha/pedidos` | — | Sim |
| PATCH | `/api/cozinha/pedidos/:id/status` | status | Sim |
| POST | `/api/cozinha/pedidos/:id/cancelar` | motivo | Sim |
| GET | `/api/cozinha/mesas/:id/conta` | — | Sim |
| POST | `/api/cozinha/mesas/:id/fechar` | — | Sim |
| GET | `/api/cozinha/relatorios/dia?data=AAAA-MM-DD` | — (data local de Fortaleza) | Sim |

Regras:
- Status avança uma etapa por vez; pular, voltar ou mudar pedido cancelado: 409.
- Só pedido em `recebido` pode ser cancelado (409 nos outros casos).
- Pedido cancelado não entra na conta nem no faturamento.
- Fechar conta sem pedidos entregues e não pagos: 409.
- Fechar conta é feito numa **transação**.
- O resumo do dia filtra por **`pago_em`** (data do pagamento), não por `criado_em`.
- Conversão do dia local para UTC: o dia `D` em Fortaleza (UTC-3) vai de `D 03:00:00` até
  `D+1 03:00:00` em UTC. Use o deslocamento definido em `src/config.js` (`FUSO_HORAS = 3`):

```sql
WHERE pago = 1
  AND pago_em >= datetime(?, '+3 hours')
  AND pago_em <  datetime(?, '+1 day', '+3 hours')
```

- "Pratos mais vendidos" soma `quantidade` de `itens_pedido` agrupando por `prato_id` e exibindo `nome_prato`.
- Pedido com mais de 20 minutos aparece destacado na fila.

## 8. Segurança (vale para todas as partes)

- Queries **sempre parametrizadas** (`db.prepare('... WHERE id = ?').get(id)`). Nunca concatene texto em SQL.
- Senhas só com bcrypt. Nunca registre senha ou token em log.
- Segredos só no `.env`. O `.env` nunca vai para o Git; o `.env.example` não tem valores reais.
- No front, exiba dados com `textContent`, **nunca** com `innerHTML`.
- Token do admin guardado em `sessionStorage`.

## 9. Testes

- Cada regra de negócio das seções acima tem pelo menos um teste (caso de sucesso e caso de erro).
- Testes de rota com Supertest importando o `app` de `src/app.js` (sem subir o servidor).
- Cada arquivo de teste cria um banco `:memory:` com as mesmas configurações da seção 4.1,
  roda `migrar(db)` e `seed(db)`. Nunca use o banco de desenvolvimento nos testes.
- Teste obrigatório de integridade: para todo pedido, `total_centavos` = soma dos itens.
- `npm test` precisa passar antes de abrir um Pull Request.

## 10. Fluxo de trabalho do grupo

- Ninguém faz push direto na `main`. Tudo entra por Pull Request aprovado por outra pessoa.
- Uma branch por tarefa: `feat/login-admin`, `feat/carrinho`, `fix/total-pedido`.
- Commits pequenos em **Conventional Commits** (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`).
  Migrations usam `feat(db):` ou `fix(db):`.
- PRs com até ~300 linhas, descrição de como testar e prints quando houver tela.
- Antes do PR: `git pull origin main` na branch e resolver conflitos.
- Depois de qualquer `git pull` que traga migration nova: `npm run db:migrar`.

## 11. Como o assistente deve ajudar

- Os desenvolvedores são iniciantes: explique o que o código faz e por quê, em português.
- Gere código em passos pequenos, um arquivo ou uma função por vez, e espere o desenvolvedor entender antes de seguir.
- Siga as camadas rotas → service → repositório; não coloque SQL em rotas.
- Não invente rotas, tabelas ou campos que não estão neste arquivo. Se faltar algo, diga o que falta
  e sugira a mudança (em forma de migration nova, quando for no banco) para o grupo aprovar.
- Ao escrever um teste, use o nome da regra que ele verifica.
- Ao sugerir comandos, use PowerShell e um comando por linha.

### 11.1 Documentação

- Este arquivo (`AGENTS.md`) é a referência completa. O `README.md` é um resumo para pessoas e
  não deve repetir regras detalhadas: ele aponta para as seções daqui.
- Quando uma mudança alterar algo que aparece no `README.md` (funcionalidades, comandos, `.env`,
  como rodar, estrutura de pastas), atualize o `README.md` no mesmo Pull Request.
- Quando uma mudança alterar regras, rotas, tabelas ou fluxo, atualize este arquivo no mesmo
  Pull Request, subindo a versão e registrando na seção 13.
- O `CLAUDE.md` contém apenas `@AGENTS.md`. Não coloque regras nele.

## 12. Primeiros passos e comandos

### 12.1 Configurar o projeto pela primeira vez

Pré-requisitos: Git, Node.js LTS (versão 20.6 ou mais nova, por causa do `--env-file`) e acesso
de colaborador ao repositório no GitHub. Comandos no PowerShell, um por linha:

```powershell
cd ~\estudos
git clone <URL-do-repositório>
cd cardapio-digital
npm install
Copy-Item .env.example .env
npm run db:resetar
npm test
npm run dev
```

Depois de `Copy-Item`, edite o `.env` e troque os valores de `JWT_SECRET` e `SEED_SENHA_ADMIN`.
Com o `npm run dev` rodando, as telas ficam em `http://localhost:3000/admin`, `/mesa/1` e `/cozinha`.

### 12.2 Referência rápida

| Quero... | Comando |
| --- | --- |
| Rodar o servidor reiniciando a cada mudança | `npm run dev` |
| Rodar os testes | `npm test` |
| Aplicar migrations novas depois de um `git pull` | `npm run db:migrar` |
| Recriar meu banco local do zero (migrations + seed) | `npm run db:resetar` |
| Começar uma tarefa nova | `git switch main`, `git pull`, `git switch -c feat/nome` |
| Trazer a `main` para a minha branch | `git pull origin main` |
| Enviar minha branch | `git push -u origin feat/nome` |
| Ver vulnerabilidades nas dependências | `npm audit` |

### 12.3 Problemas comuns

| Sintoma | Solução |
| --- | --- |
| "execução de scripts foi desabilitada" ao rodar `npm` | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Erro de tabela ou coluna inexistente | `npm run db:migrar`; se continuar, `npm run db:resetar` |
| `SQLITE_BUSY` ou banco travado | Pare o servidor (`Ctrl+C`) e rode o comando de novo |
| `process.env` vem `undefined` | Confira se o `.env` existe e se o script usa `--env-file=.env` |
| Erro ao instalar `better-sqlite3` | Use o Node.js LTS; versões muito novas podem ainda não ter binário pronto |

## 13. Histórico de alterações

| Versão | Data | Alteração |
| --- | --- | --- |
| 2.1 | 2026-11-08 | `README.md` criado; arquivos de documentação na estrutura de pastas; regras de manutenção da documentação (seção 11.1) |
| 2.0 | 2026-11-08 | Banco reorganizado em migrations; schema revisado (tabelas `STRICT`, novos `CHECK`, `ativo`, `pago_em`, `nome_prato`, índices); regras de fuso horário; índice, informações do documento e seção de primeiros passos |
| 1.0 | 2026-11-08 | Primeira versão: stack, estrutura, banco, API e divisão em 3 partes |
