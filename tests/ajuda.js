import request from 'supertest';
import { app } from '../src/app.js';
import { obterDb } from '../src/db/conexao.js';
import { migrar } from '../src/db/migrar.js';
import { seed } from '../src/db/seed.js';

export const SENHA_TESTE = 'senha-de-teste';

export function prepararBanco() {        // no beforeAll de cada arquivo de teste
  const db = obterDb();
  migrar(db);
  seed(db, SENHA_TESTE);
  return db;
}

export async function tokenAdmin() {
  const resposta = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@teste.com', senha: SENHA_TESTE });
  return resposta.body.token;
}
