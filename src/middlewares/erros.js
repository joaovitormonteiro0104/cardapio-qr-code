import { ZodError } from 'zod';

// Erro "esperado" que os services lançam: throw new ErroApp(404, 'PRATO_NAO_ENCONTRADO', 'Prato 3 não existe')
export class ErroApp extends Error {
  constructor(status, codigo, mensagem) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

function responderErro(res, status, codigo, mensagem) {
  res.status(status).json({ erro: { codigo, mensagem } });
}

// Fica depois de todas as rotas de /api: se ninguém respondeu, a rota não existe.
export function rotaNaoEncontrada(req, res) {
  responderErro(res, 404, 'ROTA_NAO_ENCONTRADA', `Rota ${req.method} ${req.originalUrl} não existe`);
}

// Middleware de erro do Express (tem 4 parâmetros). Converte tudo para o formato padrão.
// eslint-disable-next-line no-unused-vars
export function tratarErros(err, req, res, next) {
  if (err instanceof ErroApp) {
    return responderErro(res, err.status, err.codigo, err.message);
  }

  if (err instanceof ZodError) {
    // Ex.: "nome: Too small: expected string to have >=2 characters"
    const mensagem = err.issues
      .map((issue) => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
      .join('; ');
    return responderErro(res, 400, 'DADOS_INVALIDOS', mensagem);
  }

  // O express.json() marca assim o corpo que não é um JSON válido.
  if (err.type === 'entity.parse.failed') {
    return responderErro(res, 400, 'JSON_INVALIDO', 'O corpo da requisição não é um JSON válido');
  }

  // Regra do banco (UNIQUE, CHECK, chave estrangeira...) que o service não tratou antes.
  if (typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    return responderErro(res, 409, 'CONFLITO', 'A operação viola uma regra do banco de dados');
  }

  // Qualquer outra coisa é um bug: registra no terminal e não mostra detalhes para quem chamou.
  console.error(err);
  return responderErro(res, 500, 'ERRO_INTERNO', 'Erro interno do servidor');
}
