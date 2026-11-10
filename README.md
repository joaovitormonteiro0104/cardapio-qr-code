# Cardápio e Pedidos por QR Code

Web app de cardápio, pedidos e pagamento Pix por QR Code na mesa.

- **O que o produto faz:** [`PRD.md`](PRD.md)
- **Como construir (arquitetura, regras, roadmap):** [`AGENTS.md`](AGENTS.md)

## Rodar localmente

```powershell
npm install
Copy-Item .env.example .env.local   # preencha com os dados do seu projeto Supabase
npm run dev
```

Setup completo em AGENTS.md §5.

## Primeiro gerente (bootstrap, uma vez só)

O login da equipe é **matrícula + PIN de 6 números**. Por baixo, cada funcionário é um usuário do Supabase Auth com email sintético `{matricula}@restaurante.local` (AGENTS.md §6.9). Os demais funcionários são criados pela tela `/gerencia/equipe`; só o primeiro é feito à mão:

1. No dashboard do Supabase: **Authentication → Users → Add user → Create new user**
   - Email: `001@restaurante.local`
   - Password: o PIN de 6 números do gerente
   - Marque **Auto Confirm User**
2. No **SQL Editor**, rode (troque o nome):

```sql
insert into public.funcionarios (usuario_id, matricula, nome, papel)
select id, '001', 'Nome do Gerente', 'gerencia'
from auth.users
where email = '001@restaurante.local';
```

3. Abra `/login` e entre com matrícula `001` e o PIN.

Isso cria **dados**, não schema, por isso pode ser feito pelo dashboard. Nunca crie tabelas ou políticas por lá: schema só por migration (`npx supabase db push --remote`).

## Testes

```powershell
npm test                                                           # regras de domínio e schemas
npx supabase db query --remote --yes -f supabase/testes/rls_roteiro.sql   # RLS (desfaz tudo no fim)
```
