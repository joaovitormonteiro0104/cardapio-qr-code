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

## Edge Function `equipe`

Única função do servidor (cria funcionário, troca PIN, desativa). Usa a `service_role`, que nunca vai pro navegador. Para publicar depois de mudar `supabase/functions/equipe/index.ts` ou `src/domain/equipe/regras.ts`:

```powershell
npx supabase functions deploy equipe --use-api
```

`--use-api` empacota no servidor do Supabase, sem precisar de Docker.

## Comandos do Supabase CLI contra o projeto

O CLI 3 usa o banco **local** por padrão. Contra o projeto remoto, passe `--remote`:

```powershell
npx supabase db push --remote          # aplica migrations novas
npx supabase migration list --remote   # confere local x remoto
npx supabase db advisors --remote      # avisos de segurança e performance
```

## Backup diário (Backblaze B2)

A rotina `.github/workflows/backup.yml` roda todo dia às 03:00 (Fortaleza): faz um `pg_dump` do banco, **criptografa** o arquivo com uma senha e envia para um bucket **privado** no Backblaze B2. Os segredos ficam só no GitHub, nunca no repositório.

### Configurar (uma vez só)

1. **Backblaze B2** (backblaze.com, conta gratuita):
   - *Buckets → Create a Bucket*: nome único (ex.: `cardapio-backup-seunome`), **Private**.
   - No bucket, *Lifecycle Settings → Use custom lifecycle rules*: prefixo `diario/`, *Days till hide* = **30**, *Days till delete* = **1**. Assim ficam só os últimos 30 dias.
   - *Application Keys → Add a New Application Key*: acesso **só a esse bucket**, *Read and Write*. Anote o **keyID** e a **applicationKey** (ela só aparece uma vez).
   - Na página do bucket, anote o **Endpoint** (ex.: `s3.us-east-005.backblazeb2.com`). A região é o pedaço do meio (`us-east-005`).
2. **Supabase**: no painel do projeto, botão **Connect** → *Session pooler* → copie a URI (`postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-...pooler.supabase.com:5432/postgres`) e troque `[YOUR-PASSWORD]` pela senha do banco. Use o *Session pooler*: a conexão direta não funciona nos servidores do GitHub.
3. **GitHub** → repositório → *Settings → Secrets and variables → Actions → New repository secret*. Crie:

   | Nome | Valor |
   |---|---|
   | `SUPABASE_DB_URL` | a URI do passo 2, com a senha |
   | `BACKUP_SENHA` | uma senha forte que **você guarda** (sem ela o backup não abre) |
   | `B2_KEY_ID` | keyID do B2 |
   | `B2_APPLICATION_KEY` | applicationKey do B2 |
   | `B2_BUCKET` | nome do bucket |
   | `B2_ENDPOINT` | `https://` + endpoint (ex.: `https://s3.us-east-005.backblazeb2.com`) |
   | `B2_REGIAO` | ex.: `us-east-005` |

4. Teste: *Actions → Backup diário do banco → Run workflow*. Em 1–3 minutos deve ficar verde e aparecer um arquivo em `diario/` no bucket.

Se falhar, a aba *Actions* mostra o motivo; o GitHub também manda e-mail quando uma rotina agendada falha.

### Restaurar um backup

1. Baixe o arquivo `.dump.gpg` do bucket (painel do B2 → *Browse Files*).
2. Descriptografe (Git Bash):

   ```bash
   gpg --decrypt --output backup.dump cardapio_AAAA-MM-DD_HHMM.dump.gpg
   ```

3. Veja o que tem dentro sem mexer em nada:

   ```bash
   pg_restore --list backup.dump
   ```

4. Para voltar **só os dados** das tabelas do app num projeto que já tem as migrations aplicadas (o caso mais comum):

   ```bash
   pg_restore --dbname "URI_DO_BANCO" --data-only --schema=public --disable-triggers backup.dump
   ```

   Faça isso de preferência num **projeto Supabase novo** (rode `npx supabase db push --remote` nele antes) e confira antes de apontar o app para ele. Restaurar por cima do banco em uso apaga o que mudou depois do backup.

5. Os logins da equipe ficam no schema `auth`. Se o projeto for novo, restaure também `--schema=auth --data-only` ou recrie os funcionários pela tela Equipe.

Dúvida na hora de restaurar? Peça ajuda antes de rodar o passo 4: é o único passo que escreve no banco.
