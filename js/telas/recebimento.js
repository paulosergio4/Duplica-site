// =====================================================================
// DUPLICA · telas/recebimento.js
// Tela "Receber notas" (feita para o CELULAR, no recebimento da loja).
//   - Abrir câmera → bipa o código de barras da DANFE (chave de 44 números)
//   - ou digita/bipa a chave com leitor USB no campo
// A nota fica como "Chegou", recebida por quem bipou, e o sistema pergunta
// "Tem boleto?": se sim, abre a câmera para a foto do boleto, que fica
// anexada, e os boletos da nota viram "Chegou". O Fiscal é avisado na hora.
// Fiscal/Admin veem TODAS as notas (XML) desde empresas.recebimento_desde,
// "Não chegou" / "Chegou", e podem marcar na tela que chegou.
// =====================================================================
import { estado, notaDe, filialDe } from '../nucleo/estado.js?v=e9fe573';
import { registrarAcoes, registrarFormulario, registrarCampo, avisar, executar } from '../nucleo/eventos.js?v=e9fe573';
import { desenhar, recarregar } from '../nucleo/desenhar.js?v=e9fe573';
import { cabecalho, toastHtml, vazio, docNota } from '../componentes/comuns.js?v=e9fe573';
import { esc, plural, brl, dataBR, dataHoraBR } from '../util/formato.js?v=e9fe573';
import { chaveValida, chaveFormatada, numeroDaChave } from '../util/chave.js?v=e9fe573';
import { abrirCamera, bip } from '../util/camera.js?v=e9fe573';
import { conferenciaHtml, seloConferencia, resumoDaNota } from './conferencia.js?v=e9fe573';

/** Recebimento (o primeiro, não repetido) de cada nota */
function recebimentoDaNota(notaId) {
  let achado = null;
  for (const r of estado.recebimentos || []) if (r.nota_id === notaId && r.situacao !== 'pendente' && (!achado || r.feito_em < achado.feito_em)) achado = r;
  return achado;
}

export const telaRecebimento = {
  id: 'receber',
  rotulo: () => (estado.perfil?.setor === 'Recebimento' ? 'Receber notas' : 'Recebimento de mercadoria'),
  visivel: (p) => p.setor === 'Recebimento' || p.setor === 'Fiscal' || p.papel === 'gerente',

  render() {
    const u = estado.ultimoRecebimento;
    const conferente = estado.perfil.setor === 'Recebimento';
    const topo = cabecalho(conferente ? 'Recebimento' : 'Estoque', conferente ? 'Receber notas' : 'Recebimento de mercadoria') + toastHtml()
      + `<section class="secao receber">
          <button class="bp receber-bipar" type="button" data-acao="receber-camera">${iconeCamera()}Bipar nota com a câmera</button>
          <form id="form-chave" class="receber-manual" novalidate>
            <label for="rc-chave">Ou digite a chave (44 números) / use o leitor USB</label>
            <div style="display:flex;gap:8px"><input class="inp num" id="rc-chave" inputmode="numeric" autocomplete="off" placeholder="0000 0000 0000 ..." style="flex:1;min-width:0"><button class="bg" type="submit" style="height:48px">OK</button></div>
          </form>
          ${u ? resultadoHtml(u) : ''}
        </section>`;
    return topo + (estado.conferindo ? conferenciaHtml() : conferente ? listaConferente() : listaNotas());
  },
};

/** Conferente: só o que ele mesmo recebeu hoje */
function listaConferente() {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const lista = (estado.recebimentos || []).filter((r) => r.perfil_id === estado.perfil.id && new Date(r.feito_em) >= hoje);
  return `<section class="secao"><div class="secao-h"><h2>Você recebeu hoje</h2><span class="pill p-breve num">${plural(lista.length, 'nota', 'notas')}</span></div>
    ${lista.length ? `<div class="rolagem">${lista.map((r) => linhaNota(r.nota_id ? notaDe(r.nota_id) : null, r)).join('')}</div>` : vazio('Nenhuma nota recebida hoje.')}</section>`;
}

/** Fiscal e Admin: todas as notas (XML) desde empresas.recebimento_desde, chegou ou não */
function listaNotas() {
  const desde = estado.empresa?.recebimento_desde || '0000';
  const busca = estado.recBusca.trim().toLowerCase();
  const itens = estado.notas.filter((n) => n.chave && (n.emissao >= desde || recebimentoDaNota(n.id)))
    .map((n) => ({ n, r: recebimentoDaNota(n.id) }));
  // notas bipadas que ainda não têm XML
  for (const r of estado.recebimentos || []) if (r.situacao === 'pendente') itens.push({ n: null, r });
  const total = itens.length, chegaram = itens.filter((i) => i.r).length;
  const lista = itens
    .filter((i) => estado.recFiltro === 'todas' || (estado.recFiltro === 'chegou') === Boolean(i.r))
    .filter((i) => !busca || `${i.n?.fornecedor || ''} ${i.n?.numero || numeroDaChave(i.r.chave)} ${i.r?.nome || ''}`.toLowerCase().includes(busca))
    .sort((a, b) => (Boolean(a.r) - Boolean(b.r)) || ((b.r?.feito_em || b.n?.emissao || '') > (a.r?.feito_em || a.n?.emissao || '') ? 1 : -1));
  const chip = (id, txt, q) => `<button type="button" aria-pressed="${estado.recFiltro === id}" data-acao="rec-filtro" data-id="${id}">${txt} <span class="num">${q}</span></button>`;
  return `<section class="secao"><div class="secao-h"><h2>Notas desde ${dataBR(desde)}</h2><span class="pill p-breve num">${plural(total - chegaram, 'não chegou', 'não chegaram')}</span></div>
    <div style="padding:14px 20px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--linha)">
      <div class="chips">${chip('falta', 'Não chegaram', total - chegaram)}${chip('chegou', 'Chegaram', chegaram)}${chip('todas', 'Todas', total)}</div>
      <input class="inp" id="rec-busca" placeholder="Buscar fornecedor, nota ou quem recebeu" value="${esc(estado.recBusca)}" style="flex:1 1 240px;min-width:0;height:40px"></div>
    ${lista.length ? `<div class="rolagem">${lista.map((i) => linhaNota(i.n, i.r)).join('')}</div>`
      : vazio(estado.recFiltro === 'falta' ? 'Nenhuma nota esperando: todas chegaram.' : 'Nenhuma nota aqui.')}</section>`;
}

const iconeCamera = () => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';

/** Cartão com o resultado da última leitura e a pergunta "Tem boleto?" */
function resultadoHtml(r) {
  const cor = { casada: 'var(--musgo)', ja: 'var(--ocre-txt)', pendente: 'var(--terra)', repetida: 'var(--ocre-txt)', erro: 'var(--alerta)' }[r.situacao];
  const quem = r.recebido_por ? ` por ${esc(r.recebido_por)} em ${dataHoraBR(r.recebido_em)}` : '';
  const titulo = {
    casada: 'Nota recebida',
    ja: `Essa nota já tinha sido recebida${quem}`,
    pendente: 'Nota guardada: ainda não entrou no sistema',
    repetida: `Essa nota já foi bipada${quem} e está aguardando o XML`,
    erro: 'Não deu certo',
  }[r.situacao];
  const corpo = r.situacao === 'erro' ? esc(r.erro)
    : r.fornecedor ? `${esc(r.fornecedor)} · NF ${esc(r.numero)} · ${esc(r.filial || '')}`
    : `NF ${esc(numeroDaChave(r.chave))} · chave ${esc(chaveFormatada(r.chave))}<br>Quando o XML chegar, ela é ligada a este recebimento.`;
  let boleto = '';
  if (r.recebimento_id && r.situacao !== 'erro') {
    const fotos = r.fotos || 0;
    if (r.enviando) boleto = '<div class="tem-boleto"><b>Enviando a foto…</b></div>';
    else if (r.tem_boleto === true) boleto = `<div class="tem-boleto"><b style="color:var(--musgo)">Boleto anexado${fotos ? ` (${plural(fotos, 'foto', 'fotos')})` : ''}${r.marcados ? ` · ${plural(r.marcados, 'boleto marcado', 'boletos marcados')} como "Chegou"` : ''}</b>
        <div class="tem-boleto-b">${botaoFoto('Tirar mais uma foto', 'bg')}<button class="bg" type="button" data-acao="rec-concluir">Concluir</button></div></div>`;
    else if (r.tem_boleto === false) boleto = '<div class="tem-boleto"><b>Sem boleto junto com a nota.</b></div>';
    else boleto = `<div class="tem-boleto"><b>Tem boleto junto com a nota?</b>
        <div class="tem-boleto-b">${botaoFoto('Sim, tirar foto', 'bp')}<button class="bg" type="button" data-acao="rec-sem-boleto">Não tem</button></div>
        ${r.erroFoto ? `<small style="color:var(--alerta)">${esc(r.erroFoto)}</small>` : ''}</div>`;
  }
  let produtos = '';
  if (r.nota_id && r.situacao !== 'erro' && !(estado.conferindo?.notaId === r.nota_id)) {
    const rs = resumoDaNota(r.nota_id);
    produtos = `<div class="tem-boleto"><b>Conferência de produtos${rs ? ` · <span class="num">${rs.conferidos} de ${rs.total}</span>` : ''}</b>
      <div class="tem-boleto-b"><button class="${rs && rs.conferidos >= rs.total ? 'bg' : 'bp'}" type="button" data-acao="conf-abrir" data-id="${r.nota_id}">${rs && rs.conferidos >= rs.total ? 'Ver conferência' : 'Conferir produtos (EAN)'}</button></div></div>`;
  }
  return `<div class="receber-resultado" style="border-color:${cor}" role="status"><b style="color:${cor}">${titulo}</b><small>${corpo}</small>${boleto}${produtos}</div>`;
}

/** Botão que abre a câmera do celular para a foto (no computador, abre a escolha de arquivo) */
const botaoFoto = (texto, classe) => `<label class="${classe} botao-foto">${iconeCamera()}${texto}<input type="file" id="rec-foto" accept="image/*" capture="environment" hidden></label>`;

function linhaNota(n, r) {
  const f = n ? filialDe(n.filial_id) : null;
  const temBoletoNoSistema = n && estado.boletos.some((b) => b.nota_id === n.id);
  const chegou = !r ? '<span class="pill p-esperado">Não chegou</span>'
    : r.situacao === 'pendente' ? '<span class="pill p-breve">Recebida · aguardando XML</span>'
    : '<span class="pill p-visto">Chegou</span>';
  const boleto = !r ? '' : r.tem_boleto === true ? '<span class="pill p-chegou">Com boleto</span>'
    : r.tem_boleto === false ? '<span class="pill p-esperado">Sem boleto</span>'
    : `<span class="pill p-breve">${temBoletoNoSistema ? 'Boleto: não informado' : 'Boleto: não informado'}</span>`;
  const acoes = [
    !r && n ? `<button class="bp" type="button" data-acao="rec-marcar" data-id="${n.id}">Marcar que chegou</button>` : '',
    r?.fotos?.length ? `<button class="bg" type="button" data-acao="rec-ver-fotos" data-id="${r.id}">Ver ${plural(r.fotos.length, 'foto', 'fotos')} do boleto</button>` : '',
    r && r.tem_boleto !== true && estado.perfil.setor !== 'Recebimento' ? `<button class="bg" type="button" data-acao="rec-anexar" data-id="${r.id}">Anexar boleto</button>` : '',
    r && n && resumoDaNota(n.id) ? `<button class="bg" type="button" data-acao="conf-abrir" data-id="${n.id}">Conferência</button>` : '',
  ].join('');
  return `<div class="linha"><div class="kv" style="flex:1 1 240px;min-width:0"><b style="color:var(--petroleo)">${n ? esc(n.fornecedor) : 'Nota ainda sem XML'}</b>
      <small>${n ? `${docNota(n)} · ${esc(f?.nome || '')}` : `NF ${esc(numeroDaChave(r.chave))}`}</small></div>
    ${n ? `<div class="kv" style="width:96px"><small>Emissão</small><b class="num">${dataBR(n.emissao)}</b></div>
    <div class="kv" style="width:120px"><small>Valor da nota</small><b class="num">${brl(n.valor)}</b></div>` : ''}
    ${r ? `<div class="kv" style="width:190px"><small>${r.manual ? 'Marcado por' : 'Recebido por'}</small><b>${esc(r.nome)} · <span class="num">${dataHoraBR(r.feito_em)}</span></b></div>` : ''}
    ${chegou}${boleto}${n && r ? seloConferencia(n.id) : ''}${acoes ? `<div class="acoes">${acoes}</div>` : ''}</div>`;
}

/** Janela com as fotos do boleto */
export function modalFotosBoletoHtml() {
  const m = estado.modal;
  return `<div class="modal-fundo" data-fechar-fundo="fechar-modal"><div class="modal modal-largo" role="dialog" aria-modal="true" aria-labelledby="m-t">
    <h2 id="m-t">${esc(m.cabecalho || 'Foto do boleto')}</h2>
    ${m.titulo ? `<p class="dica-campo" style="margin:0;font-size:13px">${esc(m.titulo)}</p>` : ''}
    ${m.urls ? m.urls.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="${esc(m.cabecalho || 'Foto do boleto')}" style="width:100%;border-radius:12px;display:block"></a>`).join('') : '<p style="margin:0">Carregando…</p>'}
    <div class="botoes"><button class="bg" type="button" data-acao="fechar-modal" style="height:46px;flex:1">Fechar</button></div>
  </div></div>`;
}

/** Abre a janela das fotos de um recebimento */
export async function verFotosBoleto(recebimentoId) {
  const r = (estado.recebimentos || []).find((x) => String(x.id) === String(recebimentoId));
  if (!r?.fotos?.length) return;
  const n = r.nota_id ? notaDe(r.nota_id) : null;
  estado.modal = { tipo: 'fotos-boleto', titulo: `${n ? `${n.fornecedor} · NF ${n.numero} · ` : ''}recebido por ${r.nome} em ${dataHoraBR(r.feito_em)}`, urls: null };
  desenhar();
  try {
    const urls = await Promise.all(r.fotos.map((c) => estado.api.urlFotoBoleto(c)));
    if (estado.modal?.tipo === 'fotos-boleto') { estado.modal.urls = urls; desenhar(); }
  } catch (e) { estado.modal = null; avisar(e.message, true); }
}

/** Fotos de boleto ligadas a uma nota (para os Detalhes do boleto) */
export function fotosDaNotaHtml(notaId) {
  const r = (estado.recebimentos || []).find((x) => x.nota_id === notaId && x.fotos?.length);
  return r ? `<button class="bg" type="button" data-acao="rec-ver-fotos" data-id="${r.id}" style="align-self:flex-start">Ver foto do boleto (tirada por ${esc(r.nome)})</button>` : '';
}

/** Diminui a foto (lado maior até 1600 px, JPEG) antes de enviar */
async function reduzirFoto(arquivo) {
  const img = await createImageBitmap(arquivo).catch(() => null);
  if (!img) throw new Error('Não consegui abrir a foto. Tente de novo.');
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const tela = document.createElement('canvas');
  tela.width = Math.round(img.width * k); tela.height = Math.round(img.height * k);
  tela.getContext('2d').drawImage(img, 0, 0, tela.width, tela.height);
  return new Promise((ok, erro) => tela.toBlob((b) => (b ? ok(b) : erro(new Error('Não consegui preparar a foto.'))), 'image/jpeg', 0.82));
}

/** Manda a chave para o banco e mostra o resultado */
export async function receber(texto, manual = false) {
  const chave = String(texto).replace(/\D/g, '');
  if (!chaveValida(chave)) {
    bip(false);
    estado.ultimoRecebimento = { situacao: 'erro', erro: chave.length === 44 ? 'O código não confere. Bipe de novo.' : `Li ${chave.length} números; a chave da nota tem 44. Bipe o código de barras grande da DANFE.` };
    desenhar();
    return false;
  }
  try {
    const r = await estado.api.receberNota(chave, manual);
    estado.conferindo = null;
    bip(r.situacao === 'casada' || r.situacao === 'pendente');
    estado.ultimoRecebimento = { ...r, chave };
    await recarregar();
  } catch (e) {
    bip(false);
    estado.ultimoRecebimento = { situacao: 'erro', erro: e.message };
    desenhar();
  }
  return true;
}

registrarFormulario('form-chave', async () => {
  const campo = document.getElementById('rc-chave');
  const ok = await receber(campo.value);
  if (ok) { const c = document.getElementById('rc-chave'); if (c) { c.value = ''; c.focus(); } }
});

registrarCampo('rec-busca', (el) => { estado.recBusca = el.value; desenhar(); });

// Escolheu/tirou a foto do boleto
registrarCampo('rec-foto', async (el) => {
  const arquivo = el.files?.[0], u = estado.ultimoRecebimento;
  if (!arquivo || !u?.recebimento_id) return;
  u.enviando = true; u.erroFoto = ''; desenhar();
  try {
    const foto = await reduzirFoto(arquivo);
    const caminho = await estado.api.enviarFotoBoleto(u.recebimento_id, foto);
    const r = await estado.api.recebimentoBoleto(u.recebimento_id, true, [caminho]);
    Object.assign(u, { enviando: false, tem_boleto: true, fotos: (u.fotos || 0) + 1, marcados: (u.marcados || 0) + (r?.marcados || 0) });
    bip(true);
    await recarregar();
  } catch (e) {
    Object.assign(u, { enviando: false, erroFoto: `A foto não foi enviada: ${e.message}` });
    bip(false);
    desenhar();
  }
});

registrarAcoes({
  'rec-filtro': (el) => { estado.recFiltro = el.dataset.id; desenhar(); },
  'rec-sem-boleto': () => executar(async () => {
    const u = estado.ultimoRecebimento;
    await estado.api.recebimentoBoleto(u.recebimento_id, false);
    u.tem_boleto = false;
    await recarregar();
  }),
  'rec-concluir': () => { estado.ultimoRecebimento = null; desenhar(); },
  // Fiscal marca na tela que a nota chegou (sem bipar)
  'rec-marcar': async (el) => {
    const n = notaDe(el.dataset.id);
    if (n && await receber(n.chave, true)) window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  // Fiscal anexa o boleto de uma nota que já chegou
  'rec-anexar': (el) => {
    const r = estado.recebimentos.find((x) => String(x.id) === el.dataset.id), n = r?.nota_id ? notaDe(r.nota_id) : null;
    if (!r) return;
    estado.ultimoRecebimento = { situacao: 'ja', recebimento_id: r.id, tem_boleto: null, recebido_por: r.nome, recebido_em: r.feito_em, chave: r.chave,
      fornecedor: n?.fornecedor, numero: n?.numero, filial: n ? filialDe(n.filial_id)?.nome : '' };
    desenhar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  'rec-ver-fotos': (el) => verFotosBoleto(el.dataset.id),
  'receber-camera': async () => {
    try {
      await abrirCamera({
        titulo: 'Bipe o código de barras da DANFE',
        // só fecha a câmera quando ler uma chave válida (44 números)
        dica: 'Em pé ou deitado. Segure a uns 20 cm, com o código de barras da nota inteiro no retângulo e boa luz.',
        aoLer: async (texto) => {
          // código de barras = só os 44 números; QR da NFC-e = endereço com a chave dentro
          const t = String(texto), achado = t.match(/\d{44}/);
          const c = achado ? achado[0] : t.replace(/\D/g, '');
          if (!chaveValida(c)) return false;
          return receber(c);
        },
      });
    } catch (e) { avisar(e.message, true); }
  },
});
