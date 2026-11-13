// =====================================================================
// DUPLICA · telas/contabilidade.js
// Tela da CONTABILIDADE.
//   1. Impostos do mês (Lucro Real): todos os impostos com a PREVISÃO de
//      vencimento, por loja quando é o caso. Em cada um:
//        - "Lançar guia" abre o boleto avulso já preenchido (tipo Guia de
//          imposto); a guia lançada segue o caminho normal até o Financeiro;
//        - depois de lançada, mostra o valor e a situação (ver util/impostos.js).
//      O valor previsto é o da última guia do mesmo imposto, quando existe.
//   2. Boletos que já têm visto do financeiro (consulta).
// =====================================================================
import { estado, notaDe, naLoja, ordenarPorVencimento } from '../nucleo/estado.js?v=7c22e1d';
import { registrarAcoes } from '../nucleo/eventos.js?v=7c22e1d';
import { desenhar } from '../nucleo/desenhar.js?v=7c22e1d';
import { cabecalho, sobretituloHoje, toastHtml, vazio, docNota, pillEtapa } from '../componentes/comuns.js?v=7c22e1d';
import { esc, brl, dataBR, dataHoraBR, hojeISO, diasAte, MESES, plural } from '../util/formato.js?v=7c22e1d';
import { IMPOSTOS_LUCRO_REAL, IMPOSTOS_EVENTUAIS, vencimentoImposto, competenciaDe } from '../util/impostos.js?v=7c22e1d';

const podeLancarGuia = () => estado.perfil.papel === 'gerente' || ['Fiscal', 'Financeiro', 'Contabilidade'].includes(estado.perfil.setor);

/** Loja que representa o CNPJ matriz (final 0001); se não achar, a primeira */
const lojaMatriz = () => estado.filiais.find((f) => (f.cnpj || '').slice(8, 12) === '0001') || estado.filiais[0];

/** Guias (boletos de nota tipo "imposto") deste imposto nesta loja, da mais nova para a mais antiga */
function guiasDe(imp, filialId) {
  return estado.boletos
    .filter((b) => { const n = notaDe(b.nota_id); return n && n.tipo === 'imposto' && n.descricao === imp.nome && n.filial_id === filialId && b.etapa !== 'cancelado'; })
    .sort((a, b) => ((a.vencimento || '') < (b.vencimento || '') ? 1 : -1));
}

/** Uma linha por imposto (e por loja, quando é por loja) do mês escolhido */
function linhasDoMes(ano, mes) {
  const linhas = [];
  for (const imp of IMPOSTOS_LUCRO_REAL) {
    const lojas = imp.porLoja ? estado.filiais.filter((f) => estado.loja === 'todas' || f.id === estado.loja) : [lojaMatriz()];
    for (const f of lojas.filter(Boolean)) {
      const venc = vencimentoImposto(imp, ano, mes);
      const guias = guiasDe(imp, f.id);
      const doMes = guias.find((b) => (b.vencimento || '').slice(0, 7) === venc.slice(0, 7));
      const anterior = guias.find((b) => b !== doMes && (b.vencimento || '') < venc);
      linhas.push({ imp, f, venc, doMes, anterior });
    }
  }
  return linhas.sort((a, b) => (a.venc < b.venc ? -1 : a.venc > b.venc ? 1 : 0));
}

function linhaImposto({ imp, f, venc, doMes, anterior }) {
  const dias = diasAte(venc);
  const prazo = doMes?.pago_em ? '' : dias < 0 ? `<span class="pill p-vencido">Venceu há ${plural(-dias, 'dia', 'dias')}</span>`
    : dias === 0 ? '<span class="pill p-vencido">Vence hoje</span>'
    : dias <= 5 ? `<span class="pill p-breve">Vence em ${plural(dias, 'dia', 'dias')}</span>` : '';
  const valor = doMes ? `<b class="num">${brl(doMes.valor)}</b>`
    : anterior ? `<b class="num" style="color:var(--terra)">≈ ${brl(anterior.valor)}</b>` : '<b style="color:var(--nevoa)">a apurar</b>';
  const acao = doMes ? `${pillEtapa(doMes)}<button class="bg" type="button" data-acao="abrir-boleto" data-id="${doMes.id}">Detalhes</button>`
    : `<span class="pill p-esperado">Falta a guia</span>${podeLancarGuia() ? `<button class="bp bs" type="button" data-acao="lancar-guia" data-imp="${imp.id}" data-filial="${f.id}" data-venc="${venc}">Lançar guia</button>` : ''}`;
  return `<div class="linha"><div class="kv" style="flex:1 1 260px;min-width:0"><b style="color:var(--petroleo)">${esc(imp.nome)}</b>
      <small>${esc(imp.guia)} · ${esc(imp.esfera)} · ${esc(f.nome)}</small></div>
    <div class="kv" style="width:110px"><small>Vencimento</small><b class="num">${dataBR(venc)}</b></div>
    <div class="kv" style="width:130px"><small>${doMes ? 'Valor da guia' : anterior ? 'Previsão (último)' : 'Valor'}</small>${valor}</div>
    ${prazo}${acao}</div>`;
}

export const telaContabilidade = {
  id: 'contabilidade',
  rotulo: () => 'Contabilidade',
  visivel: (p) => p.setor === 'Contabilidade' || p.papel === 'gerente',

  render() {
    const hoje = new Date(hojeISO() + 'T12:00:00');
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() + (estado.impMes || 0), 1, 12);
    const ano = ref.getFullYear(), mes = ref.getMonth();
    const linhas = linhasDoMes(ano, mes);
    const faltam = linhas.filter((l) => !l.doMes).length;
    const lancado = linhas.filter((l) => l.doMes).reduce((s, l) => s + Number(l.doMes.valor), 0);
    const previsto = linhas.filter((l) => !l.doMes && l.anterior).reduce((s, l) => s + Number(l.anterior.valor), 0);
    const chip = (d, txt) => `<button type="button" aria-pressed="${(estado.impMes || 0) === d}" data-acao="imp-mes" data-id="${d}">${txt}</button>`;
    const nomeMes = (d) => { const x = new Date(hoje.getFullYear(), hoje.getMonth() + d, 1, 12); return `${MESES[x.getMonth()]}/${x.getFullYear()}`; };

    const vistos = estado.boletos.filter((b) => b.etapa === 'visto' && naLoja(b)).sort(ordenarPorVencimento);
    const linhasVistos = vistos.map((b) => {
      const n = notaDe(b.nota_id);
      return `<div class="linha"><div class="kv" style="flex:1 1 220px;min-width:180px"><b style="color:var(--petroleo)">${esc(n.fornecedor)}</b>
        <small>${docNota(n)} · parcela ${b.parcela}/${b.total_parcelas} · visto por ${esc(b.visto_por)} em ${dataHoraBR(b.visto_em)}</small></div>
        <div class="kv" style="width:110px"><small>Vencimento</small><b class="num">${dataBR(b.vencimento)}</b></div>
        <div class="kv" style="width:120px"><small>Valor</small><b class="num">${brl(b.valor)}</b></div>
        <span class="pill p-visto">Visto do financeiro</span></div>`;
    }).join('');

    return cabecalho(sobretituloHoje('Contabilidade'), 'Impostos e contabilidade') + toastHtml()
      + `<section class="secao"><div class="secao-h"><h2>Impostos a pagar em ${nomeMes(estado.impMes || 0)} · Lucro Real</h2>
          <span class="pill ${faltam ? 'p-breve' : 'p-visto'} num">${faltam ? `${plural(faltam, 'guia falta', 'guias faltam')}` : 'todas as guias lançadas'}</span></div>
        <div style="padding:14px 20px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;border-bottom:1px solid var(--linha)">
          <div class="chips">${chip(-1, nomeMes(-1))}${chip(0, nomeMes(0))}${chip(1, nomeMes(1))}${chip(2, nomeMes(2))}</div>
          <small style="color:var(--terra)">Competência ${competenciaDe(ano, mes)} · guias lançadas: <b class="num">${brl(lancado)}</b>${previsto ? ` · previsão do que falta: <b class="num">≈ ${brl(previsto)}</b>` : ''}</small>
        </div>
        <div class="rolagem">${linhas.map(linhaImposto).join('')}</div>
        <p style="margin:0;padding:14px 20px;font-size:13px;line-height:1.5;color:var(--terra);border-top:1px solid var(--linha)">As <b>datas</b> são a previsão pelo calendário fiscal (caem para dia útil; feriados locais não entram). O <b>valor</b> só existe depois que a contabilidade apura e gera a guia: até lá aparece a previsão pelo valor da última guia. Confirme prazos e enquadramento com o contador.</p>
      </section>
      <section class="secao"><div class="secao-h"><h2>Sem dia fixo (lembretes)</h2></div>
        <div class="rolagem">${IMPOSTOS_EVENTUAIS.map((e) => `<div class="linha"><div class="kv" style="flex:1 1 260px;min-width:0"><b style="color:var(--petroleo)">${esc(e.nome)}</b><small>${esc(e.guia)} · ${esc(e.quando)}</small></div></div>`).join('')}</div>
      </section>
      <section class="secao"><div class="secao-h"><h2>Boletos com visto do financeiro</h2><span class="pill p-breve num">${plural(vistos.length, 'boleto', 'boletos')}</span></div>
        ${linhasVistos ? `<div class="rolagem">${linhasVistos}</div>` : vazio('Nenhum boleto com visto ainda.')}</section>`;
  },
};

registrarAcoes({
  'imp-mes': (el) => { estado.impMes = Number(el.dataset.id); desenhar(); },

  // abre o boleto avulso já preenchido para a guia deste imposto
  'lancar-guia': (el) => {
    const imp = IMPOSTOS_LUCRO_REAL.find((i) => i.id === el.dataset.imp);
    const venc = el.dataset.venc, d = new Date(venc + 'T12:00:00');
    estado.modal = {
      tipo: 'avulso', erro: '',
      parcelas: [{ venc, valor: '' }],
      v: { tipo: 'imposto', filial: el.dataset.filial, fornecedor: imp.orgao, numero: competenciaDe(d.getFullYear(), d.getMonth()), descricao: imp.nome },
    };
    desenhar();
    document.querySelector('.modal input[placeholder="0,00"]')?.focus();
  },
});
