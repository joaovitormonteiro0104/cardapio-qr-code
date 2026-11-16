---
name: Cardápio
description: Cardápio, pedidos e Pix pela mesa, com a cozinha em tempo real.
colors:
  brasa: "oklch(0.55 0.17 38)"
  brasa-forte: "oklch(0.47 0.16 36)"
  brasa-clara: "oklch(0.95 0.035 45)"
  fundo: "oklch(0.965 0.002 250)"
  superficie: "oklch(1 0 0)"
  borda: "oklch(0.9 0.012 70)"
  borda-campo: "oklch(0.62 0.015 60)"
  tinta: "oklch(0.24 0.02 50)"
  tinta-suave: "oklch(0.45 0.02 55)"
  sucesso: "oklch(0.5 0.12 150)"
  sucesso-clara: "oklch(0.95 0.04 150)"
  alerta: "oklch(0.55 0.13 75)"
  alerta-clara: "oklch(0.96 0.05 90)"
  perigo: "oklch(0.52 0.19 27)"
  perigo-clara: "oklch(0.95 0.03 25)"
  info: "oklch(0.5 0.12 250)"
  info-clara: "oklch(0.95 0.03 250)"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.1
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    letterSpacing: "-0.025em"
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brasa}"
    textColor: "{colors.superficie}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.brasa-forte}"
  button-secondary:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.fundo}"
  button-danger:
    backgroundColor: "{colors.perigo}"
    textColor: "{colors.superficie}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.xl}"
    padding: "0 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.superficie}"
    rounded: "{rounded.2xl}"
    padding: "16px"
  chip-category:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "44px"
  chip-category-active:
    backgroundColor: "{colors.brasa-clara}"
    textColor: "{colors.brasa-forte}"
  badge-status:
    rounded: "{rounded.full}"
    padding: "4px 10px"
---

<!-- Extraído do código em 2026-11-16 (src/index.css e componentes). Metáfora ("A comanda limpa") e sensação dos componentes ("macio e firme") confirmadas pelo dono do produto em 2026-11-16. -->

# Design System: Cardápio

## Overview

**Creative North Star: "A comanda limpa"**

O pedido de papel, passado a limpo: fundo cinza-neutro quase branco, cartões brancos, tinta marrom-escura e uma única cor de marca, o laranja-brasa, reservada para ação e para o que está selecionado. Os estados (recebido, preparando, pronto, cancelado) são as únicas outras cores, sempre em par de fundo claro com texto escuro da mesma família.

A densidade muda por tela: o cliente vê uma coluna só (até 672px), com alvos grandes e uma ação principal por vez; a equipe ganha largura (até 1280px) e colunas no tablet em paisagem. Não há fonte própria: a fonte do sistema mantém o app leve e familiar no celular de cada cliente.

**Key Characteristics:**
- Uma cor de marca (brasa) e quatro cores de estado; o resto é neutro.
- Alvo de toque mínimo de 44px em todo controle.
- Cantos arredondados generosos (12px controles, 16px cartões, pílula em chips e selos).
- Profundidade por borda de 1px e sombra mínima, nunca por cor.
- Números de dinheiro e horário sempre em algarismos tabulares.

## Colors

Neutros levemente quentes, uma brasa de cozinha para ação e cores de estado com contraste AA.

### Primary
- **Brasa** (`brasa`): fundo do botão principal, selo de contagem, bolinhas preenchidas do PIN, contorno de foco (`outline` 2px).
- **Brasa Forte** (`brasa-forte`): hover do botão principal, texto em brasa sobre fundo claro (aba ativa, links de ação, sinais − e +).
- **Brasa Clara** (`brasa-clara`): fundo do que está selecionado (chip de categoria ativo), do botão redondo de adicionar e da foto ausente (inicial do item).

### Neutral
- **Fundo** (`fundo`): fundo da página. Cinza quase branco e neutro (antes era creme; trocado por achado do `impeccable detect`).
- **Superfície** (`superficie`): cartões, campos, folhas e botões secundários.
- **Borda** (`borda`): divisórias, contorno de cartões e de botões secundários.
- **Borda de Campo** (`borda-campo`): contorno de campos de formulário, com contraste ≥ 3:1 (WCAG 1.4.11).
- **Tinta** (`tinta`): texto principal.
- **Tinta Suave** (`tinta-suave`): texto secundário, ajuda e placeholders (AA sobre fundo e superfície).

### Estados
Sempre em par `X-clara` (fundo) + `X` (texto):
- **Info** (`info`): pedido recebido, conta aguardando o caixa.
- **Alerta** (`alerta`): preparando (texto em tinta), avisos e prazo acabando.
- **Sucesso** (`sucesso`): pronto, pago, confirmação de envio.
- **Perigo** (`perigo`): cancelado, erros, ações destrutivas (`botao-perigo` usa o tom cheio com texto branco).

### Named Rules
**The One Ember Rule.** Brasa só marca ação ou seleção. Nunca serve de decoração, fundo de seção ou cor de texto comum.

**The Paired State Rule.** Cor de estado vem sempre como fundo claro + texto da mesma família; nunca texto colorido solto sobre o fundo neutro (exceto mensagem de erro em `perigo`).

## Typography

**Display Font:** fonte do sistema (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto…`)
**Body Font:** a mesma

**Character:** Uma família só, a do aparelho. A hierarquia vem de peso (400 → 500 → 600 → 700) e tamanho, não de troca de fonte.

### Hierarchy
- **Display** (700, 36px): só valores de destaque, como o total na tela Pagar.
- **Headline** (700, 24–30px, tracking −0.025em): título de tela (h1 da equipe, "Bem-vindo!", "Acesso da equipe").
- **Title** (600–700, 18–20px): nome da casa no cabeçalho, título de seção (categoria, "Em andamento"), título de modal.
- **Body** (400, 16px, linha 1.5): texto corrido; campos usam 16px para o iOS não dar zoom.
- **Label** (500–600, 14px): rótulos de campo, abas, botões pequenos, chips. 12px só para ajuda curta e selos de estado.

### Named Rules
**The Tabular Money Rule.** Todo valor em R$, quantidade, número de pedido e horário usa algarismos tabulares (`tabular-nums`).

## Layout

Mobile-first. Margem lateral de 16px. Cliente numa coluna de até 672px (`max-w-2xl`), com cabeçalho fixo (nome da casa + abas Cardápio / Minha conta / Pagar) e a barra de categorias grudada logo abaixo, rolando para o lado. A ação principal do carrinho fica numa barra fixa no rodapé, respeitando a área segura do iPhone.

Equipe até 1280px (`max-w-7xl`); no celular (< 768px) o cabeçalho da equipe rola com a página, no tablet ele fica fixo. A cozinha usa colunas por estado (Novos, Preparando, Prontos) no tablet em paisagem.

Ritmo de espaço em passos de 4px: 8–12px dentro de grupos, 16–24px entre blocos (`space-y-4` a `space-y-6`). Modais viram folha que sobe de baixo no celular (até 92% da altura) e caixa centralizada a partir de 640px.

## Elevation & Depth

Quase plano. A profundidade vem de camadas de tom (fundo cinza → cartão branco) e de borda/anel de 1px na cor `borda`. Cartões principais somam a sombra mínima; só modais ganham sombra forte. Cabeçalhos fixos usam fundo 95% opaco com desfoque, para o conteúdo passar por baixo sem confundir.

### Shadow Vocabulary
- **Repouso** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`): cartões de resumo e de pedido, junto com o anel de 1px.
- **Folha** (`box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`): modais, sobre véu em `tinta` a 40%.

### Named Rules
**The Border-First Rule.** Separar com borda ou tom de fundo antes de pensar em sombra. Sem borda lateral colorida em cartões e avisos.

## Shapes

Cantos arredondados e macios. Controles (botões, campos, avisos) com 12px; cartões, seções recolhíveis e folhas com 16px; fotos de item com 8–12px; chips, selos e o botão de adicionar em pílula/círculo. Fotos sempre cortadas em quadrado (`object-cover`).

## Components

**Macio e firme.** Cantos generosos e superfícies brancas dão a maciez; alvos de 44px, peso 600 nos rótulos e uma só ação em brasa por tela dão a firmeza.

### Buttons
- **Shape:** 12px, altura mínima 44px, padding lateral 16px, peso 600.
- **Primary:** brasa com texto branco; hover em brasa forte. Em botões de valor ("Pagar", "Enviar para a cozinha") o rótulo vai à esquerda e o total à direita.
- **Secondary:** superfície com borda; hover no tom do fundo.
- **Danger:** perigo cheio com texto branco, só na confirmação de ação destrutiva.
- **Disabled:** 50% de opacidade e cursor de bloqueio. **Focus:** contorno brasa de 2px, afastado 2px.

### Chips
- **Categoria:** pílula com borda, altura 44px; ativa em brasa clara com texto e borda brasa (`aria-current`).
- **Selo de estado:** pílula pequena (12px, 600) no par de cores do estado.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** superfície sobre o fundo.
- **Shadow Strategy:** anel de 1px + sombra de repouso (ver Elevation).
- **Internal Padding:** 16px.

### Inputs / Fields
- **Style:** superfície, borda de campo de 1px, 12px de canto, altura 44px, texto 16px.
- **Focus:** borda brasa + anel brasa a 30%.
- **Error:** borda perigo + anel perigo a 20% (`aria-invalid`), mensagem em perigo logo abaixo.

### Navigation
- **Abas do cliente:** três abas de mesma largura, texto 14px/600; ativa com sublinhado de 2px em brasa e texto brasa forte; contador em pílula brasa.
- **Equipe:** abas no cabeçalho, botão "Sair" secundário à direita.

### Seletor de quantidade
Grupo − n + com borda e 12px de canto; cada botão é um quadrado de 44px com o sinal em brasa forte. Substitui o botão redondo "+" assim que o item entra no carrinho, levando o foco junto.

## Do's and Don'ts

### Do:
- **Do** usar só os tokens de `src/index.css` (`@theme`); cor nova vira token antes de ser usada.
- **Do** garantir 44px de alvo em qualquer coisa tocável.
- **Do** usar `botao-primario` para uma única ação principal por tela ou folha.
- **Do** mostrar valores com `formatarReal` e `tabular-nums`.

### Don't:
- **Don't** usar brasa como decoração, fundo de seção ou texto comum.
- **Don't** colocar borda lateral colorida em cartões, linhas ou avisos (achado do scanner Impeccable).
- **Don't** voltar ao fundo creme; o fundo é neutro.
- **Don't** usar cor de estado fora do par fundo claro + texto.
