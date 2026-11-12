// =====================================================================
// DUPLICA · componentes/menu.js
// Menu lateral: marca, empresa, telas que a pessoa pode ver e botão Sair.
// =====================================================================
import { estado } from '../nucleo/estado.js?v=543c57a';
import { NOME_PAPEL } from '../nucleo/regras.js?v=543c57a';
import { registrarAcoes } from '../nucleo/eventos.js?v=543c57a';
import { desenhar } from '../nucleo/desenhar.js?v=543c57a';
import { telasDe } from '../telas/index.js?v=543c57a';
import { ICONE } from './icones.js?v=543c57a';
import { esc } from '../util/formato.js?v=543c57a';
import { temaAtual, alternarTema, LUA, SOL } from '../util/tema.js?v=543c57a';

export function menuHtml() {
  const p = estado.perfil;
  const itens = telasDe(p).map((t) => {
    const n = t.contador ? t.contador() : 0;
    return `<button type="button" data-acao="abrir-tela" data-id="${t.id}"${estado.tela === t.id ? ' aria-current="page"' : ''}>
      <span>${t.rotulo(p)}</span>${n ? `<span class="badge num">${n}</span>` : ''}</button>`;
  }).join('');
  const papel = p.papel === 'gerente' ? NOME_PAPEL.gerente : p.setor + (p.papel === 'admin_setor' ? ' · admin do setor' : '');

  const atual = telasDe(p).find((t) => t.id === estado.tela);
  const totalAvisos = telasDe(p).reduce((s, t) => s + (t.contador ? t.contador() : 0), 0);

  // Barra do topo: só aparece em tela estreita (celular / janela pequena).
  // O botão "Menu" abre e fecha a lista de telas. Veja .barra-topo em css/layout.css
  const barra = `<header class="barra-topo">
    <div class="marca">${ICONE.logo(30)}<span>${esc(atual ? atual.rotulo(p) : 'Duplica')}</span></div>
    <button class="botao-menu" type="button" data-acao="alternar-menu" aria-expanded="${estado.menuAberto}" aria-controls="menu-principal">
      ${estado.menuAberto ? ICONE.fechar() : ICONE.menu()}<span>Menu</span>${!estado.menuAberto && totalAvisos ? `<span class="badge num">${totalAvisos}</span>` : ''}
    </button></header>`;

  return `${barra}<nav class="menu${estado.menuAberto ? ' aberto' : ''}" id="menu-principal" aria-label="Menu">
    <div class="marca marca-menu" style="font-size:20px;padding:0 6px">${ICONE.logo()}Duplica</div>
    <div class="empresa"><small>Empresa</small><b>${esc(estado.empresa?.nome || '')}</b></div>
    <div class="nav">${itens}</div>
    <div class="eu"><span class="av" aria-hidden="true">${esc(p.nome.charAt(0))}</span>
      <div><b>${esc(p.nome)}</b><small>${esc(papel)}</small></div>
      <button class="sair" type="button" data-acao="alternar-tema" aria-label="${temaAtual() === 'escuro' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}" title="${temaAtual() === 'escuro' ? 'Tema claro' : 'Tema escuro'}">${temaAtual() === 'escuro' ? SOL : LUA}</button>
      <button class="sair" type="button" data-acao="sair" aria-label="Sair" title="Sair">${ICONE.sair()}</button></div>
  </nav>`;
}

registrarAcoes({
  'abrir-tela': (el) => {
    Object.assign(estado, { tela: el.dataset.id, sel: null, corrigindo: false, modal: null, menuAberto: false });
    desenhar();
  },
  'alternar-tema': () => { alternarTema(); desenhar(); },
  'alternar-menu': () => { estado.menuAberto = !estado.menuAberto; desenhar(); },
  sair: async () => {
    await estado.api.sair();
    location.href = '../index.html';
  },
});
