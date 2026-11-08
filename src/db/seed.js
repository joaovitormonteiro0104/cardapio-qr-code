import bcrypt from 'bcrypt';

// Dados falsos para desenvolvimento e testes (AGENTS.md, seção 4.5). NÃO é migration.
// A senha do admin vem do .env; nos testes, passe a senha como segundo parâmetro.
export function seed(db, senhaAdmin = process.env.SEED_SENHA_ADMIN) {
  if (!senhaAdmin) {
    throw new Error('SEED_SENHA_ADMIN não definido. Confira o arquivo .env.');
  }
  const senhaHash = bcrypt.hashSync(senhaAdmin, 10);

  // Tudo numa transação: ou o seed entra inteiro, ou nada entra
  db.transaction(() => {
    db.prepare('INSERT INTO admins (email, senha_hash) VALUES (?, ?)').run('admin@teste.com', senhaHash);

    // 3 categorias
    const inserirCategoria = db.prepare('INSERT INTO categorias (nome, ordem) VALUES (?, ?)');
    const categorias = {
      entradas: inserirCategoria.run('Entradas', 1).lastInsertRowid,
      principais: inserirCategoria.run('Pratos principais', 2).lastInsertRowid,
      bebidas: inserirCategoria.run('Bebidas', 3).lastInsertRowid,
    };

    // 10 pratos: 2 indisponíveis (acabaram hoje) e 1 inativo (removido do cardápio)
    const inserirPrato = db.prepare(`
      INSERT INTO pratos (categoria_id, nome, descricao, preco_centavos, disponivel, ativo)
      VALUES (@categoria_id, @nome, @descricao, @preco_centavos, @disponivel, @ativo)
    `);
    const listaPratos = [
      { categoria: 'entradas', nome: 'Bruschetta', descricao: 'Pão italiano com tomate e manjericão', preco: 1890 },
      { categoria: 'entradas', nome: 'Pastel de queijo', descricao: 'Porção com 6 unidades', preco: 1290 },
      { categoria: 'entradas', nome: 'Bolinho de bacalhau', descricao: 'Porção com 8 unidades', preco: 2490, disponivel: 0 },
      { categoria: 'principais', nome: 'Baião de dois', descricao: 'Arroz, feijão verde, queijo coalho e nata', preco: 4590 },
      { categoria: 'principais', nome: 'Carne de sol com macaxeira', descricao: 'Serve 2 pessoas', preco: 5290 },
      { categoria: 'principais', nome: 'Peixe grelhado', descricao: 'Com arroz e salada', preco: 4890 },
      { categoria: 'principais', nome: 'Moqueca de camarão', descricao: 'Com arroz e pirão', preco: 6990, disponivel: 0 },
      { categoria: 'principais', nome: 'Frango à parmegiana', descricao: 'Com arroz e fritas', preco: 3990, ativo: 0 },
      { categoria: 'bebidas', nome: 'Suco de cajá', descricao: 'Copo de 400 ml', preco: 990 },
      { categoria: 'bebidas', nome: 'Refrigerante lata', descricao: null, preco: 690 },
    ];
    const pratos = {};
    for (const p of listaPratos) {
      const id = inserirPrato.run({
        categoria_id: categorias[p.categoria],
        nome: p.nome,
        descricao: p.descricao,
        preco_centavos: p.preco,
        disponivel: p.disponivel ?? 1,
        ativo: p.ativo ?? 1,
      }).lastInsertRowid;
      pratos[p.nome] = { id, nome: p.nome, preco: p.preco };
    }

    // 5 mesas: a mesa 5 está inativa
    const inserirMesa = db.prepare('INSERT INTO mesas (numero, ativa) VALUES (?, ?)');
    const mesas = {};
    for (const numero of [1, 2, 3, 4, 5]) {
      mesas[numero] = inserirMesa.run(numero, numero === 5 ? 0 : 1).lastInsertRowid;
    }

    // 5 pedidos, um em cada status. Os horários ficam no passado para a cozinha
    // ver tempos de espera diferentes (o "preparando" passa dos 20 minutos).
    const inserirPedido = db.prepare(`
      INSERT INTO pedidos (mesa_id, status, total_centavos, pago, pago_em, motivo_cancelamento, criado_em, atualizado_em)
      VALUES (
        @mesa_id, @status, @total_centavos, @pago,
        CASE WHEN @pago = 1 THEN datetime('now', @pago_ha) END,
        @motivo_cancelamento,
        datetime('now', @criado_ha), datetime('now', @criado_ha)
      )
    `);
    const inserirItem = db.prepare(`
      INSERT INTO itens_pedido (pedido_id, prato_id, nome_prato, quantidade, preco_unitario_centavos, observacao)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const pedidos = [
      {
        mesa: 1, status: 'recebido', criado_ha: '-5 minutes',
        itens: [['Baião de dois', 2, 'Sem coentro'], ['Suco de cajá', 2]],
      },
      {
        mesa: 2, status: 'preparando', criado_ha: '-25 minutes',
        itens: [['Carne de sol com macaxeira', 1], ['Refrigerante lata', 1]],
      },
      {
        mesa: 3, status: 'pronto', criado_ha: '-12 minutes',
        itens: [['Peixe grelhado', 1, 'Molho à parte'], ['Suco de cajá', 1]],
      },
      {
        mesa: 4, status: 'entregue', criado_ha: '-90 minutes', pago: 1, pago_ha: '-30 minutes',
        itens: [['Pastel de queijo', 2], ['Peixe grelhado', 1]],
      },
      {
        mesa: 1, status: 'cancelado', criado_ha: '-40 minutes', motivo: 'Cliente desistiu do pedido',
        itens: [['Bruschetta', 1]],
      },
    ];

    for (const pedido of pedidos) {
      // O total é a soma de quantidade × preço dos itens (regra da seção 7.2)
      const total = pedido.itens.reduce((soma, [nome, quantidade]) => soma + pratos[nome].preco * quantidade, 0);
      const pedidoId = inserirPedido.run({
        mesa_id: mesas[pedido.mesa],
        status: pedido.status,
        total_centavos: total,
        pago: pedido.pago ?? 0,
        pago_ha: pedido.pago_ha ?? null,
        motivo_cancelamento: pedido.motivo ?? null,
        criado_ha: pedido.criado_ha,
      }).lastInsertRowid;

      // Nome e preço são copiados para o item, como no pedido de verdade
      for (const [nome, quantidade, observacao] of pedido.itens) {
        const prato = pratos[nome];
        inserirItem.run(pedidoId, prato.id, prato.nome, quantidade, prato.preco, observacao ?? null);
      }
    }
  })();
}
