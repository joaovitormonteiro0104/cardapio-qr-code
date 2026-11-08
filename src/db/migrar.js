import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// No Windows, URL.pathname devolve "/C:/..." e quebra o caminho; fileURLToPath resolve isso.
const PASTA_MIGRATIONS = fileURLToPath(new URL('./migrations', import.meta.url));

// Aplica, em ordem, as migrations que ainda não rodaram neste banco (AGENTS.md, seção 4.4).
// Recebe o db como parâmetro para os testes usarem a mesma função com ':memory:'.
// Devolve a lista de nomes das migrations aplicadas agora.
export function migrar(db) {
  // 1. Tabela que guarda o nome de cada migration já aplicada
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      nome TEXT PRIMARY KEY,
      aplicada_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 2. Arquivos .sql em ordem alfabética, menos os que já estão em _migrations
  const aplicadas = new Set(db.prepare('SELECT nome FROM _migrations').pluck().all());
  const pendentes = readdirSync(PASTA_MIGRATIONS)
    .filter((nome) => nome.endsWith('.sql'))
    .sort()
    .filter((nome) => !aplicadas.has(nome));

  const registrar = db.prepare('INSERT INTO _migrations (nome) VALUES (?)');

  // 3. Desliga as FKs antes do loop: esse pragma não funciona dentro de transação
  //    e precisa estar desligado para reconstruir tabelas
  db.pragma('foreign_keys = OFF');
  try {
    // 4. Cada migration roda numa transação: se der erro, nada dela fica no banco
    for (const nome of pendentes) {
      const sql = readFileSync(join(PASTA_MIGRATIONS, nome), 'utf8');
      try {
        db.transaction(() => {
          db.exec(sql);
          registrar.run(nome);
        })();
      } catch (erro) {
        throw new Error(`Falha na migration ${nome}: ${erro.message}`, { cause: erro });
      }
    }

    // 5. Confere se alguma linha ficou apontando para um registro que não existe
    const problemas = db.pragma('foreign_key_check');
    if (problemas.length > 0) {
      throw new Error(`Chaves estrangeiras quebradas depois das migrations: ${JSON.stringify(problemas)}`);
    }
  } finally {
    // 6. Religa as FKs, mesmo se algo deu errado
    db.pragma('foreign_keys = ON');
  }

  return pendentes;
}
