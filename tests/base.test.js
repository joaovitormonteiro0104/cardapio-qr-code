import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prepararBanco } from './ajuda.js';

let db;

beforeAll(() => {
  db = prepararBanco();
});

function contar(tabela) {
  // O nome da tabela vem só deste arquivo de teste, nunca do usuário.
  return db.prepare(`SELECT count(*) AS total FROM ${tabela}`).get().total;
}

describe('seed', () => {
  it('cria os dados de exemplo', () => {
    expect(contar('admins')).toBe(1);
    expect(contar('categorias')).toBe(3);
    expect(contar('pratos')).toBe(8);
    expect(contar('mesas')).toBe(4);
    expect(contar('pedidos')).toBe(4);
  });

  it('tem 2 pratos indisponíveis', () => {
    const { total } = db.prepare('SELECT count(*) AS total FROM pratos WHERE disponivel = 0').get();
    expect(total).toBe(2);
  });

  it('tem um pedido em cada status: recebido, preparando, pronto e entregue', () => {
    const status = db.prepare('SELECT status FROM pedidos ORDER BY id').all().map((p) => p.status);
    expect(status.sort()).toEqual(['entregue', 'preparando', 'pronto', 'recebido']);
  });

  it('o total de cada pedido é a soma dos itens', () => {
    const pedidos = db.prepare(`
      SELECT p.total_centavos, sum(i.quantidade * i.preco_unitario_centavos) AS soma
      FROM pedidos p JOIN itens_pedido i ON i.pedido_id = p.id
      GROUP BY p.id
    `).all();
    for (const pedido of pedidos) {
      expect(pedido.total_centavos).toBe(pedido.soma);
    }
  });

  it('nome de categoria não diferencia maiúsculas', () => {
    expect(() => db.prepare('INSERT INTO categorias (nome) VALUES (?)').run('bebidas')).toThrow(/UNIQUE/);
  });
});

describe('erros da API', () => {
  it('rota inexistente devolve 404 no formato padrão', async () => {
    const resposta = await request(app).get('/api/nao-existe');
    expect(resposta.status).toBe(404);
    expect(resposta.body.erro.codigo).toBe('ROTA_NAO_ENCONTRADA');
  });

  it('JSON malformado devolve 400 JSON_INVALIDO', async () => {
    const resposta = await request(app)
      .post('/api/qualquer')
      .set('Content-Type', 'application/json')
      .send('{ "nome": ');
    expect(resposta.status).toBe(400);
    expect(resposta.body.erro.codigo).toBe('JSON_INVALIDO');
  });
});
