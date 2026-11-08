# Cardápio Digital

Cardápio acessado pelo QR Code da mesa: o cliente faz o pedido pelo celular, a cozinha acompanha
em tempo quase real e o dono administra pratos e mesas.

Projeto de estudo desenvolvido em equipe de 3 pessoas, com revisão obrigatória de Pull Requests.

> **Referência completa do projeto:** [`AGENTS.md`](AGENTS.md) — regras do banco, rotas da API,
> divisão das partes e fluxo de trabalho. Este README é só a porta de entrada.

## Funcionalidades

| Quem usa | O que faz | Onde |
| --- | --- | --- |
| Dono (admin) | Login, cadastro de categorias, pratos e mesas, impressão dos QR Codes | `/admin` |
| Cliente | Abre o cardápio pelo QR Code, monta o carrinho, envia e acompanha o pedido | `/mesa/:id` |
| Cozinha | Fila de pedidos, mudança de status, fechamento de conta, resumo do dia | `/cozinha` |

## Telas

_Adicionar prints quando as telas estiverem prontas._

| Cardápio (cliente) | Fila da cozinha | Painel do dono |
| --- | --- | --- |
| _print_ | _print_ | _print_ |

## Tecnologias

Node.js · Express · SQLite (better-sqlite3) · HTML, CSS e JavaScript puro · Zod · bcrypt · JWT · Vitest · Supertest

## Como rodar

Pré-requisitos: [Git](https://git-scm.com/) e [Node.js LTS](https://nodejs.org/) (versão 20.6 ou mais nova).

```powershell
git clone <URL-do-repositório>
cd cardapio-digital
npm install
Copy-Item .env.example .env
npm run db:resetar
npm run dev
```

Antes do `npm run db:resetar`, edite o `.env` e troque os valores de `JWT_SECRET` e `SEED_SENHA_ADMIN`.

Com o servidor rodando:

- Painel do dono: <http://localhost:3000/admin> (login `admin@teste.com` e a senha definida no `.env`)
- Cardápio da mesa 1: <http://localhost:3000/mesa/1>
- Cozinha: <http://localhost:3000/cozinha>

> No Linux ou Mac, use `cp .env.example .env` no lugar de `Copy-Item`.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o servidor e reinicia a cada mudança |
| `npm start` | Sobe o servidor |
| `npm test` | Roda os testes |
| `npm run db:migrar` | Aplica as migrations novas no banco local |
| `npm run db:resetar` | Recria o banco local do zero (migrations + dados de exemplo) |

## Estrutura

```
src/
├── db/            # conexão, migrations e seed
├── middlewares/   # autenticação e tratamento de erros
├── admin/         # Parte 1 — painel do dono
├── cliente/       # Parte 2 — experiência do cliente
└── cozinha/       # Parte 3 — cozinha e operação
public/            # telas (admin, mesa, cozinha)
tests/
```

Detalhes em [`AGENTS.md`, seção 3](AGENTS.md#3-estrutura-de-pastas).

## Equipe

| Parte | Responsável |
| --- | --- |
| 1 — Painel do dono | _preencher_ |
| 2 — Experiência do cliente | _preencher_ |
| 3 — Cozinha e operação | _preencher_ |

## Como contribuir

1. Crie uma branch a partir da `main`: `feat/nome-da-tarefa` ou `fix/nome-do-ajuste`.
2. Faça commits pequenos em [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat:`, `fix:`, `test:`).
3. Rode `npm test` antes de abrir o Pull Request.
4. Abra o PR descrevendo o que mudou e como testar. Outra pessoa da equipe revisa e aprova.
5. Mudou o banco? Crie uma migration nova e avise o grupo.

Regras completas em [`AGENTS.md`, seções 4.4 e 10](AGENTS.md).

## Usando assistentes de IA

O arquivo [`AGENTS.md`](AGENTS.md) é lido automaticamente por ferramentas como Codex, Cursor e Copilot.
Para o Claude Code, o repositório tem um `CLAUDE.md` com a linha `@AGENTS.md`, que importa o mesmo conteúdo.
