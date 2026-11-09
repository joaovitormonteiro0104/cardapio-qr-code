// npm run db:migrar — aplica as migrations pendentes no banco do .env.
import { obterDb } from './conexao.js';
import { migrar } from './migrar.js';

const aplicadas = migrar(obterDb());

if (aplicadas.length === 0) {
  console.log('Nenhuma migration pendente.');
} else {
  console.log(`Migrations aplicadas: ${aplicadas.join(', ')}`);
}
