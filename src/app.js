import express from 'express';
import { fileURLToPath } from 'node:url';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.js';
// import rotasAdmin from './admin/rotas.js';      // Parte 1
// import rotasCliente from './cliente/rotas.js';  // Parte 2
// import rotasCozinha from './cozinha/rotas.js';  // Parte 3

const PASTA_PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));

export const app = express();

app.use(express.json());              // transforma o corpo JSON em req.body
app.use(express.static(PASTA_PUBLIC)); // telas: /admin/, /cozinha/, /comum/...

// O link do QR Code é /mesa/3: devolvemos sempre a mesma tela, que lê o id na URL.
app.get('/mesa/:id', (req, res) => {
  res.sendFile(PASTA_PUBLIC + 'mesa/index.html');
});

// app.use('/api', rotasAdmin);    // Parte 1
// app.use('/api', rotasCliente);  // Parte 2
// app.use('/api', rotasCozinha);  // Parte 3
app.use('/api', rotaNaoEncontrada);
app.use(tratarErros);
