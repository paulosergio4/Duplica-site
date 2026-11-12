// =====================================================================
// DUPLICA · util/tema.js
// Tema claro / escuro. A escolha fica guardada neste aparelho
// (localStorage "duplica-tema": 'claro' | 'escuro'). Sem escolha, segue
// o tema do celular/computador.
// O <head> de cada página tem um script curtinho que aplica o tema ANTES
// de desenhar, para a tela não piscar (procure "duplica-tema" no HTML).
// As cores de cada tema estão em css/base.css (:root e [data-tema="escuro"]).
// =====================================================================
const CHAVE = 'duplica-tema';

export function temaAtual() {
  let t = null;
  try { t = localStorage.getItem(CHAVE); } catch { /* sem storage */ }
  if (t === 'claro' || t === 'escuro') return t;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

export function aplicarTema(t = temaAtual()) {
  document.documentElement.dataset.tema = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'escuro' ? '#0A121B' : '#0F2A43');
}

export function alternarTema() {
  const novo = temaAtual() === 'escuro' ? 'claro' : 'escuro';
  try { localStorage.setItem(CHAVE, novo); } catch { /* sem storage */ }
  aplicarTema(novo);
  return novo;
}

/** Botão solto (login, criar conta): <button data-tema-botao> */
export function ligarBotaoTema() {
  const icone = () => (temaAtual() === 'escuro' ? SOL : LUA);
  document.querySelectorAll('[data-tema-botao]').forEach((b) => {
    b.innerHTML = icone();
    b.addEventListener('click', () => { alternarTema(); b.innerHTML = icone(); });
  });
}

export const LUA = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
export const SOL = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

aplicarTema();
