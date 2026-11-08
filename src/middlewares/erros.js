import { ZodError } from 'zod';

// Erro com status HTTP e código, para os services lançarem.
// Exemplo: throw new ErroApp(422, 'PRATO_INDISPONIVEL', 'O prato 12 não está disponível');
export class ErroApp extends Error {
  constructor(status, codigo, mensagem) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

// Erros de restrição do banco viram 409 com código claro (AGENTS.md, seção 5)
const ERROS_DO_BANCO = {
  SQLITE_CONSTRAINT_UNIQUE: ['REGISTRO_DUPLICADO', 'Já existe um registro com esses dados'],
  SQLITE_CONSTRAINT_PRIMARYKEY: ['REGISTRO_DUPLICADO', 'Já existe um registro com esses dados'],
  SQLITE_CONSTRAINT_FOREIGNKEY: ['REGISTRO_RELACIONADO', 'O registro depende de outro que não existe, ou tem registros que dependem dele'],
  SQLITE_CONSTRAINT_CHECK: ['REGRA_DO_BANCO_VIOLADA', 'Os dados não respeitam uma regra do banco'],
  SQLITE_CONSTRAINT_NOTNULL: ['CAMPO_OBRIGATORIO', 'Um campo obrigatório não foi preenchido'],
};

// Rota da API que não existe: 404 no formato padrão, em vez da página HTML do Express
export function rotaNaoEncontrada(req, res, next) {
  next(new ErroApp(404, 'ROTA_NAO_ENCONTRADA', `A rota ${req.method} ${req.originalUrl} não existe`));
}

// Transforma qualquer erro na resposta padrão: { erro: { codigo, mensagem } }.
// O Express só reconhece um middleware de erro se ele tiver os 4 parâmetros.
export function tratarErros(erro, req, res, next) {
  if (res.headersSent) {
    return next(erro);
  }

  const responder = (status, codigo, mensagem) => res.status(status).json({ erro: { codigo, mensagem } });

  if (erro instanceof ErroApp) {
    return responder(erro.status, erro.codigo, erro.message);
  }

  if (erro instanceof ZodError) {
    const problema = erro.issues[0];
    const campo = problema.path.join('.');
    return responder(400, 'DADOS_INVALIDOS', campo ? `${campo}: ${problema.message}` : problema.message);
  }

  // Corpo com JSON malformado (erro lançado pelo express.json)
  if (erro.type === 'entity.parse.failed') {
    return responder(400, 'JSON_INVALIDO', 'O corpo da requisição não é um JSON válido');
  }

  if (erro.code?.startsWith('SQLITE_CONSTRAINT')) {
    const [codigo, mensagem] = ERROS_DO_BANCO[erro.code] ?? ['CONFLITO', 'Os dados entram em conflito com uma regra do banco'];
    return responder(409, codigo, mensagem);
  }

  // Arquivo de tela que não existe (res.sendFile)
  if (erro.status === 404) {
    return responder(404, 'NAO_ENCONTRADO', 'Página não encontrada');
  }

  // Erro inesperado: registra no terminal para investigar, mas não mostra detalhes ao cliente
  console.error(erro);
  return responder(500, 'ERRO_INTERNO', 'Erro inesperado no servidor');
}
