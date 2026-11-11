// =====================================================================
// DUPLICA · util/chave.js
// Chave de acesso da NF-e (44 números, o código de barras da DANFE):
// confere o dígito verificador (módulo 11) e separa as partes.
// =====================================================================

/** Só os números; true se tem 44 e o último dígito confere */
export function chaveValida(texto) {
  const c = String(texto ?? '').replace(/\D/g, '');
  if (c.length !== 44) return false;
  return dvChave(c.slice(0, 43)) === Number(c[43]);
}

/** Dígito da chave (pesos 2 a 9 da direita para a esquerda) */
export function dvChave(c43) {
  let soma = 0, peso = 2;
  for (let i = c43.length - 1; i >= 0; i--) { soma += Number(c43[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  const r = soma % 11;
  return r < 2 ? 0 : 11 - r;
}

/** "3126 1128 1006 ..." (de 4 em 4, como na DANFE) */
export const chaveFormatada = (c) => String(c ?? '').replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');

/** Número da nota dentro da chave (posições 26 a 34) */
export const numeroDaChave = (c) => String(Number(String(c).slice(25, 34)));
