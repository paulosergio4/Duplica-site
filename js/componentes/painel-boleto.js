// =====================================================================
// DUPLICA · componentes/painel-boleto.js
// Janela (modal) "Detalhes" de um boleto, no meio da tela: etapas, anotação, foto do
// comprovante, correção de marcação e histórico.
// O histórico e o link da foto são buscados só quando o painel abre.
// =====================================================================
import { estado, boletoDe, notaDe } from '../nucleo/estado.js?v=d903c9a';
import { podeCorrigir, podeCancelar, podePagar, podePagarFiscal, podeAlterarVencimento, NOME_ETAPA } from '../nucleo/regras.js?v=d903c9a';
import { registrarAcoes, registrarCampo, avisar, executar } from '../nucleo/eventos.js?v=d903c9a';
import { desenhar, recarregar } from '../nucleo/desenhar.js?v=d903c9a';
import { ICONE } from './icones.js?v=d903c9a';
import { docNota } from './comuns.js?v=d903c9a';
import { linhaDigitavelHtml } from './ler-boleto.js?v=d903c9a';
import { fotosDaNotaHtml } from '../telas/recebimento.js?v=d903c9a';
import { esc, brl, dataBR, dataHoraBR } from '../util/formato.js?v=d903c9a';

/** Abre o painel e busca histórico + foto */
async function abrir(id) {
  Object.assign(estado, { sel: id, hist: null, fotoUrl: null, corrigindo: false, editandoVenc: false });
  desenhar();
  await executar(async () => {
    const b = boletoDe(id);
    const [hist, url] = await Promise.all([
      estado.api.historico(id),
      b.foto_path ? estado.api.urlFoto(b.foto_path) : null,
    ]);
    if (estado.sel !== id) return;            // a pessoa já abriu outro
    estado.hist = hist; estado.fotoUrl = url;
    desenhar();
  });
}

/** Depois de qualquer mudança: recarrega dados e o painel */
async function atualizar(msg) {
  const id = estado.sel;
  await recarregar();
  avisar(msg);
  await abrir(id);
}

export function painelHtml() {
  const b = boletoDe(estado.sel);
  if (!b) return '';
  const n = notaDe(b.nota_id);
  const ordem = ['esperado', 'chegou', 'enviado', 'visto'];
  // cancelado: mostra até a etapa em que estava antes de cancelar
  const atual = ordem.indexOf(b.etapa === 'cancelado' ? (b.etapa_antes_cancelar || 'esperado') : b.etapa);

  // boleto que chegou direto no financeiro (e-mail, DDA, em mãos): pulou o fiscal
  const direto = b.direto_financeiro;
  const comoDireto = direto === 'E-mail' ? 'por e-mail' : direto === 'DDA' ? 'pelo DDA'
    : direto === 'Em mãos' ? `em mãos, entregue por ${esc(b.entregue_por || '')}`
    : `pago direto ao fornecedor (${esc(direto)})`;
  const textoPago = b.pago_em ? `${b.pago_forma && b.pago_forma !== 'Boleto' ? `<b>${esc(b.pago_forma)}</b> · ` : ''}por ${esc(b.pago_por)} · ${dataHoraBR(b.pago_em)}` : '';
  const passos = direto ? [
    ['Nota lançada, boleto esperado', 'automático, pelo XML'],
    ['Chegou', b.chegou_em ? `<b>Recebido por ${esc(b.recebido_por)}</b> · marcado por ${esc(b.chegou_marcado_por)} · ${dataHoraBR(b.chegou_em)}` : 'não passou pelo fiscal'],
    ['Recebido direto pelo financeiro', `<b>${comoDireto}</b> · marcado por ${esc(b.visto_por)} · ${dataHoraBR(b.visto_em)}`],
    ['Pago', b.pago_em ? textoPago : 'a pagar'],
  ].map(([titulo, info], i) => `<li class="${(i === 1 && !b.chegou_em) || (i === 3 && !b.pago_em) ? '' : 'feito'}"><div class="trilho"><span class="dot"></span><span class="fio"></span></div>
      <div class="txt"><b>${titulo}</b><small>${info}</small></div></li>`).join('') : [
    ['Nota lançada, boleto esperado', 'automático, pelo XML'],
    ['Chegou', b.chegou_em ? `<b>Recebido por ${esc(b.recebido_por)}</b> · marcado por ${esc(b.chegou_marcado_por)} · ${dataHoraBR(b.chegou_em)}` : 'pendente'],
    ['Enviado ao financeiro', b.enviado_em ? `por ${esc(b.enviado_por)} · ${dataHoraBR(b.enviado_em)}${b.forma_indicada && !b.pago_em ? ` · <b>marcado como pago por ${esc(b.forma_indicada)}</b>${b.forma_indicada_obs ? ` (${esc(b.forma_indicada_obs)})` : ''}, falta o Financeiro confirmar` : ''}` : 'pendente'],
    ['Visto do financeiro', b.visto_em ? `<b>Entregue por ${esc(b.entregue_por)}</b> · visto por ${esc(b.visto_por)} · ${dataHoraBR(b.visto_em)}` : 'pendente'],
    ['Pago', b.pago_em ? textoPago : 'pendente'],
  ].map(([titulo, info], i) => `<li class="${i <= atual || (i === 4 && b.pago_em) ? 'feito' : ''}"><div class="trilho"><span class="dot"></span><span class="fio"></span></div>
      <div class="txt"><b>${titulo}</b><small>${info}</small></div></li>`).join('');

  const foto = b.foto_path
    ? `<div class="foto">${estado.fotoUrl && !/\.pdf$/i.test(b.foto_path) ? `<img src="${esc(estado.fotoUrl)}" alt="Comprovante">` : `<div class="thumb" aria-hidden="true">${ICONE.imagem()}</div>`}
        <div class="kv"><b>${esc(b.foto_path.split('/').pop())}</b>${estado.fotoUrl ? `<a href="${esc(estado.fotoUrl)}" target="_blank" rel="noopener">Abrir arquivo</a>` : '<small>carregando…</small>'}</div></div>`
    : `<button class="addfoto" type="button" data-acao="escolher-foto">${ICONE.anexo()}Anexar foto ou PDF do comprovante</button>`;

  const correcao = !podeCorrigir(b) ? '' : `<div class="corrigir">${estado.corrigindo
    ? `<label for="just" style="font-size:13px;font-weight:700">Por que está corrigindo? (obrigatório)</label>
       <textarea class="inp" id="just" rows="2" placeholder="ex.: marquei a parcela errada, era a 2" style="border-color:var(--alerta)"></textarea>
       <div style="display:flex;gap:8px;flex-wrap:wrap">
         <button class="bdanger" type="button" data-acao="confirmar-correcao" id="b-conf" disabled>Desfazer “${b.pago_em && b.etapa !== 'cancelado' ? 'Pago' : b.etapa === 'cancelado' ? 'Cancelado' : direto ? 'Recebido direto pelo financeiro' : NOME_ETAPA[b.etapa]}”</button>
         <button class="bg" type="button" data-acao="cancelar-correcao">Cancelar</button></div>`
    : '<button class="link-alerta" type="button" data-acao="abrir-correcao">Corrigir marcação</button>'}</div>`;

  const hist = estado.hist === null ? '<div><small>Carregando…</small></div>'
    : estado.hist.length === 0 ? '<div><b style="font-weight:600;color:var(--terra)">Nenhuma marcação ainda</b><small>sistema</small></div>'
    : estado.hist.slice().reverse().map((h) => `<div><b class="${h.acao === 'Corrigido' ? 'corr' : ''}">${esc(h.acao)}${h.detalhe ? ' · ' + esc(h.detalhe) : ''}</b>
        <small>marcado por ${esc(h.feito_por_nome)} · ${dataHoraBR(h.feito_em)}</small></div>`).join('');

  // fundo escuro: clicar fora da janela fecha (data-fechar-fundo, ver nucleo/eventos.js)
  return `<div class="modal-fundo painel-fundo" data-fechar-fundo="fechar-painel">
  <aside class="painel painel-modal" role="dialog" aria-modal="true" aria-label="Detalhes do boleto">
    <div class="painel-h"><div><small>${docNota(n)} · parcela ${b.parcela}/${b.total_parcelas}</small><strong>${esc(n.fornecedor)}</strong>
      <span class="num">${brl(b.valor)} · vence ${dataBR(b.vencimento)}</span>
      ${podeAlterarVencimento(b) && !estado.editandoVenc ? '<button class="link-alerta" type="button" data-acao="editar-venc" style="align-self:flex-start;color:var(--petroleo)">Alterar vencimento</button>' : ''}</div>
      <button class="x" type="button" data-acao="fechar-painel" aria-label="Fechar detalhes">${ICONE.fechar()}</button></div>
    ${estado.editandoVenc ? `<div class="corrigir" style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div class="field" style="flex:0 0 180px"><label for="venc-novo">Novo vencimento</label>
          <input class="inp" type="date" id="venc-novo" data-rascunho="1" value="${esc(estado.rascunho['venc-novo'] ?? b.vencimento ?? '')}"></div>
        <div class="field" style="flex:1 1 220px"><label for="venc-motivo">Motivo (opcional)</label>
          <input class="inp" id="venc-motivo" data-rascunho="1" placeholder="ex.: fornecedor prorrogou" value="${esc(estado.rascunho['venc-motivo'] || '')}"></div></div>
      <div style="display:flex;gap:8px"><button class="bp" type="button" data-acao="salvar-venc">Salvar vencimento</button>
        <button class="bg" type="button" data-acao="cancelar-venc">Cancelar</button></div>
      <small style="color:var(--terra)">A data antiga fica registrada no histórico.</small></div>` : ''}
    ${b.etapa === 'cancelado' ? `<div class="erro" style="background:#E9EDF2;color:#1F2933"><b>Cancelado</b> · ${esc(b.cancelado_motivo || '')}<br>
      <small>por ${esc(b.cancelado_por || '')} · ${dataHoraBR(b.cancelado_em)}</small></div>` : ''}
    <ol class="etapas">${passos}</ol>
    ${linhaDigitavelHtml(b)}
    ${fotosDaNotaHtml(b.nota_id)}
    <div class="field"><label for="anot">Anotação</label>
      ${b.anotacao ? `<div style="background:var(--creme-2);border-radius:10px;padding:10px 12px;font-size:14px;white-space:pre-wrap">${esc(b.anotacao)}</div>` : ''}
      <textarea class="inp" id="anot" rows="3" placeholder="${b.anotacao ? 'Escreva uma nova anotação (substitui a de cima)' : 'ex.: entregue para fulano no balcão'}"></textarea>
      <button class="bg" type="button" data-acao="salvar-anotacao" style="align-self:flex-start">Salvar anotação</button></div>
    <div class="field"><label>Comprovante</label>${foto}
      <input type="file" id="arquivo-foto" accept="image/jpeg,image/png,image/webp,application/pdf" hidden></div>
    ${correcao}
    ${estado.tela !== 'financeiro' && podePagarFiscal(b) ? `<button class="visto" type="button" data-acao="pago-fiscal" data-id="${b.id}" style="align-self:flex-start">${ICONE.check()}Pago (cheque, Pix…) · enviar ao financeiro</button>`
      : podePagar(b) ? `<button class="visto" type="button" data-acao="marcar-pago" data-id="${b.id}" style="align-self:flex-start">${ICONE.check()}${b.etapa === 'visto' ? 'Marcar como pago' : b.forma_indicada ? `Confirmar pagamento (${esc(b.forma_indicada)})` : 'Pago direto ao fornecedor (Pix, transferência…)'}</button>` : ''}
    ${podeCancelar() && b.etapa !== 'cancelado' ? `<button class="link-cancelar" type="button" data-acao="cancelar-boleto" data-id="${b.id}" style="align-self:flex-start">Cancelar este boleto</button>` : ''}
    <div class="field"><label>Histórico</label><div class="hist">${hist}</div></div>
  </aside></div>`;
}

registrarAcoes({
  'abrir-boleto': (el) => abrir(el.dataset.id),
  'fechar-painel': () => { estado.sel = null; desenhar(); },
  'editar-venc': () => {
    delete estado.rascunho['venc-novo']; delete estado.rascunho['venc-motivo'];
    estado.editandoVenc = true; desenhar(); document.getElementById('venc-novo')?.focus();
  },
  'cancelar-venc': () => { estado.editandoVenc = false; desenhar(); },
  'salvar-venc': () => executar(async () => {
    const nova = document.getElementById('venc-novo').value;
    if (!nova) throw new Error('Escolha a nova data de vencimento.');
    await estado.api.alterarVencimento(estado.sel, nova, document.getElementById('venc-motivo').value);
    estado.editandoVenc = false;
    await atualizar(`Vencimento alterado para ${dataBR(nova)}.`);
  }),
  'salvar-anotacao': () => executar(async () => {
    const campo = document.getElementById('anot');
    if (!campo.value.trim()) throw new Error('Escreva a anotação antes de salvar.');
    await estado.api.salvarAnotacao(estado.sel, campo.value);
    campo.value = '';
    await atualizar('Anotação salva.');
  }),
  'escolher-foto': () => document.getElementById('arquivo-foto').click(),
  'abrir-correcao': () => { estado.corrigindo = true; desenhar(); document.getElementById('just')?.focus(); },
  'cancelar-correcao': () => { estado.corrigindo = false; desenhar(); },
  'confirmar-correcao': () => executar(async () => {
    const b = boletoDe(estado.sel), motivo = document.getElementById('just').value;
    // boleto pago: a correção desfaz só o "Pago" (o visto continua)
    if (b.pago_em && b.etapa !== 'cancelado') await estado.api.desfazerPago(b.id, motivo);
    else await estado.api.corrigir(estado.sel, motivo);
    await atualizar('Marcação corrigida. A correção ficou registrada no histórico.');
  }),
});

// o botão "Desfazer" só libera com pelo menos 5 letras de motivo
registrarCampo('just', (el) => { document.getElementById('b-conf').disabled = el.value.trim().length < 5; });

registrarCampo('arquivo-foto', (el) => executar(async () => {
  const arq = el.files[0];
  if (!arq) return;
  if (arq.size > 5 * 1024 * 1024) throw new Error('Arquivo maior que 5 MB. Tire a foto com resolução menor.');
  await estado.api.enviarFoto(estado.sel, arq);
  await atualizar('Comprovante anexado.');
}));
