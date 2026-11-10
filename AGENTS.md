# AGENTS.md

Guia operacional do projeto. Serve de referência pra desenvolvedores humanos e pra assistentes de IA (Claude Code, Cursor, etc.). Mantenha este arquivo atualizado sempre que uma decisão de arquitetura ou regra de negócio mudar.

> O que o produto faz e por quê está em [`PRD.md`](PRD.md). Este arquivo diz **como** construir.

---

## Índice

- [1. O projeto](#1-o-projeto)
- [2. Stack](#2-stack)
- [3. Princípio arquitetural central: anti-lock-in do Supabase](#3-princípio-arquitetural-central-anti-lock-in-do-supabase)
- [4. Estrutura de pastas](#4-estrutura-de-pastas)
- [5. Como rodar localmente (setup inicial)](#5-como-rodar-localmente-setup-inicial)
- [6. Regras de negócio do domínio](#6-regras-de-negócio-do-domínio)
  - [6.1 Identidade e sessão da mesa](#61-identidade-e-sessão-da-mesa)
  - [6.2 Modelo: comanda, pedido e item](#62-modelo-comanda-pedido-e-item)
  - [6.3 Estados do pedido](#63-estados-do-pedido)
  - [6.4 Estados da comanda](#64-estados-da-comanda)
  - [6.5 Edição e cancelamento pelo cliente](#65-edição-e-cancelamento-pelo-cliente)
  - [6.6 Cancelamento pela cozinha (2 etapas)](#66-cancelamento-pela-cozinha-2-etapas)
  - [6.7 Cardápio e mesas](#67-cardápio-e-mesas)
  - [6.8 Pagamento](#68-pagamento)
  - [6.9 Autenticação e papéis](#69-autenticação-e-papéis)
  - [6.10 Auditoria e log](#610-auditoria-e-log)
  - [6.11 Rotinas automáticas (sem servidor)](#611-rotinas-automáticas-sem-servidor)
  - [6.12 Multi-tenancy](#612-multi-tenancy)
- [7. Row Level Security (RLS) — autorização mínima](#7-row-level-security-rls--autorização-mínima)
- [8. Convenções de código](#8-convenções-de-código)
- [9. Variáveis de ambiente](#9-variáveis-de-ambiente)
- [10. Configurações runtime (gerenciáveis pela gerência)](#10-configurações-runtime-gerenciáveis-pela-gerência)
- [11. Fluxo de desenvolvimento](#11-fluxo-de-desenvolvimento)
  - [11.4 Qualidade visual (Impeccable)](#114-qualidade-visual-impeccable)
- [12. Dos e Don'ts](#12-dos-e-donts)
- [13. Roadmap (ordem das entregas)](#13-roadmap-ordem-das-entregas) — 16 itens
- [14. Prompts para Claude Code (por etapa do roadmap)](#14-prompts-para-claude-code-por-etapa-do-roadmap)
- [15. Decisões pendentes e contato](#15-decisões-pendentes-e-contato)
- [16. Histórico de revisões deste arquivo](#16-histórico-de-revisões-deste-arquivo)

---

## 1. O projeto

Aplicação web comercial para estabelecimentos do setor alimentício. Fluxo:

- Cliente escaneia QR Code fixo na mesa, abre o cardápio no navegador do celular, monta um pedido, envia, acompanha o status (recebido, preparando, pronto, entregue), pode enviar novos pedidos na mesma conta, opcionalmente solicita edição/cancelamento e paga por Pix no fim.
- Cozinha/atendimento vê pedidos em tempo real num tablet, altera estados, cancela em 2 etapas, confirma pagamento e fecha a mesa. Toda modificação vai pro log de auditoria.
- Gerência gerencia cardápio, mesas, equipe, configurações do estabelecimento e consulta a auditoria.

MVP é mono-tenant: um deploy atende um estabelecimento. Multi-tenant fica pra fase 2.

Desenvolvedor é iniciante usando Windows + VS Code + PowerShell, aprendendo Node.js, Git e conceitos de backend. Priorize explicações claras de cada peça nova e evite introduzir dependências ou padrões sem justificativa. Comandos de terminal nos exemplos são em **PowerShell**.

---

## 2. Stack

| Camada | Escolha |
|---|---|
| Linguagem | TypeScript `strict` (sem `any`) |
| Backend / BaaS | Supabase cloud (Postgres + Auth + Realtime + Storage) |
| Cliente Supabase | `@supabase/supabase-js` (usado SÓ em `src/repositories/`) |
| Frontend | React 18 + Vite |
| Rotas | `react-router-dom` |
| Estilo | Tailwind CSS v4 via plugin `@tailwindcss/vite` (mobile-first) |
| Validação I/O | Zod |
| Testes | Vitest (unitários em lógica pura) |
| Hospedagem frontend | Vercel (deploy automático em push na main) |
| Migrations de banco | Supabase CLI (SQL versionado em `supabase/migrations/`) |
| Backup | GitHub Action diária com `pg_dump` → Backblaze B2 ou S3 |
| Qualidade visual (dev) | [Impeccable](https://github.com/pbakaus/impeccable) — ver [§11.4](#114-qualidade-visual-impeccable) |

**Dependências de runtime** (`dependencies`): `react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js`, `zod`.
**Dependências de desenvolvimento** (`devDependencies`): `typescript`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `vitest`, `@types/react`, `@types/react-dom`, `supabase` (CLI), `impeccable`.

Versões fixadas no item 1 (2026-11-09): React **18** (`react`, `react-dom`, `@types/*` na linha 18, como diz a tabela acima), Zod 4, TypeScript 7, Vite 8, Vitest 5, Tailwind 4. A sintaxe Zod dos exemplos deste arquivo (`z.string().uuid()`, `.datetime()`) ainda funciona no Zod 4; em código novo prefira as formas do v4 (`z.uuid()`, `z.iso.datetime({ offset: true })`).

Regra prática: se o código roda no navegador do usuário, é `dependencies`. Se só roda na sua máquina (build, teste, CLI), é `devDependencies`.

**Não use ORM** (Prisma, Drizzle, TypeORM etc.) nem banco local alternativo (SQLite). O acesso a dados é o SDK do Supabase isolado nos repositories; o schema é SQL puro nas migrations. Não introduza libs pesadas (Redux, MUI, tRPC etc.) sem discutir. React Query/TanStack Query pode entrar quando o padrão repository não bastar pra cache.

Tailwind v4 dispensa `tailwind.config.ts`, `postcss.config.js` e `autoprefixer`: a configuração do tema fica em `src/index.css` com `@import "tailwindcss";` e um bloco `@theme { ... }`.

---

## 3. Princípio arquitetural central: anti-lock-in do Supabase

O projeto usa Supabase pela velocidade, MAS é desenhado pra poder migrar pra Node próprio no futuro sem reescrita completa. Toda decisão de arquitetura respeita essas 5 regras:

1. **Lógica de negócio fica em TypeScript puro no frontend**, em `src/domain/*`. Nunca em triggers SQL, nunca em RLS, raramente em Edge Functions.
2. **SDK do Supabase é isolado em `src/repositories/*`** (padrão Repository). Nenhum componente React chama `supabase.from(...)` direto. Trocar o backend depois = reescrever só essa pasta.
3. **RLS existe só pra autorização mínima** (quem pode ler/escrever quais linhas), nunca pra regras de negócio complexas.
4. **Schema E configuração do Supabase são versionados no repositório**: tabelas, funções SQL e políticas em `supabase/migrations/`; configurações de Auth em `supabase/config.toml` (aplicadas com `npx supabase config push`). Nada de schema ou configuração criado pelo dashboard. (Criar *dados*, como o primeiro usuário, pelo dashboard é permitido — ver §6.9.)
5. **Edge Functions só quando absolutamente necessário** — no MVP, só pra operações que exigem a `service_role` key (criar funcionário, trocar PIN). Ver §6.9.

Se uma mudança for violar alguma dessas regras, pare e discuta antes de implementar.

---

## 4. Estrutura de pastas

```
restaurante-qr/
├── AGENTS.md                      ← este arquivo (como construir)
├── PRD.md                         ← requisitos do produto (o que construir)
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts                 ← plugins react + tailwind, alias @ → src
├── .env.example                   ← template, SEM valores reais
├── .gitignore                     ← inclui .env.local
├── supabase/
│   ├── config.toml                ← config de Auth versionada (anon sign-in etc.)
│   ├── migrations/                ← schema, funções e RLS em SQL versionado
│   └── functions/                 ← Edge Functions (só gestão de equipe no MVP)
│       └── equipe/
├── src/
│   ├── main.tsx                   ← entry point
│   ├── App.tsx                    ← router raiz
│   ├── index.css                  ← Tailwind v4 + @theme
│   ├── pages/                     ← rotas por área
│   │   ├── mesa/                  ← /mesa/:numero — fluxo do cliente
│   │   ├── cozinha/               ← /cozinha — operação
│   │   ├── gerencia/              ← /gerencia — admin
│   │   └── login/                 ← /login — equipe
│   ├── domain/                    ← REGRAS DE NEGÓCIO (funções puras, zero I/O)
│   │   ├── pedido/
│   │   │   ├── estado.ts          ← máquina de estados do pedido
│   │   │   ├── cancelamento.ts    ← regras de 2 etapas
│   │   │   ├── edicao.ts          ← janela livre vs solicitação
│   │   │   ├── autoCancelamento.ts← quais pedidos expiraram
│   │   │   └── calculo.ts         ← total, subtotais
│   │   ├── comanda/
│   │   │   ├── estado.ts          ← Aberta → AguardandoPagamento → Paga → Fechada
│   │   │   └── sessao.ts          ← expiração por inatividade
│   │   ├── cardapio/
│   │   │   ├── validacao.ts
│   │   │   └── formatacao.ts      ← centavos ↔ R$
│   │   ├── pagamento/
│   │   │   └── pix.ts             ← payload BR Code (lib decidida no item 12)
│   │   └── auditoria/
│   │       └── evento.ts          ← tipos de evento + builders
│   ├── repositories/              ← ÚNICO lugar com Supabase SDK
│   │   ├── supabase.ts            ← cliente único exportado
│   │   ├── mesaRepo.ts
│   │   ├── comandaRepo.ts
│   │   ├── pedidoRepo.ts
│   │   ├── cardapioRepo.ts
│   │   ├── authRepo.ts
│   │   ├── equipeRepo.ts          ← chama a Edge Function de equipe
│   │   ├── auditoriaRepo.ts
│   │   ├── configRepo.ts
│   │   └── storageRepo.ts         ← upload de fotos
│   ├── hooks/                     ← React hooks consumindo repositories
│   │   ├── useAuth.ts
│   │   ├── useComanda.ts
│   │   ├── usePedidosCozinha.ts
│   │   └── useCardapio.ts
│   ├── components/                ← UI reutilizável
│   ├── schemas/                   ← schemas Zod de domínio
│   │   ├── pedido.ts
│   │   ├── comanda.ts
│   │   ├── cardapio.ts
│   │   └── auth.ts
│   └── lib/                       ← utilitários
│       ├── config.ts              ← ConfigContext com configs runtime
│       └── formato.ts             ← formatação de datas, moeda
└── tests/
    ├── domain/                    ← testa toda função pura
    │   ├── pedido/estado.test.ts
    │   ├── pedido/cancelamento.test.ts
    │   └── ...
    └── schemas/                   ← testa validações Zod críticas
```

---

## 5. Como rodar localmente (setup inicial)

Pré-requisitos: Node.js 20+, Git, conta no Supabase cloud (free tier basta pra dev), conta na Vercel (quando for subir).

```powershell
# 1. Instalar dependências (Impeccable já vem via devDependencies)
npm install

# 2. Registrar o hook do Impeccable (primeira vez do projeto)
npx impeccable install

# 3. Gerar PRODUCT.md (só na primeira sessão), dentro do Claude Code:
#   /impeccable init
#   /impeccable document   (só depois que existir alguma UI)

# 4. Copiar template de env e preencher
Copy-Item .env.example .env.local
# Preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (do projeto no supabase.com)

# 5. Ligar ao projeto remoto, aplicar migrations e config de Auth
npx supabase link --project-ref SEU_REF
npx supabase db push
npx supabase config push

# 6. Rodar o app
npm run dev
```

Em sessões seguintes, só `npm install` + `npm run dev` bastam. Os passos 2, 3 e 5 são one-time (o 5 se repete quando houver migration nova).

Para rodar com Supabase local (opcional, mais pesado):

```powershell
# Exige Docker Desktop instalado
npx supabase start     # sobe Postgres + Studio + Auth locais
npx supabase db reset  # aplica migrations do zero
```

---

## 6. Regras de negócio do domínio

Decisões tomadas e congeladas. Não altere sem conversar.

### 6.1 Identidade e sessão da mesa

- QR da mesa aponta pra URL simples com o **número** da mesa: `https://app.restaurante.com/mesa/42`.
- Ao abrir a URL, o app faz **login anônimo do Supabase** (`signInAnonymously`) se ainda não houver sessão. Isso dá ao cliente um `auth.uid()` estável no navegador, que é o que a RLS usa pra saber "de qual comanda é este cliente" (§7). O cliente não vê nada disso.
- O vínculo cliente ↔ comanda fica na tabela `sessoes_mesa` (`usuario_id`, `comanda_id`, `nome_cliente`, `criado_em`).
- O `localStorage` guarda só conveniências da UI, na chave `sessao-mesa-{numero}` (ex: nome opcional digitado). A sessão de Auth é persistida pelo próprio SDK.
- Vários clientes na mesma mesa COMPARTILHAM uma única comanda: o primeiro a abrir a mesa cria a comanda; os seguintes entram nela.
- Fechamento da comanda é MANUAL pelo garçom via "fechar mesa" (§6.4), com fallback automático se ficar inativa por `timeout_sessao_mesa_h` horas (§6.11).
- Esse timeout é CONFIGURÁVEL pela gerência. Nunca hardcode.
- Risco aceito no MVP: quem souber a URL de uma mesa consegue entrar na comanda dela. Equivale a sentar à mesa. Não tente "resolver" isso no MVP.

### 6.2 Modelo: comanda, pedido e item

Três níveis, sempre com esses nomes:

| Conceito | O que é | Tabela |
|---|---|---|
| **Comanda** | A conta da mesa, do primeiro pedido até o fechamento. Uma aberta por mesa por vez. | `comandas` |
| **Pedido** | Cada envio de itens feito pelo cliente ("rodada"). Uma comanda tem 1..N pedidos. **O estado de preparo vive aqui.** | `pedidos` |
| **Item do pedido** | Linha com item do cardápio, quantidade e preço congelado. | `itens_pedido` |

- O cliente monta um **carrinho local** (só na tela, sem gravar) e toca "enviar pedido". Isso cria um `pedido` em `Recebido` com seus `itens_pedido`. Depois ele pode enviar outros pedidos na mesma comanda.
- Cada `itens_pedido` grava `preco_centavos_snapshot` — o preço daquele momento. Mudar o preço no cardápio NUNCA afeta pedidos já feitos.
- Remover um item de um pedido NÃO apaga a linha: seta `removido_em`. A auditoria precisa enxergar o que existiu.
- Comanda tem campo `observacao` (texto livre, geral). SEM observação por item.
- Numeração: `comandas.numero` e `pedidos.numero` são sequenciais GLOBAIS, nunca reiniciam (colunas `bigint generated always as identity`). A cozinha se refere ao pedido pelo número (ex: pedido #1248 da comanda #530).
- **Total da comanda** = soma de `quantidade × preco_centavos_snapshot` dos itens não removidos, de pedidos não `Cancelado`. Calculado em `src/domain/pedido/calculo.ts`, nunca no banco.

### 6.3 Estados do pedido

8 estados, válidos pelo pedido inteiro (não por item):

```
Recebido → Preparando → Pronto → Entregue → Finalizado
                                               └─ automático quando a comanda é fechada

Estados temporários: EdicaoSolicitada, CancelamentoPendente
Estado final lateral: Cancelado
```

Transições válidas, implementadas em `src/domain/pedido/estado.ts`:

- `Recebido → Preparando` (cozinha aceita)
- `Preparando → Pronto`
- `Pronto → Entregue`
- `Entregue → Finalizado` (quando o garçom fecha a mesa, §6.4)
- `Recebido → Cancelado` (livre, por cliente, cozinha ou sistema)
- `Preparando → CancelamentoPendente → Cancelado` (2 etapas pela cozinha)
- `Pronto → CancelamentoPendente → Cancelado` (2 etapas pela cozinha)
- `CancelamentoPendente → estado anterior` (funcionário desistiu na 2ª etapa)
- `(Recebido|Preparando|Pronto) → EdicaoSolicitada → estado anterior` (edição aplicada ou negada; o pedido SEMPRE volta exatamente pro estado de onde saiu)
- `Entregue → *` BLOQUEADO, exceto `Finalizado`

**Estado anterior**: ao entrar num estado temporário, grava-se `pedidos.estado_anterior`. Ao sair, a única volta permitida é pra esse valor (ou `Cancelado`, no caso de `CancelamentoPendente`), e `estado_anterior` volta a `null`. A tabela de transições sozinha não garante isso — a função `transicaoValida` recebe o pedido inteiro (ver §8).

Cada mudança de estado grava `pedidos.estado_desde` (timestamptz). É ele que mede a janela de edição e o auto-cancelamento.

Toda transição produz evento no log de auditoria.

### 6.4 Estados da comanda

```
Aberta → AguardandoPagamento → Paga → Fechada
```

- `Aberta`: aceita novos pedidos.
- `AguardandoPagamento`: cliente tocou "já paguei". Não aceita novos pedidos. O caixa pode devolver pra `Aberta` se o cliente quiser pedir mais.
- `Paga`: caixa conferiu o extrato e tocou "marcar como pago".
- `Fechada`: garçom tocou "fechar mesa". Nesse momento todos os pedidos `Entregue` viram `Finalizado`. Encerra as `sessoes_mesa` daquela comanda.
- **Só pode fechar** se a comanda estiver `Paga` E nenhum pedido estiver em `Recebido`, `Preparando`, `Pronto`, `EdicaoSolicitada` ou `CancelamentoPendente`. Regra em `src/domain/comanda/estado.ts` (`podeFecharComanda`).
- Comanda com todos os pedidos cancelados (total zero) pode ir direto de `Aberta` pra `Fechada`.
- `comandas.ultima_atividade_em` é atualizada a cada pedido enviado, item alterado ou mudança de estado. Base do fallback de inatividade (§6.11).

### 6.5 Edição e cancelamento pelo cliente

- **Janela livre**: estado = `Recebido` OU (estado = `Preparando` E `agora − estado_desde < janela_edicao_preparando_min` minutos). Padrão `janela_edicao_preparando_min` = 2, CONFIGURÁVEL. No limite exato, a janela já está FECHADA (comparação estrita `<`).
- Dentro da janela: cliente edita quantidades, remove itens ou cancela o pedido direto, sem aprovação. Cancelar o pedido em `Preparando` dentro da janela vai direto pra `Cancelado` (é exceção da janela, registrada no log como ação do cliente).
- Fora da janela: botão "editar" some, aparece "chamar garçom", que leva o pedido pra `EdicaoSolicitada`. O garçom resolve no tablet (aplica a edição ou nega) e o pedido volta ao estado anterior.
- Cancelamento parcial (remover 1 item) segue as MESMAS regras do cancelamento total.
- **Auto-cancelamento**: pedido em `Recebido` há mais de `timeout_auto_cancelamento_min` minutos (padrão 15, CONFIGURÁVEL) é cancelado com `ator_tipo = sistema`. Como isso roda está em §6.11.

### 6.6 Cancelamento pela cozinha (2 etapas)

- Vale pra pedidos em `Preparando` ou `Pronto`. Em `Recebido`, a cozinha cancela direto (transição livre), mas o motivo continua obrigatório.
- 1ª etapa: funcionário toca "cancelar", escolhe o motivo; pedido vai pra `CancelamentoPendente`.
- 2ª etapa: modal exige CONFIRMAÇÃO EXPLÍCITA — digitar o número do pedido OU tocar "confirmar cancelamento" (botão habilitado só após 2s). O MESMO usuário pode confirmar. Desistir devolve o pedido ao estado anterior.
- Motivo é OBRIGATÓRIO: um valor da lista fixa + texto livre opcional (obrigatório quando o motivo é `outro`).
- Lista fixa: `sem_ingrediente`, `erro_de_pedido`, `cliente_desistiu`, `atraso`, `outro`.
- **Regra vale pra TODOS**, inclusive gerência. SEM skip de admin.
- Pedidos em `Entregue` NÃO podem ser cancelados.

### 6.7 Cardápio e mesas

- **Categorias**: CRUD completo pela gerência + reordenação (campo `ordem`, drag-and-drop na UI). Desativar usa `ativa = false`.
- **Itens**: nome, preço em centavos (integer), categoria, `disponivel` (boolean, controla visibilidade), `ativo` (boolean, soft delete), `foto_url` (opcional).
- **Variações**: NÃO existe modelo de variante. "X-Burguer pequeno" e "X-Burguer grande" são itens SEPARADOS.
- **Esgotado**: botão por item que seta `disponivel = false`. Item some do cardápio do cliente mas continua no banco. Reativação manual pela gerência.
- **Soft delete**: "excluir" seta `ativo = false`. Item some de todas as listagens (inclusive gerência, exceto via filtro "mostrar inativos"), mas pedidos antigos preservam a referência.
- **Fotos**: upload pela gerência via Supabase Storage. Bucket `cardapio-fotos` (público, criado por migration). URL pública salva em `foto_url`.
- **Mesas**: tabela `mesas` (`id`, `numero` único, `ativa`). A gerência cadastra mesas e imprime o QR de cada uma em `/gerencia/mesas`. Mesa inativa mostra "mesa indisponível" ao escanear.

### 6.8 Pagamento

- **Momento**: pós-pago (depois de comer). Fluxo tradicional brasileiro.
- **Método no MVP**: APENAS Pix estático. O sistema gera um QR Code Pix (padrão BR Code) com a `chave_pix` do estabelecimento e o **valor total da comanda**, mais o código "copia e cola".
- **Confirmação**: 100% manual pelo caixa. Caixa confere o extrato no celular e toca "marcar como pago".
- **Sem integração com gateway no MVP**. Mercado Pago, Asaas, Efí ficam pra fase 2.
- **Sem divisão de conta no MVP**. Clientes dividem entre si por fora.

### 6.9 Autenticação e papéis

- **Papéis de funcionário**: 2 — `operacao` (cozinha, caixa e garçom usam a mesma tela) e `gerencia` (admin; também acessa tudo de `operacao`).
- **Cliente**: usuário anônimo do Supabase Auth (§6.1), com NOME OPCIONAL (texto livre em `sessoes_mesa.nome_cliente`, descartado com a comanda).
- **Funcionário**: login por **matrícula** (número atribuído pela gerência) + **PIN de exatamente 6 dígitos numéricos**.
  - Por que 6 e não 4: o Supabase Auth exige senha de no mínimo 6 caracteres por padrão. Baixar esse mínimo enfraquece a segurança de todas as contas.
- **Implementação**: Supabase Auth com email SINTÉTICO. Matrícula `001` vira internamente `001@restaurante.local`. A UI mostra APENAS "Matrícula" + "PIN". O email sintético é detalhe de infraestrutura — funcionário nunca o vê.
- **Papel do funcionário**: fica na tabela `funcionarios` (`usuario_id` → `auth.users.id`, `matricula`, `nome`, `papel`, `ativo`). NÃO usa custom claims no JWT. O `authRepo.getPapelAtual()` lê essa tabela; a RLS usa a função SQL `papel_atual()` (§7). Tudo em migration, nada no dashboard.
- **Criar funcionário e trocar PIN** exigem a `service_role` key, que NUNCA vai pro frontend. Por isso existe uma Edge Function `equipe` (única do MVP) que: confere se quem chama é `gerencia`, e cria o usuário/troca a senha via Admin API. A lógica de validação (formato da matrícula, PIN) é importada de `src/schemas/auth.ts` sempre que possível; se o bundler não permitir, duplique só o schema Zod e comente a origem.
- **Primeiro gerente** (bootstrap, uma vez só): criar o usuário `001@restaurante.local` em Authentication → Users → "Add user" no dashboard (com "Auto confirm"), e então rodar o SQL documentado no README que insere a linha em `funcionarios` com `papel = 'gerencia'`. É criação de DADO, não de schema, por isso é permitido.
- **Garçom responsável pela mesa**: NÃO é registrado no pedido.
- PIN é trocável pela gerência em `/gerencia/equipe`. Desativar funcionário seta `ativo = false` (a RLS passa a negar tudo pra ele).

### 6.10 Auditoria e log

- Tabela `eventos_auditoria`:
  - `id` (uuid), `comanda_id` (uuid, nullable), `pedido_id` (uuid, nullable), `ator_tipo` (`cliente` | `funcionario` | `sistema`), `ator_id` (text, nullable — matrícula, ou `auth.uid()` do cliente anônimo), `tipo_evento` (text), `payload` (jsonb), `motivo` (text, nullable), `criado_em` (timestamptz).
- **Granularidade**: TODA modificação em comanda, pedido e item — criação, adição/remoção/alteração de item, mudança de estado, cancelamento, edição de observação, solicitação de edição, pagamento, fechamento. Também mudanças de cardápio, configurações e equipe.
- **Quem grava**: o repository que faz a mutação, DENTRO da mesma função, logo após a escrita. Nunca o componente.
- **Retenção**: 1 ano. Arquivamento é job administrativo fora do MVP.
- **Append-only puro**: eventos NUNCA são editados ou deletados. A RLS não tem política de UPDATE nem DELETE nessa tabela pra ninguém. Correções são novos eventos apontando pro original via `payload.corrige_id`.
- **Export**: gerência baixa CSV filtrado por período em `/gerencia/auditoria`.
- Limitação conhecida do MVP: como escrita e evento são duas chamadas separadas, uma falha de rede entre elas pode deixar uma mutação sem evento. Aceito no MVP; o repository deve logar o erro no console de forma visível.

### 6.11 Rotinas automáticas (sem servidor)

O MVP não tem servidor próprio nem cron. As duas rotinas automáticas rodam **no tablet da cozinha** (`/cozinha`), que fica aberto durante todo o expediente:

| Rotina | Regra de domínio (pura) | Execução |
|---|---|---|
| Auto-cancelamento | `pedidosExpirados(pedidos, configs, agora)` em `domain/pedido/autoCancelamento.ts` | A cada 60s, a tela da cozinha cancela os pedidos expirados com `ator_tipo = sistema` |
| Sessão inativa | `comandaInativa(comanda, configs, agora)` em `domain/comanda/sessao.ts` | A cada 60s, fecha comandas inativas sem pedidos pendentes. Comanda inativa COM pedidos pendentes ou não paga NÃO fecha sozinha: aparece destacada pro garçom |

- Pode haver mais de um tablet aberto. Por isso a escrita é **condicional** (`update ... where estado = 'Recebido'`): se outro tablet já cancelou, a segunda escrita não afeta nenhuma linha e não gera evento duplicado.
- O app do cliente também usa as mesmas funções puras pra **mostrar** o estado correto (ex: "pedido expirou"), mas não grava.
- Por que não `pg_cron` ou Edge Function agendada: poria regra de negócio no banco/servidor (viola §3). Se o estabelecimento passar a operar sem tablet aberto, isso vira decisão de fase 2.

### 6.12 Multi-tenancy

MVP é MONO-TENANT. Sem coluna `tenant_id`. Um deploy = um estabelecimento. Se virar rede no futuro, é um projeto de migração à parte.

---

## 7. Row Level Security (RLS) — autorização mínima

Supabase exige RLS habilitada por segurança. Políticas devem ser SIMPLES, sem regras de negócio.

### Funções auxiliares (SQL, em migration)

Só consultas de identidade, nenhuma regra de negócio:

```sql
-- papel do funcionário logado, ou null se não for funcionário ativo
create function public.papel_atual() returns text
language sql stable security definer set search_path = public as $$
  select papel from funcionarios where usuario_id = auth.uid() and ativo
$$;

-- comandas às quais o usuário (cliente anônimo) está vinculado
create function public.minhas_comandas() returns setof uuid
language sql stable security definer set search_path = public as $$
  select comanda_id from sessoes_mesa where usuario_id = auth.uid()
$$;
```

`security definer` é necessário pra evitar recursão (a função lê uma tabela que também tem RLS). Explique isso no comentário da migration.

Uma terceira função (decisão 10 de §15) deixa o cliente achar a comanda aberta da mesa que escaneou, já que o SELECT em `comandas` só mostra as comandas às quais ele já está vinculado:

```sql
-- id da comanda não-Fechada de uma mesa ativa, ou null
create function public.comanda_aberta_da_mesa(numero_mesa integer) returns uuid
language sql stable security definer set search_path = public as $$
  select c.id from comandas c join mesas m on m.id = c.mesa_id
  where m.numero = numero_mesa and m.ativa and c.estado <> 'Fechada'
$$;
```

As três funções têm `execute` revogado de `anon` e liberado só pra `authenticated`.

### Políticas

**Todos os usuários autenticados (inclusive cliente anônimo)**:
- SELECT em `itens_cardapio` onde `ativo AND disponivel`
- SELECT em `categorias` onde `ativa`
- SELECT em `mesas` onde `ativa`
- SELECT em `configuracoes` (o cliente precisa de `chave_pix`, nome do estabelecimento e janelas de tempo)
- INSERT em `eventos_auditoria`

**Cliente (qualquer usuário com vínculo em `sessoes_mesa`)**:
- SELECT/INSERT em `sessoes_mesa` onde `usuario_id = auth.uid()`
- INSERT em `comandas` (abrir a comanda da mesa quando não há uma aberta)
- SELECT/UPDATE em `comandas` onde `id in (select minhas_comandas())`
- SELECT/INSERT/UPDATE em `pedidos` e `itens_pedido` da própria comanda
- A checagem fina (janela de edição, estado permite?) fica no frontend. A RLS só impede mexer em comanda de outra mesa.

**Operação** (`papel_atual() in ('operacao', 'gerencia')`):
- SELECT em todas as comandas, pedidos, itens_pedido, sessoes_mesa
- UPDATE em comandas, pedidos, itens_pedido
- SELECT em itens_cardapio e categorias (inclusive indisponíveis), pra exibir pedidos antigos
- SELECT em mesas (inclusive inativas), pra cozinha ver o número de uma mesa desativada com comanda aberta (decisão 11 de §15)

**Gerência** (`papel_atual() = 'gerencia'`):
- CRUD em `itens_cardapio`, `categorias`, `mesas`, `configuracoes`
- SELECT em `funcionarios` (escrita é pela Edge Function `equipe`)
- SELECT em `eventos_auditoria`

**Ninguém**: UPDATE ou DELETE em `eventos_auditoria`. DELETE em `comandas`, `pedidos`, `itens_pedido`.

**Storage**: bucket `cardapio-fotos` público pra leitura; upload/remoção só `gerencia`.

**Trava extra**: além da ausência de política, os privilégios `update, delete, truncate` em `eventos_auditoria` e `delete, truncate` em `comandas`, `pedidos` e `itens_pedido` são revogados de `anon` e `authenticated` (TRUNCATE não passa pela RLS).

**Teste**: [`supabase/testes/rls_roteiro.sql`](supabase/testes/rls_roteiro.sql) cobre os 5 casos do item 3. Pode ser colado no SQL Editor ou rodado com `npx supabase db query --remote --yes -f supabase/testes/rls_roteiro.sql`; termina com um erro proposital que mostra o relatório e desfaz tudo. Atualize-o quando mudar políticas.

**Regra de ouro**: se uma política RLS precisa de IF/ELSE complexo, você está fazendo errado — esse IF/ELSE pertence a `src/domain/*`.

---

## 8. Convenções de código

### Nomenclatura
- Arquivos TS: `camelCase.ts`. Componentes React: `PascalCase.tsx`.
- Tipos TypeScript: `PascalCase` (`Pedido`, `ItemCardapio`).
- Funções: `camelCase` descritivo em português (`validarTransicaoEstado`).
- Constantes: `UPPER_SNAKE_CASE`.
- Enums de domínio: union de strings literais, não `enum` TS:
  ```ts
  type EstadoPedido = 'Recebido' | 'Preparando' | 'Pronto' | ...
  ```
- No banco, estados são `text` com `check (estado in (...))`, mesmos valores do TS.
- Tabelas Postgres: `snake_case`, no plural (`itens_cardapio`, `eventos_auditoria`).
- Colunas Postgres: `snake_case` (`criado_em`, `preco_centavos_snapshot`).
- Conversão entre snake_case (DB) e camelCase (TS) acontece DENTRO do repository.

### Dinheiro
- SEMPRE em centavos (`number` inteiro). NUNCA `float` pra moeda.
- Formatação pra UI só na borda, em `src/lib/formato.ts`:
  ```ts
  export function formatarReal(centavos: number): string {
    return (centavos / 100).toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL'
    })
  }
  ```

### Datas
- Timestamps no banco: `timestamptz` (UTC).
- Formatação pra UI: timezone `America/Fortaleza` (hardcoded no MVP).
- NUNCA manipule datas como string. Use `Date`. Funções de domínio recebem `agora: Date` como argumento (nunca chamam `new Date()` por dentro), pra serem testáveis.

### Padrão Repository
Toda query ao Supabase passa por aqui:

```ts
// src/repositories/cardapioRepo.ts
import { supabase } from './supabase'
import { ItemCardapioSchema, type ItemCardapio } from '@/schemas/cardapio'

export async function listarCardapioCliente(): Promise<ItemCardapio[]> {
  const { data, error } = await supabase
    .from('itens_cardapio')
    .select('id, nome, preco_centavos, categoria_id, disponivel, ativo, foto_url, criado_em')
    .eq('ativo', true)
    .eq('disponivel', true)
    .order('nome')

  if (error) throw new Error(`listarCardapioCliente: ${error.message}`)

  return data.map(row => ItemCardapioSchema.parse({
    id: row.id,
    nome: row.nome,
    precoCentavos: row.preco_centavos,
    categoriaId: row.categoria_id,
    disponivel: row.disponivel,
    ativo: row.ativo,
    fotoUrl: row.foto_url,
    criadoEm: row.criado_em,
  }))
}
```

Regras:
- NUNCA retorne o objeto cru do Supabase. Sempre valide com Zod e retorne o tipo do domínio.
- Converte snake_case → camelCase no mapeamento.
- Erros viram `Error` com mensagem clara. Componentes decidem o que fazer.
- Subscriptions de Realtime também ficam no repository, expostas como `assinarX(callback): () => void` (a função retornada cancela a assinatura).

### Padrão função de domínio
Funções puras, sem efeitos colaterais:

```ts
// src/domain/pedido/estado.ts
export type EstadoPedido =
  | 'Recebido' | 'Preparando' | 'Pronto' | 'Entregue' | 'Finalizado'
  | 'Cancelado' | 'EdicaoSolicitada' | 'CancelamentoPendente'

export interface SituacaoPedido {
  estado: EstadoPedido
  estadoAnterior: EstadoPedido | null // preenchido só nos estados temporários
}

const TRANSICOES: Record<EstadoPedido, readonly EstadoPedido[]> = {
  Recebido: ['Preparando', 'Cancelado', 'EdicaoSolicitada'],
  Preparando: ['Pronto', 'CancelamentoPendente', 'EdicaoSolicitada'],
  Pronto: ['Entregue', 'CancelamentoPendente', 'EdicaoSolicitada'],
  Entregue: ['Finalizado'],
  Finalizado: [],
  Cancelado: [],
  EdicaoSolicitada: ['Recebido', 'Preparando', 'Pronto'],
  CancelamentoPendente: ['Cancelado', 'Preparando', 'Pronto'],
}

export function transicaoValida(pedido: SituacaoPedido, para: EstadoPedido): boolean {
  if (!TRANSICOES[pedido.estado].includes(para)) return false
  // Estados temporários só podem voltar exatamente pra onde estavam
  if (pedido.estado === 'EdicaoSolicitada') return para === pedido.estadoAnterior
  if (pedido.estado === 'CancelamentoPendente') {
    return para === 'Cancelado' || para === pedido.estadoAnterior
  }
  return true
}

export function proximosEstados(pedido: SituacaoPedido): EstadoPedido[] {
  return TRANSICOES[pedido.estado].filter(para => transicaoValida(pedido, para))
}
```

(Exceção da janela livre — cliente cancelando em `Preparando` — é tratada em `edicao.ts`, que chama uma transição explícita documentada; não afrouxe a tabela acima.)

Regras:
- ZERO imports de `supabase`, `fetch`, ou qualquer I/O.
- Apenas lógica pura. Argumentos → resultado determinístico.
- Testada 100% com Vitest em `tests/domain/`.

### Validação Zod
Todo payload (formulário, parâmetro de repository, resposta do banco) passa por Zod:

```ts
// src/schemas/cardapio.ts
import { z } from 'zod'

export const ItemCardapioSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(1).max(100),
  precoCentavos: z.number().int().positive(),
  categoriaId: z.string().uuid(),
  disponivel: z.boolean(),
  ativo: z.boolean(),
  fotoUrl: z.string().url().nullable(),
  criadoEm: z.string().datetime({ offset: true }),
})

export type ItemCardapio = z.infer<typeof ItemCardapioSchema>
```

(`offset: true` é necessário porque o Postgres devolve timestamps como `2026-11-09T12:00:00+00:00`.)

### Testes
- Testar TUDO em `src/domain/*`. É pura, não tem desculpa.
- Testar validações Zod críticas (casos de erro).
- Repositories podem ser testados com Supabase local (fase 2).
- UI: sem automação no MVP, testes manuais sistemáticos.

Rodar: `npm test`

---

## 9. Variáveis de ambiente

`.env.example`:
```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-publica-aqui
```

- `VITE_SUPABASE_ANON_KEY` é PÚBLICA (vai pro bundle do navegador). Não é segredo.
- `SUPABASE_SERVICE_ROLE_KEY` é SEGREDO. NUNCA no frontend, nunca com prefixo `VITE_`. Existe só (a) automaticamente dentro das Edge Functions, e (b) em GitHub Actions (backup) como `secrets.SUPABASE_SERVICE_KEY`.
- `.env.local` é ignorado pelo Git (`.gitignore`). NUNCA commite.

---

## 10. Configurações runtime (gerenciáveis pela gerência)

Tabela `configuracoes` guarda valores que a gerência edita em `/gerencia/config`. Schema: `(chave text primary key, valor text not null, atualizado_em timestamptz, atualizado_por text)`. **Exceção à regra de `id uuid`**: aqui a chave natural é a própria `chave`.

Chaves:

| Chave | Default | Tipo | Descrição |
|---|---|---|---|
| `janela_edicao_preparando_min` | `2` | int ≥ 0 | Minutos de "Preparando" durante os quais o cliente edita livre |
| `timeout_auto_cancelamento_min` | `15` | int > 0 | Minutos em "Recebido" antes de cancelar automaticamente |
| `timeout_sessao_mesa_h` | `4` | int > 0 | Horas sem atividade antes da comanda ser considerada inativa |
| `chave_pix` | `""` | string | Chave Pix do estabelecimento (obrigatória pra exibir pagamento) |
| `nome_estabelecimento` | `""` | string (≤ 25 chars) | Nome exibido em telas e no payload Pix |
| `cidade_estabelecimento` | `""` | string (≤ 15 chars) | Exigida pelo padrão BR Code do Pix |
| `telefone_estabelecimento` | `""` | string | Para contato do cliente |

Os limites de tamanho de nome e cidade vêm do padrão BR Code.

Configs são carregadas no boot via `src/lib/config.ts`, validadas com Zod (convertendo `text` → tipo certo) e injetadas num React Context. NUNCA hardcode esses valores em código. Os defaults acima só existem na migration de seed.

---

## 11. Fluxo de desenvolvimento

### Pra adicionar uma feature
1. Entende a regra de negócio. Confere este AGENTS.md e o PRD.md. Se tiver dúvida, pergunte antes de codar.
2. Escreve a função pura em `src/domain/*` PRIMEIRO, com teste em `tests/domain/*`.
3. Escreve o schema Zod em `src/schemas/*` se precisa validar I/O novo.
4. Adiciona migration em `supabase/migrations/` se muda o banco. Nunca mexa no schema pelo dashboard.
5. Atualiza o repository em `src/repositories/*` se o acesso a dados mudou.
6. Escreve a UI consumindo o repository via hook customizado.
7. Teste manual no navegador (mobile view do DevTools).
8. `npm test` e `npm run build` passando. Commit, push, deploy automático via Vercel.

### Pra corrigir um bug
1. Reproduz manualmente, anota passos.
2. Escreve teste em `tests/domain/*` que falha com o bug (quando aplicável).
3. Corrige.
4. Teste passa.
5. Commit.

### Antes de aceitar sugestão de IA
REJEITE se a sugestão:
- coloca lógica de negócio em RLS, triggers SQL ou Edge Functions sem justificativa forte,
- mistura `supabase.from(...)` dentro de um componente React,
- usa `any` em TypeScript,
- formata dinheiro como float,
- hardcoda valor que deveria estar em `configuracoes`,
- cria tabela ou muda configuração pelo dashboard do Supabase em vez de migration/`config.toml`,
- adiciona lib pesada ou ORM sem discutir (Redux, MUI, tRPC, Prisma, Drizzle etc.),
- coloca a `service_role` key em qualquer lugar do frontend.

### 11.4 Qualidade visual (Impeccable)

> **Verificação obrigatória no item 1**: antes de adicionar ao `package.json`, confirme que o pacote npm `impeccable` corresponde ao repositório `pbakaus/impeccable` e que os comandos abaixo existem na versão instalada (`npx impeccable --help`). Se algo divergir, PARE e pergunte; atualize esta seção com o que for real.

Impeccable roda em dois momentos:

**Hook automático**: quando um agente edita um arquivo de UI (`.tsx`, `.jsx`, `.html`, `.css`), o hook escaneia antes de considerar a tarefa concluída. Instalação via `npx impeccable install` no primeiro setup.

**Comandos sob demanda** durante o dev de uma tela nova:

```
/impeccable critique the <alvo>       ← revisão UX pontuada, fixes rankeados
/impeccable audit the <alvo>          ← a11y, performance, theming, responsividade (P0 a P3)
/impeccable bolder the <alvo>         ← amplifica design tímido
/impeccable quieter the <alvo>        ← acalma design barulhento
/impeccable layout the <alvo>         ← ajusta espaçamento/ritmo
/impeccable polish the <alvo>         ← passe final antes de merge
/impeccable harden <alvo>             ← errors, overflow, edge cases
```

Fluxo recomendado em cada tela nova: `critique` → ajustes com `bolder`/`quieter`/`layout` → `audit` → `polish` → merge.

Antes de qualquer deploy, scanner CLI na página renderizada:

```powershell
npm run dev            # sobe o Vite
npx impeccable detect http://localhost:5173
```

Exit code diferente de `0` = problemas detectados, não deploya. `--list-rules` mostra as regras.

**PRODUCT.md** e **DESIGN.md** ficam versionados na raiz. Mantenha atualizados quando o produto mudar. Shared artifacts (`.impeccable/config.json`, `critique/*.md`) também vão pro Git; `.impeccable/cache` não.

Alvos estreitos rendem mais que alvos amplos: `/impeccable critique the pricing cards` bate `/impeccable critique the whole landing page`.

---

## 12. Dos e Don'ts

### ✅ Faça
- Lógica de negócio em `src/domain/*` como função pura, recebendo `agora` como argumento.
- Toda query e subscription via repository, nunca direto no componente.
- Dinheiro em centavos.
- Migration versionada pra QUALQUER mudança de schema; `config.toml` pra configuração de Auth.
- Teste unitário de cada função em `domain/`.
- Mobile-first no CSS (base celular, breakpoints crescem).
- Nome de variável, função e tabela em português do domínio ("pedido", "comanda", "cardapio").
- Validar com Zod na entrada E na saída dos repositories.
- Registrar evento de auditoria dentro do repository, em toda mutação.
- Passar toda tela nova por `/impeccable critique` + `/impeccable polish` antes de merge.

### ❌ Não faça
- Chamar `supabase.from(...)` fora de `src/repositories/`.
- Escrever regra de negócio em política RLS, trigger ou cron.
- Usar `any`.
- Hardcode de valor que o usuário disse ser configurável.
- Criar tabela/coluna ou mudar config de Auth pelo dashboard do Supabase.
- Commitar `.env.local` ou qualquer secret.
- Tratar preço como float.
- Retornar objeto cru do Supabase do repository.
- Apagar linhas de `itens_pedido`, `pedidos`, `comandas` ou `eventos_auditoria`.
- Adicionar dependência pesada ou ORM sem discussão prévia.
- Fazer deploy pulando o build local (`npm run build` tem que passar antes de push).

---

## 13. Roadmap (ordem das entregas)

Cada item é um PR independente. Não faça dois em paralelo até o MVP.

1. **Setup inicial** — scaffold Vite + React + TS + Tailwind v4 + router, dependências conforme §2, verificação e instalação do Impeccable, `supabase init`, `git init`. (Deploy na Vercel foi movido pro item 16.)
2. **Schema inicial via migrations** — `mesas`, `categorias`, `itens_cardapio`, `comandas`, `sessoes_mesa`, `pedidos`, `itens_pedido`, `funcionarios`, `configuracoes`, `eventos_auditoria` + seed de configurações + bucket `cardapio-fotos`.
3. **RLS mínima** — funções `papel_atual()`/`minhas_comandas()`, políticas de §7, login anônimo habilitado no `config.toml`. Testada manualmente.
4. **Autenticação da equipe** — login por matrícula/PIN, bootstrap do primeiro gerente, rotas protegidas por papel.
5. **Gerência: cardápio** — CRUD de categorias e itens, upload de foto, toggle de esgotado, soft delete.
6. **Cliente: cardápio, carrinho e comanda** — scan QR → login anônimo → entra/abre comanda → cardápio por categoria → carrinho → enviar pedido → ver comanda.
7. **Operação: pedidos em tempo real** — tela da cozinha com Realtime.
8. **Máquina de estados do pedido** — `estado.ts` + botões na cozinha.
9. **Edição/cancelamento pelo cliente + rotinas automáticas** — janela livre, "chamar garçom", auto-cancelamento e sessão inativa (§6.11).
10. **Cancelamento pela cozinha** — 2 etapas, motivo, confirmação explícita.
11. **Auditoria** — eventos em todas as mutações, tela de consulta, export CSV.
12. **Pagamento Pix estático + fechamento** — QR BR Code, "já paguei", "marcar como pago", "fechar mesa".
13. **Configurações e mesas** — `/gerencia/config` e `/gerencia/mesas` com impressão de QR.
14. **Equipe** — Edge Function `equipe` + `/gerencia/equipe` (criar, desativar, trocar PIN).
15. **Polimento final** — ciclo Impeccable em cada tela, scan final, teste em aparelhos reais.
16. **Go-live** — deploy na Vercel (deploy automático na main, variáveis de ambiente configuradas lá) e GitHub Action de backup diário (`pg_dump` → Backblaze B2 ou S3, PRD §9).

Fase 2 (fora do MVP): variações de item, adicionais pagos, divisão de conta, gateway de pagamento, observação por item, multi-tenant, notificações push, WhatsApp de status, rotinas automáticas no servidor.

---

## 14. Prompts para Claude Code (por etapa do roadmap)

Pra cada item do roadmap (§13), um prompt pronto pra abrir uma sessão do Claude Code. O Claude Code lê `CLAUDE.md` automaticamente, não `AGENTS.md` — por isso o item 1 cria um `CLAUDE.md` de uma linha que importa este arquivo (`@AGENTS.md`). Mesmo assim, todo prompt pede a leitura explícita das seções relevantes.

**Como usar:**
1. Abre o Claude Code na raiz do projeto.
2. Cola o prompt do item em que você está.
3. Acompanha o que o agente propõe. Rejeita o que violar §11 ou §12.
4. Ao terminar: `npm test`, `npm run build`, commit, e passa pro próximo.

Uma sessão = um item do roadmap. Não misture itens.

### Item 1 — Setup inicial

```
Leia AGENTS.md completo e PRD.md antes de agir. Execute o item 1 do roadmap (§13).

Antes de tudo, verifique o Impeccable conforme a caixa de aviso em §11.4. Se divergir, pare e me pergunte.

Crie o scaffold:
- package.json com dependencies e devDependencies EXATAMENTE conforme §2 (nada de ORM ou SQLite). Scripts: dev, build (tsc -b && vite build), preview, test (vitest run).
- tsconfig.json (strict: true, target ES2022, moduleResolution bundler, paths @/* → src/*)
- vite.config.ts (plugins react + @tailwindcss/vite, alias @ → src)
- src/index.css com @import "tailwindcss" e um bloco @theme vazio comentado
- .env.example conforme §9 (sem valores reais)
- .gitignore (node_modules, dist, .env.local, .impeccable/cache)
- src/main.tsx e src/App.tsx com react-router-dom e uma rota "/" mostrando "Olá mundo"
- Estrutura de pastas vazia conforme §4 (use .gitkeep nas pastas vazias)
- CLAUDE.md com uma única linha: @AGENTS.md
- README.md curto apontando pra AGENTS.md e PRD.md
- supabase/ inicializado com npx supabase init

Rode npm install e depois npx impeccable install. Explique em 2-3 frases o que cada arquivo de configuração faz (sou iniciante).
NÃO escreva código de domínio nem UI de produção. Confirme com npm run build e npm test (sem testes ainda deve passar com --passWithNoTests) que tudo funciona.
```

### Item 2 — Schema inicial via migrations

```
Leia AGENTS.md §4, §6 (todas subseções), §7, §8 e §10 antes de agir.

Crie migrations em supabase/migrations/ cobrindo: mesas, categorias, itens_cardapio, comandas, sessoes_mesa, pedidos, itens_pedido, funcionarios, configuracoes, eventos_auditoria.

Regras:
- snake_case em tudo, tabelas no plural
- id uuid primary key default gen_random_uuid() — EXCETO configuracoes, cuja PK é chave (§10)
- comandas.numero e pedidos.numero: bigint generated always as identity (sequenciais globais)
- estados como text com check constraint, valores idênticos aos tipos TS de §6.3 e §6.4
- pedidos com estado, estado_anterior (nullable), estado_desde
- comandas com estado, observacao, ultima_atividade_em
- itens_pedido com quantidade (int > 0), preco_centavos_snapshot (int), removido_em (nullable)
- funcionarios.usuario_id referencia auth.users(id); matricula única; papel com check ('operacao','gerencia')
- timestamptz em UTC; criado_em / atualizado_em onde fizer sentido
- preço em centavos (integer, check > 0)
- índice único parcial garantindo UMA comanda não-Fechada por mesa
- comentário SQL (comment on table) em cada tabela explicando seu papel
- uma migration de SEED com as linhas de configuracoes e defaults de §10
- uma migration criando o bucket cardapio-fotos (público)
- NENHUM trigger com regra de negócio (atualizado_em automático é aceitável; explique se usar)

NÃO crie nada pelo dashboard. Rode npx supabase db push e depois npx supabase db diff pra confirmar que não há diferença. Me mostre um diagrama em texto das relações.
```

### Item 3 — RLS mínima

```
Leia AGENTS.md §6.1, §6.9 e §7 antes de agir.

1. No supabase/config.toml, habilite login anônimo (enable_anonymous_sign_ins = true). Aplique com npx supabase config push.
2. Crie uma migration só pra RLS:
   - funções papel_atual() e minhas_comandas() exatamente como em §7, com comentário explicando security definer
   - ENABLE ROW LEVEL SECURITY em todas as tabelas do item 2
   - políticas conforme §7, uma por operação, com nomes descritivos
   - políticas de storage do bucket cardapio-fotos

Regra de ouro: NENHUMA regra de negócio nas políticas. Se precisar de IF/ELSE, pare e me mostre o caso antes de gravar.

Depois do push, me dê um roteiro de teste manual (SQL Editor com "set role" / impersonação, ou chamadas pelo app) cobrindo:
1. Cliente anônimo faz UPDATE em itens_cardapio — deve falhar
2. Gerência faz INSERT em itens_cardapio — deve passar
3. Cliente anônimo SELECT em itens_cardapio — só ativos e disponíveis
4. Cliente da mesa 1 tenta ler a comanda da mesa 2 — deve retornar vazio
5. Qualquer um tenta UPDATE/DELETE em eventos_auditoria — deve falhar
```

### Item 4 — Autenticação da equipe

```
Leia AGENTS.md §6.9 antes de agir.

Implemente login por matrícula + PIN de 6 dígitos com email sintético (matrícula 001 → 001@restaurante.local):
- src/schemas/auth.ts — LoginSchema (matrícula: string só de dígitos, 1 a 6; PIN: exatamente 6 dígitos) e helper emailSintetico(matricula)
- src/repositories/authRepo.ts — entrarComoFuncionario, entrarComoCliente (signInAnonymously), sair, usuarioAtual, getPapelAtual (lê a tabela funcionarios; null se não for funcionário ativo)
- src/hooks/useAuth.ts + AuthProvider envolvendo o App
- src/pages/login/LoginPage.tsx — mobile-first, 2 campos, inputMode="numeric" e autocomplete adequado, mensagens de erro em português sem revelar se a matrícula existe
- Componente RotaProtegida(papeis) pra /cozinha e /gerencia; sem papel → /login
- Seção no README com o bootstrap do primeiro gerente (§6.9): passo no dashboard + SQL de insert em funcionarios

Testes em tests/schemas/auth.test.ts (matrícula válida/inválida, PIN com 5, 6 e 7 dígitos, PIN com letras).
Sem lib extra de UI, só Tailwind.
```

### Item 5 — Gerência: cardápio

```
Leia AGENTS.md §6.7, §4 e §8 antes de agir.

Implemente o CRUD de cardápio pra gerência:
- src/schemas/cardapio.ts — ItemCardapioSchema, CategoriaSchema, schemas de formulário
- src/domain/cardapio/formatacao.ts — parseReal(texto): number | null (aceita "12,50", "12.50", "R$ 12,50"; retorna centavos inteiros)
- src/lib/formato.ts — formatarReal(centavos)
- src/domain/cardapio/validacao.ts — nomeValido, precoValido etc. (puras)
- src/repositories/cardapioRepo.ts — listarCardapioGerencia(mostrarInativos), criarItem, atualizarItem, marcarEsgotado, reativarItem, removerItem (soft delete), CRUD de categorias, reordenarCategorias
- src/repositories/storageRepo.ts — uploadFotoItem (bucket cardapio-fotos), validando tipo (jpeg/png/webp) e tamanho máximo de 2 MB
- src/pages/gerencia/CardapioPage.tsx — lista por categoria, toggle esgotado inline, reordenação de categorias, modal criar/editar item com upload de foto, filtro "mostrar inativos"
- Hook useCardapio

Para o drag-and-drop: primeiro proponha a opção sem dependência (HTML5 drag-and-drop nativo + botões ↑↓ como alternativa acessível). Só sugira lib se eu pedir.
Auditoria das mutações: deixe uma chamada a auditoriaRepo.registrar com interface pronta (implementação real no item 11).
Testes em tests/domain/cardapio/. Variações são itens separados — NÃO crie modelo de variante.
```

### Item 6 — Cliente: cardápio, carrinho e comanda

```
Leia AGENTS.md §6.1, §6.2, §6.4 e §6.7 antes de agir.

Implemente o fluxo do cliente:
- Rota /mesa/:numero:
  1. valida a mesa (inexistente ou inativa → tela "mesa indisponível")
  2. garante login anônimo (authRepo.entrarComoCliente)
  3. comandaRepo.entrarNaMesa(numero): se há comanda não-Fechada, cria a sessoes_mesa e entra; senão cria a comanda e a sessão. Trate a corrida de dois celulares abrindo ao mesmo tempo (o índice único do item 2 faz um falhar; nesse caso, releia e entre na existente)
  4. pede nome opcional (guardado em sessoes_mesa.nome_cliente e no localStorage sessao-mesa-{numero})
- src/pages/mesa/CardapioPage.tsx — mobile-first, por categoria, só ativo+disponível
- Carrinho local (estado React, sem gravar) com quantidades e total
- "Enviar pedido" → pedidoRepo.criarPedido(comandaId, itens): cria pedido em Recebido + itens_pedido com preco_centavos_snapshot lido do cardápio NO MOMENTO do envio; atualiza ultima_atividade_em
- src/domain/pedido/calculo.ts — totalPedido, totalComanda (ignora removidos e cancelados), com testes
- src/pages/mesa/ComandaPage.tsx — pedidos da mesa com estado de cada um, total em R$, observação geral editável
- Comanda em AguardandoPagamento/Paga/Fechada não aceita novo pedido (regra pura em domain/comanda/estado.ts, com teste)
- Hooks useComanda, useCardapio

Toda chamada passa por repository. Nenhum supabase.from em componente.
Teste manual no DevTools em viewport 375x667, com DOIS navegadores (um normal e um anônimo) na mesma mesa, confirmando que compartilham a comanda.
```

### Item 7 — Operação: pedidos em tempo real

```
Leia AGENTS.md §6.2, §6.3, §4 e §8 (Padrão Repository) antes de agir.

Implemente a tela da cozinha:
- Rota /cozinha protegida (operacao ou gerencia)
- src/pages/cozinha/PedidosPage.tsx — grid de cards, um por PEDIDO, mostrando número do pedido, número da mesa, itens, observação da comanda, estado com cor, tempo desde estado_desde
- Layout pensado pra tablet em paisagem, mas funcional no celular
- Realtime: pedidoRepo.assinarPedidosAbertos(callback) assinando pedidos e itens_pedido, retornando função de cancelamento. Componente nunca toca no canal diretamente
- usePedidosCozinha encapsula carga inicial + assinatura + reconexão (ao reconectar, recarrega a lista inteira pra não perder eventos)
- Botões de ação por card como placeholders (máquina de estados vem no item 8)

Teste: abra /mesa/1 numa janela e /cozinha em outra; envie um pedido e confirme que aparece sem reload. Derrube a rede no DevTools por 10s e confirme que volta sincronizado.
```

### Item 8 — Máquina de estados do pedido

```
Leia AGENTS.md §6.3 e §8 (Padrão função de domínio) antes de agir.

Implemente:
- src/domain/pedido/estado.ts exatamente no formato de §8: EstadoPedido, SituacaoPedido, TRANSICOES, transicaoValida(pedido, para), proximosEstados(pedido), e aplicarTransicao(pedido, para, agora) que devolve os novos valores de estado, estadoAnterior e estadoDesde (grava estadoAnterior ao entrar em estado temporário, limpa ao sair)
- tests/domain/pedido/estado.test.ts cobrindo TODAS as transições válidas, todas as voltas de estado temporário (pra estado certo e errado) e uma amostra de inválidas
- pedidoRepo.atualizarEstado(pedidoId, para, ator): lê o pedido, valida com transicaoValida, grava com update condicional (where estado = estado lido) pra não sobrescrever mudança concorrente; se nenhuma linha mudou, lança Error "pedido foi alterado por outra pessoa, recarregue"
- Toda transição chama auditoriaRepo.registrar (interface pronta; implementação no item 11)
- Na tela da cozinha (item 7), botões só aparecem pros estados de proximosEstados, com rótulos em português ("Aceitar", "Pronto", "Entregue")

NÃO implemente cancelamento (item 10) nem auto-cancelamento (item 9) aqui.
```

### Item 9 — Edição/cancelamento pelo cliente + rotinas automáticas

```
Leia AGENTS.md §6.5 e §6.11 antes de agir.

Implemente:
- src/domain/pedido/edicao.ts: dentroDaJanelaLivre(pedido, configs, agora): boolean; acaoDisponivel(pedido, configs, agora): 'editar_livre' | 'solicitar_edicao' | 'bloqueado'
- tests/domain/pedido/edicao.test.ts com casos de borda: exatamente no limite (fechada), 1ms antes (aberta), janela configurada como 0, estados fora de Recebido/Preparando
- UI em ComandaPage: "editar"/"remover item"/"cancelar pedido" quando editar_livre; "chamar garçom" quando solicitar_edicao (leva a EdicaoSolicitada); nada quando bloqueado
- Remoção de item seta removido_em (nunca delete)
- Na cozinha: pedidos em EdicaoSolicitada ganham destaque e botões "aplicar edição" e "negar", ambos voltando ao estado anterior
- src/domain/pedido/autoCancelamento.ts: pedidosExpirados(pedidos, configs, agora)
- src/domain/comanda/sessao.ts: comandaInativa(comanda, configs, agora) e podeFecharAutomaticamente(comanda, pedidos)
- Testes de ambos
- Rotinas na tela da cozinha conforme §6.11: intervalo de 60s, update condicional, ator sistema, sem evento duplicado quando há 2 tablets
- Configs lidas do ConfigContext; se o contexto ainda não existir (vem no item 13), crie um configRepo.listarConfigs mínimo e um ConfigProvider simples agora

Testes unitários obrigatórios. NÃO use pg_cron nem Edge Function.
```

### Item 10 — Cancelamento pela cozinha (2 etapas)

```
Leia AGENTS.md §6.3 e §6.6 antes de agir.

Implemente:
- src/domain/pedido/cancelamento.ts: podeCancelar(pedido): boolean (falso em Entregue, Finalizado, Cancelado); MOTIVOS_CANCELAMENTO (readonly, lista de §6.6); validaMotivo(motivo, textoLivre?) (texto obrigatório quando motivo = outro); precisaDuasEtapas(pedido) (falso em Recebido)
- Testes unitários de tudo acima
- Modal na cozinha:
  Etapa 1: select com os motivos (rótulos em português) + textarea → pedidoRepo.solicitarCancelamento → CancelamentoPendente
  Etapa 2: campo pra digitar o número do pedido OU botão "confirmar cancelamento" habilitado após 2s → pedidoRepo.confirmarCancelamento → Cancelado. Botão "desistir" → volta ao estado anterior
  Em Recebido: uma etapa só, mas motivo continua obrigatório
- Cada passo registra evento de auditoria com motivo
- Gerência NÃO pula etapas. Pedido em Entregue: botão "cancelar" não aparece e o repo rejeita com erro claro
- Se o tablet fechar no meio, o pedido fica em CancelamentoPendente e o card mostra as opções da etapa 2
```

### Item 11 — Auditoria

```
Leia AGENTS.md §6.10 antes de agir.

Implemente o log:
- src/domain/auditoria/evento.ts: TipoEvento (union de strings), EventoAuditoria, builders puros (criaEventoMudancaEstado, criaEventoCancelamento, criaEventoItem, criaEventoComanda, criaEventoCardapio, criaEventoConfig etc.)
- src/repositories/auditoriaRepo.ts: registrar(evento), listar(filtros: {desde, ate, tipoEvento?, atorId?, pagina}), exportarCSV(periodo)
- Varra TODOS os repos que fazem mutação e garanta que chamam auditoriaRepo.registrar DENTRO da mesma função, logo após a escrita. Liste no resumo os que você alterou
- Tela /gerencia/auditoria: filtros (período, tipo, ator), tabela paginada, botão "exportar CSV" (gerado no navegador, com BOM UTF-8 pra abrir certo no Excel, datas em America/Fortaleza)
- Testes dos builders

Append-only puro: nunca UPDATE nem DELETE em eventos_auditoria. Correções são novos eventos com payload.corrige_id.
```

### Item 12 — Pagamento Pix estático + fechamento

```
Leia AGENTS.md §6.4, §6.8 e §10 antes de agir.

ANTES de qualquer código: pare e me apresente 2 ou 3 opções pra (a) montar o payload BR Code do Pix e (b) desenhar o QR Code na tela, com tamanho, manutenção e licença de cada uma, incluindo a opção de montar o payload à mão (é um formato TLV com CRC16). Não decida sozinho.

Depois da minha escolha:
- src/domain/pagamento/pix.ts: gerarPayloadPix({chave, valorCentavos, nome, cidade, txid}) puro, com testes comparando com payloads de exemplo conhecidos
- src/pages/mesa/PagamentoPage.tsx: total da comanda, QR, botão "copiar código", botão "já paguei" → comanda AguardandoPagamento. Se chave_pix vazia, mostra "pagamento indisponível, chame o garçom"
- src/domain/comanda/estado.ts: transições de §6.4 e podeFecharComanda, com testes
- Cozinha ganha aba "Contas": comandas AguardandoPagamento com total; botões "marcar como pago" e "reabrir"
- comandaRepo.marcarComoPaga(comandaId, ator) e comandaRepo.fecharMesa(comandaId, ator): fechar valida podeFecharComanda, passa pedidos Entregue → Finalizado, encerra sessoes_mesa, registra eventos

SEM webhook. SEM gateway. SEM divisão.
```

### Item 13 — Configurações e mesas

```
Leia AGENTS.md §6.7 (Mesas) e §10 antes de agir.

Implemente:
- src/repositories/configRepo.ts: listarConfigs(), setConfig(chave, valor, ator) (registra auditoria)
- src/lib/config.ts: ConfigContext + ConfigProvider carregando tudo no boot, validando com Zod por tipo (§10). Se já existir versão mínima do item 9, evolua ela
- src/pages/gerencia/ConfigPage.tsx: uma linha por chave de §10, label descritivo, validação por tipo, "salvar" por linha
- src/repositories/mesaRepo.ts + src/pages/gerencia/MesasPage.tsx: criar mesa, ativar/desativar, e página de impressão com o QR de cada mesa (URL /mesa/:numero com a origem atual), usando a mesma lib de QR escolhida no item 12

Varra o código: qualquer valor de §10 hardcoded deve passar a vir do ConfigContext. Liste os lugares alterados no resumo do commit.
```

### Item 14 — Equipe

```
Leia AGENTS.md §3 (regra 5), §6.9 e §9 antes de agir.

Implemente a gestão de equipe:
- Edge Function supabase/functions/equipe com ações criar, trocarPin e desativar:
  - valida o JWT de quem chama e confere em funcionarios que é gerencia ativo; senão 403
  - valida o corpo com Zod (mesmas regras de src/schemas/auth.ts; se não der pra importar, duplique só o schema e comente a origem)
  - usa a service_role (variável automática da função, nunca exposta) pra criar usuário com email sintético e email_confirm true, trocar senha ou banir
  - grava/atualiza funcionarios e registra evento de auditoria
- src/repositories/equipeRepo.ts chamando a função via supabase.functions.invoke
- src/pages/gerencia/EquipePage.tsx: lista, criar (matrícula, nome, papel, PIN), trocar PIN, desativar
- Gerente não pode desativar a si mesmo nem rebaixar o último gerente (regra pura em domain, com teste)

Me explique, como iniciante, o que é uma Edge Function e por que esta é a única do projeto. Mostre o comando de deploy (npx supabase functions deploy equipe).
```

### Item 15 — Polimento final

```
Leia AGENTS.md §11.4 e §13 antes de agir.

Rode o ciclo Impeccable em UMA tela por sessão:

Rotas: /mesa/:numero (cardápio), /mesa/:numero (comanda), /mesa/:numero (pagamento), /cozinha, /gerencia/cardapio, /gerencia/mesas, /gerencia/equipe, /gerencia/auditoria, /gerencia/config, /login

Pra cada uma:
1. /impeccable critique <rota>
2. Me mostre os findings priorizados; eu decido quais aplicar
3. Aplique os fixes escolhidos com bolder/quieter/layout conforme o caso
4. /impeccable audit <rota> — resolver TODOS os P0 e P1, documentar os P2 e P3 ignorados
5. /impeccable polish <rota>

Com o dev server rodando no final:
   npx impeccable detect http://localhost:5173
Exit code 0 obrigatório antes de considerar pronto.

Teste manual: iPhone real + Android real, Chrome e Safari. Cozinha testada em tablet real, com 2 tablets abertos ao mesmo tempo.
```

### Item 16 — Go-live (Vercel + backup)

```
Leia AGENTS.md §2, §9 e PRD.md §9 antes de agir.

1. Deploy na Vercel: me guie passo a passo (sou iniciante) pra conectar o repositório do GitHub, configurar VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente da Vercel e ativar deploy automático na main. Inclua um vercel.json com rewrite de todas as rotas pra index.html (o app usa react-router).
2. Backup: crie .github/workflows/backup.yml rodando diariamente pg_dump do banco Supabase e enviando pra Backblaze B2 ou S3 (me pergunte qual). Segredos só em GitHub Secrets; NUNCA no repositório. Documente no README como restaurar um backup.
3. Confirme que npm run build passa e que nenhuma chave secreta aparece em dist/.
```

---

## 15. Decisões pendentes e contato

Qualquer decisão NÃO coberta aqui, pergunte antes de implementar. Se a resposta ficar estável e for reusável, atualize este arquivo no mesmo PR.

Decisões **confirmadas pelo dono do produto em 2026-11-09**:

| # | Decisão | Afeta item |
|---|---|---|
| 1 | PIN de exatamente 6 dígitos (antes: 4 a 6) | 4 |
| 2 | Cliente usa login anônimo do Supabase pra RLS saber de qual comanda ele é. Ativar também o limite de taxa de sign-ins anônimos no `config.toml` | 3, 6 |
| 3 | Comanda tem vários pedidos ("rodadas"); estado de preparo é por pedido | 2, 6 |
| 4 | Auto-cancelamento e sessão inativa rodam no tablet da cozinha, não em servidor | 9 |
| 5 | Papel do funcionário vem da tabela `funcionarios`, não de claim no JWT (desativação vale na hora) | 3, 4 |
| 6 | Uma Edge Function (`equipe`) pra criar funcionário/trocar PIN | 14 |
| 7 | Nova config `cidade_estabelecimento` (exigida pelo Pix) | 2, 12 |
| 8 | Deploy na Vercel e backup saem do item 1 e vão pro item 16 (go-live) | 1, 16 |
| 9 | Cozinha ignora pedido sem itens (envio interrompido entre o INSERT do pedido e dos itens); o auto-cancelamento limpa esses pedidos depois. Nada de lógica no banco pra isso | 6, 7, 9 |
| 10 | (2026-11-10) Função `comanda_aberta_da_mesa(numero)` pra o cliente achar a comanda aberta da mesa e entrar nela (§7). O `comandaRepo` gera o `id` da comanda no navegador (`crypto.randomUUID()`) e insere SEM `.select()`: o cliente só enxerga a comanda depois de criar a `sessoes_mesa` | 3, 6 |
| 11 | (2026-11-10) Operação lê todas as mesas, inclusive inativas | 3, 7 |
| 13 | (2026-11-10) `authRepo.getPapelAtual()` usa `supabase.rpc('papel_atual')`: o funcionário de operação não precisa ler a tabela `funcionarios`, e a RLS de §7 fica como está | 4 |
| 12 | (2026-11-10) `config.toml` alinhado aos valores do projeto remoto (confirmação de email ligada, MFA TOTP ligado, pool etc.); só o login anônimo mudou no remoto. Comandos do CLI 3 contra o projeto usam `--remote` (o padrão é o banco local, que exige Docker) | 3 |

Ainda em aberto:

| # | Decisão | Afeta item |
|---|---|---|
| A | Lib de QR/Pix. Inclinação atual: payload BR Code montado à mão (TS puro + CRC16, testado) e lib `qrcode` só pra desenhar. Decidir no início do item 12 | 12, 13 |
| C | "Fechar mesa" (§6.4) encerra `sessoes_mesa`, mas §7 não dá UPDATE em `sessoes_mesa` à operação. Decidir no item 12: nova política de UPDATE pra operação, ou não gravar `encerrada_em` | 12 |

---

## 16. Histórico de revisões deste arquivo

**Revisão 4 (2026-11-10)** — itens 2 e 3 executados:
- §7: função `comanda_aberta_da_mesa`, operação lê todas as mesas, trava extra de privilégios, roteiro de teste.
- §15: decisões 10–12. Em aberto: B (funcionário ler o próprio cadastro) e C (operação encerrar `sessoes_mesa`).

**Revisão 3 (2026-11-09)** — item 1 executado:
- §15: decisões 1–7 confirmadas; adicionadas 8 (Vercel/backup → item 16) e 9 (pedido sem itens).
- §13/§14: novo item 16 (go-live); item 1 sem deploy.
- §2: versões fixadas (React 18, Zod 4, TS 7, Vite 8, Vitest 5).
- PRD alinhado: OPE-06 (Recebido = 1 etapa), OPE-10 (só fecha sozinha se paga ou total zero), meta de auditoria, plano com 16 entregas.

**Revisão 2 (2026-11-09)** — correções de inconsistências da versão inicial:
- §2/Item 1: removidos `drizzle-orm`, `drizzle-kit` e `better-sqlite3` (contradiziam "sem ORM"); separadas `dependencies` de `devDependencies`; adicionados `@supabase/supabase-js` e `react-router-dom`, que faltavam; Tailwind atualizado pra v4.
- §6.9: PIN passa a ter 6 dígitos (mínimo padrão do Supabase Auth); papel sai de custom claim e vai pra tabela `funcionarios` (sem configuração pelo dashboard).
- §6.3/§8: `Pronto → EdicaoSolicitada` incluído na tabela; volta de estados temporários garantida por `estado_anterior`.
- §6.2/§6.4: definida a relação comanda → pedidos → itens e os estados da comanda.
- §6.1/§7: mecanismo concreto de RLS pro cliente (login anônimo + `sessoes_mesa`); clientes passam a poder ler `configuracoes` e gravar auditoria.
- §6.11: definido onde rodam auto-cancelamento e expiração de sessão.
- §6.7/§13: adicionadas tabela `mesas`, tela de mesas/QR e item de gestão de equipe (antes sem item no roadmap).
- §10: PK de `configuracoes` é `chave` (item 2 pedia uuid).
- §11.4: verificação do pacote Impeccable antes da instalação.
- Item 8: referência errada a §7 corrigida; Claude Code lê `CLAUDE.md`, então o item 1 cria um que importa este arquivo.
