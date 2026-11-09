import Database from 'better-sqlite3';

// Abre um arquivo SQLite já com as configurações do projeto.
export function abrirBanco(arquivo) {
  const db = new Database(arquivo);
  db.pragma('journal_mode = WAL');   // leituras e escritas convivem melhor
  db.pragma('foreign_keys = ON');    // o SQLite só respeita REFERENCES com isto ligado
  db.pragma('busy_timeout = 5000');  // espera até 5 s se o banco estiver ocupado
  return db;
}

let db = null;

// Devolve sempre a mesma conexão. Abre na primeira chamada.
// Nos testes (o Vitest define NODE_ENV=test) o banco fica só na memória.
export function obterDb() {
  if (!db) {
    const arquivo = process.env.NODE_ENV === 'test'
      ? ':memory:'
      : (process.env.DB_ARQUIVO ?? 'cardapio.db');
    db = abrirBanco(arquivo);
  }
  return db;
}
