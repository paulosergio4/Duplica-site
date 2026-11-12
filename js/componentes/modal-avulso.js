// =====================================================================
// DUPLICA · componentes/modal-avulso.js
// Janela "Adicionar boleto avulso": para nota de serviço (NFS-e) ou
// outro documento que não vem no XML de NF-e. A pessoa informa o
// fornecedor, número, data de emissão, filial e as parcelas.
// Depois de lançado, o boleto segue o caminho normal (Chegou → Enviado → Visto).
//
// Botão que abre: data-acao="abrir-avulso"   (Fiscal e Financeiro)
// =====================================================================
import { estado, notaDe, filialDe } from '../nucleo/estado.js?v=499bdd4';
import { registrarAcoes, registrarCampo, avisar, executar } from '../nucleo/eventos.js?v=499bdd4';
import { desenhar, recarregar } from '../nucleo/desenhar.js?v=499bdd4';
import { esc, brl, dataBR, hojeISO, mascaraCnpj } from '../util/formato.js?v=499bdd4';
import { TIPOS_NOTA } from './comuns.js?v=499bdd4';

/** Copia o que está digitado na janela para o estado (para não perder ao redesenhar) */
function lerCampos() {
  const m = estado.modal, v = (id) => document.getElementById(id)?.value ?? '';
  m.v = { tipo: v('av-tipo'), fornecedor: v('av-forn'), cnpj: v('av-cnpj'), numero: v('av-num'),
    emissao: v('av-emissao'), filial: v('av-filial'), descricao: v('av-desc') };
  m.parcelas = m.parcelas.map((_, i) => ({ venc: v(`av-venc-${i}`), valor: v(`av-valor-${i}`) }));
}

/** "1.234,56" ou "1234.56" → 1234.56 */
const numero = (t) => Number(String(t).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));

/** Linhas de parcela (vencimento + valor), usadas nas duas janelas */
function parcelasHtml(m) {
  return m.parcelas.map((p, i) => `<div class="av-parcela">
      <span class="parc num">${i + 1}ª</span>
      <div class="field"><label for="av-venc-${i}">Vencimento</label><input class="inp" type="date" id="av-venc-${i}" value="${esc(p.venc)}"></div>
      <div class="field"><label for="av-valor-${i}">Valor (R$)</label><input class="inp num" id="av-valor-${i}" inputmode="decimal" placeholder="0,00" value="${esc(p.valor)}"></div>
      ${m.parcelas.length > 1 ? `<button class="x" type="button" data-acao="av-tirar-parcela" data-i="${i}" aria-label="Tirar a ${i + 1}ª parcela">✕</button>` : ''}
    </div>`).join('');
}

/** Janela "Informar parcelas": nota paga por boleto cujo XML não trouxe as parcelas */
export function modalParcelasHtml() {
  const m = estado.modal, n = notaDe(m.nota), f = filialDe(n.filial_id);
  const total = m.parcelas.reduce((s, p) => s + (numero(p.valor) || 0), 0);
  const diferenca = Math.round((total - Number(n.valor)) * 100) / 100;
  return `<div class="modal-fundo"><div class="modal modal-largo" role="dialog" aria-modal="true" aria-labelledby="m-t">
    <h2 id="m-t">Informar parcelas</h2>
    <p class="resumo"><b>${esc(n.fornecedor)}</b> · ${esc(f?.nome || '')}<br>NF ${esc(n.numero)} · emitida em ${dataBR(n.emissao)} · valor da nota <span class="num">${brl(n.valor)}</span></p>
    <span class="dica-campo">Copie do boleto em papel: o vencimento e o valor de cada parcela (ex.: “1/2”, “2/2”).</span>
    <div class="field"><label>Parcelas</label>${parcelasHtml(m)}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <button class="bg" type="button" data-acao="av-mais-parcela">+ parcela</button>
        <b class="num">Total: ${brl(total)}${diferenca ? ` <span style="color:var(--alerta-txt)">(${diferenca > 0 ? '+' : ''}${brl(diferenca)} da nota)</span>` : ''}</b></div></div>
    ${m.erro ? `<p class="erro" role="alert">${esc(m.erro)}</p>` : ''}
    <div class="botoes">
      <button class="bp" type="button" data-acao="parc-salvar" style="flex:1">Salvar parcelas</button>
      <button class="bg" type="button" data-acao="fechar-modal" style="height:46px">Cancelar</button>
    </div>
  </div></div>`;
}

export function modalAvulsoHtml() {
  const m = estado.modal, v = m.v || {};
  const filiais = estado.filiais.map((f) => `<option value="${f.id}"${v.filial === f.id ? ' selected' : ''}>${esc(f.nome)}</option>`).join('');
  const total = m.parcelas.reduce((s, p) => s + (numero(p.valor) || 0), 0);
  const parcelas = parcelasHtml(m);
  const sel = (val, rot) => `<option value="${val}"${(v.tipo || 'servico') === val ? ' selected' : ''}>${rot}</option>`;

  return `<div class="modal-fundo"><div class="modal modal-largo" role="dialog" aria-modal="true" aria-labelledby="m-t">
    <h2 id="m-t">Adicionar boleto avulso</h2>
    <div class="av-grade">
      <div class="field"><label for="av-tipo">Tipo</label><select class="inp" id="av-tipo">${Object.entries(TIPOS_NOTA).filter(([k]) => k !== 'recorrente').map(([k, t]) => sel(k, t[0])).join('')}</select></div>
      <div class="field"><label for="av-filial">Filial</label><select class="inp" id="av-filial"><option value="">Escolha…</option>${filiais}</select></div>
      <div class="field av-largo"><label for="av-forn">Fornecedor</label><input class="inp" id="av-forn" placeholder="ex.: Net Pompéu Telecom" value="${esc(v.fornecedor || '')}"></div>
      <div class="field"><label for="av-cnpj">CNPJ do fornecedor (opcional)</label><input class="inp num" id="av-cnpj" inputmode="numeric" maxlength="18" placeholder="00.000.000/0000-00" value="${esc(v.cnpj || '')}"></div>
      <div class="field"><label for="av-num">Número da nota / documento</label><input class="inp" id="av-num" placeholder="ex.: 1234" value="${esc(v.numero || '')}"></div>
      <div class="field"><label for="av-emissao">Data de emissão</label><input class="inp" type="date" id="av-emissao" value="${esc(v.emissao || hojeISO())}"></div>
      <div class="field"><label for="av-desc">Descrição (opcional)</label><input class="inp" id="av-desc" placeholder="ex.: Manutenção das câmeras" value="${esc(v.descricao || '')}"></div>
    </div>
    <div class="field"><label>Parcelas</label>${parcelas}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <button class="bg" type="button" data-acao="av-mais-parcela">+ parcela</button>
        <b class="num">Total: ${brl(total)}</b></div></div>
    ${m.erro ? `<p class="erro" role="alert">${esc(m.erro)}</p>` : ''}
    <div class="botoes">
      <button class="bp" type="button" data-acao="av-salvar" style="flex:1">Lançar boleto${m.parcelas.length > 1 ? 's' : ''}</button>
      <button class="bg" type="button" data-acao="fechar-modal" style="height:46px">Cancelar</button>
    </div>
  </div></div>`;
}

registrarAcoes({
  'abrir-avulso': () => {
    estado.modal = { tipo: 'avulso', parcelas: [{ venc: '', valor: '' }], v: { filial: estado.loja !== 'todas' ? estado.loja : '' }, erro: '' };
    desenhar();
    document.getElementById('av-forn')?.focus();
  },
  'av-mais-parcela': () => {
    lerCampos();
    const ult = estado.modal.parcelas[estado.modal.parcelas.length - 1];
    // nova parcela já sugere 30 dias depois da anterior e o mesmo valor
    let venc = '';
    if (ult.venc) { const d = new Date(ult.venc + 'T12:00:00'); d.setDate(d.getDate() + 30); venc = d.toISOString().slice(0, 10); }
    estado.modal.parcelas.push({ venc, valor: ult.valor });
    desenhar();
  },
  'informar-parcelas': (el) => {
    const n = notaDe(el.dataset.nota);
    const valor = Number(n.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    estado.modal = { tipo: 'parcelas', nota: n.id, parcelas: [{ venc: '', valor }], erro: '' };
    desenhar();
    document.getElementById('av-venc-0')?.focus();
  },
  'parc-salvar': () => executar(async () => {
    lerCampos();
    const m = estado.modal, n = notaDe(m.nota);
    const parcelas = m.parcelas.map((p) => ({ vencimento: p.venc, valor: numero(p.valor) }));
    if (parcelas.some((p) => !p.vencimento) || parcelas.some((p) => !(p.valor > 0))) {
      m.erro = 'Preencha o vencimento e o valor de todas as parcelas.'; desenhar(); return;
    }
    try { await estado.api.definirParcelas(m.nota, parcelas); } catch (e) { m.erro = e.message; desenhar(); return; }
    estado.modal = null;
    await recarregar();
    avisar(`Parcelas da NF ${n.numero} de ${n.fornecedor} salvas: ${parcelas.map((p, i) => `${i + 1}/${parcelas.length} vence ${dataBR(p.vencimento)}`).join(', ')}.`);
  }),
  'av-tirar-parcela': (el) => { lerCampos(); estado.modal.parcelas.splice(Number(el.dataset.i), 1); desenhar(); },
  'av-salvar': () => executar(async () => {
    lerCampos();
    const m = estado.modal, v = m.v;
    const parcelas = m.parcelas.map((p) => ({ vencimento: p.venc, valor: numero(p.valor) }));
    const erro = !v.filial ? 'Escolha a filial.'
      : !v.fornecedor.trim() ? 'Informe o fornecedor.'
      : !v.numero.trim() ? 'Informe o número da nota ou documento.'
      : parcelas.some((p) => !p.vencimento) ? 'Preencha o vencimento de todas as parcelas.'
      : parcelas.some((p) => !(p.valor > 0)) ? 'Preencha o valor de todas as parcelas (ex.: 199,90).' : '';
    if (erro) { m.erro = erro; desenhar(); return; }
    try {
      await estado.api.lancarAvulso({ tipo: v.tipo, fornecedor: v.fornecedor.trim(), fornecedor_cnpj: v.cnpj, numero: v.numero.trim(),
        emissao: v.emissao, filial_id: v.filial, descricao: v.descricao.trim(), parcelas });
    } catch (e) { m.erro = e.message; desenhar(); return; }
    estado.modal = null;
    await recarregar();
    avisar(`${parcelas.length > 1 ? `${parcelas.length} boletos lançados` : 'Boleto lançado'} para ${v.fornecedor.trim()}. ${parcelas.length > 1 ? 'Estão' : 'Está'} como “Não chegou” até alguém marcar.`);
  }),
});

registrarCampo('av-cnpj', (el) => { el.value = mascaraCnpj(el.value); });
