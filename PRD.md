# PRD — Cardápio e Pedidos por QR Code (MVP)

| | |
|---|---|
| Versão | 1.1 — 2026-11-09 |
| Status | Pronto pra desenvolvimento |
| Documento técnico | [`AGENTS.md`](AGENTS.md) (arquitetura, regras de código, roadmap e prompts por etapa) |

> Este PRD diz **o que** o produto faz e **como saber que está pronto**. Detalhes de implementação ficam no AGENTS.md. Se os dois divergirem, pare e pergunte.

---

## 1. Problema

Em restaurantes e lanchonetes pequenos e médios, o pedido passa por papel ou pela memória do garçom. O resultado:

- Erro de pedido (item errado, esquecido, mesa trocada).
- Cliente esperando garçom pra pedir, pedir mais e pedir a conta.
- Cozinha sem visão de fila nem de tempo de espera.
- Cancelamentos e alterações sem registro, abrindo espaço pra perda e fraude.
- Cardápio impresso desatualizado (preço antigo, item esgotado).

## 2. Solução

Um web app (sem instalar nada) com três frentes:

1. **Cliente** escaneia o QR da mesa, vê o cardápio no celular, envia pedidos, acompanha o preparo e paga via Pix.
2. **Operação** (cozinha, caixa, garçom) recebe os pedidos em tempo real num tablet, avança os estados, cancela com controle, confirma pagamento e fecha a mesa.
3. **Gerência** mantém cardápio, mesas, equipe e configurações, e consulta a auditoria completa.

## 3. Objetivos e métricas do MVP

| Objetivo | Métrica | Meta |
|---|---|---|
| Reduzir erro de pedido | Pedidos cancelados com motivo `erro_de_pedido` | < 2% dos pedidos |
| Agilizar atendimento | Tempo do envio até "Preparando" (mediana) | < 3 min |
| Rastreabilidade total | Mutações em pedido/comanda sem evento de auditoria | 0 no teste de aceitação (falha de rede entre escrita e evento é limitação aceita, AGENTS.md §6.10) |
| Facilidade pro cliente | Clientes que enviam pedido após escanear o QR | > 70% |
| Estabilidade | Pedido que não aparece na cozinha em até 5 s | 0 em teste de aceitação |

## 4. Fora do escopo do MVP

Variações e adicionais de item, observação por item, divisão de conta, gateway de pagamento/confirmação automática, multi-estabelecimento, notificações push/WhatsApp, app nativo, impressão em impressora térmica, delivery/retirada, programa de fidelidade, relatórios de vendas.

## 5. Usuários e papéis

| Persona | Acesso | Dispositivo | Necessidade principal |
|---|---|---|---|
| **Cliente** | Anônimo (via QR), nome opcional | Celular próprio | Pedir rápido, saber quando chega, pagar sem esperar |
| **Operação** (cozinha, caixa, garçom) | Matrícula + PIN, papel `operacao` | Tablet compartilhado | Ver fila em tempo real, mudar estados com 1 toque |
| **Gerência** | Matrícula + PIN, papel `gerencia` | Celular ou computador | Manter cardápio e equipe, configurar, auditar |

## 6. Conceitos

- **Mesa**: local físico com QR fixo apontando pra `/mesa/{numero}`.
- **Comanda**: a conta da mesa, da abertura até o fechamento. Compartilhada por todos na mesa.
- **Pedido**: cada envio de itens ("rodada"). Uma comanda tem vários. Tem estado próprio de preparo.
- **Item do pedido**: produto + quantidade + preço congelado no envio.

## 7. Requisitos funcionais

Prioridade: **P0** = sem isso não lança; **P1** = esperado no MVP, pode atrasar uma semana.

### 7.1 Cliente

| ID | Requisito | Prioridade |
|---|---|---|
| CLI-01 | Ao escanear o QR, abre o cardápio da mesa sem cadastro nem login visível. Mesa inexistente/inativa mostra "mesa indisponível". | P0 |
| CLI-02 | Vários celulares na mesma mesa veem e alimentam a MESMA comanda. | P0 |
| CLI-03 | Cardápio agrupado por categoria, na ordem definida pela gerência, só com itens ativos e disponíveis, com foto (quando houver) e preço em R$. | P0 |
| CLI-04 | Carrinho local com quantidades e subtotal; "enviar pedido" cria um pedido na comanda. | P0 |
| CLI-05 | Tela da comanda lista todos os pedidos com estado atualizado em tempo real e o total da conta. | P0 |
| CLI-06 | Campo de observação geral da comanda, editável. | P1 |
| CLI-07 | Nome opcional, exibido pra cozinha junto aos pedidos daquele celular. | P1 |
| CLI-08 | Dentro da janela livre, o cliente edita quantidades, remove itens ou cancela o pedido sem aprovação. | P0 |
| CLI-09 | Fora da janela livre, só "chamar garçom", que sinaliza o pedido pra operação. | P0 |
| CLI-10 | Tela de pagamento com valor total, QR Pix e código copia-e-cola; botão "já paguei". | P0 |
| CLI-11 | Após "já paguei", não é possível enviar novos pedidos até o caixa reabrir a comanda. | P0 |

### 7.2 Operação

| ID | Requisito | Prioridade |
|---|---|---|
| OPE-01 | Login por matrícula + PIN de 6 dígitos. | P0 |
| OPE-02 | Painel de pedidos em aberto atualizado em tempo real, sem recarregar, recuperando-se sozinho após queda de rede. | P0 |
| OPE-03 | Cada card mostra nº do pedido, mesa, itens, observação, estado (cor) e tempo no estado atual. | P0 |
| OPE-04 | Botões só para as transições válidas do estado atual (aceitar, pronto, entregue). | P0 |
| OPE-05 | Pedidos em "edição solicitada" ficam destacados, com "aplicar edição" e "negar". | P0 |
| OPE-06 | Cancelamento com motivo obrigatório; em Preparando/Pronto, 2 etapas com confirmação explícita; em Recebido, 1 etapa; impossível após "entregue". | P0 |
| OPE-07 | Aba "Contas" com comandas aguardando confirmação; "marcar como pago" e "reabrir". | P0 |
| OPE-08 | "Fechar mesa" disponível só com a conta paga e sem pedidos pendentes. | P0 |
| OPE-09 | Auto-cancelamento de pedidos não aceitos dentro do prazo configurado. | P1 |
| OPE-10 | Comandas inativas por muito tempo fecham sozinhas se estiverem pagas (ou com total zero) e sem pedidos pendentes; caso contrário ficam destacadas pro garçom. | P1 |
| OPE-11 | Dois tablets abertos ao mesmo tempo não geram ações duplicadas nem sobrescrevem um ao outro. | P0 |

### 7.3 Gerência

| ID | Requisito | Prioridade |
|---|---|---|
| GER-01 | CRUD de categorias com reordenação. | P0 |
| GER-02 | CRUD de itens (nome, preço, categoria, foto), "esgotado" e "excluir" (soft delete), filtro "mostrar inativos". | P0 |
| GER-03 | Alterar preço não muda pedidos já enviados. | P0 |
| GER-04 | Cadastro de mesas e página de impressão dos QR Codes. | P0 |
| GER-05 | Cadastro de funcionários (matrícula, nome, papel, PIN), troca de PIN, desativação. | P0 |
| GER-06 | Configurações editáveis: janela de edição, timeout de auto-cancelamento, timeout de sessão, chave Pix, nome, cidade e telefone do estabelecimento. | P0 |
| GER-07 | Consulta de auditoria com filtros (período, tipo, ator) e paginação. | P1 |
| GER-08 | Export CSV da auditoria por período, abrindo corretamente no Excel. | P1 |
| GER-09 | Gerência tem todo acesso da operação, sem atalhos que pulem regras (ex.: cancelamento continua em 2 etapas). | P0 |

## 8. Regras de negócio (resumo)

As regras completas e congeladas estão no AGENTS.md §6. As mais importantes:

1. **Fluxo do pedido**: Recebido → Preparando → Pronto → Entregue → Finalizado. Cancelado é final. "Edição solicitada" e "cancelamento pendente" são temporários e sempre voltam ao estado de origem.
2. **Janela livre do cliente**: em Recebido, ou nos primeiros 2 min (configurável) de Preparando.
3. **Cancelamento pela operação**: 2 etapas, motivo da lista fixa (`sem_ingrediente`, `erro_de_pedido`, `cliente_desistiu`, `atraso`, `outro`), nunca após Entregue, sem exceção pra gerência.
4. **Fluxo da comanda**: Aberta → Aguardando pagamento → Paga → Fechada.
5. **Dinheiro** sempre em centavos inteiros; preço congelado no envio.
6. **Auditoria append-only**: toda modificação vira evento; nada é editado ou apagado.
7. **Nada configurável fica fixo no código.**

## 9. Requisitos não funcionais

| Área | Requisito |
|---|---|
| Dispositivos | Cliente: celular, iOS Safari e Android Chrome das 2 últimas versões. Operação: tablet 10" em paisagem. |
| Desempenho | Cardápio interativo em < 3 s em 4G. Pedido visível na cozinha em < 5 s. |
| Acessibilidade | WCAG 2.1 AA nas telas do cliente: contraste, alvos de toque ≥ 44 px, labels em formulários. |
| Idioma e formato | Português do Brasil; moeda R$; horário America/Fortaleza. |
| Segurança | Nenhum segredo no navegador; cada mesa só enxerga a própria comanda; funcionário desativado perde acesso imediatamente. |
| Confiabilidade | Backup diário do banco fora do Supabase. Reconexão automática do tempo real. |
| Privacidade (LGPD) | Coleta mínima: nome opcional do cliente, descartado com a comanda. Nenhum dado pessoal em URL. |
| Manutenibilidade | Regras de negócio em funções puras com testes; troca do Supabase restrita à pasta de repositories. |

## 10. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Alguém de fora entra na comanda pela URL da mesa | Aceito no MVP (equivale a sentar à mesa). Toda ação fica auditada. |
| Tablet da cozinha fechado → rotinas automáticas param | Documentado; o tablet faz parte da operação. Mover pra servidor é fase 2. |
| Cliente diz que pagou e não pagou | Confirmação é sempre manual pelo caixa conferindo o extrato. |
| Internet instável no salão | Reconexão automática, recarga completa ao reconectar, mensagens claras de erro. |
| PIN curto adivinhável | 6 dígitos, limite de tentativas do Supabase Auth, desativação imediata pela gerência. |

## 11. Critérios de aceite do MVP

O MVP está pronto quando, num teste de ponta a ponta com 2 celulares e 2 tablets:

1. Dois clientes na mesma mesa enviam pedidos separados e ambos aparecem na mesma comanda e na cozinha em < 5 s.
2. A cozinha leva um pedido de Recebido a Entregue; o cliente vê cada mudança sem recarregar.
3. O cliente edita um pedido dentro da janela; fora dela, só consegue chamar o garçom.
4. Um pedido não aceito é cancelado sozinho após o tempo configurado, com evento `sistema`.
5. A cozinha cancela um pedido em Preparando em 2 etapas; um pedido Entregue não pode ser cancelado por ninguém.
6. O cliente paga via Pix, o caixa confirma, o garçom fecha a mesa; a próxima leitura do QR abre uma comanda nova.
7. A gerência muda um preço e um pedido já enviado mantém o preço antigo.
8. A gerência muda a janela de edição e o comportamento muda sem novo deploy.
9. Toda ação acima aparece na auditoria e no CSV exportado.
10. Um cliente não consegue ler a comanda de outra mesa, nem um cliente alterar o cardápio (verificado pelo roteiro de RLS).
11. `npm test` e `npm run build` passam; `npx impeccable detect` termina com exit code 0.

## 12. Plano de entrega

16 entregas sequenciais, uma por PR, detalhadas no AGENTS.md §13 (ordem) e §14 (prompt de cada uma pro Claude Code):

| Fase | Itens | Resultado |
|---|---|---|
| Fundação | 1–4 | Projeto rodando local, banco, segurança e login da equipe |
| Fluxo principal | 5–8 | Cardápio, pedido do cliente, cozinha em tempo real, estados |
| Controle | 9–11 | Edição, cancelamentos, rotinas automáticas, auditoria |
| Fechamento | 12–14 | Pix, fechamento de mesa, configurações, mesas, equipe |
| Qualidade | 15 | Polimento visual, acessibilidade, teste em aparelhos reais |
| Go-live | 16 | Deploy na Vercel e backup diário do banco |

## 13. Decisões em aberto

Ver AGENTS.md §15. A única que bloqueia trabalho é a escolha da lib de QR/Pix, decidida no início do item 12.
