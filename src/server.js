// Sobe o servidor. O app fica separado (app.js) para os testes usarem sem abrir porta.
import { URL_PUBLICA } from './config.js'; // valida o .env antes de tudo
import { app } from './app.js';

const PORTA = Number(process.env.PORT ?? 3000);

app.listen(PORTA, () => {
  console.log(`Servidor rodando em ${URL_PUBLICA}`);
});
