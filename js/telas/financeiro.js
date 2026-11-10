// =====================================================================
// DUPLICA · telas/financeiro.js
// Tela do FINANCEIRO ("caderninho"):
//   1. Aguardando seu visto      → o que o fiscal enviou (agrupado por nota)
//   2. A pagar                     → com visto e ainda não pago: botão "Marcar como pago"
//   3. Chegaram, ainda com o fiscal → só consulta
//   4. Chegou direto aqui?          → busca boletos que o fiscal ainda não enviou
//                                    (e-mail, DDA, em mãos) e marca com visto
//   5. Vencem nos próximos 7 dias   → só consulta, qualquer etapa (menos os já pagos)
// =====================================================================
import { estado, notaDe, filialDe, naLoja, ordenarPorVencimento } from '../nucleo/estado.js';
import { podeFinanceiro, podePagar } from '../nucleo/regras.js';
import { registrarCampo, registrarAcoes, avisar, executar } from '../nucleo/eventos.js';
import '../componentes/modal-avulso.js';
import { desenhar, recarregar } from '../nucleo/desenhar.js';
import { cabecalho, sobretituloHoje, toastHtml, faixaFiliais, pillEtapa, pillPrazo, vazio, docNota } from '../componentes/comuns.js';
import { ICONE } from '../componentes/icones.js';
import { esc, brl, dataBR, dataHoraBR, diasAte, plural } from '../util/formato.js';

const aviso = (t) => `<span style="margin-left:auto;font-size:12px;color:var(--terra);font-weight:600;white-space:nowrap">${t}</span>`;

/** Linha de um boleto aguardando visto */
function linhaVisto(b) {
  return `<div class="linha"><span class="parc num">${b.parcela}/${b.total_parcelas}</span>
    <div class="kv" style="flex:1 1 200px;min-width:160px"><small>chegou aqui · enviado por</small><b>${dataHoraBR(b.enviado_em)} · ${esc(b.enviado_por || '—')}</b></div>
    <div class="kv" style="width:110px"><small>Vencimento</small><b class="num">${dataBR(b.vencimento)}</b></div>
    <div class="kv" style="width:120px"><small>Valor</small><b class="num">${brl(b.valor)}</b></div>
    <span style="width:130px;display:flex;justify-content:flex-end">${pillPrazo(b)}</span>
    ${podeFinanceiro() ? `<button class="visto" type="button" data-acao="avancar" data-id="${b.id}" style="margin-left:auto">${ICONE.check()}Dar visto</button>` : aviso('Só o Financeiro dá o visto')}
  </div>`;
}

/** Grupo de uma nota com o botão "Dar visto em todos" */
function grupoNota(notaId, boletos) {
  const n = notaDe(notaId), f = filialDe(n.filial_id);
  const total = boletos.reduce((s, b) => s + Number(b.valor), 0);
  return `<div class="grupo"><div class="kv"><b style="color:var(--petroleo)">${esc(n.fornecedor)}</b>
      <small>${docNota(n)} · ${esc(f?.nome || '')} · ${plural(boletos.length, 'boleto', 'boletos')} · <span class="num">${brl(total)}</span></small></div>
      ${podeFinanceiro() && boletos.length > 1 ? `<button class="visto" type="button" data-acao="avancar-lote" data-nota="${notaId}" data-etapa="enviado">${ICONE.check()}Dar visto em todos (${boletos.length})</button>` : ''}
    </div>${boletos.map(linhaVisto).join('')}`;
}

/** Grupo de uma nota na seção "A pagar" */
function grupoPagar(notaId, boletos) {
  const n = notaDe(notaId), f = filialDe(n.filial_id);
  const total = boletos.reduce((s, b) => s + Number(b.valor), 0);
  const linhas = boletos.map((b) => `<div class="linha"><span class="parc num">${b.parcela}/${b.total_parcelas}</span>
      <div class="kv" style="flex:1 1 200px;min-width:160px"><small>visto em · por</small><b>${dataHoraBR(b.visto_em)} · ${esc(b.visto_por || '—')}</b></div>
      <div class="kv" style="width:110px"><small>Vencimento</small><b class="num">${dataBR(b.vencimento)}</b></div>
      <div class="kv" style="width:120px"><small>Valor</small><b class="num">${brl(b.valor)}</b></div>
      <span style="width:130px;display:flex;justify-content:flex-end">${pillPrazo(b)}</span>
      <button class="bg" type="button" data-acao="abrir-boleto" data-id="${b.id}">Detalhes</button>
      ${podePagar(b) ? `<button class="visto" type="button" data-acao="marcar-pago" data-id="${b.id}">${ICONE.check()}Marcar como pago</button>` : ''}
    </div>`).join('');
  return `<div class="grupo"><div class="kv"><b style="color:var(--petroleo)">${esc(n.fornecedor)}</b>
      <small>${docNota(n)} · ${esc(f?.nome || '')} · ${plural(boletos.length, 'boleto', 'boletos')} · <span class="num">${brl(total)}</span></small></div>
      ${podeFinanceiro() && boletos.length > 1 ? `<button class="visto" type="button" data-acao="marcar-pago-nota" data-nota="${notaId}">${ICONE.check()}Marcar todos como pagos (${boletos.length})</button>` : ''}
    </div>${linhas}`;
}

export const telaFinanceiro = {
  id: 'financeiro',
  rotulo: () => 'Financeiro',
  visivel: (p) => p.setor === 'Financeiro' || p.papel === 'gerente',
  contador: () => estado.boletos.filter((b) => b.etapa === 'enviado').length,

  render() {
    // aba escolhida: 'chegada' = na ordem em que chegaram ao financeiro; 'vencimento' = quem vence primeiro
    const porChegada = estado.ordemFin === 'chegada';
    const ordem = porChegada
      ? (a, b) => ((a.enviado_em || a.chegou_em || '') < (b.enviado_em || b.chegou_em || '') ? -1 : 1)
      : ordenarPorVencimento;
    const pend = estado.boletos.filter((b) => b.etapa === 'enviado' && naLoja(b)).sort(ordem);
    const notasPend = [...new Set(pend.map((b) => b.nota_id))];
    const blocoPend = notasPend.map((nid) => grupoNota(nid, pend.filter((b) => b.nota_id === nid).sort((a, b) => a.parcela - b.parcela))).join('');

    // ---- a pagar: com visto e ainda não pago (sempre por vencimento: o que vence primeiro em cima)
    const aPagar = estado.boletos.filter((b) => b.etapa === 'visto' && !b.pago_em && naLoja(b)).sort(ordenarPorVencimento);
    const notasPagar = [...new Set(aPagar.map((b) => b.nota_id))];
    const blocoPagar = notasPagar.map((nid) => grupoPagar(nid, aPagar.filter((b) => b.nota_id === nid).sort((a, b) => a.parcela - b.parcela))).join('');
    const totalPagar = aPagar.reduce((s, b) => s + Number(b.valor), 0);

    const comFiscal = estado.boletos.filter((b) => b.etapa === 'chegou' && naLoja(b))
      .sort(porChegada ? (a, b) => ((a.chegou_em || '') < (b.chegou_em || '') ? -1 : 1) : ordenarPorVencimento);
    const blocoFiscal = comFiscal.map((b) => {
      const n = notaDe(b.nota_id);
      return `<div class="linha"><div class="kv" style="flex:1 1 220px;min-width:180px"><b style="color:var(--petroleo)">${esc(n.fornecedor)}</b>
        <small>${docNota(n)} · parcela ${b.parcela}/${b.total_parcelas} · chegou ${dataHoraBR(b.chegou_em)} · recebido por ${esc(b.recebido_por || '—')}</small></div>
        <div class="kv" style="width:110px"><small>Vencimento</small><b class="num">${dataBR(b.vencimento)}</b></div>
        <div class="kv" style="width:120px"><small>Valor</small><b class="num">${brl(b.valor)}</b></div>
        <span style="width:130px;display:flex;justify-content:flex-end">${pillPrazo(b)}</span>${aviso('Aguardando o fiscal enviar')}</div>`;
    }).join('');

    const semana = estado.boletos.filter((b) => { const d = diasAte(b.vencimento); return d !== null && d >= 0 && d <= 7 && naLoja(b) && b.etapa !== 'cancelado' && !b.pago_em; }).sort(ordenarPorVencimento);
    const blocoSemana = semana.map((b) => {
      const n = notaDe(b.nota_id);
      return `<div class="linha"><b class="num" style="width:60px;color:var(--petroleo)">${dataBR(b.vencimento).slice(0, 5)}</b>
        <div class="kv" style="flex:1 1 220px;min-width:180px"><b>${esc(n.fornecedor)}</b><small>${docNota(n)} · parcela ${b.parcela}/${b.total_parcelas}</small></div>
        <b class="num" style="width:120px">${brl(b.valor)}</b>${pillEtapa(b)}</div>`;
    }).join('');

    const secao = (titulo, pill, conteudo, textoVazio) => `<section class="secao"><div class="secao-h"><h2>${titulo}</h2>${pill}</div>
      ${conteudo ? `<div class="rolagem">${conteudo}</div>` : vazio(textoVazio)}</section>`;

    // ---- busca de boletos que chegaram direto no financeiro
    const q = (estado.buscaDireto || '').trim().toLowerCase().replace(/\./g, '');
    let blocoDireto = '';
    if (q.length >= 2) {
      const achados = estado.boletos.filter((b) => ['esperado', 'chegou'].includes(b.etapa) && naLoja(b)).filter((b) => {
        const n = notaDe(b.nota_id);
        return n.fornecedor.toLowerCase().includes(q) || n.numero.replace(/\./g, '').includes(q);
      }).sort(ordenarPorVencimento).slice(0, 40);
      const notasAchadas = [...new Set(achados.map((b) => b.nota_id))];
      blocoDireto = notasAchadas.map((nid) => {
        const n = notaDe(nid), f = filialDe(n.filial_id), bs = achados.filter((b) => b.nota_id === nid).sort((a, b) => a.parcela - b.parcela);
        return `<div class="grupo"><div class="kv"><b style="color:var(--petroleo)">${esc(n.fornecedor)}</b>
            <small>${docNota(n)} · ${esc(f?.nome || '')} · ${plural(bs.length, 'boleto', 'boletos')}</small></div>
            ${podeFinanceiro() && bs.length > 1 ? `<button class="visto" type="button" data-acao="direto-lote" data-nota="${nid}">${ICONE.check()}Todos chegaram aqui (${bs.length})</button>` : ''}</div>`
          + bs.map((b) => `<div class="linha"><span class="parc num">${b.parcela}/${b.total_parcelas}</span>
            <div class="kv" style="width:110px"><small>Vencimento</small><b class="num">${dataBR(b.vencimento)}</b></div>
            <div class="kv" style="width:120px"><small>Valor</small><b class="num">${brl(b.valor)}</b></div>
            <div class="status">${pillEtapa(b)}${pillPrazo(b)}</div>
            ${podeFinanceiro() ? `<button class="bg" type="button" data-acao="direto" data-id="${b.id}" style="margin-left:auto">Chegou direto aqui</button>` : ''}</div>`).join('');
      }).join('');
      if (!blocoDireto) blocoDireto = vazio('Nenhum boleto pendente com esse fornecedor ou número de nota.');
    }
    const secaoDireto = `<section class="secao"><div class="secao-h"><h2>Boleto chegou direto aqui?</h2>
        <span style="font-size:12px;color:var(--terra);font-weight:600">e-mail, DDA ou em mãos</span></div>
      <div style="padding:14px 20px;border-bottom:1px solid var(--linha)"><div class="busca"><label for="busca-direto" class="sr">Buscar boleto que chegou direto</label>
        <input id="busca-direto" placeholder="Digite o fornecedor ou o número da nota" value="${esc(estado.buscaDireto || '')}">${ICONE.busca()}</div></div>
      ${q.length >= 2 ? `<div class="rolagem">${blocoDireto}</div>` : vazio('Busque o boleto que o fornecedor mandou direto para o financeiro. Ao marcar, ele já fica com visto e sai dos pendentes do Fiscal.')}</section>`;

    const abas = `<div class="abas" role="tablist" aria-label="Ordem das listas">
        <button type="button" role="tab" data-acao="ordem-fin" data-ordem="chegada" aria-selected="${porChegada}">Por chegada</button>
        <button type="button" role="tab" data-acao="ordem-fin" data-ordem="vencimento" aria-selected="${!porChegada}">Por vencimento</button></div>`;
    const botoes = `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">${abas}
        ${podeFinanceiro() ? '<button class="bg" type="button" data-acao="abrir-avulso" style="height:46px">+ Boleto avulso</button>' : ''}</div>`;

    return cabecalho(sobretituloHoje('Financeiro'), 'Caderninho do financeiro', botoes) + toastHtml()
      + faixaFiliais(estado.boletos.filter((b) => b.etapa === 'enviado'), 'aguardando visto')
      + secao('Aguardando seu visto', `<span class="pill p-enviado num">${plural(pend.length, 'boleto', 'boletos')}</span>`, blocoPend, 'Tudo com visto. Nenhum boleto esperando.')
      + secao('A pagar', `<span class="pill p-breve num">${plural(aPagar.length, 'boleto', 'boletos')} · ${brl(totalPagar)}</span>`, blocoPagar, 'Nada a pagar. Todos os boletos com visto já estão pagos.')
      + secao('Chegaram, ainda com o fiscal', `<span class="pill p-chegou num">${plural(comFiscal.length, 'boleto', 'boletos')}</span>`, blocoFiscal, 'Nenhum boleto parado no fiscal.')
      + secaoDireto
      + secao('Vencem nos próximos 7 dias', '', blocoSemana, 'Nada vence nesta semana.');
  },
};

registrarCampo('busca-direto', (el) => { estado.buscaDireto = el.value; desenhar(); });
/** Marca como pago e avisa; o boleto sai de "A pagar" (dá para desfazer em Detalhes → Corrigir marcação) */
function pagar(ids) {
  return executar(async () => {
    const n = await estado.api.marcarPago(ids);
    await recarregar();
    avisar(n === 1 ? 'Boleto marcado como pago.' : `${n} boletos marcados como pagos.`);
  });
}

registrarAcoes({
  'ordem-fin': (el) => { estado.ordemFin = el.dataset.ordem; desenhar(); },
  'marcar-pago': (el) => pagar([el.dataset.id]),
  'marcar-pago-nota': (el) => pagar(estado.boletos.filter((b) => b.nota_id === el.dataset.nota && b.etapa === 'visto' && !b.pago_em).map((b) => b.id)),
});
