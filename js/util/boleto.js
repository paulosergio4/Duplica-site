// =====================================================================
// DUPLICA · util/boleto.js
// Lê o código de barras (44 números) ou a linha digitável (47 números)
// de um boleto bancário e tira dele: banco, valor e vencimento.
//
// O código NÃO traz o fornecedor nem o número da nota: o Duplica acha
// o boleto certo cruzando valor + vencimento (ver telas/ler-boleto.js).
//
// Vencimento: o código guarda um "fator" = dias desde uma data-base.
//   Fator 1000 a 9999 a partir de 07/10/1997. Em 22/02/2025 o fator chegou
//   em 9999 e recomeçou em 1000. Usamos a data que fica mais perto de hoje.
// =====================================================================

const BANCOS = {
  '001': 'Banco do Brasil', '033': 'Santander', '041': 'Banrisul', '070': 'BRB', '077': 'Inter',
  '084': 'Uniprime', '085': 'Ailos', '104': 'Caixa', '133': 'Cresol', '136': 'Unicred',
  '208': 'BTG Pactual', '212': 'Original', '237': 'Bradesco', '260': 'Nubank', '290': 'PagBank',
  '323': 'Mercado Pago', '336': 'C6 Bank', '341': 'Itaú', '389': 'Mercantil do Brasil', '422': 'Safra',
  '604': 'Industrial do Brasil', '637': 'Sofisa', '655': 'Votorantim', '707': 'Daycoval',
  '748': 'Sicredi', '756': 'Sicoob',
};

/** Dígito do código de barras (módulo 11, pesos 2 a 9) */
function dvBarras(cod43) {
  let soma = 0, peso = 2;
  for (let i = cod43.length - 1; i >= 0; i--) {
    soma += Number(cod43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const r = 11 - (soma % 11);
  return r === 0 || r === 10 || r === 11 ? 1 : r;
}

/** Dígito de cada campo da linha digitável (módulo 10) */
function dvCampo(numeros) {
  let soma = 0, peso = 2;
  for (let i = numeros.length - 1; i >= 0; i--) {
    let n = Number(numeros[i]) * peso;
    if (n > 9) n = Math.floor(n / 10) + (n % 10);
    soma += n;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}

/** Linha digitável (47) → código de barras (44) */
function linhaParaBarras(l) {
  return l.slice(0, 4) + l[32] + l.slice(33, 47) + l.slice(4, 9) + l.slice(10, 20) + l.slice(21, 31);
}

/** Código de barras (44) → linha digitável (47) */
function barrasParaLinha(c) {
  const livre = c.slice(19);
  const c1 = c.slice(0, 4) + livre.slice(0, 5), c2 = livre.slice(5, 15), c3 = livre.slice(15, 25);
  return c1 + dvCampo(c1) + c2 + dvCampo(c2) + c3 + dvCampo(c3) + c[4] + c.slice(5, 19);
}

/** Linha digitável com os pontos e espaços de sempre (para mostrar e copiar) */
export function linhaFormatada(l) {
  if (!l || l.length !== 47) return l || '';
  return `${l.slice(0, 5)}.${l.slice(5, 10)} ${l.slice(10, 15)}.${l.slice(15, 21)} ${l.slice(21, 26)}.${l.slice(26, 32)} ${l[32]} ${l.slice(33)}`;
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function maisDias(base, dias) { const d = new Date(base + 'T12:00:00'); d.setDate(d.getDate() + dias); return iso(d); }

/** Fator de vencimento → data (a mais perto de hoje entre os dois ciclos) */
function vencimentoDoFator(fator, hoje = iso(new Date())) {
  if (!fator) return null;                       // fator 0000 = boleto sem vencimento
  const ciclo1 = maisDias('1997-10-07', fator);
  const ciclo2 = fator >= 1000 ? maisDias('2025-02-22', fator - 1000) : null;
  if (!ciclo2) return ciclo1;
  const dist = (d) => Math.abs(new Date(d + 'T12:00:00') - new Date(hoje + 'T12:00:00'));
  return dist(ciclo2) <= dist(ciclo1) ? ciclo2 : ciclo1;
}

/**
 * Lê o que foi bipado ou digitado.
 * Devolve { ok: true, barras, linha, banco, bancoNome, valor, vencimento }
 *      ou { ok: false, erro: 'mensagem' }
 */
export function lerBoleto(texto, hoje) {
  const n = String(texto ?? '').replace(/\D/g, '');
  if (!n) return { ok: false, erro: 'Bipe o código de barras ou digite a linha digitável.' };
  if (n[0] === '8' && (n.length === 44 || n.length === 48)) {
    return { ok: false, erro: 'Esse é um boleto de conta de consumo ou tributo (luz, água, imposto). Por enquanto o Duplica só lê boleto bancário.' };
  }
  let barras;
  if (n.length === 44) barras = n;
  else if (n.length === 47) {
    // confere os dígitos dos 3 primeiros campos (pega erro de digitação)
    if (dvCampo(n.slice(0, 9)) !== Number(n[9]) || dvCampo(n.slice(10, 20)) !== Number(n[20]) || dvCampo(n.slice(21, 31)) !== Number(n[31])) {
      return { ok: false, erro: 'Linha digitável com número errado. Confira e digite de novo.' };
    }
    barras = linhaParaBarras(n);
  } else {
    return { ok: false, erro: `Li ${n.length} números. O código de barras tem 44 e a linha digitável tem 47.` };
  }
  if (dvBarras(barras.slice(0, 4) + barras.slice(5)) !== Number(barras[4])) {
    return { ok: false, erro: 'O código não confere (dígito verificador errado). Bipe de novo ou digite a linha digitável.' };
  }
  const banco = barras.slice(0, 3);
  return {
    ok: true,
    barras,
    linha: barrasParaLinha(barras),
    banco,
    bancoNome: BANCOS[banco] || `Banco ${banco}`,
    valor: Number(barras.slice(9, 19)) / 100,
    vencimento: vencimentoDoFator(Number(barras.slice(5, 9)), hoje),
  };
}
