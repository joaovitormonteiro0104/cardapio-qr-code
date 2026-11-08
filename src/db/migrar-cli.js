// Aplica as migrations pendentes no banco do .env (npm run db:migrar).
import { obterDb } from './conexao.js';
import { migrar } from './migrar.js';

try {
  const aplicadas = migrar(obterDb());
  if (aplicadas.length === 0) {
    console.log('Nenhuma migration pendente. O banco já está atualizado.');
  } else {
    console.log(`Migrations aplicadas: ${aplicadas.join(', ')}`);
  }
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
}
