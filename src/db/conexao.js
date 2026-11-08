import Database from 'better-sqlite3';

// Abre um banco SQLite com as configurações obrigatórias (AGENTS.md, seção 4.1).
// Use ':memory:' como arquivo para um banco temporário, que só existe na memória.
export function abrirBanco(arquivo) {
  const db = new Database(arquivo);
  db.pragma('journal_mode = WAL');   // permite ler enquanto alguém escreve
  db.pragma('foreign_keys = ON');    // no SQLite as FKs vêm DESLIGADAS por padrão
  db.pragma('busy_timeout = 5000');  // espera até 5 s se o banco estiver ocupado
  return db;
}

let banco;

// Devolve a conexão usada pela aplicação. Ela só é aberta na primeira chamada,
// e as chamadas seguintes devolvem a mesma conexão.
// Nos testes (o Vitest define NODE_ENV=test) o banco é sempre ':memory:',
// para nunca mexer no banco de desenvolvimento.
export function obterDb() {
  if (!banco) {
    const arquivo = process.env.NODE_ENV === 'test' ? ':memory:' : process.env.DB_ARQUIVO;
    if (!arquivo) {
      throw new Error('DB_ARQUIVO não definido. Confira se o arquivo .env existe (Copy-Item .env.example .env).');
    }
    banco = abrirBanco(arquivo);
  }
  return banco;
}
