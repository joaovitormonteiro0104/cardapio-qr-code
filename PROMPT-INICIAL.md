# Prompt inicial para o Claude Code

Coloque `AGENTS.md` e `PRD.md` na pasta (vazia) do projeto, abra o Claude Code nela e cole o texto abaixo.

```
Você vai me ajudar a construir, do zero, o produto descrito em PRD.md, seguindo à risca as regras técnicas de AGENTS.md. Os dois arquivos estão na raiz desta pasta.

Contexto sobre mim: sou iniciante (Windows + VS Code + PowerShell), aprendendo Node.js, Git e backend. Explique cada peça nova em poucas frases, use comandos PowerShell e não introduza dependências fora das listadas em AGENTS.md §2 sem me perguntar.

Nesta primeira sessão:

1. Leia PRD.md e AGENTS.md por completo.
2. Me devolva, em no máximo 15 linhas:
   - seu entendimento do produto em 3 frases;
   - qualquer contradição entre PRD.md e AGENTS.md que você encontrar;
   - as decisões da tabela de AGENTS.md §15 que eu ainda preciso confirmar.
3. Espere minha confirmação.
4. Depois que eu confirmar, execute SOMENTE o Item 1 do roadmap, usando o prompt de AGENTS.md §14 "Item 1 — Setup inicial". Antes de rodar git init, npm install ou qualquer comando que instale algo, me diga o que vai rodar.
5. Ao terminar: rode npm run build e npm test, me mostre o resultado, liste os arquivos criados e sugira a mensagem de commit. Não faça commit sem eu pedir.

Regras para todas as sessões deste projeto:
- Uma sessão = um item do roadmap (AGENTS.md §13). Não adiante itens.
- Se algo não estiver coberto por PRD.md ou AGENTS.md, pare e pergunte (AGENTS.md §15).
- Se uma decisão nova ficar estável, proponha a alteração em AGENTS.md no mesmo PR.
- Nunca coloque a service_role key no frontend nem commite .env.local.
```

## Sessões seguintes

Abra uma sessão nova do Claude Code para cada item e cole o prompt correspondente de **AGENTS.md §14** (Item 2, Item 3, …). Depois do Item 1, o `CLAUDE.md` criado faz o Claude Code carregar o AGENTS.md automaticamente.
