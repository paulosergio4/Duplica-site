// =====================================================================
// DUPLICA · componentes/relatorio.js
// "Relatório Excel": baixa uma planilha (.xlsx) com TODOS os boletos de
// um período (pagos, não pagos e cancelados), escolhendo:
//   - por vencimento do boleto ou por emissão da nota;
//   - uma loja ou todas.
// A planilha tem duas abas: "Boletos" (uma linha por parcela) e "Resumo".
// Gerada no navegador com a biblioteca SheetJS (carregada só na hora).
// =====================================================================
import { estado, filialDe } from '../nucleo/estado.js?v=543c57a';
import { registrarAcoes, avisar } from '../nucleo/eventos.js?v=543c57a';
import { desenhar } from '../nucleo/desenhar.js?v=543c57a';
import { NOME_ETAPA } from '../nucleo/regras.js?v=543c57a';
import { TIPOS_NOTA } from './comuns.js?v=543c57a';
import { esc, hojeISO, dataHoraBR, cnpjFormatado } from '../util/formato.js?v=543c57a';

const URL_XLSX = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

/** Carrega a SheetJS uma vez só */
let carregando;
function sheetjs() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  carregando ??= new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = URL_XLSX;
    s.onload = () => ok(window.XLSX);
    s.onerror = () => { carregando = null; erro(new Error('Não foi possível carregar o gerador de Excel. Confira a internet e tente de novo.')); };
    document.head.appendChild(s);
  });
  return carregando;
}

/** Botão do cabeçalho */
export const botaoRelatorio = () =>
  `<button class="bg" type="button" data-acao="abrir-relatorio" style="height:46px">Relatório Excel</button>`;

/** Janela de escolha do período */
export function modalRelatorioHtml() {
  const m = estado.modal;
  const lojas = estado.filiais.map((f) => `<option value="${f.id}"${m.loja === f.id ? ' selected' : ''}>${esc(f.nome)}</option>`).join('');
  const atalho = (id, txt) => `<button type="button" aria-pressed="${m.atalho === id}" data-acao="rel-atalho" data-id="${id}">${txt}</button>`;
  return `<div class="modal-fundo" data-fechar-fundo="fechar-modal"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-t">
    <h2 id="m-t">Relatório de boletos (Excel)</h2>
    <p class="resumo">Todos os boletos do período: <b>pagos, não pagos e cancelados</b>, com quem marcou cada etapa.</p>
    <div class="field"><label for="rel-campo">Período pela data de</label>
      <select class="inp" id="rel-campo">
        <option value="vencimento"${m.campo !== 'emissao' ? ' selected' : ''}>Vencimento do boleto</option>
        <option value="emissao"${m.campo === 'emissao' ? ' selected' : ''}>Emissão da nota</option>
      </select></div>
    <div class="chips">${atalho('mes', 'Este mês')}${atalho('mes-ant', 'Mês passado')}${atalho('30', 'Últimos 30 dias')}${atalho('ano', 'Este ano')}</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <div class="field" style="flex:1 1 140px"><label for="rel-de">De</label><input class="inp" type="date" id="rel-de" value="${m.de}"></div>
      <div class="field" style="flex:1 1 140px"><label for="rel-ate">Até</label><input class="inp" type="date" id="rel-ate" value="${m.ate}"></div>
    </div>
    <div class="field"><label for="rel-loja">Loja</label>
      <select class="inp" id="rel-loja"><option value="todas">Todas as lojas</option>${lojas}</select></div>
    ${m.erro ? `<p class="erro" role="alert">${esc(m.erro)}</p>` : ''}
    <div class="botoes">
      <button class="bp" type="button" data-acao="baixar-relatorio" style="flex:1"${m.gerando ? ' disabled' : ''}>${m.gerando ? 'Gerando…' : 'Baixar Excel'}</button>
      <button class="bg" type="button" data-acao="fechar-modal" style="height:46px">Cancelar</button>
    </div>
  </div></div>`;
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function periodo(atalho) {
  const h = new Date(hojeISO() + 'T12:00:00'), a = h.getFullYear(), m = h.getMonth();
  if (atalho === 'mes-ant') return [iso(new Date(a, m - 1, 1)), iso(new Date(a, m, 0))];
  if (atalho === '30') { const d = new Date(h); d.setDate(d.getDate() - 30); return [iso(d), iso(h)]; }
  if (atalho === 'ano') return [`${a}-01-01`, `${a}-12-31`];
  return [iso(new Date(a, m, 1)), iso(new Date(a, m + 1, 0))];
}

/** Lê o que está na janela (para não perder ao redesenhar) */
function lerCampos() {
  const v = (id) => document.getElementById(id)?.value;
  Object.assign(estado.modal, { campo: v('rel-campo'), de: v('rel-de'), ate: v('rel-ate'), loja: v('rel-loja') });
}

const data = (s) => (s ? new Date(s.slice(0, 10) + 'T12:00:00') : null);
const situacao = (b) => (b.etapa === 'cancelado' ? 'Cancelado' : b.pago_em ? 'Pago' : NOME_ETAPA[b.etapa]);

/** Monta e baixa o .xlsx */
async function gerar() {
  const { campo, de, ate, loja } = estado.modal;
  if (!de || !ate) throw new Error('Escolha as datas De e Até.');
  if (de > ate) throw new Error('A data "De" é depois da data "Até".');
  const [XLSX, todos] = await Promise.all([sheetjs(), estado.api.relatorio(de, ate, campo)]);
  const lista = todos.filter((b) => loja === 'todas' || b.nota?.filial_id === loja);
  if (!lista.length) throw new Error('Nenhum boleto nesse período.');

  const cab = ['Loja', 'Fornecedor', 'CNPJ do fornecedor', 'Tipo', 'Nota', 'Série', 'Emissão', 'Valor da nota', 'Parcela', 'Vencimento',
    'Valor do boleto', 'Situação', 'Pago?', 'Forma de pagamento', 'Pago em', 'Pago por', 'Recebido por', 'Chegou em', 'Enviado ao financeiro em',
    'Enviado por', 'Visto em', 'Visto por', 'Entregue por', 'Chegou direto no financeiro', 'Fiscal marcou pago', 'Cancelado em', 'Motivo do cancelamento',
    'Anotação', 'Linha digitável', 'Chave da NF-e'];
  const linhas = lista.map((b) => {
    const n = b.nota || {};
    return [filialDe(n.filial_id)?.nome || '', n.fornecedor || '', n.fornecedor_cnpj ? cnpjFormatado(n.fornecedor_cnpj) : '', !n.tipo || (n.tipo === 'nfe' && n.chave) ? 'NF-e' : (TIPOS_NOTA[n.tipo]?.[2] || n.tipo),
      n.numero || '', n.serie || '', data(n.emissao), Number(n.valor) || null, `${b.parcela}/${b.total_parcelas}`, data(b.vencimento),
      Number(b.valor), situacao(b), b.pago_em && b.etapa !== 'cancelado' ? 'Sim' : 'Não', b.pago_em ? (b.pago_forma || 'Boleto') : '',
      b.pago_em ? dataHoraBR(b.pago_em) : '', b.pago_por || '', b.recebido_por || '', b.chegou_em ? dataHoraBR(b.chegou_em) : '',
      b.enviado_em ? dataHoraBR(b.enviado_em) : '', b.enviado_por || '', b.visto_em ? dataHoraBR(b.visto_em) : '', b.visto_por || '',
      b.entregue_por || '', b.direto_financeiro || '', b.forma_indicada || '', b.cancelado_em ? dataHoraBR(b.cancelado_em) : '',
      b.cancelado_motivo || '', b.anotacao || '', b.linha_digitavel || '', n.chave || ''];
  });
  const ativos = lista.filter((b) => b.etapa !== 'cancelado');
  const soma = (arr) => Math.round(arr.reduce((s, b) => s + Number(b.valor), 0) * 100) / 100;
  linhas.push([], ['TOTAL (sem cancelados)', '', '', '', '', '', null, null, `${ativos.length} boletos`, null, soma(ativos)]);

  const ws = XLSX.utils.aoa_to_sheet([cab, ...linhas], { cellDates: true });
  const ultima = linhas.length;   // linha do total (0 = cabeçalho)
  for (let r = 1; r <= ultima; r++) {
    for (const c of [6, 9]) { const ref = XLSX.utils.encode_cell({ r, c }); if (ws[ref]) ws[ref].z = 'dd/mm/yyyy'; }
    for (const c of [7, 10]) { const ref = XLSX.utils.encode_cell({ r, c }); if (ws[ref]) ws[ref].z = '"R$" #,##0.00'; }
  }
  ws['!cols'] = [22, 34, 20, 12, 10, 6, 11, 14, 8, 11, 14, 18, 7, 16, 16, 16, 16, 16, 18, 16, 16, 16, 16, 16, 14, 16, 30, 30, 54, 46].map((w) => ({ wch: w }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lista.length, c: cab.length - 1 } }) };

  // aba Resumo
  const grupos = [['Pago', (b) => b.etapa !== 'cancelado' && b.pago_em], ['Visto, falta pagar', (b) => b.etapa === 'visto' && !b.pago_em],
    ['No financeiro (sem visto)', (b) => b.etapa === 'enviado' && !b.pago_em], ['Chegou (com o fiscal)', (b) => b.etapa === 'chegou'],
    ['Não chegou', (b) => b.etapa === 'esperado'], ['Cancelado', (b) => b.etapa === 'cancelado']];
  const nomeLoja = loja === 'todas' ? 'Todas as lojas' : filialDe(loja)?.nome;
  const fmt = (s) => s.split('-').reverse().join('/');
  const resumo = [['Relatório de boletos · Duplica'], [`Período (${campo === 'emissao' ? 'emissão da nota' : 'vencimento'}): ${fmt(de)} a ${fmt(ate)}`],
    [`Loja: ${nomeLoja}`], [`Gerado em ${dataHoraBR(new Date().toISOString())} por ${estado.perfil.nome}`], [],
    ['Situação', 'Boletos', 'Valor'], ...grupos.map(([t, f]) => { const g = lista.filter(f); return [t, g.length, soma(g)]; }),
    ['Total (sem cancelados)', ativos.length, soma(ativos)], [], ['Por loja (sem cancelados)', 'Boletos', 'Valor', 'Pago', 'Falta pagar']];
  for (const f of estado.filiais) {
    const g = ativos.filter((b) => b.nota?.filial_id === f.id);
    if (g.length) resumo.push([f.nome, g.length, soma(g), soma(g.filter((b) => b.pago_em)), soma(g.filter((b) => !b.pago_em))]);
  }
  const wr = XLSX.utils.aoa_to_sheet(resumo);
  for (let r = 6; r < resumo.length; r++) for (let c = 2; c <= 4; c++) { const ref = XLSX.utils.encode_cell({ r, c }); if (wr[ref] && typeof wr[ref].v === 'number') wr[ref].z = '"R$" #,##0.00'; }
  wr['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wr, 'Resumo');
  XLSX.utils.book_append_sheet(wb, ws, 'Boletos');
  XLSX.writeFile(wb, `Duplica-boletos-${de}-a-${ate}.xlsx`);
  return lista.length;
}

registrarAcoes({
  'abrir-relatorio': () => {
    const [de, ate] = periodo('mes');
    estado.modal = { tipo: 'relatorio', campo: 'vencimento', de, ate, atalho: 'mes', loja: estado.loja || 'todas', erro: '' };
    desenhar();
  },
  'rel-atalho': (el) => {
    lerCampos();
    const [de, ate] = periodo(el.dataset.id);
    Object.assign(estado.modal, { de, ate, atalho: el.dataset.id });
    desenhar();
  },
  'baixar-relatorio': async () => {
    lerCampos();
    Object.assign(estado.modal, { gerando: true, erro: '', atalho: null });
    desenhar();
    try {
      const n = await gerar();
      estado.modal = null;
      desenhar();
      avisar(`Relatório baixado: ${n} boletos. Confira a pasta Downloads.`);
    } catch (e) {
      Object.assign(estado.modal, { gerando: false, erro: e.message });
      desenhar();
    }
  },
});
