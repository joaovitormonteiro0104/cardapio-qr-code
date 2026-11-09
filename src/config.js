// Lê e valida as variáveis do .env. Se faltar algo obrigatório, o servidor nem sobe.

function obrigatoria(nome) {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável ${nome} ausente. Confira o arquivo .env.`);
  return valor;
}

export const JWT_SECRET = obrigatoria('JWT_SECRET');
if (JWT_SECRET.length < 32) throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres');

export const URL_PUBLICA = process.env.URL_PUBLICA ?? `http://localhost:${process.env.PORT ?? 3000}`;
export const BCRYPT_CUSTO = 10;
