import bcrypt from 'bcrypt';
import { BCRYPT_CUSTO } from '../config.js';

// Dados de exemplo para desenvolver e testar.
// 1 admin, 3 categorias, 8 pratos (2 indisponíveis), 4 mesas e 4 pedidos (um em cada status aberto + entregue).
export function seed(db, senhaAdmin) {
  const senhaHash = bcrypt.hashSync(senhaAdmin, BCRYPT_CUSTO);

  const inserirAdmin = db.prepare('INSERT INTO admins (email, senha_hash) VALUES (?, ?)');
  const inserirCategoria = db.prepare('INSERT INTO categorias (nome, ordem) VALUES (?, ?)');
  const inserirPrato = db.prepare(`
    INSERT INTO pratos (categoria_id, nome, descricao, preco_centavos, disponivel)
    VALUES (?, ?, ?, ?, ?)
  `);
  const inserirMesa = db.prepare('INSERT INTO mesas (numero) VALUES (?)');
  const inserirPedido = db.prepare(`
    INSERT INTO pedidos (mesa_id, status, total_centavos, criado_em, atualizado_em)
    VALUES (?, ?, ?, datetime('now', ?), datetime('now', ?))
  `);
  const inserirItem = db.prepare(`
    INSERT INTO itens_pedido (pedido_id, prato_id, nome_prato, quantidade, preco_unitario_centavos, observacao)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // db.transaction: se qualquer insert falhar, nada é gravado.
  db.transaction(() => {
    inserirAdmin.run('admin@teste.com', senhaHash);

    const categorias = {};
    for (const [nome, ordem] of [['Entradas', 1], ['Pratos principais', 2], ['Bebidas', 3]]) {
      categorias[nome] = inserirCategoria.run(nome, ordem).lastInsertRowid;
    }

    // [categoria, nome, descrição, preço em centavos, disponível (1/0)]
    const listaPratos = [
      ['Entradas', 'Pão de alho', 'Porção com 6 unidades', 1490, 1],
      ['Entradas', 'Bolinho de bacalhau', 'Porção com 8 unidades', 3290, 1],
      ['Entradas', 'Bruschetta', 'Tomate, manjericão e azeite', 2190, 0],
      ['Pratos principais', 'Feijoada', 'Acompanha arroz, couve e farofa', 4990, 1],
      ['Pratos principais', 'Parmegiana de frango', 'Acompanha arroz e fritas', 4290, 1],
      ['Pratos principais', 'Moqueca de peixe', null, 6890, 0],
      ['Bebidas', 'Suco de laranja', '500 ml', 990, 1],
      ['Bebidas', 'Refrigerante lata', '350 ml', 690, 1],
    ];

    const pratos = {};
    for (const [categoria, nome, descricao, preco, disponivel] of listaPratos) {
      const id = inserirPrato.run(categorias[categoria], nome, descricao, preco, disponivel).lastInsertRowid;
      pratos[nome] = { id, nome, preco };
    }

    const mesas = [];
    for (const numero of [1, 2, 3, 4]) {
      mesas.push(inserirMesa.run(numero).lastInsertRowid);
    }

    // Cada pedido: mesa, status, há quanto tempo foi criado e os itens [prato, quantidade, observação].
    const pedidos = [
      [mesas[0], 'recebido', '-5 minutes', [['Feijoada', 2, null], ['Suco de laranja', 2, 'Sem açúcar']]],
      [mesas[1], 'preparando', '-25 minutes', [['Parmegiana de frango', 1, 'Sem fritas'], ['Refrigerante lata', 1, null]]],
      [mesas[2], 'pronto', '-15 minutes', [['Pão de alho', 1, null], ['Bolinho de bacalhau', 1, null]]],
      [mesas[3], 'entregue', '-60 minutes', [['Feijoada', 1, null]]],
    ];

    for (const [mesaId, status, quando, itens] of pedidos) {
      // O total é sempre a soma dos itens (preço copiado do prato × quantidade).
      const total = itens.reduce((soma, [nome, qtd]) => soma + pratos[nome].preco * qtd, 0);
      const pedidoId = inserirPedido.run(mesaId, status, total, quando, quando).lastInsertRowid;

      for (const [nome, qtd, observacao] of itens) {
        const prato = pratos[nome];
        inserirItem.run(pedidoId, prato.id, prato.nome, qtd, prato.preco, observacao);
      }
    }
  })();
}
