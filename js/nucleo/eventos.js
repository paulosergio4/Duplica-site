// =====================================================================
// DUPLICA · nucleo/eventos.js
// Liga os cliques, digitação e envios de formulário às funções certas.
//
// Como funciona (o mesmo em todas as telas):
//   <button data-acao="chegou" data-id="123">   → chama acoes.chegou(botao, evento)
//   <form id="form-usuario">                     → chama formularios['form-usuario'](form)
//   <input id="busca">                           → chama campos['busca'](input)
//
// Cada tela registra as suas funções com registrarAcoes / registrarFormulario
// / registrarCampo. Para achar "o que acontece quando clico em X", procure
// pelo nome do data-acao nos arquivos da pasta js/telas.
// =====================================================================
import { estado } from './estado.js?v=ad4d5df';

const acoes = {};
const formularios = {};
const campos = {};

export const registrarAcoes = (obj) => Object.assign(acoes, obj);
export const registrarFormulario = (id, fn) => { formularios[id] = fn; };
export const registrarCampo = (id, fn) => { campos[id] = fn; };

let redesenhar = () => {};

/** Mostra um aviso no topo da tela por alguns segundos */
let timerToast;
export function avisar(texto, erro = false) {
  estado.toast = { texto, erro };
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { estado.toast = null; redesenhar(); }, erro ? 7000 : 4500);
  redesenhar();
}

/** Roda uma ação que fala com o banco: mostra o erro se der problema */
export async function executar(fn) {
  try { await fn(); } catch (e) { console.error(e); avisar(e.message || 'Algo deu errado.', true); }
}

/** Liga os ouvintes uma única vez no elemento raiz da página */
export function ligarEventos(raiz, render) {
  redesenhar = render;

  raiz.addEventListener('click', (ev) => {
    // clique no fundo escuro de uma janela (fora dela): fecha a janela
    if (ev.target.dataset.fecharFundo) { acoes[ev.target.dataset.fecharFundo]?.(ev.target, ev); return; }
    const alvo = ev.target.closest('[data-acao]');
    if (!alvo || alvo.disabled) return;
    const fn = acoes[alvo.dataset.acao];
    if (fn) { ev.preventDefault(); fn(alvo, ev); }
    else console.warn('Ação sem função registrada:', alvo.dataset.acao);
  });

  raiz.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.type === 'file') return;                                  // arquivos são tratados no "change"
    if (el.dataset.rascunho) estado.rascunho[el.id] = el.value;   // guarda o que foi digitado
    campos[el.id]?.(el, ev);
  });

  raiz.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.type === 'file') campos[el.id]?.(el, ev);
  });

  raiz.addEventListener('submit', (ev) => {
    ev.preventDefault();
    formularios[ev.target.id]?.(ev.target, ev);
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    // fecha primeiro a janela de confirmação; depois, a dos detalhes do boleto
    if (estado.modal) { estado.modal = null; render(); }
    else if (estado.sel) { estado.sel = null; render(); }
  });
}
