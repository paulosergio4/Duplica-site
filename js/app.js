// =====================================================================
// DUPLICA · app.js
// Ponto de partida da página do sistema (html/app.html).
//   1. confere se há alguém logado (senão volta para o login)
//   2. carrega os dados
//   3. desenha o menu + a tela aberta + os detalhes do boleto e a janela (se houver)
// =====================================================================
import { estado } from './nucleo/estado.js?v=e9fe573';
import { ligarEventos, registrarAcoes, avisar } from './nucleo/eventos.js?v=e9fe573';
import { definirDesenho, recarregar } from './nucleo/desenhar.js?v=e9fe573';
import { obterApi } from './servicos/api.js?v=e9fe573';
import { TELAS, telasDe, telaInicial } from './telas/index.js?v=e9fe573';
import { menuHtml } from './componentes/menu.js?v=e9fe573';
import { modalHtml } from './componentes/modal-pessoa.js?v=e9fe573';
import { painelHtml } from './componentes/painel-boleto.js?v=e9fe573';
import { esc, dataBR, hojeISO } from './util/formato.js?v=e9fe573';
import { CONFIG } from './config.js?v=e9fe573';
import { prepararInstalacao } from './util/instalar.js?v=e9fe573';
import { bip } from './util/camera.js?v=e9fe573';
import { numeroDaChave } from './util/chave.js?v=e9fe573';
import { limparFotosProduto } from './telas/conferencia.js?v=e9fe573';

const raiz = document.getElementById('app');
const inicioCarga = performance.now();

/** A animação do logo (traço do D, visto e "pulo") vai até ~2,1 s. A tela pesada do sistema só é
 *  desenhada DEPOIS disso, para não engasgar a animação; aí a abertura some suave (só opacidade/escala). */
const DURACAO_LOGO = 2250;
const logoPronto = new Promise((ok) => setTimeout(ok, Math.max(0, DURACAO_LOGO - performance.now())));
const quadro = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
async function esconderSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  await quadro();                       // a tela já está desenhada por baixo
  splash.classList.add('saindo');
  setTimeout(() => splash.remove(), 700);
}

/** Dias que faltam do teste grátis (null = não está em teste) */
function diasDeTeste() {
  const e = estado.empresa;
  if (!e || e.situacao !== 'teste' || !e.teste_ate) return null;
  return Math.round((new Date(e.teste_ate + 'T12:00:00') - new Date(hojeISO() + 'T12:00:00')) / 864e5);
}

const contatoSuporte = () => [
  CONFIG.SUPORTE_WHATSAPP ? `<a href="https://wa.me/${CONFIG.SUPORTE_WHATSAPP}" target="_blank" rel="noopener">WhatsApp</a>` : '',
  CONFIG.SUPORTE_EMAIL ? `<a href="mailto:${CONFIG.SUPORTE_EMAIL}">${CONFIG.SUPORTE_EMAIL}</a>` : '',
].filter(Boolean).join(' · ');

/** Faixa no topo durante o teste grátis */
function faixaTeste() {
  const d = diasDeTeste();
  if (d === null || d < 0) return '';
  const quando = d === 0 ? 'termina hoje' : d === 1 ? 'termina amanhã' : `faltam ${d} dias`;
  const c = contatoSuporte();
  return `<div class="faixa-teste">Teste grátis: ${quando} (até ${dataBR(estado.empresa.teste_ate)}).${c ? ` Para assinar, fale com a gente: ${c}` : ''}</div>`;
}

/** Teste vencido ou empresa suspensa: mostra o aviso no lugar do sistema */
function telaBloqueio() {
  const e = estado.empresa;
  const titulo = e.situacao === 'bloqueado' ? 'Acesso suspenso' : 'O teste grátis terminou';
  const texto = e.situacao === 'bloqueado'
    ? 'O acesso desta empresa ao Duplica está suspenso.'
    : `O período de teste da ${esc(e.nome)} terminou em ${dataBR(e.teste_ate)}. Os seus dados continuam guardados: assine para voltar a usar.`;
  const c = contatoSuporte();
  return `<div class="bloqueio"><div class="login-card"><h2>${titulo}</h2><p style="margin:0;font-size:15px;line-height:1.6;color:var(--cafe)">${texto}</p>
    ${c ? `<p style="margin:0;font-size:15px">Fale com a gente: ${c}</p>` : '<p style="margin:0;font-size:15px">Fale com o suporte do Duplica.</p>'}
    <a class="bg" href="../index.html?sair=1" style="height:46px;display:flex;align-items:center;justify-content:center;text-decoration:none">Sair</a></div></div>`;
}

/** "A nota e o boleto chegaram, fulano recebeu" */
async function avisoRecebimento(r, atualizou) {
  if (r.perfil_id === estado.perfil.id) return;          // fui eu mesmo
  if (atualizou && r.tem_boleto !== true) return;        // só interessa quando o boleto foi anexado
  await recarregar();
  const n = r.nota_id ? estado.notas.find((x) => x.id === r.nota_id) : null;
  const f = n ? estado.filiais.find((x) => x.id === n.filial_id) : null;
  const qual = n ? `${n.fornecedor} · NF ${n.numero}${f ? ' · ' + f.nome : ''}` : `NF ${numeroDaChave(r.chave)}`;
  const texto = atualizou ? `Boleto chegou junto com a nota: ${qual}. ${r.nome} recebeu${r.fotos?.length ? ' e anexou a foto' : ''}.`
    : r.situacao === 'pendente' ? `${r.nome} recebeu a NF ${numeroDaChave(r.chave)}, que ainda não entrou no sistema (aguardando o XML).`
    : `Nota chegou: ${qual}. ${r.nome} recebeu.`;
  bip(true);
  avisar(texto, false, 12000);
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
  raiz.innerHTML = `${faixaDemo}${faixaTeste()}<div class="app">${menuHtml()}<main>${tela.render()}</main></div>${painelHtml()}${modalHtml()}`;

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
  const d = diasDeTeste();
  if (estado.empresa?.situacao === 'bloqueado' || (d !== null && d < 0)) {
    document.getElementById('splash')?.remove();
    raiz.innerHTML = telaBloqueio();
    return;
  }
  estado.tela = telaInicial(estado.perfil);

  definirDesenho(desenhar);
  ligarEventos(raiz, desenhar);
  // cria os boletos das contas fixas que já entraram no prazo (nunca duplica)
  try { await estado.api.gerarRecorrentes(); } catch (e) { console.warn('Contas fixas:', e.message); }
  await recarregar(logoPronto);
  esconderSplash();
  limparFotosProduto();   // fotos de produto com mais de 3 meses (Fiscal/Admin, 1x por dia)
  // Fiscal e Admin: aviso na hora quando alguém bipa uma nota no recebimento
  if (estado.perfil.papel === 'gerente' || estado.perfil.setor === 'Fiscal') {
    try { estado.api.ouvirRecebimentos(avisoRecebimento); } catch (e) { console.warn('Avisos de recebimento:', e.message); }
  }
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

prepararInstalacao();
