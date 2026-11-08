// Recria o banco local do zero: apaga o arquivo, aplica as migrations e roda o seed (npm run db:resetar).
import { rmSync } from 'node:fs';
import { abrirBanco } from './conexao.js';
import { migrar } from './migrar.js';
import { seed } from './seed.js';

const arquivo = process.env.DB_ARQUIVO;

if (process.env.NODE_ENV === 'production') {
  console.error('db:resetar apaga todos os dados e não roda com NODE_ENV=production.');
  process.exitCode = 1;
} else if (!arquivo) {
  console.error('DB_ARQUIVO não definido. Confira se o arquivo .env existe (Copy-Item .env.example .env).');
  process.exitCode = 1;
} else {
  // Com WAL, o SQLite usa dois arquivos extras: cardapio.db-wal e cardapio.db-shm
  for (const sufixo of ['', '-wal', '-shm']) {
    rmSync(arquivo + sufixo, { force: true });
  }

  const db = abrirBanco(arquivo);
  try {
    const aplicadas = migrar(db);
    seed(db);
    console.log(`Banco ${arquivo} recriado. Migrations: ${aplicadas.join(', ')}. Seed aplicado.`);
  } catch (erro) {
    console.error(erro.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
