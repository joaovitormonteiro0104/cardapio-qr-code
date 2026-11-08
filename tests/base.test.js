import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { obterDb } from '../src/db/conexao.js';
import { migrar } from '../src/db/migrar.js';
import { seed } from '../src/db/seed.js';
import { app } from '../src/app.js';
import { ErroApp, tratarErros } from '../src/middlewares/erros.js';

// Nos testes, obterDb() devolve um banco ':memory:' novo para este arquivo
const db = obterDb();
const contar = (sql) => db.prepare(sql).pluck().get();

beforeAll(() => {
  migrar(db);
  seed(db, 'senha-de-teste');
});

describe('conexão (seção 4.1)', () => {
  it('liga as chaves estrangeiras e o busy_timeout', () => {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.pragma('busy_timeout', { simple: true })).toBe(5000);
  });
});

describe('migrations (seção 4.4)', () => {
  it('registra cada migration aplicada em _migrations', () => {
    const nomes = db.prepare('SELECT nome FROM _migrations').pluck().all();
    expect(nomes).toContain('001_inicial.sql');
  });

  it('não aplica de novo uma migration que já rodou', () => {
    expect(migrar(db)).toEqual([]);
  });

  it('deixa as chaves estrangeiras ligadas no final', () => {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });
});

describe('seed (seção 4.5)', () => {
  it('cria o admin com a senha gravada com bcrypt', () => {
    const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get('admin@teste.com');
    expect(bcrypt.compareSync('senha-de-teste', admin.senha_hash)).toBe(true);
  });

  it('cria 3 categorias', () => {
    expect(contar('SELECT count(*) FROM categorias')).toBe(3);
  });

  it('cria 10 pratos, 2 indisponíveis e 1 inativo', () => {
    expect(contar('SELECT count(*) FROM pratos')).toBe(10);
    expect(contar('SELECT count(*) FROM pratos WHERE disponivel = 0')).toBe(2);
    expect(contar('SELECT count(*) FROM pratos WHERE ativo = 0')).toBe(1);
  });

  it('cria 5 mesas, 1 inativa', () => {
    expect(contar('SELECT count(*) FROM mesas')).toBe(5);
    expect(contar('SELECT count(*) FROM mesas WHERE ativa = 0')).toBe(1);
  });

  it('cria um pedido em cada status', () => {
    const status = db.prepare('SELECT status FROM pedidos ORDER BY status').pluck().all();
    expect(status).toEqual(['cancelado', 'entregue', 'preparando', 'pronto', 'recebido']);
  });

  it('o pedido entregue está pago e o cancelado tem motivo', () => {
    const entregue = db.prepare("SELECT * FROM pedidos WHERE status = 'entregue'").get();
    expect(entregue.pago).toBe(1);
    expect(entregue.pago_em).not.toBeNull();
    const cancelado = db.prepare("SELECT * FROM pedidos WHERE status = 'cancelado'").get();
    expect(cancelado.motivo_cancelamento).toBeTruthy();
  });
});

describe('integridade (seção 9)', () => {
  it('para todo pedido, total_centavos = soma dos itens', () => {
    const divergentes = db.prepare(`
      SELECT p.id
      FROM pedidos p
      JOIN itens_pedido i ON i.pedido_id = p.id
      GROUP BY p.id
      HAVING p.total_centavos <> sum(i.quantidade * i.preco_unitario_centavos)
    `).all();
    expect(divergentes).toEqual([]);
  });

  it('o banco recusa pedido pago que não foi entregue', () => {
    expect(() => db.prepare(`
      INSERT INTO pedidos (mesa_id, status, total_centavos, pago, pago_em)
      VALUES (1, 'recebido', 1000, 1, datetime('now'))
    `).run()).toThrow(/CHECK/);
  });
});

describe('formato único de erro (seção 5)', () => {
  it('rota da API inexistente responde 404 no formato padrão', async () => {
    const resposta = await request(app).get('/api/nao-existe');
    expect(resposta.status).toBe(404);
    expect(resposta.body.erro.codigo).toBe('ROTA_NAO_ENCONTRADA');
  });

  it('JSON malformado responde 400', async () => {
    const resposta = await request(app)
      .post('/api/qualquer')
      .set('Content-Type', 'application/json')
      .send('{ isto não é json');
    expect(resposta.status).toBe(400);
    expect(resposta.body.erro.codigo).toBe('JSON_INVALIDO');
  });

  // App mínimo só para testar o middleware de erros com cada tipo de erro
  const appDeTeste = express();
  appDeTeste.get('/erro-app', () => {
    throw new ErroApp(422, 'PRATO_INDISPONIVEL', 'O prato 12 não está disponível');
  });
  appDeTeste.get('/erro-zod', () => {
    z.object({ nome: z.string() }).parse({});
  });
  appDeTeste.get('/mesa-repetida', () => {
    db.prepare('INSERT INTO mesas (numero) VALUES (?)').run(1);
  });
  appDeTeste.get('/erro-inesperado', () => {
    throw new Error('detalhe interno');
  });
  appDeTeste.use(tratarErros);

  it('ErroApp usa o status e o código informados', async () => {
    const resposta = await request(appDeTeste).get('/erro-app');
    expect(resposta.status).toBe(422);
    expect(resposta.body).toEqual({
      erro: { codigo: 'PRATO_INDISPONIVEL', mensagem: 'O prato 12 não está disponível' },
    });
  });

  it('falha na validação do Zod responde 400', async () => {
    const resposta = await request(appDeTeste).get('/erro-zod');
    expect(resposta.status).toBe(400);
    expect(resposta.body.erro.codigo).toBe('DADOS_INVALIDOS');
  });

  it('erro de restrição do banco vira 409 com código claro', async () => {
    const resposta = await request(appDeTeste).get('/mesa-repetida');
    expect(resposta.status).toBe(409);
    expect(resposta.body.erro.codigo).toBe('REGISTRO_DUPLICADO');
  });

  it('erro inesperado responde 500 sem mostrar detalhes', async () => {
    const original = console.error;
    console.error = () => {}; // evita poluir a saída do teste
    const resposta = await request(appDeTeste).get('/erro-inesperado');
    console.error = original;
    expect(resposta.status).toBe(500);
    expect(resposta.body.erro.codigo).toBe('ERRO_INTERNO');
    expect(JSON.stringify(resposta.body)).not.toContain('detalhe interno');
  });
});
