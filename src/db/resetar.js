// npm run db:resetar — apaga o banco local, recria as tabelas e coloca os dados de exemplo.
import { rmSync } from 'node:fs';
import { obterDb } from './conexao.js';
import { migrar } from './migrar.js';
import { seed } from './seed.js';

const arquivo = process.env.DB_ARQUIVO ?? 'cardapio.db';
const senhaAdmin = process.env.SEED_SENHA_ADMIN;
if (!senhaAdmin) throw new Error('Variável SEED_SENHA_ADMIN ausente. Confira o arquivo .env.');

// O modo WAL cria dois arquivos extras; apagamos os três.
for (const extra of ['', '-wal', '-shm']) {
  rmSync(arquivo + extra, { force: true });
}

const db = obterDb();
migrar(db);
seed(db, senhaAdmin);
db.close();

console.log(`Banco ${arquivo} recriado com os dados de exemplo.`);
