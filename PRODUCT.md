# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Feito para **um estabelecimento só** (o deploy é da casa; hoje configurado como "Lanche do espocado"). Três públicos, detalhados em [PRD.md §5](PRD.md):

- **Cliente na mesa**: escaneia o QR fixo com o próprio celular, sem cadastro nem login visível. Quer pedir rápido, saber quando chega e pagar sem esperar o garçom. Vários celulares da mesma mesa dividem uma única conta.
- **Operação** (cozinha, caixa e garçom na mesma tela): tablet 10" compartilhado, em paisagem, aberto o expediente todo. Quer ver a fila em tempo real e mudar o estado com um toque.
- **Gerência**: celular ou computador. Mantém cardápio, mesas, equipe e configurações e consulta a auditoria.

## Product Purpose

Tirar o pedido do papel e da memória do garçom num restaurante ou lanchonete pequena: menos erro de pedido, cliente sem esperar para pedir ou pedir a conta, cozinha com visão da fila e toda alteração registrada. Sucesso está medido em [PRD.md §3](PRD.md) (ex.: menos de 2% de cancelamentos por erro de pedido, pedido na cozinha em até 5 s, mais de 70% de quem escaneia envia pedido).

## Positioning

Web app da própria casa, sem app para instalar: o cliente faz tudo do QR da mesa até o Pix, e a equipe tem uma trilha de auditoria completa (quem mudou o quê, inclusive cancelamentos em 2 etapas com motivo).

## Operating Context

- Salão com internet às vezes instável: o app reconecta sozinho e avisa "Sem conexão".
- Pós-pago, no fluxo brasileiro: come, depois paga. Pagamento só por Pix estático (copia e cola ou QR); o caixa confere o extrato no celular e marca como pago. Sem gateway.
- Rotinas automáticas (auto-cancelamento, mesa inativa) rodam no tablet da cozinha, que precisa ficar aberto.
- Funcionário entra por matrícula + PIN de 6 números.

## Capabilities and Constraints

- Termos do domínio, sempre com estes nomes: **mesa**, **comanda** (na interface, "conta"), **pedido** (cada rodada), **item**. Estados do pedido e da conta em [AGENTS.md §6](AGENTS.md).
- Fora do MVP: variações e adicionais, observação por item, divisão de conta, gateway, multi-estabelecimento, push/WhatsApp, app nativo, impressão térmica, delivery, fidelidade, relatórios de vendas ([PRD.md §4](PRD.md)).
- Português do Brasil, moeda R$, horário America/Fortaleza.
- Nome do estabelecimento, cidade, chave Pix, telefone e prazos são configuráveis pela gerência; nada disso fica fixo no código.
- Coleta mínima (LGPD): só um nome opcional do cliente, descartado com a conta.

## Brand Commitments

- Sem logo nem nome de produto por enquanto: a casa aparece só pelo **nome configurado** (`nome_estabelecimento`).
- Voz **simples e acolhedora**: frases curtas, tratando por "você", sem gíria (ex.: "Bem-vindo!", "Obrigado pela visita!"). Botões dizem a ação; erros dizem o problema e o que fazer.

## Evidence on Hand

- Fotos reais dos itens do cardápio, enviadas pela gerência (bucket `cardapio-fotos`).
- Não há depoimentos, clientes, números de uso nem logo. Não inventar.

## Product Principles

1. **O cliente nunca trava**: todo estado (esperando a cozinha, conta em pagamento, mesa fechada, sem internet) diz o que está acontecendo e o próximo passo.
2. **Um toque para a operação**: a ação mais comum de cada tela é a mais fácil de alcançar no tablet.
3. **Nada some sem rastro**: cancelar, remover ou mudar fica registrado, e as ações destrutivas pedem confirmação explícita.
4. **A casa manda nos valores**: preços, prazos e dados do Pix vêm das configurações, nunca do código.

## Accessibility & Inclusion

WCAG 2.1 AA nas telas do cliente: contraste, alvos de toque de pelo menos 44 px e rótulos em todos os campos ([PRD.md §9](PRD.md)). Celular do cliente: iOS Safari e Android Chrome das 2 últimas versões.
