# Cardápio Digital

Cardápio acessado pelo QR Code da mesa: o dono cadastra o cardápio e as mesas, o cliente faz o pedido
pelo celular e a cozinha acompanha a fila.

As regras do projeto (stack, banco, API, fluxo do grupo) estão em [AGENTS.md](AGENTS.md).

## Como rodar (PowerShell)

Precisa do Node.js LTS (20.6 ou mais nova).

```powershell
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

Telas: `http://localhost:3000/admin`, `/mesa/1` e `/cozinha`
(login `admin@teste.com` e a senha do `.env`).

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o servidor e reinicia ao salvar um arquivo |
| `npm start` | Sobe o servidor |
| `npm test` | Roda os testes |
| `npm run db:migrar` | Aplica as migrations pendentes |
| `npm run db:resetar` | Apaga o banco local, recria e coloca os dados de exemplo |
