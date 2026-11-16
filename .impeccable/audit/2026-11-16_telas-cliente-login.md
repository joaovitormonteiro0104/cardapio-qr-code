# Audit Impeccable — telas do cliente e login (2026-11-16)

Telas: /login, /mesa/:numero (pedir nome, cardápio, carrinho), /mesa/:numero/comanda (com edição), /mesa/:numero/pagamento (pagar, aguardando, paga), conta encerrada.
Como: janela do Edge (InPrivate, sem login da equipe) controlada por CDP, em 375x812 e 768x1024; fluxo real na mesa 2 (contas #37 e #38, fechadas no fim pela equipe); detector do Impeccable em cada tela; checagem própria de contraste (cor renderizada), alvos de toque, rótulos, títulos e overflow.

## Placar
| Dimensão | Nota | Observação |
|---|---|---|
| Acessibilidade | 3 → 4 | Contraste AA em todo texto; alvos ≥ 44px; todo campo com rótulo; foco vai ao campo com erro no login. Faltava h1 nas abas da mesa (corrigido) |
| Performance | 3 | Leve; fotos com lazy; a Minha conta re-renderiza a cada 1 s por causa do cronômetro da janela de edição (aceitável) |
| Theming | 3 | Tokens em toda a UI; sem modo escuro (fora do MVP) |
| Responsivo | 4 | Sem overflow em 375 e 768; folha do carrinho sobe de baixo no celular |
| Integridade | 3 → 4 | Detector: 1 aviso (falso positivo, abaixo). Estado enganoso na conta paga (corrigido) |
| **Total** | **16 → 18/20** | Bom → Excelente |

## P0/P1
Nenhum.

## P2 corrigidos
- Contador "Minha conta" contava pedido já entregue como em andamento → usa a mesma regra da lista "Em andamento" (`separarPedidos`).
- Conta paga mostrava "A conta foi enviada para pagamento" → mostra "Conta paga. Obrigado pela visita!".
- Observação continuava editável depois do "já paguei" (decisão 20; com a conta paga a RLS recusa e dava erro) → só editável com a conta Aberta; depois, aparece só para leitura.
- Abas da mesa sem h1 (nome da casa era `<p>`) → nome da casa é o h1.
- Título da aba do navegador era "Cardápio" nas três seções → "Minha conta · Mesa 2 · Lanche do espocado" etc.
- Pagar: as caixas "Mostrar o QR Code" / "Ver o código Pix de novo" grudavam o texto na borda quando quebravam em 2 linhas e não tinham seta → respiro vertical e a mesma seta ▾ da Minha conta.

## P3 documentados (não corrigidos)
- Espaço vazio de ~40px abaixo de "Já paguei" (área reservada para mensagem de erro).
- Em 375px, "Cachorro-quente" quebra no hífen quando o seletor de quantidade aparece.
- Ícones são caracteres (+, ×, ▾, ✓), padrão do projeto inteiro; trocar por SVG seria uma revisão geral.
- Sem modo escuro (fora do escopo do MVP).

## Falso positivo do detector
- `edge-flush-cards` na barra de categorias: em 406px a última categoria aparece cortada de propósito (indica que a barra rola). No fim da rolagem ela fica a 16px da borda.

## Observado no teste (não é da interface)
- Num perfil novo do Edge com sincronização ligada, a tela de login virou login da equipe sem que o teste digitasse nada (provável preenchimento automático da senha salva + entrada automática ao completar 6 números). Por isso o teste do cliente rodou em InPrivate.
