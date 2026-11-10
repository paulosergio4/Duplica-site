// =====================================================================
// DUPLICA · util/formato.js
// Funções pequenas de formatação usadas em todas as telas.
// =====================================================================

/** Escapa texto antes de colocar dentro do HTML (evita quebrar a página). */
export function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** 1234.5 → "R$ 1.234,50" */
export function brl(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Valor curto para o calendário: 4200 → "R$ 4,2 mil" */
export function brlCurto(v) {
  return v >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : brl(v);
}

/** Data de hoje no formato do banco: "2026-11-09" (horário local) */
export function hojeISO() {
  const d = new Date();
  return isoDe(d.getFullYear(), d.getMonth(), d.getDate());
}

/** (2026, 10, 9) → "2026-11-09"  (mês começa em 0, como no JavaScript) */
export function isoDe(ano, mes, dia) {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** "2026-11-09" → "09/11/2026" */
export function dataBR(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** Data e hora curtas de um timestamp: "09/11 19:42" */
export function dataHoraBR(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const z = (n) => String(n).padStart(2, '0');
  return `${z(d.getDate())}/${z(d.getMonth() + 1)} ${z(d.getHours())}:${z(d.getMinutes())}`;
}

/** Dias de hoje até a data (negativo = já passou) */
export function diasAte(iso) {
  if (!iso) return null;                         // boleto ainda sem vencimento
  const [a, m, d] = iso.split('-').map(Number);
  const [ha, hm, hd] = hojeISO().split('-').map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / 86400000);
}

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "segunda, 9 de novembro" */
export function hojeExtenso() {
  return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace('-feira', '');
}

// ---------------------------- CNPJ ----------------------------------

export const soDigitos = (s) => String(s ?? '').replace(/\D/g, '');

/** "25123899000322" → "25.123.899/0003-22" */
export function cnpjFormatado(d) {
  d = soDigitos(d);
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Máscara enquanto digita: vai colocando pontos, barra e traço */
export function mascaraCnpj(valor) {
  const d = soDigitos(valor).slice(0, 14);
  let v = d;
  if (d.length > 2) v = d.slice(0, 2) + '.' + d.slice(2);
  if (d.length > 5) v = v.slice(0, 6) + '.' + d.slice(5);
  if (d.length > 8) v = v.slice(0, 10) + '/' + d.slice(8);
  if (d.length > 12) v = v.slice(0, 15) + '-' + d.slice(12);
  return v;
}

/** Confere os dois dígitos verificadores do CNPJ */
export function cnpjValido(valor) {
  const d = soDigitos(valor);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = (n) => {
    let soma = 0, peso = n - 7;
    for (let i = 0; i < n; i++) { soma += Number(d[i]) * peso--; if (peso < 2) peso = 9; }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

/**
 * Deixa usuário e código da empresa no formato do login, não importa como a
 * pessoa digitou: "  São Luiz " → "saoluiz", "Rafaela" → "rafaela", "joão.silva" → "joao.silva"
 * (tira acento, espaço e maiúscula; mantém letras, números, ponto, traço e _)
 */
export function normalizarLogin(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

/** "1 boleto" / "3 boletos" */
export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
