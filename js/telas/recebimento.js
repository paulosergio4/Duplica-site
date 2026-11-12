// =====================================================================
// DUPLICA · telas/recebimento.js
// Tela "Receber notas" (feita para o CELULAR, no recebimento da loja).
//   - Abrir câmera → bipa o código de barras da DANFE (chave de 44 números)
//   - ou digita/bipa a chave com leitor USB no campo
// O Duplica marca os boletos daquela nota como "Chegou", recebido por
// quem bipou, e o Fiscal é avisado na hora (ver avisoRecebimento em app.js).
// Se a nota ainda não entrou pelo XML, fica guardada e é marcada sozinha
// quando o XML chegar.
// =====================================================================
import { estado, notaDe, filialDe } from '../nucleo/estado.js?v=030b138';
import { registrarAcoes, registrarFormulario, registrarCampo, avisar } from '../nucleo/eventos.js?v=030b138';
import { desenhar, recarregar } from '../nucleo/desenhar.js?v=030b138';
import { cabecalho, toastHtml, vazio, docNota } from '../componentes/comuns.js?v=030b138';
import { esc, plural, brl, dataHoraBR } from '../util/formato.js?v=030b138';
import { chaveValida, chaveFormatada, numeroDaChave } from '../util/chave.js?v=030b138';
import { abrirCamera, bip } from '../util/camera.js?v=030b138';

export const telaRecebimento = {
  id: 'receber',
  rotulo: () => (estado.perfil?.setor === 'Recebimento' ? 'Receber notas' : 'Recebimento de mercadoria'),
  visivel: (p) => p.setor === 'Recebimento' || p.setor === 'Fiscal' || p.papel === 'gerente',

  render() {
    const u = estado.ultimoRecebimento;
    const conferente = estado.perfil.setor === 'Recebimento';
    const dias = conferente ? 1 : estado.recDias;
    const desde = new Date(); desde.setHours(0, 0, 0, 0); desde.setDate(desde.getDate() - (dias - 1));
    const busca = estado.recBusca.trim().toLowerCase();
    const lista = (estado.recebimentos || [])
      .filter((r) => r.situacao !== 'repetida' && new Date(r.feito_em) >= desde)
      .filter((r) => !conferente || r.perfil_id === estado.perfil.id)
      .filter((r) => {
        if (!busca) return true;
        const n = r.nota_id ? notaDe(r.nota_id) : null;
        return `${n?.fornecedor || ''} ${n?.numero || numeroDaChave(r.chave)} ${r.nome}`.toLowerCase().includes(busca);
      });
    const chip = (d, txt) => `<button type="button" aria-pressed="${estado.recDias === d}" data-acao="rec-dias" data-id="${d}">${txt}</button>`;
    const filtros = conferente ? '' : `<div style="padding:14px 20px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--linha)">
        <div class="chips">${chip(1, 'Hoje')}${chip(7, 'Últimos 7 dias')}${chip(30, 'Últimos 30 dias')}</div>
        <input class="inp" id="rec-busca" placeholder="Buscar fornecedor, nota ou quem recebeu" value="${esc(estado.recBusca)}" style="flex:1 1 240px;min-width:0;height:40px"></div>`;
    const titulo = conferente ? 'Você bipou hoje' : 'Notas recebidas';
    return cabecalho(conferente ? 'Recebimento' : 'Estoque', conferente ? 'Receber notas' : 'Recebimento de mercadoria') + toastHtml()
      + `<section class="secao receber">
          <button class="bp receber-bipar" type="button" data-acao="receber-camera">${iconeCamera()}Bipar nota com a câmera</button>
          <form id="form-chave" class="receber-manual" novalidate>
            <label for="rc-chave">Ou digite a chave (44 números) / use o leitor USB</label>
            <div style="display:flex;gap:8px"><input class="inp num" id="rc-chave" inputmode="numeric" autocomplete="off" placeholder="0000 0000 0000 ..." style="flex:1;min-width:0"><button class="bg" type="submit" style="height:48px">OK</button></div>
          </form>
          ${u ? resultadoHtml(u) : ''}
        </section>
        <section class="secao"><div class="secao-h"><h2>${titulo}</h2><span class="pill p-breve num">${plural(lista.length, 'nota', 'notas')}</span></div>
          ${filtros}
          ${lista.length ? `<div class="rolagem">${lista.map(linhaRecebimento).join('')}</div>` : vazio(dias === 1 ? 'Nenhuma nota recebida hoje.' : 'Nenhuma nota recebida nesse período.')}</section>`;
  },
};

const iconeCamera = () => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';

/** Cartão com o resultado da última leitura */
function resultadoHtml(r) {
  const cor = { casada: 'var(--musgo)', ja: 'var(--ocre-txt)', pendente: 'var(--terra)', repetida: 'var(--ocre-txt)', erro: 'var(--alerta)' }[r.situacao];
  const titulo = {
    casada: r.marcados ? `Nota recebida: ${plural(r.marcados, 'boleto marcado', 'boletos marcados')} como "Chegou"` : 'Nota recebida (essa nota não tem boleto)',
    ja: 'Nota recebida: os boletos dela já estavam marcados',
    pendente: 'Nota guardada: ainda não entrou no sistema',
    repetida: 'Essa nota já foi bipada e está aguardando o XML',
    erro: 'Não deu certo',
  }[r.situacao];
  const corpo = r.situacao === 'erro' ? esc(r.erro)
    : r.fornecedor ? `${esc(r.fornecedor)} · NF ${esc(r.numero)} · ${esc(r.filial || '')}`
    : `NF ${esc(numeroDaChave(r.chave))} · chave ${esc(chaveFormatada(r.chave))}<br>Quando o XML chegar, os boletos dela já entram como "Chegou".`;
  return `<div class="receber-resultado" style="border-color:${cor}" role="status"><b style="color:${cor}">${titulo}</b><small>${corpo}</small></div>`;
}

function linhaRecebimento(r) {
  const n = r.nota_id ? notaDe(r.nota_id) : null, f = n ? filialDe(n.filial_id) : null;
  const pill = r.situacao === 'pendente' ? '<span class="pill p-esperado">Aguardando XML</span>'
    : r.boletos ? `<span class="pill p-chegou">${plural(r.boletos, 'boleto', 'boletos')} chegou</span>` : estado.boletos.some((b) => b.nota_id === r.nota_id) ? '<span class="pill p-chegou">Boleto já marcado</span>' : '<span class="pill p-visto">Sem boleto</span>';
  return `<div class="linha"><div class="kv" style="flex:1 1 240px;min-width:0"><b style="color:var(--petroleo)">${n ? esc(n.fornecedor) : 'Nota ainda sem XML'}</b>
      <small>${n ? `${docNota(n)} · ${esc(f?.nome || '')}` : `NF ${esc(numeroDaChave(r.chave))}`}</small></div>
    ${n ? `<div class="kv" style="width:120px"><small>Valor da nota</small><b class="num">${brl(n.valor)}</b></div>` : ''}
    <div class="kv" style="width:170px"><small>Recebido por</small><b>${esc(r.nome)}</b></div>
    <div class="kv" style="width:110px"><small>Quando</small><b class="num">${dataHoraBR(r.feito_em)}</b></div>
    ${pill}</div>`;
}

/** Manda a chave para o banco e mostra o resultado */
async function receber(texto) {
  const chave = String(texto).replace(/\D/g, '');
  if (!chaveValida(chave)) {
    bip(false);
    estado.ultimoRecebimento = { situacao: 'erro', erro: chave.length === 44 ? 'O código não confere. Bipe de novo.' : `Li ${chave.length} números; a chave da nota tem 44. Bipe o código de barras grande da DANFE.` };
    desenhar();
    return false;
  }
  try {
    const r = await estado.api.receberNota(chave);
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

registrarAcoes({
  'rec-dias': (el) => { estado.recDias = Number(el.dataset.id); desenhar(); },
  'receber-camera': async () => {
    try {
      await abrirCamera({
        titulo: 'Bipe o código de barras da DANFE',
        // só fecha a câmera quando ler uma chave válida (44 números)
        aoLer: async (texto) => {
          const c = String(texto).replace(/\D/g, '');
          if (!chaveValida(c)) return false;
          return receber(c);
        },
      });
    } catch (e) { avisar(e.message, true); }
  },
});
