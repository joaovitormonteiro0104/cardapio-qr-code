# Cardápio Digital — Contexto do projeto para assistentes de IA

Este arquivo é a fonte de verdade do projeto. Leia-o inteiro antes de sugerir ou gerar código.
Se um pedido do desenvolvedor contradizer este arquivo, aponte a contradição e pergunte antes de seguir.

| Campo | Valor |
| --- | --- |
| Versão deste arquivo | 1.1 (2026-11-09) |
| Repositório | https://github.com/joaovitormonteiro0104/cardapio-qr-code |
| Parte 1 — Painel do dono | _responsável_ |
| Parte 2 — Cliente | _responsável_ |
| Parte 3 — Cozinha | _responsável_ |
| Duração | 5 semanas |
| Claude Code | `CLAUDE.md` na raiz contendo apenas `@AGENTS.md` |

## Índice

1. O que é o projeto
2. Stack
3. Estrutura e arquivos comuns
4. Banco de dados
5. Convenções da API
6. Segurança e front-end
7. Testes
8. Fluxo de trabalho do grupo
9. Cronograma
10. Parte 1 — Painel do dono
11. Parte 2 — Cliente
12. Parte 3 — Cozinha
13. Como o assistente deve ajudar
14. Primeiros passos e problemas comuns

## 1. O que é o projeto

Cardápio digital acessado pelo QR Code da mesa de um restaurante:
- o **dono** cadastra categorias, pratos e mesas e imprime os QR Codes (Parte 1);
- o **cliente** escaneia o QR Code, monta o pedido no celular e acompanha o status (Parte 2);
- a **cozinha** vê a fila de pedidos e avança o status até a entrega (Parte 3).

O projeto é feito por **3 desenvolvedores iniciantes**, um por parte. O objetivo é aprender:
prefira sempre a solução mais simples que funcione e explique o código que gerar.

**Fora do escopo** (ideias para depois, se sobrar tempo): fechamento de conta e pagamento, relatório do dia,
remover pratos do cardápio (por enquanto o prato só fica disponível ou indisponível), fotos dos pratos,
atualização em tempo real, mais de um admin.

## 2. Stack

Não troque nem acrescente bibliotecas sem combinar com o grupo.

- Node.js LTS (20.6 ou mais nova), com ESM (`"type": "module"`)
- **Express 5** (captura sozinho os erros de rotas `async`)
- SQLite com **better-sqlite3**
- Front-end em HTML, CSS e JavaScript puro
- **Zod 4** para validar entradas, **bcrypt** para senhas, **jsonwebtoken** para o login, **qrcode** para os QR Codes
- **Vitest** + **Supertest** para testes

Ambiente: Windows, VS Code e PowerShell 7. Ao sugerir comandos, use PowerShell, um comando por linha.

## 3. Estrutura e arquivos comuns

```
cardapio-digital/
├── src/
│   ├── app.js                 # Express: telas, rotas e tratamento de erros (sem listen)
│   ├── server.js              # sobe o servidor
│   ├── config.js              # variáveis do .env validadas
│   ├── db/
│   │   ├── conexao.js         # abrirBanco(arquivo) e obterDb()
│   │   ├── migrar.js          # migrar(db): aplica migrations pendentes
│   │   ├── migrar-cli.js      # npm run db:migrar
│   │   ├── resetar.js         # npm run db:resetar (apaga, migra e roda o seed)
│   │   ├── seed.js            # seed(db, senhaAdmin): dados de exemplo
│   │   └── migrations/
│   │       └── 001_inicial.sql
│   ├── middlewares/
│   │   ├── erros.js           # ErroApp, rotaNaoEncontrada, tratarErros
│   │   └── exigirAuth.js      # valida o token (Parte 1)
│   ├── admin/                 # Parte 1
│   ├── cliente/               # Parte 2
│   └── cozinha/               # Parte 3
├── public/
│   ├── comum/                 # api.js, formato.js, estilo.css
│   ├── admin/                 # telas da Parte 1
│   ├── mesa/                  # telas da Parte 2
│   └── cozinha/               # telas da Parte 3
├── tests/
│   ├── ajuda.js               # prepararBanco() e tokenAdmin()
│   ├── admin/  cliente/  cozinha/
├── vitest.config.js
├── .env.example
├── .gitignore                 # node_modules/, .env, *.db, *.db-wal, *.db-shm
├── AGENTS.md
├── CLAUDE.md
└── README.md
```

Scripts do `package.json`: `start`, `dev` (`node --env-file=.env --watch src/server.js`), `test` (`vitest run`),
`db:migrar` e `db:resetar`.

**Camadas.** Dentro de cada parte, cada assunto tem três arquivos:

| Arquivo | Faz | Nunca faz |
| --- | --- | --- |
| `rotas.js` | Valida a entrada com Zod, chama o service, escolhe o status HTTP | SQL |
| `service.js` | Regras de negócio; lança `ErroApp` | Usar `req`/`res`, SQL |
| `repositorio.js` | SQL com `?` e conversão de `0/1` para `true/false` | Regra de negócio |

Uma parte nunca importa arquivos de outra; se precisar de dados dela, consulta o banco pelo próprio repositório.

**`src/config.js`**

```js
function obrigatoria(nome) {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável ${nome} ausente. Confira o arquivo .env.`);
  return valor;
}

export const JWT_SECRET = obrigatoria('JWT_SECRET');
if (JWT_SECRET.length < 32) throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres');

export const URL_PUBLICA = process.env.URL_PUBLICA ?? `http://localhost:${process.env.PORT ?? 3000}`;
export const BCRYPT_CUSTO = 10;
```

**`src/middlewares/erros.js`** — `ErroApp(status, codigo, mensagem)` para os services lançarem;
`rotaNaoEncontrada` (404 `ROTA_NAO_ENCONTRADA`); e `tratarErros`, que converte `ErroApp`, `ZodError`
(400 `DADOS_INVALIDOS`), JSON malformado (400 `JSON_INVALIDO`) e erros `SQLITE_CONSTRAINT_*` (409 `CONFLITO`)
para o formato padrão, e qualquer outro erro em 500 `ERRO_INTERNO` sem mostrar detalhes.

**Montagem das rotas (`src/app.js`).** Cada parte exporta um roteador, registrado em `/api`:

```js
app.use('/api', rotasAdmin);    // Parte 1
app.use('/api', rotasCliente);  // Parte 2
app.use('/api', rotasCozinha);  // Parte 3
app.use('/api', rotaNaoEncontrada);
app.use(tratarErros);
```

**Regra importante:** como os três roteadores ficam em `/api`, o `exigirAuth` só pode ser aplicado num
sub-roteador com caminho próprio (`/admin` ou `/cozinha`). Um `router.use(exigirAuth)` solto no topo
bloquearia também as rotas públicas do cliente. Exemplo na seção 10.

O `app.js` também serve `public/` com `express.static` e faz `/mesa/:id` devolver `public/mesa/index.html`.

## 4. Banco de dados

**Conexão.** `abrirBanco(arquivo)` liga `journal_mode = WAL`, `foreign_keys = ON` e `busy_timeout = 5000`.
`obterDb()` abre o banco de `DB_ARQUIVO` na primeira chamada; nos testes (`NODE_ENV=test`) usa `:memory:`.
Os repositórios chamam `obterDb()` dentro de cada função.

**Regras.**
- Dinheiro em **centavos** (inteiro): R$ 25,90 = `2590`.
- Booleanos em INTEGER 0/1; a API devolve `true`/`false`.
- Datas em UTC com `datetime('now')`.
- Nomes digitados pelo usuário usam `COLLATE NOCASE` ("Bebidas" = "bebidas").
- Chaves estrangeiras com `ON DELETE RESTRICT`: o banco impede apagar o que está em uso.
- O pedido copia o nome e o preço do prato para `itens_pedido`, para mudanças no cardápio não alterarem pedidos feitos.

**`src/db/migrations/001_inicial.sql`**

```sql
CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  senha_hash TEXT NOT NULL
) STRICT;

CREATE TABLE categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(nome) BETWEEN 2 AND 40),
  ordem INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE pratos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  nome TEXT NOT NULL COLLATE NOCASE CHECK (length(nome) BETWEEN 2 AND 80),
  descricao TEXT CHECK (descricao IS NULL OR length(descricao) <= 300),
  preco_centavos INTEGER NOT NULL CHECK (preco_centavos > 0),
  disponivel INTEGER NOT NULL DEFAULT 1 CHECK (disponivel IN (0, 1)),
  UNIQUE (categoria_id, nome)
) STRICT;

CREATE TABLE mesas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero INTEGER NOT NULL UNIQUE CHECK (numero > 0)
) STRICT;

CREATE TABLE pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mesa_id INTEGER NOT NULL REFERENCES mesas(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'recebido'
    CHECK (status IN ('recebido', 'preparando', 'pronto', 'entregue', 'cancelado')),
  total_centavos INTEGER NOT NULL CHECK (total_centavos > 0),
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

CREATE TABLE itens_pedido (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE RESTRICT,
  prato_id INTEGER NOT NULL REFERENCES pratos(id) ON DELETE RESTRICT,
  nome_prato TEXT NOT NULL,
  quantidade INTEGER NOT NULL CHECK (quantidade BETWEEN 1 AND 20),
  preco_unitario_centavos INTEGER NOT NULL CHECK (preco_unitario_centavos > 0),
  observacao TEXT CHECK (observacao IS NULL OR length(observacao) <= 140)
) STRICT;

CREATE INDEX idx_pratos_categoria ON pratos(categoria_id);
CREATE INDEX idx_pedidos_mesa ON pedidos(mesa_id);
CREATE INDEX idx_pedidos_status ON pedidos(status, criado_em);
CREATE INDEX idx_itens_pedido ON itens_pedido(pedido_id);
CREATE INDEX idx_itens_prato ON itens_pedido(prato_id);
```

**Migrations.** O banco é a soma das migrations em `src/db/migrations/`, aplicadas em ordem pelo nome
(`002_descricao.sql`). A tabela `_migrations` guarda o nome de cada uma já aplicada.
- **Nunca edite uma migration que já entrou na `main`**; para mudar algo, crie uma nova.
- Reserve o número no grupo antes de criar ("vou criar a 003").
- Depois de um `git pull` com migration nova, rode `npm run db:migrar`. Se o banco local ficar estranho,
  `npm run db:resetar`.
- Para mudar `CHECK`, `UNIQUE` ou tipo de coluna, o SQLite exige recriar a tabela (criar a nova, copiar os
  dados, apagar a antiga e renomear). Peça ajuda antes de fazer isso.

**Seed (`seed(db, senhaAdmin)`)**: 1 admin (`admin@teste.com`, senha do `.env` ou a passada nos testes),
3 categorias, 8 pratos (2 indisponíveis), 4 mesas e 4 pedidos (um em cada status: recebido, preparando,
pronto e entregue). Itens com nome e preço copiados e total igual à soma dos itens. Roda numa transação.

## 5. Convenções da API

- Rotas começam com `/api`. Corpo e resposta em JSON (exceto a imagem do QR Code).
- Toda entrada passa por um esquema Zod na rota: `esquema.parse(req.body)`. Use `z.strictObject` (campos
  extras viram 400) e sempre o **retorno** do `parse`. Ids da URL: `z.coerce.number().int().positive()`.
- Criar responde 201 com o registro; atualizar, 200; apagar, 204 sem corpo.
- Dinheiro em centavos; booleanos como `true`/`false`.

**Formato único de erro**

```json
{ "erro": { "codigo": "PRATO_INDISPONIVEL", "mensagem": "O prato 12 não está disponível" } }
```

| Código | Status | Quando | Parte |
| --- | --- | --- | --- |
| `DADOS_INVALIDOS` / `JSON_INVALIDO` | 400 | Entrada inválida | Todas |
| `CREDENCIAIS_INVALIDAS` | 401 | E-mail ou senha errados | 1 |
| `TOKEN_AUSENTE` / `TOKEN_INVALIDO` | 401 | Sem token válido | 1 e 3 |
| `CATEGORIA_NAO_ENCONTRADA` | 404 | Categoria inexistente | 1 |
| `PRATO_NAO_ENCONTRADO` | 404 | Prato inexistente | 1 |
| `MESA_NAO_ENCONTRADA` | 404 | Mesa inexistente | 1 e 2 |
| `PEDIDO_NAO_ENCONTRADO` | 404 | Pedido inexistente | 2 e 3 |
| `CATEGORIA_DUPLICADA` | 409 | Nome de categoria já usado | 1 |
| `CATEGORIA_COM_PRATOS` | 409 | Apagar categoria que tem pratos | 1 |
| `PRATO_DUPLICADO` | 409 | Nome de prato já usado na categoria | 1 |
| `MESA_DUPLICADA` | 409 | Número de mesa já usado | 1 |
| `MESA_COM_PEDIDOS` | 409 | Apagar mesa que tem pedidos | 1 |
| `TRANSICAO_INVALIDA` | 409 | Pular ou voltar etapa do status | 3 |
| `CANCELAMENTO_NAO_PERMITIDO` | 409 | Cancelar pedido fora de `recebido` | 3 |
| `PRATO_INDISPONIVEL` | 422 | Pedido com prato inexistente ou indisponível | 2 |
| `ROTA_NAO_ENCONTRADA` | 404 | Rota de `/api` que não existe | Todas |
| `CONFLITO` | 409 | Regra do banco (UNIQUE, CHECK, chave estrangeira) que o service não tratou antes | Todas |
| `ERRO_INTERNO` | 500 | Erro inesperado (bug); os detalhes ficam só no terminal | Todas |

Não invente códigos novos sem combinar com o grupo.

## 6. Segurança e front-end

**Segurança**
- SQL sempre com `?`; nunca monte SQL juntando texto vindo do usuário. Nunca use `SELECT *`.
- Senha só com bcrypt. Nunca escreva senha, token ou o corpo do login em log.
- Segredos só no `.env`, que nunca vai para o Git.
- Na tela, dados do usuário só com `textContent` e `createElement`, nunca `innerHTML`.
- O token do admin fica em `sessionStorage`.

**Módulos comuns (`public/comum/`)**
- `api.js`: `api(caminho, { metodo, corpo })` faz o `fetch` com o token, converte o JSON e lança `Error` com a
  mensagem do erro padrão; em 401 (fora do login) apaga o token e leva para `/admin/`. Também exporta
  `exigirLogin()` e `sair()`.
- `formato.js`: conversão de dinheiro **sem número decimal** (evita `25.90 * 100 = 2589.99...`):

```js
export function reaisParaCentavos(texto) {
  const limpo = texto.trim().replace(/^R\$\s*/, '').replace('.', ',');
  if (!/^\d{1,5}(,\d{1,2})?$/.test(limpo)) return null; // null = "Use o formato 25,90"
  const [reais, centavos = ''] = limpo.split(',');
  return Number(reais) * 100 + Number(centavos.padEnd(2, '0'));
}

export function centavosParaReais(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
```

- `estilo.css`: cores, fontes, botões e aviso de erro.

**Regras das telas:** scripts com `<script type="module">`; telas do admin e da cozinha chamam `exigirLogin()`
na primeira linha; botão desativado durante a requisição; erros num aviso na página (não em `alert()`);
depois de salvar, recarregar a lista da API; funcionar no celular a partir de 360px.

## 7. Testes

`vitest.config.js` (o Vitest não lê o `.env`; o banco já é `:memory:` pelo `obterDb()`):

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      JWT_SECRET: 'segredo-somente-para-testes-com-mais-de-32-caracteres',
      URL_PUBLICA: 'http://teste.local:3000',
    },
  },
});
```

`tests/ajuda.js`:

```js
import request from 'supertest';
import { app } from '../src/app.js';
import { obterDb } from '../src/db/conexao.js';
import { migrar } from '../src/db/migrar.js';
import { seed } from '../src/db/seed.js';

export const SENHA_TESTE = 'senha-de-teste';

export function prepararBanco() {        // no beforeAll de cada arquivo de teste
  const db = obterDb();
  migrar(db);
  seed(db, SENHA_TESTE);
  return db;
}

export async function tokenAdmin() {
  const resposta = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@teste.com', senha: SENHA_TESTE });
  return resposta.body.token;
}
```

Regras: cada regra listada nas seções 10 a 12 tem pelo menos um teste; os testes usam Supertest com o `app`
(sem subir servidor); cada teste cria os próprios dados com nomes únicos; `npm test` passa antes de todo PR.

## 8. Fluxo de trabalho do grupo

- Ninguém faz push direto na `main`: tudo entra por Pull Request aprovado por outra pessoa.
- Uma branch por entrega, criada da `main` atualizada (`feat/admin-login`, `feat/carrinho`).
- Commits pequenos em Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.
- PR pequeno (até ~300 linhas), com "como testar" e prints das telas.
- Revisão em rodízio, em até 24 horas; quem revisa roda o código antes de aprovar.
- Mudanças em arquivos comuns (`app.js`, `config.js`, `erros.js`, `seed.js`, migrations, `public/comum/`)
  são avisadas no grupo antes do PR.

**Rotina de cada entrega** (PowerShell):

```powershell
git switch main
git pull
npm run db:migrar
git switch -c feat/nome-da-entrega
```

Ao terminar: `npm test`, `git add .`, `git commit -m "feat: ..."`, `git push -u origin feat/nome-da-entrega`
e abra o PR.

**Pronto para PR quando:**
- [ ] `npm test` passa e as regras novas têm teste;
- [ ] testei no navegador o caminho certo e pelo menos um erro;
- [ ] SQL só no repositório, com `?`;
- [ ] entrada validada com `z.strictObject`;
- [ ] texto na tela só com `textContent`;
- [ ] se mudou rota ou regra, este arquivo foi atualizado no mesmo PR.

## 9. Cronograma

| Semana | Todos | Parte 1 | Parte 2 | Parte 3 |
| --- | --- | --- | --- | --- |
| 1 | Base comum (seção 14.1) | — | — | — |
| 2 | — | P1.1 Login | P2.1 Cardápio | P3.1 Fila |
| 3 | — | P1.2 Categorias e pratos | P2.2 Carrinho e pedido | P3.2 Status e cancelamento |
| 4 | — | P1.3 Mesas e QR Code | P2.3 Acompanhamento | P3.3 Tela da cozinha completa |
| 5 | Integração, testes cruzados e apresentação | | | |

Até a parte do outro ficar pronta, cada um usa os dados do seed.

## 10. Parte 1 — Painel do dono

**Pastas:** `src/admin/`, `src/middlewares/exigirAuth.js`, `public/admin/`, `tests/admin/`.
**Entrega:** login, categorias, pratos e mesas com QR Code.
**Prioridade:** a P1.1 (login e `exigirAuth`) tem prazo rígido, porque a Parte 3 depende dela.

**Rotas**

| Método | Rota | Corpo | Token |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | email, senha | Não |
| GET, POST | `/api/admin/categorias` | nome, ordem | Sim |
| PUT, DELETE | `/api/admin/categorias/:id` | nome, ordem | Sim |
| GET, POST | `/api/admin/pratos` | categoria_id, nome, descricao, preco_centavos | Sim |
| PUT | `/api/admin/pratos/:id` | mesmos campos | Sim |
| PATCH | `/api/admin/pratos/:id/disponivel` | disponivel (true/false) | Sim |
| GET, POST | `/api/admin/mesas` | numero | Sim |
| DELETE | `/api/admin/mesas/:id` | — | Sim |
| GET | `/api/qrcode/:mesaId` | — (imagem PNG) | Não |

A rota do QR Code é **pública** de propósito: o QR Code só contém o link público da mesa. Assim a tela usa
um `<img src="/api/qrcode/3">` normal.

**Montagem do roteador (`src/admin/rotas.js`)**

```js
import { Router } from 'express';
import { exigirAuth } from '../middlewares/exigirAuth.js';
import rotasAuth from './auth/rotas.js';
import rotasCategorias from './categorias/rotas.js';
import rotasPratos from './pratos/rotas.js';
import rotasMesas from './mesas/rotas.js';
import rotasQrCode from './mesas/qrcode.js';

const protegidas = Router();
protegidas.use(exigirAuth);                    // só para /api/admin/...
protegidas.use('/categorias', rotasCategorias);
protegidas.use('/pratos', rotasPratos);
protegidas.use('/mesas', rotasMesas);

const rotasAdmin = Router();
rotasAdmin.use('/auth', rotasAuth);
rotasAdmin.use('/qrcode', rotasQrCode);
rotasAdmin.use('/admin', protegidas);

export default rotasAdmin;
```

Enquanto um assunto não existe, deixe a linha dele comentada.

### P1.1 — Login e `exigirAuth` (semana 2)

**Como criar**
1. `src/admin/auth/repositorio.js`: `buscarPorEmail(email)` devolve `id` e `senha_hash`.
2. `src/admin/auth/service.js`: compara a senha com `bcrypt.compare`. Errou o e-mail ou a senha: 401
   `CREDENCIAIS_INVALIDAS`, sempre com a mesma mensagem ("E-mail ou senha inválidos"). Acertou: gera o token
   com `jwt.sign({}, JWT_SECRET, { subject: String(admin.id), expiresIn: '8h' })`.
3. `src/admin/auth/rotas.js`: `POST /login` com o esquema
   `z.strictObject({ email: z.string().trim().toLowerCase().pipe(z.email()), senha: z.string().min(1).max(72) })`.
4. `src/middlewares/exigirAuth.js`: lê `Authorization: Bearer <token>`; sem token, 401 `TOKEN_AUSENTE`;
   `jwt.verify` falhou, 401 `TOKEN_INVALIDO`; válido, `req.admin = { id }` e `next()`.
5. `src/admin/rotas.js` como acima e `app.use('/api', rotasAdmin)` no `app.js`.
6. Telas: `public/admin/index.html` (login) e um menu (Pratos · Categorias · Mesas · Sair).

**Concluída quando**
- [ ] login certo devolve `{ token }`; errado devolve 401 com a mesma mensagem para e-mail ou senha;
- [ ] rota de `/api/admin` sem token devolve 401;
- [ ] `GET /api/nao-existe` sem token continua devolvendo 404 (o `exigirAuth` não vazou);
- [ ] pela tela, o admin entra, vê o menu e sai;
- [ ] o responsável pela Parte 3 foi avisado de que o `exigirAuth` está na `main`.

### P1.2 — Categorias e pratos (semana 3)

**Como criar**
1. Categorias primeiro: repositório, service, rotas e testes. Ele é o modelo para o resto.
   - nome de 2 a 40 caracteres, sem repetir (409 `CATEGORIA_DUPLICADA`); editar mantendo o próprio nome é permitido;
   - `ordem` de 0 a 999 (padrão 0); a lista vem ordenada por `ordem` e nome;
   - apagar categoria com pratos: 409 `CATEGORIA_COM_PRATOS`.
2. Pratos:
   - categoria precisa existir (404 `CATEGORIA_NAO_ENCONTRADA`);
   - nome de 2 a 80 caracteres, sem repetir na mesma categoria (409 `PRATO_DUPLICADO`);
   - descrição opcional até 300 caracteres (texto vazio vira `null`);
   - `preco_centavos` inteiro maior que zero;
   - `PATCH /disponivel` liga e desliga o prato no cardápio do cliente;
   - a lista traz `categoria_nome` (JOIN) e vem ordenada pela ordem da categoria e pelo nome do prato.
3. Telas: `categorias.html` (criar, editar, apagar), `pratos.html` (lista agrupada por categoria, chave de
   disponível, botão editar) e `prato.html` (formulário de criar e editar; preço digitado em reais e convertido
   com `reaisParaCentavos`).

**Concluída quando**
- [ ] "Bebidas" e "bebidas" não podem coexistir;
- [ ] categoria com prato não é apagada e a tela explica o motivo;
- [ ] preço `0`, negativo ou decimal (`25.9`) devolve 400;
- [ ] digitar `25,90` na tela grava `2590`;
- [ ] prato indisponível continua na lista do admin, marcado como "esgotado";
- [ ] `disponivel` chega como `true`/`false`.

### P1.3 — Mesas e QR Code (semana 4)

**Como criar**
1. Mesas: número inteiro de 1 a 999, sem repetir (409 `MESA_DUPLICADA`). Apagar mesa que já tem pedidos:
   409 `MESA_COM_PEDIDOS`. A lista traz o campo `link` de cada mesa: `new URL('/mesa/' + id, URL_PUBLICA).href`.
2. `src/admin/mesas/qrcode.js`: `GET /:mesaId` confere se a mesa existe (404 `MESA_NAO_ENCONTRADA`) e responde
   `QRCode.toBuffer(link, { type: 'png', width: 512, margin: 2 })` com `res.type('png')`.
3. Telas: `mesas.html` (criar, apagar, miniatura do QR Code e link) e `qrcodes.html` (cartões para imprimir com
   "Mesa N", o QR Code e o link; botão Imprimir com `window.print()`; `@media print` esconde menu e botões).
4. Teste no celular conforme a seção 14.3.

**Concluída quando**
- [ ] mesa repetida devolve 409; mesa com pedidos não é apagada;
- [ ] `GET /api/qrcode/1` devolve uma imagem PNG; mesa inexistente devolve 404;
- [ ] a impressão mostra só os cartões;
- [ ] um celular no mesmo Wi-Fi abre o link lido do cartão impresso.

## 11. Parte 2 — Cliente

**Pastas:** `src/cliente/`, `public/mesa/`, `tests/cliente/`.
**Entrega:** cardápio aberto pelo QR Code, carrinho, envio do pedido e acompanhamento.
Todas as rotas desta parte são **públicas** (sem `exigirAuth`).

**Rotas**

| Método | Rota | Corpo | Resposta |
| --- | --- | --- | --- |
| GET | `/api/mesas/:id` | — | `{ id, numero }` ou 404 `MESA_NAO_ENCONTRADA` |
| GET | `/api/cardapio` | — | Categorias com seus pratos disponíveis |
| POST | `/api/pedidos` | mesa_id, itens: [{ prato_id, quantidade, observacao }] | 201 com o pedido e o total |
| GET | `/api/pedidos/:id` | — | Pedido com itens e status, ou 404 `PEDIDO_NAO_ENCONTRADO` |

### P2.1 — Cardápio (semana 2)

**Como criar**
1. `GET /api/mesas/:id` e `GET /api/cardapio`: só pratos com `disponivel = 1`, agrupados por categoria na
   ordem definida pelo admin; categorias sem prato disponível não aparecem.
2. `public/mesa/index.html` + `mesa.js`: lê o id da mesa na URL (`location.pathname`), mostra "Mesa N" e o
   cardápio em cartões com nome, descrição e preço em reais. Mesa inexistente mostra uma mensagem amigável.

**Concluída quando**
- [ ] `/mesa/1` mostra o cardápio do seed no celular (360px), sem os pratos indisponíveis;
- [ ] `/mesa/999` mostra "Mesa não encontrada".

### P2.2 — Carrinho e pedido (semana 3)

**Como criar**
1. Carrinho no navegador: botão "+" em cada prato, painel fixo no rodapé com quantidade e total, lista com
   quantidade, observação (até 140 caracteres) e remover. Guarde em `sessionStorage`.
2. `POST /api/pedidos`:
   - de 1 a 30 itens; quantidade de 1 a 20 por item (400);
   - mesa inexistente: 404 `MESA_NAO_ENCONTRADA`;
   - prato inexistente ou indisponível: 422 `PRATO_INDISPONIVEL`, dizendo qual;
   - **o servidor busca os preços no banco e calcula o total**; preço vindo do navegador é ignorado;
   - pedido e itens gravados numa **transação** (`db.transaction`), copiando nome e preço do prato;
   - o pedido nasce com status `recebido`.
3. Botão "Enviar para a cozinha" chama a rota; no sucesso, limpa o carrinho e vai para o acompanhamento.

**Concluída quando**
- [ ] o total gravado é o calculado pelo servidor, mesmo se o navegador mandar outro;
- [ ] pedido com prato indisponível devolve 422 e nada fica gravado;
- [ ] recarregar a página não perde o carrinho.

### P2.3 — Acompanhamento (semana 4)

**Como criar**
1. `GET /api/pedidos/:id`.
2. `public/mesa/pedido.html` + `pedido.js`: número do pedido, itens, total e a etapa atual
   (Recebido → Preparando → Pronto → Entregue, ou Cancelado), atualizando a cada 15 segundos.

**Concluída quando**
- [ ] a mudança de status feita pela cozinha aparece na tela do cliente em até 15 segundos;
- [ ] pedido inexistente mostra uma mensagem amigável.

## 12. Parte 3 — Cozinha

**Pastas:** `src/cozinha/`, `public/cozinha/`, `tests/cozinha/`.
**Entrega:** fila de pedidos, mudança de status e cancelamento.
As rotas exigem token. O roteador aplica o `exigirAuth` só no sub-roteador `/cozinha` (mesmo padrão da Parte 1).
Enquanto a P1.1 não estiver na `main`, construa sem o `exigirAuth` e acrescente depois.

**Rotas**

| Método | Rota | Corpo | Resposta |
| --- | --- | --- | --- |
| GET | `/api/cozinha/pedidos` | — | Pedidos em `recebido`, `preparando` e `pronto`, com mesa e itens |
| PATCH | `/api/cozinha/pedidos/:id/status` | status | Pedido atualizado |
| POST | `/api/cozinha/pedidos/:id/cancelar` | — | Pedido cancelado |

### P3.1 — Fila (semana 2)

**Como criar**
1. `GET /api/cozinha/pedidos`: pedidos abertos, mais antigos primeiro, com número da mesa, itens
   (nome, quantidade, observação) e `minutos_espera` (calculado a partir de `criado_em`).
2. `public/cozinha/index.html` + `fila.js`: três colunas (Recebido, Preparando, Pronto) com um cartão por
   pedido; atualiza a cada 10 segundos; pedido com mais de 20 minutos aparece destacado.

**Concluída quando**
- [ ] os pedidos abertos do seed aparecem nas colunas certas;
- [ ] pedidos entregues e cancelados não aparecem.

### P3.2 — Status e cancelamento (semana 3)

**Como criar**
1. `PATCH /status`: só avança uma etapa (recebido → preparando → pronto → entregue). Pular, voltar ou mexer em
   pedido entregue ou cancelado: 409 `TRANSICAO_INVALIDA`. Pedido inexistente: 404 `PEDIDO_NAO_ENCONTRADO`.
   Atualiza `atualizado_em`.
2. `POST /cancelar`: só pedido em `recebido`; nos outros casos, 409 `CANCELAMENTO_NAO_PERMITIDO`.
3. Acrescente o `exigirAuth` assim que a P1.1 estiver na `main`.

**Concluída quando**
- [ ] avançar uma etapa funciona; pular devolve 409;
- [ ] cancelar só funciona em `recebido`;
- [ ] sem token, as rotas devolvem 401.

### P3.3 — Tela da cozinha completa (semana 4)

**Como criar**
1. Botão "Avançar" em cada cartão (o texto mostra a próxima etapa) e "Cancelar" nos pedidos recebidos, com
   `confirm()`.
2. Login: se não houver token, `exigirLogin()` leva para `/admin/`; depois do login, o admin volta para `/cozinha/`.

**Concluída quando**
- [ ] o pedido anda da coluna Recebido até sumir da fila ao ser entregue;
- [ ] o cliente vê cada mudança na tela de acompanhamento (teste junto com a Parte 2).

## 13. Como o assistente deve ajudar

- Os desenvolvedores são iniciantes: explique o que o código faz e por quê, em português.
- Antes de ajudar, confirme em qual parte e em qual entrega (P1.1, P2.2...) o desenvolvedor está.
- Gere um arquivo por vez, na ordem repositório → service → rotas → testes → tela.
- Prefira a solução mais simples que cumpra as regras deste arquivo. Não acrescente funcionalidades do
  "fora do escopo" (seção 1) sem o desenvolvedor pedir.
- Não invente rotas, tabelas, campos ou códigos de erro. Se faltar algo, diga o que falta e sugira a mudança
  neste arquivo para o grupo aprovar.
- Não altere arquivos de outra parte sem avisar.
- Mudança no banco é sempre uma migration nova.
- Comandos em PowerShell, um por linha.

## 14. Primeiros passos e problemas comuns

### 14.1 Base comum (semana 1, uma pessoa monta e as outras revisam)

1. Estrutura de pastas da seção 3, `package.json` com os scripts e as dependências:

```powershell
npm install express@5 better-sqlite3 zod bcrypt jsonwebtoken qrcode
npm install -D vitest supertest
```

2. `config.js`, `conexao.js`, `migrar.js`, `migrar-cli.js`, `resetar.js`, `seed.js`, `001_inicial.sql` e `erros.js`.
3. `app.js` com os arquivos estáticos, as três linhas de rotas comentadas, `rotaNaoEncontrada` e `tratarErros`.
4. `public/comum/` (`api.js`, `formato.js`, `estilo.css`), `vitest.config.js` e `tests/ajuda.js`.
5. Um teste básico: o seed cria os dados certos, rota inexistente devolve 404 e JSON malformado devolve 400.
6. `.env.example`, `.gitignore`, `README.md` e `CLAUDE.md`.

### 14.2 Configurar a máquina de cada desenvolvedor

```powershell
cd ~\estudos
git clone <URL-do-repositório>
cd cardapio-digital
npm install
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Cole o valor gerado em `JWT_SECRET` no `.env` e troque a `SEED_SENHA_ADMIN`. Depois:

```powershell
npm run db:resetar
npm test
npm run dev
```

Telas: `http://localhost:3000/admin`, `/mesa/1` e `/cozinha` (login `admin@teste.com` e a senha do `.env`).

`.env.example`:

```
PORT=3000
DB_ARQUIVO=cardapio.db
JWT_SECRET=troque-por-um-valor-com-pelo-menos-32-caracteres
SEED_SENHA_ADMIN=troque-esta-senha
URL_PUBLICA=http://localhost:3000
```

### 14.3 Testar no celular

1. `ipconfig` no PowerShell e anote o "Endereço IPv4" do Wi-Fi (por exemplo, `192.168.0.15`).
2. No `.env`, `URL_PUBLICA=http://192.168.0.15:3000`, e reinicie o `npm run dev`.
3. Quando o Windows perguntar sobre o firewall, permita o Node.js em **Redes privadas**
   (se a rede estiver como "Pública", mude para "Privada").
4. Com o celular no mesmo Wi-Fi, abra `http://192.168.0.15:3000/mesa/1`. Antes de uma apresentação, confira
   o IP: se mudou, reimprima os QR Codes.

### 14.4 Problemas comuns

| Sintoma | Solução |
| --- | --- |
| "execução de scripts foi desabilitada" | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| "Variável JWT_SECRET ausente" | Confira o `.env` e o tamanho do segredo (32 ou mais caracteres) |
| Tabela ou coluna inexistente | `npm run db:migrar`; se continuar, `npm run db:resetar` |
| Banco travado (`SQLITE_BUSY`) | Pare o servidor (`Ctrl+C`) e tente de novo |
| Erro ao instalar `better-sqlite3` ou `bcrypt` | Use o Node.js LTS |
| Rotas do cliente devolvem 401 | O `exigirAuth` foi aplicado fora de `/admin` ou `/cozinha` (seção 3) |
| Celular não abre o QR Code | Confira a `URL_PUBLICA`, o Wi-Fi e o firewall (seção 14.3) |
| Preço gravado errado (`2589`) | Use `reaisParaCentavos` (seção 6) |
