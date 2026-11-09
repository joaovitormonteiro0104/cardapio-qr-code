// Função única para conversar com o servidor.
// Uso: const pratos = await api('/api/admin/pratos');
//      await api('/api/admin/categorias', { metodo: 'POST', corpo: { nome: 'Bebidas' } });

const CHAVE_TOKEN = 'token';
const ROTA_LOGIN = '/api/auth/login';

export async function api(caminho, { metodo = 'GET', corpo } = {}) {
  const cabecalhos = {};
  const token = sessionStorage.getItem(CHAVE_TOKEN);
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';

  const resposta = await fetch(caminho, {
    method: metodo,
    headers: cabecalhos,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });

  // Token vencido ou inválido: volta para o login (menos na própria tela de login).
  if (resposta.status === 401 && caminho !== ROTA_LOGIN) {
    sessionStorage.removeItem(CHAVE_TOKEN);
    location.href = '/admin/';
    throw new Error('Sessão expirada. Entre novamente.');
  }

  if (resposta.status === 204) return null; // apagar: sem corpo

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new Error(dados?.erro?.mensagem ?? 'Não foi possível falar com o servidor');
  }
  return dados;
}

// Primeira linha das telas do admin e da cozinha.
export function exigirLogin() {
  if (!sessionStorage.getItem(CHAVE_TOKEN)) {
    location.href = '/admin/';
  }
}

export function sair() {
  sessionStorage.removeItem(CHAVE_TOKEN);
  location.href = '/admin/';
}
