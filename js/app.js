// =====================================================================
// DUPLICA · app.js
// Ponto de partida da página do sistema (html/app.html).
//   1. confere se há alguém logado (senão volta para o login)
//   2. carrega os dados
//   3. desenha o menu + a tela aberta + os detalhes do boleto e a janela (se houver)
// =====================================================================
import { estado } from './nucleo/estado.js?v=1a48cff';
import { ligarEventos, registrarAcoes } from './nucleo/eventos.js?v=1a48cff';
import { definirDesenho, recarregar } from './nucleo/desenhar.js?v=1a48cff';
import { obterApi } from './servicos/api.js?v=1a48cff';
import { TELAS, telasDe, telaInicial } from './telas/index.js?v=1a48cff';
import { menuHtml } from './componentes/menu.js?v=1a48cff';
import { modalHtml } from './componentes/modal-pessoa.js?v=1a48cff';
import { painelHtml } from './componentes/painel-boleto.js?v=1a48cff';
import { esc } from './util/formato.js?v=1a48cff';

const raiz = document.getElementById('app');
const inicioCarga = performance.now();

/** Some com a tela de carregamento (deixa a animação do logo terminar: ~1,6 s no mínimo) */
function esconderSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const falta = Math.max(0, 1600 - (performance.now() - inicioCarga));
  setTimeout(() => { splash.classList.add('saindo'); setTimeout(() => splash.remove(), 500); }, falta);
}

/** Redesenha tudo, mantendo o cursor no campo em que a pessoa estava digitando */
function desenhar() {
  const ativo = document.activeElement;
  const focoId = ativo && ativo.id;
  const cursor = focoId && typeof ativo.selectionStart === 'number' ? ativo.selectionStart : null;
  const rolagem = window.scrollY;

  const tela = TELAS.find((t) => t.id === estado.tela && t.visivel(estado.perfil)) || telasDe(estado.perfil)[0];
  const faixaDemo = estado.api.demo
    ? '<div class="faixa-demo">Modo demonstração: dados de exemplo, salvos só neste navegador. <button class="bg" type="button" data-acao="reiniciar-demo" style="height:28px;margin-left:8px">Recomeçar exemplo</button></div>' : '';
  raiz.innerHTML = `${faixaDemo}<div class="app">${menuHtml()}<main>${tela.render()}</main></div>${painelHtml()}${modalHtml()}`;

  if (focoId) {
    const el = document.getElementById(focoId);
    if (el) { el.focus(); if (cursor !== null) try { el.setSelectionRange(cursor, cursor); } catch { /* campo sem cursor */ } }
  }
  window.scrollTo(0, rolagem);
}

async function iniciar() {
  estado.api = await obterApi();
  const sessao = await estado.api.sessao();
  if (!sessao) { location.href = '../index.html'; return; }
  if (sessao.perfil.pendente) { location.href = '../index.html?primeiro-acesso=1'; return; }

  estado.perfil = sessao.perfil;
  estado.empresa = sessao.empresa;
  estado.tela = telaInicial(estado.perfil);

  definirDesenho(desenhar);
  ligarEventos(raiz, desenhar);
  // cria os boletos das contas fixas que já entraram no prazo (nunca duplica)
  try { await estado.api.gerarRecorrentes(); } catch (e) { console.warn('Contas fixas:', e.message); }
  await recarregar();
  esconderSplash();
}

// ação do botão da faixa de demonstração
registrarAcoes({
  'reiniciar-demo': async () => { await estado.api.reiniciarDemo(); await recarregar(); },
});

iniciar().catch((e) => {
  console.error(e);
  document.getElementById('splash')?.remove();
  raiz.innerHTML = `<div class="carregando">Não foi possível abrir o sistema: ${esc(e.message)}<br><a href="../index.html">Voltar ao login</a></div>`;
});
