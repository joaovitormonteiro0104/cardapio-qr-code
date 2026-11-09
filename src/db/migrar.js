import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PASTA_MIGRATIONS = fileURLToPath(new URL('./migrations/', import.meta.url));

// Aplica, em ordem de nome, as migrations que ainda não estão na tabela _migrations.
// Devolve a lista de nomes aplicados agora.
export function migrar(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      nome TEXT PRIMARY KEY,
      aplicada_em TEXT NOT NULL DEFAULT (datetime('now'))
    ) STRICT
  `);

  const jaAplicadas = new Set(
    db.prepare('SELECT nome FROM _migrations').all().map((linha) => linha.nome),
  );

  const arquivos = readdirSync(PASTA_MIGRATIONS)
    .filter((nome) => nome.endsWith('.sql'))
    .sort();

  const registrar = db.prepare('INSERT INTO _migrations (nome) VALUES (?)');
  const aplicadasAgora = [];

  for (const nome of arquivos) {
    if (jaAplicadas.has(nome)) continue;
    const sql = readFileSync(PASTA_MIGRATIONS + nome, 'utf8');

    // Cada migration roda numa transação: ou entra inteira, ou não entra nada.
    db.transaction(() => {
      db.exec(sql);
      registrar.run(nome);
    })();

    aplicadasAgora.push(nome);
  }

  return aplicadasAgora;
}
