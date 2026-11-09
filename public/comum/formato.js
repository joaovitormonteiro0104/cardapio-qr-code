// Conversão de dinheiro sem usar número decimal (evita 25.90 * 100 = 2589.99...).

// "25,90" ou "R$ 25,90" -> 2590. Devolve null se o formato estiver errado ("Use o formato 25,90").
export function reaisParaCentavos(texto) {
  const limpo = texto.trim().replace(/^R\$\s*/, '').replace('.', ',');
  if (!/^\d{1,5}(,\d{1,2})?$/.test(limpo)) return null;
  const [reais, centavos = ''] = limpo.split(',');
  return Number(reais) * 100 + Number(centavos.padEnd(2, '0'));
}

// 2590 -> "R$ 25,90"
export function centavosParaReais(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
