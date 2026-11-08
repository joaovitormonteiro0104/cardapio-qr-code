import express from 'express';
import { fileURLToPath } from 'node:url';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.js';

// Caminho de uma pasta de public/ no formato do sistema (funciona no Windows)
const pastaPublica = (nome) => fileURLToPath(new URL(`../public/${nome}/`, import.meta.url));

// Cria o Express e registra as rotas. Não chama listen: quem sobe o servidor é o server.js,
// e os testes usam este app direto com o Supertest.
export const app = express();

app.use(express.json());

// Telas (arquivos estáticos)
app.use('/admin', express.static(pastaPublica('admin')));
app.use('/cozinha', express.static(pastaPublica('cozinha')));
app.use('/mesa', express.static(pastaPublica('mesa')));
// /mesa/1, /mesa/2... abrem sempre a mesma página; ela lê o número da mesa na URL
app.get('/mesa/:id', (req, res, next) => {
  res.sendFile('index.html', { root: pastaPublica('mesa') }, (erro) => erro && next(erro));
});

// Rotas da API: cada parte registra o seu router aqui
// app.use('/api', rotasAdmin);    // Parte 1
// app.use('/api', rotasCliente);  // Parte 2
// app.use('/api', rotasCozinha);  // Parte 3

app.use('/api', rotaNaoEncontrada);
app.use(tratarErros);
