// =====================================================================
// DUPLICA · telas/fiscal.js
// Tela do FISCAL: notas com seus boletos, contadores, busca, filtros,
// marcação "Chegou" / "Enviar ao financeiro" (um a um ou todos da nota)
// e importação de XML.
// =====================================================================
import { estado, naLoja, precisaAtencao } from '../nucleo/estado.js?v=9b9ec3e';
import { podeFiscal, podeCancelar, proximaAcao } from '../nucleo/regras.js?v=9b9ec3e';
import { registrarAcoes, registrarCampo, avisar, executar } from '../nucleo/eventos.js?v=9b9ec3e';
import { desenhar, recarregar } from '../nucleo/desenhar.js?v=9b9ec3e';
import { cabecalho, sobretituloHoje, toastHtml, faixaFiliais, pillEtapa, pillPrazo, docNota, pillTipo } from '../componentes/comuns.js?v=9b9ec3e';
import '../componentes/modal-avulso.js?v=9b9ec3e';
import { ICONE } from '../componentes/icones.js?v=9b9ec3e';
import { esc, brl, dataBR, diasAte, plural, hojeISO } from '../util/formato.js?v=9b9ec3e';
import { lerXmlNfe } from '../util/xml-nfe.js?v=9b9ec3e';

const FILTROS = [['todos', 'Todos'], ['esperado', 'Não chegou'], ['chegou', 'Chegou'], ['enviado', 'No financeiro'], ['visto', 'Com visto'], ['cancelado', 'Cancelados'], ['alerta', 'Atenção']];

/** Uma linha de boleto dentro da nota */
function linhaBoleto(b) {
  const acao = proximaAcao(b);
  const classe = estado.sel === b.id ? ' sel' : b.etapa === 'cancelado' ? ' cancelada' : (precisaAtencao(b) && diasAte(b.vencimento) <= 0 ? ' alerta' : '');
  return `<div class="linha${classe}">
    <span class="parc num">${b.parcela}/${b.total_parcelas}</span>
    <div class="kv" style="width:120px"><small>Vencimento</small><b class="num">${dataBR(b.vencimento)}</b></div>
    <div class="kv" style="width:120px"><small>Valor</small><b class="num">${brl(b.valor)}</b></div>
    <div class="status">${pillEtapa(b)}${pillPrazo(b)}${b.anotacao ? '<em>· anotação</em>' : ''}${b.foto_path ? '<em>· comprovante</em>' : ''}</div>
    <div class="acoes">${acao ? `<button class="bp bs" type="button" data-acao="avancar" data-id="${b.id}">${acao}</button>` : ''}
      <button class="bg" type="button" data-acao="abrir-boleto" data-id="${b.id}">Detalhes</button></div>
  </div>`;
}

/** Um cartão de nota com o cabeçalho e as parcelas visíveis */
function cartaoNota(n, boletosDaNota, visiveis) {
  const filial = estado.filiais.find((f) => f.id === n.filial_id);
  // cancelados não contam no progresso da nota
  const ativos = boletosDaNota.filter((b) => b.etapa !== 'cancelado');
  const notaCancelada = ativos.length === 0;
  const chegaram = ativos.filter((b) => b.etapa !== 'esperado').length;
  const pct = ativos.length ? Math.round((chegaram / ativos.length) * 100) : 0;
  const nEsp = boletosDaNota.filter((b) => b.etapa === 'esperado').length;
  const nChe = boletosDaNota.filter((b) => b.etapa === 'chegou').length;

  // botões em lote quando a nota tem mais de um boleto na mesma etapa
  const lote = podeFiscal() && (nEsp > 1 || nChe > 1) ? `<div class="lote"><small>Os boletos desta nota chegaram juntos?</small>
      ${nEsp > 1 ? `<button class="bp bs" type="button" data-acao="avancar-lote" data-nota="${n.id}" data-etapa="esperado">Chegaram todos (${nEsp})</button>` : ''}
      ${nChe > 1 ? `<button class="bg" type="button" data-acao="avancar-lote" data-nota="${n.id}" data-etapa="chegou">Enviar todos ao financeiro (${nChe})</button>` : ''}</div>` : '';

  // nota paga por boleto, mas o XML não trouxe as parcelas: completar pelo boleto em papel
  const semVenc = boletosDaNota.some((b) => !b.vencimento && b.etapa === 'esperado');
  const informar = semVenc && podeFiscal()
    ? `<div class="lote" style="background:var(--ocre-bg)"><small style="color:var(--ocre-txt);font-weight:700">O XML desta nota não trouxe as parcelas. Informe pelo boleto em papel.</small>
        <button class="bp bs" type="button" data-acao="informar-parcelas" data-nota="${n.id}">Informar parcelas</button></div>` : '';
  const cancelar = podeCancelar() && !notaCancelada
    ? `<button class="link-cancelar" type="button" data-acao="cancelar-nota" data-nota="${n.id}">Cancelar nota</button>` : '';

  return `<article class="nota"><div class="nota-h">
      <div class="quem"><small>${docNota(n)} · ${esc(filial?.nome || '')}</small><strong>${esc(n.fornecedor)}</strong>
        ${pillTipo(n) ? `<span style="align-self:flex-start">${pillTipo(n)}</span>` : ''}
        ${notaCancelada ? '<span class="pill p-cancelado" style="align-self:flex-start">Nota cancelada</span>' : ''}</div>
      <div class="kv"><small>Emissão</small><b class="num">${n.emissao ? dataBR(n.emissao) : '—'}</b></div>
      <div class="kv"><small>Valor da nota</small><b class="num">${brl(n.valor)}</b></div>
      <div class="kv"><small>Boletos</small><b class="num">${plural(boletosDaNota.length, 'boleto', 'boletos')}</b></div>
      ${notaCancelada ? '' : `<div class="prog"><small>${chegaram} de ${ativos.length} chegaram</small><div class="barra"><i class="${pct === 100 ? 'ok' : ''}" style="width:${pct}%"></i></div></div>`}
      ${cancelar}
    </div>${informar}${lote}<div class="rolagem">${visiveis.map(linhaBoleto).join('')}</div></article>`;
}

/** Caixa com o resultado da última importação de XML */
function resultadoHtml() {
  const r = estado.resultadoImport;
  if (!r) return '';
  const itens = [
    r.importada && `<li><b>${plural(r.importada, 'nota entrou', 'notas entraram')}</b></li>`,
    r.duplicada && `<li>${plural(r.duplicada, 'XML ignorado', 'XMLs ignorados')}: <b>Este XML já foi adicionado</b></li>`,
    r.filial_desconhecida && `<li>${plural(r.filial_desconhecida, 'nota não é', 'notas não são')} para uma filial cadastrada (CNPJ do destinatário diferente)</li>`,
    r.importada_sem_vencimento && `<li><b>${plural(r.importada_sem_vencimento, 'nota paga por boleto entrou', 'notas pagas por boleto entraram')} sem as parcelas no XML</b>: use “Informar parcelas” na nota</li>`,
    r.sem_boleto && `<li>${plural(r.sem_boleto, 'nota sem boleto', 'notas sem boleto')} (não tem duplicatas no XML)</li>`,
    ...r.erros.map((e) => `<li style="color:var(--alerta-txt)">${esc(e)}</li>`),
  ].filter(Boolean).join('');
  return `<div class="resultado" role="status"><div class="linha-topo"><h2>Resultado da importação · ${plural(r.total, 'arquivo', 'arquivos')}</h2>
    <button class="bg" type="button" data-acao="fechar-resultado">Fechar</button></div><ul>${itens}</ul></div>`;
}

export const telaFiscal = {
  id: 'fiscal',
  rotulo: () => 'Fiscal',
  visivel: (p) => p.setor === 'Fiscal' || p.papel === 'gerente',
  contador: () => estado.boletos.filter(precisaAtencao).length,

  render() {
    const todos = estado.boletos.filter(naLoja);
    const conta = (f) => todos.filter(f).length;
    const cards = [
      ['esperado', 'Não chegaram', conta((b) => b.etapa === 'esperado'), 'boletos esperados', 'var(--petroleo)'],
      ['chegou', 'Chegaram, falta enviar', conta((b) => b.etapa === 'chegou'), 'estão com o fiscal', 'var(--terra)'],
      ['enviado', 'No financeiro', conta((b) => b.etapa === 'enviado'), 'aguardando visto', 'var(--petroleo)'],
      ['alerta', 'Atenção', conta(precisaAtencao), 'vencem logo e não chegaram', 'var(--alerta)'],
    ].map(([f, rot, n, sub, cor]) => `<button type="button" class="card${f === 'alerta' && n ? ' alerta' : ''}${estado.filtro === f ? ' on' : ''}" data-acao="filtrar" data-filtro="${f}">
        <span>${rot}</span><strong class="num" style="color:${cor}">${n}</strong><small>${sub}</small></button>`).join('');

    const chips = FILTROS.map(([f, rot]) => `<button type="button" data-acao="filtrar" data-filtro="${f}" aria-pressed="${estado.filtro === f}">${rot}</button>`).join('');

    const q = estado.busca.trim().toLowerCase().replace(/\./g, '');
    const visiveis = [];   // boletos que aparecem na tela (preenchido abaixo)
    const notas = estado.notas
      .filter((n) => estado.loja === 'todas' || n.filial_id === estado.loja)
      .filter((n) => !q || n.fornecedor.toLowerCase().includes(q) || n.numero.replace(/\./g, '').includes(q))
      // filtro pela data de emissão da nota (De / Até)
      .filter((n) => (!estado.emissaoDe || (n.emissao || '') >= estado.emissaoDe) && (!estado.emissaoAte || (n.emissao || '') <= estado.emissaoAte))
      .map((n) => {
        const bs = todos.filter((b) => b.nota_id === n.id).sort((a, b) => a.parcela - b.parcela);
        const vis = bs.filter((b) => (estado.filtro === 'alerta' ? precisaAtencao(b) : estado.filtro === 'todos' || b.etapa === estado.filtro));
        return vis.length ? { n, bs, vis } : null;
      })
      .filter(Boolean)
      // nota emitida mais recentemente primeiro
      .sort((a, b) => ((b.n.emissao || '') < (a.n.emissao || '') ? -1 : (b.n.emissao || '') > (a.n.emissao || '') ? 1 : a.n.fornecedor.localeCompare(b.n.fornecedor)))
      .map((x) => { visiveis.push(...x.vis); return cartaoNota(x.n, x.bs, x.vis); }).join('');

    // filtro "Chegou": botão para mandar ao financeiro todos os que estão na tela
    // (respeita filial, busca e período de emissão). Pede confirmação no 2º clique.
    const chegaram = visiveis.filter((b) => b.etapa === 'chegou');
    estado.idsEnviarTodos = chegaram.map((b) => b.id);
    const totalChegaram = chegaram.reduce((s, b) => s + Number(b.valor), 0);
    const enviarTodos = estado.filtro === 'chegou' && chegaram.length && podeFiscal()
      ? `<div class="lote" style="border-radius:14px;border:1.5px solid var(--nevoa)">
          <small><b>${plural(chegaram.length, 'boleto chegou', 'boletos chegaram')}</b> e ainda não ${chegaram.length === 1 ? 'foi' : 'foram'} para o financeiro · <span class="num">${brl(totalChegaram)}</span></small>
          ${estado.confirmarEnvioTodos
            ? `<button class="bp bs" type="button" data-acao="enviar-todos-chegou">Confirmar: enviar os ${chegaram.length}</button>
               <button class="bg" type="button" data-acao="cancelar-enviar-todos">Cancelar</button>`
            : `<button class="bp bs" type="button" data-acao="pedir-enviar-todos">Enviar todos ao financeiro (${chegaram.length})</button>`}
        </div>` : '';

    const botaoXml = podeFiscal()
      ? `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="bg" type="button" data-acao="abrir-avulso" style="height:46px">+ Boleto avulso</button>
         <button class="bp" type="button" data-acao="escolher-xml">${ICONE.upload()}Adicionar XML</button></div>
         <input type="file" id="arquivos-xml" accept=".xml,text/xml,application/xml" multiple hidden>` : '';

    // período de emissão: atalhos + De/Até
    const hoje = hojeISO(), mesIni = hoje.slice(0, 8) + '01';
    const menos = (dias) => { const d = new Date(hoje + 'T12:00:00'); d.setDate(d.getDate() - dias); return d.toISOString().slice(0, 10); };
    const atalhos = [['Hoje', hoje, hoje], ['Últimos 7 dias', menos(6), hoje], ['Este mês', mesIni, hoje], ['Todas', '', '']]
      .map(([rot, de, ate]) => `<button type="button" data-acao="periodo-emissao" data-de="${de}" data-ate="${ate}"
          aria-pressed="${estado.emissaoDe === de && estado.emissaoAte === ate}">${rot}</button>`).join('');
    const periodo = `<div class="periodo"><span class="eyebrow" style="align-self:center">Emissão</span>
        <div class="chips" role="group" aria-label="Período de emissão">${atalhos}</div>
        <div class="field"><label for="emissao-de" class="sr">Emitida de</label><input class="inp" type="date" id="emissao-de" value="${estado.emissaoDe}" title="Emitida de"></div>
        <span style="align-self:center;color:var(--terra)">até</span>
        <div class="field"><label for="emissao-ate" class="sr">Emitida até</label><input class="inp" type="date" id="emissao-ate" value="${estado.emissaoAte}" title="Emitida até"></div></div>`;

    return cabecalho(sobretituloHoje('Fiscal'), 'Boletos das notas', botaoXml) + toastHtml() + resultadoHtml()
      + faixaFiliais(estado.boletos.filter((b) => !['visto', 'cancelado'].includes(b.etapa)), 'boletos em aberto')
      + `<div class="cards">${cards}</div>
      <div class="filtros"><div class="busca"><label for="busca" class="sr">Buscar</label>
        <input id="busca" placeholder="Buscar por fornecedor ou número da nota" value="${esc(estado.busca)}">${ICONE.busca()}</div>
        <div class="chips" role="group" aria-label="Filtrar">${chips}</div></div>
      ${periodo}
      <div class="corpo"><div class="lista">${enviarTodos}${notas || '<div class="vazio">Nenhum boleto com esse filtro.</div>'}</div></div>`;
  },
};

// ------------------------------ ações -------------------------------
registrarAcoes({
  filtrar: (el) => { estado.filtro = el.dataset.filtro; estado.confirmarEnvioTodos = false; desenhar(); },
  'pedir-enviar-todos': () => { estado.confirmarEnvioTodos = true; desenhar(); },
  'cancelar-enviar-todos': () => { estado.confirmarEnvioTodos = false; desenhar(); },
  'enviar-todos-chegou': () => executar(async () => {
    const ids = estado.idsEnviarTodos || [];
    estado.confirmarEnvioTodos = false;
    if (!ids.length) return;
    const n = await estado.api.avancar(ids);
    await recarregar();
    avisar(`${plural(n, 'boleto enviado', 'boletos enviados')} ao financeiro.`);
  }),
  'periodo-emissao': (el) => { estado.emissaoDe = el.dataset.de; estado.emissaoAte = el.dataset.ate; desenhar(); },
  'escolher-xml': () => document.getElementById('arquivos-xml').click(),
  'fechar-resultado': () => { estado.resultadoImport = null; desenhar(); },
});

registrarCampo('busca', (el) => { estado.busca = el.value; desenhar(); });
registrarCampo('emissao-de', (el) => { estado.emissaoDe = el.value; desenhar(); });
registrarCampo('emissao-ate', (el) => { estado.emissaoAte = el.value; desenhar(); });

/** Lê cada XML escolhido, manda para o banco e conta o resultado */
registrarCampo('arquivos-xml', (el) => executar(async () => {
  const arquivos = [...el.files];
  if (!arquivos.length) return;
  const r = { total: arquivos.length, importada: 0, duplicada: 0, filial_desconhecida: 0, sem_boleto: 0, erros: [] };
  for (const arq of arquivos) {
    try {
      const dados = lerXmlNfe(await arq.text());
      const status = await estado.api.importarNota(dados);
      r[status] = (r[status] || 0) + 1;
    } catch (e) {
      r.erros.push(`${arq.name}: ${e.message}`);
    }
  }
  estado.resultadoImport = r;
  await recarregar();
}));
