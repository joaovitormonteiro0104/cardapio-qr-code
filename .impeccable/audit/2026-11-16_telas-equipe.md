# Audit Impeccable — telas da equipe (logado, 2026-11-16)

Telas: /cozinha, /cozinha/contas, /gerencia/cardapio, /gerencia/mesas, /gerencia/equipe, /gerencia/auditoria, /gerencia/config.
Como: navegador do app com login da gerência, em 768x1024 e 375x812; detector do Impeccable injetado em cada tela; checagem própria de contraste (cor real renderizada), alvos de toque, rótulos, títulos e overflow.

## Placar
| Dimensão | Nota | Observação |
|---|---|---|
| Acessibilidade | 4 | Contraste AA em todo texto; alvos ≥ 44px; todo campo com rótulo; 1 h1 por tela; nada sem nome |
| Performance | 3 | Leve; fotos com lazy; toda ação recarrega a lista inteira (aceitável no volume atual) |
| Theming | 3 | Tokens em toda a UI; sem modo escuro (fora do MVP) |
| Responsivo | 3 → 4 | Sem overflow; cabeçalho fixo ocupava 157px no celular (corrigido) |
| Integridade | 4 | Detector: 0 anti-padrões nas 7 telas |
| **Total** | **17 → 18/20** | Bom → Excelente |

## P0/P1
Nenhum.

## P2 corrigidos
- Cabeçalho da equipe fixo ocupava ~20% da tela no celular → rola com a página abaixo de 768px, menos espaço entre abas.
- Título da aba do navegador era "Cardápio" em todas as telas → "Pedidos · Equipe", "Contas · Equipe"...
- Filtros da Auditoria ocupavam a tela inteira no celular → recolhidos em "Mais filtros".
- Cardápio da gerência: botões "Novo item"/"Nova categoria" trocavam de destaque enquanto carregava; caixa "Mostrar excluídos" solta à direita no celular.

## P3 documentados (não corrigidos)
- Rótulo "Gerência/Operação" no cabeçalho era 12px (corrigido para 14px).
- Sem modo escuro (fora do escopo do MVP).
- Toda ação recarrega a lista inteira; otimizar só se o volume crescer.
