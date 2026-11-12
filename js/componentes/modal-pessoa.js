// =====================================================================
// DUPLICA · componentes/modal-pessoa.js
// Avançar a etapa de um ou vários boletos.
//   "Chegou"    → abre a janela para escolher QUEM RECEBEU
//   "Enviar"    → marca direto (não precisa escolher ninguém)
//   "Dar visto" → abre a janela para escolher QUEM ENTREGOU
//
// Botões que usam este arquivo:
//   data-acao="avancar"       data-id="<boleto>"
//   data-acao="avancar-lote"  data-nota="<nota>" data-etapa="esperado|chegou|enviado"
// =====================================================================
import { estado, boletoDe, notaDe, filialDe, pessoasAtivas } from '../nucleo/estado.js?v=eb710ef';
import { registrarAcoes, registrarCampo, avisar, executar } from '../nucleo/eventos.js?v=eb710ef';
import { desenhar, recarregar } from '../nucleo/desenhar.js?v=eb710ef';
import { docNota } from './comuns.js?v=eb710ef';
import { esc, brl, dataBR } from '../util/formato.js?v=eb710ef';
import { podeFiscal } from '../nucleo/regras.js?v=eb710ef';
import { modalAvulsoHtml, modalParcelasHtml } from './modal-avulso.js?v=eb710ef';
import { modalEditarPessoaHtml, modalMensagemAcessoHtml } from '../telas/usuarios.js?v=eb710ef';
import { modalFotosBoletoHtml } from '../telas/recebimento.js?v=eb710ef';
import { modalPagarHtml } from '../telas/financeiro.js?v=eb710ef';
import { modalRelatorioHtml } from './relatorio.js?v=eb710ef';

const ROTULO = { esperado: 'Chegou', chegou: 'Enviado ao financeiro', enviado: 'Visto do financeiro' };

/** Marca no banco e mostra o aviso */
function marcar(ids, pessoa) {
  return executar(async () => {
    const b0 = boletoDe(ids[0]);
    const etapaAntes = b0.etapa;
    const parcelas = ids.map((i) => { const b = boletoDe(i); return `${b.parcela}/${b.total_parcelas}`; }).join(', ');
    const fornecedor = notaDe(b0.nota_id).fornecedor;
    const n = await estado.api.avancar(ids, pessoa);
    estado.modal = null;
    await recarregar();
    const quem = pessoa ? (etapaAntes === 'esperado' ? `, recebido por ${pessoa}` : `, entregue por ${pessoa}`) : '';
    avisar(`${n > 1 ? `${n} boletos de ${fornecedor} (parcelas ${parcelas})` : `Parcela ${parcelas} de ${fornecedor}`}: “${ROTULO[etapaAntes]}”${quem}.`);
  });
}

/** Decide: abre a janela ou marca direto */
function iniciar(ids) {
  if (!ids.length) return;
  if (boletoDe(ids[0]).etapa === 'chegou') { marcar(ids); return; }
  estado.modal = { ids };
  desenhar();
  document.getElementById('quem')?.focus();
}

/** Janela "Chegou direto no financeiro": por onde chegou + quem entregou (se em mãos) */
function modalDiretoHtml(bs) {
  const b = bs[0], nota = notaDe(b.nota_id), filial = filialDe(nota.filial_id), varios = bs.length > 1;
  const total = bs.reduce((s, x) => s + Number(x.valor), 0);
  const opcoes = pessoasAtivas().map((p) => `<option value="${esc(p.nome)}">${esc(p.nome)} · ${p.setor}</option>`).join('');
  return `<div class="modal-fundo"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-t">
    <h2 id="m-t">${varios ? `Os ${bs.length} boletos chegaram direto aqui` : 'Boleto chegou direto aqui'}</h2>
    <p class="resumo"><b>${esc(nota.fornecedor)}</b> · ${esc(filial?.nome || '')}<br>${docNota(nota)} · ${varios
      ? `parcelas ${bs.map((x) => `${x.parcela}/${x.total_parcelas}`).join(', ')} · total <span class="num">${brl(total)}</span>`
      : `parcela ${b.parcela}/${b.total_parcelas} · <span class="num">${brl(b.valor)}</span> · vence ${dataBR(b.vencimento)}`}</p>
    <div class="field"><label for="origem">Por onde chegou</label>
      <select class="inp" id="origem"><option value="E-mail">E-mail do fornecedor</option><option value="DDA">DDA do banco</option><option value="Em mãos">Entregue em mãos</option></select></div>
    <div class="field" id="campo-quem" hidden><label for="quem">Entregue por</label><select class="inp" id="quem">${opcoes}</select></div>
    <span class="dica-campo">O boleto já fica com o visto e sai da lista de pendentes do Fiscal.</span>
    <div class="botoes">
      <button class="visto" type="button" data-acao="confirmar-direto" style="flex:1">Confirmar${varios ? ` os ${bs.length}` : ''}</button>
      <button class="bg" type="button" data-acao="fechar-modal" style="height:46px">Cancelar</button>
    </div>
  </div></div>`;
}

/** Janela "Cancelar": motivo obrigatório, para um boleto ou para a nota inteira */
function modalCancelarHtml(bs) {
  const b = bs[0], nota = notaDe(b.nota_id), filial = filialDe(nota.filial_id);
  const todosDaNota = estado.boletos.filter((x) => x.nota_id === nota.id && x.etapa !== 'cancelado').length === bs.length;
  const total = bs.reduce((s, x) => s + Number(x.valor), 0);
  const enviados = podeFiscal() ? bs.filter((x) => x.etapa === 'enviado').length : 0;
  const titulo = todosDaNota && bs.length > 1 ? `Cancelar a nota e os ${bs.length} boletos` : todosDaNota ? 'Cancelar a nota e o boleto' : 'Cancelar este boleto';
  return `<div class="modal-fundo"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-t">
    <h2 id="m-t">${titulo}</h2>
    <p class="resumo"><b>${esc(nota.fornecedor)}</b> · ${esc(filial?.nome || '')}<br>${docNota(nota)} · parcela${bs.length > 1 ? 's' : ''} ${bs.map((x) => `${x.parcela}/${x.total_parcelas}`).join(', ')} · <span class="num">${brl(total)}</span></p>
    <div class="field"><label for="motivo-canc">Motivo (obrigatório)</label>
      <textarea class="inp" id="motivo-canc" rows="3" placeholder="ex.: nota cancelada pelo fornecedor / mercadoria devolvida / parcela renegociada"></textarea></div>
    <span class="dica-campo">O boleto sai dos pendentes, do calendário e dos totais, mas fica no histórico. Dá para desfazer em “Corrigir marcação”.</span>
    <div class="botoes">
      <button class="bdanger" type="button" data-acao="confirmar-cancelar" id="b-canc" disabled style="flex:1;height:46px">Confirmar cancelamento</button>
      <button class="bg" type="button" data-acao="fechar-modal" style="height:46px">Voltar</button>
    </div>
    ${enviados ? `<div class="corrigir" style="display:flex;flex-direction:column;gap:8px">
      <small>Foi só enviado ao financeiro por engano? ${enviados > 1 ? `Os ${enviados} boletos voltam` : 'O boleto volta'} para <b>Chegou</b> (com o fiscal) e a nota não é cancelada. Usa o mesmo motivo de cima.</small>
      <button class="bg" type="button" data-acao="cancelar-envio" id="b-canc-envio" disabled style="height:42px;align-self:flex-start">Cancelar só o envio ao financeiro</button></div>` : ''}
  </div></div>`;
}

export function modalHtml() {
  if (!estado.modal) return '';
  if (estado.modal.tipo === 'avulso') return modalAvulsoHtml();
  if (estado.modal.tipo === 'editar-pessoa') return modalEditarPessoaHtml();
  if (estado.modal.tipo === 'mensagem-acesso') return modalMensagemAcessoHtml();
  if (estado.modal.tipo === 'fotos-boleto') return modalFotosBoletoHtml();
  if (estado.modal.tipo === 'pagar') return modalPagarHtml();
  if (estado.modal.tipo === 'relatorio') return modalRelatorioHtml();
  if (estado.modal.tipo === 'parcelas') return modalParcelasHtml();
  if (estado.modal.tipo === 'cancelar') return modalCancelarHtml(estado.modal.ids.map(boletoDe).filter(Boolean));
  if (estado.modal.tipo === 'direto') return modalDiretoHtml(estado.modal.ids.map(boletoDe).filter(Boolean));
  const bs = estado.modal.ids.map(boletoDe).filter(Boolean);
  if (!bs.length) return '';
  const b = bs[0], nota = notaDe(b.nota_id), filial = filialDe(nota.filial_id);
  const chegou = b.etapa === 'esperado', varios = bs.length > 1;
  const total = bs.reduce((s, x) => s + Number(x.valor), 0);

  // quem já vem escolhido: eu (no Chegou) ou quem enviou (no Visto)
  const padrao = chegou ? estado.perfil.nome : (b.enviado_por || '');
  const opcoes = pessoasAtivas().map((p) =>
    `<option value="${esc(p.nome)}"${p.nome === padrao ? ' selected' : ''}>${esc(p.nome)} · ${p.setor}</option>`).join('');

  const titulo = chegou
    ? (varios ? `Marcar os ${bs.length} boletos como chegou` : 'Marcar como chegou')
    : (varios ? `Dar visto nos ${bs.length} boletos` : 'Dar visto no boleto');
  const resumo = varios
    ? `parcelas ${bs.map((x) => `${x.parcela}/${x.total_parcelas}`).join(', ')} · total <span class="num">${brl(total)}</span>`
    : `parcela ${b.parcela}/${b.total_parcelas} · <span class="num">${brl(b.valor)}</span> · vence ${dataBR(b.vencimento)}`;

  return `<div class="modal-fundo"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-t">
    <h2 id="m-t">${titulo}</h2>
    <p class="resumo"><b>${esc(nota.fornecedor)}</b> · ${esc(filial?.nome || '')}<br>${docNota(nota)} · ${resumo}</p>
    <div class="field"><label for="quem">${chegou ? 'Recebido por' : 'Entregue por'}</label>
      <select class="inp" id="quem">${opcoes}</select>
      <span class="dica-campo">${chegou ? 'Quem recebeu o boleto do fornecedor ou do entregador.' : `Quem da empresa entregou ${varios ? 'estes boletos' : 'este boleto'} para você.`}</span>
    </div>
    <div class="botoes">
      <button class="${chegou ? 'bp' : 'visto'}" type="button" data-acao="confirmar-modal" style="flex:1">${chegou ? 'Confirmar chegada' : 'Confirmar visto'}${varios ? ` dos ${bs.length}` : ''}</button>
      <button class="bg" type="button" data-acao="fechar-modal" style="height:46px">Cancelar</button>
    </div>
  </div></div>`;
}

registrarAcoes({
  avancar: (el) => iniciar([el.dataset.id]),
  'avancar-lote': (el) => iniciar(
    estado.boletos.filter((b) => b.nota_id === el.dataset.nota && b.etapa === el.dataset.etapa)
      .sort((a, b) => a.parcela - b.parcela).map((b) => b.id)),
  'confirmar-modal': () => marcar(estado.modal.ids, document.getElementById('quem').value),
  'fechar-modal': () => { estado.modal = null; desenhar(); },

  // ---- chegou direto no financeiro (data-acao="direto" / "direto-lote")
  direto: (el) => { estado.modal = { ids: [el.dataset.id], tipo: 'direto' }; desenhar(); },
  'direto-lote': (el) => {
    const ids = estado.boletos.filter((b) => b.nota_id === el.dataset.nota && ['esperado', 'chegou'].includes(b.etapa))
      .sort((a, b) => a.parcela - b.parcela).map((b) => b.id);
    estado.modal = { ids, tipo: 'direto' }; desenhar();
  },
  'confirmar-direto': () => executar(async () => {
    const ids = estado.modal.ids, origem = document.getElementById('origem').value;
    const pessoa = origem === 'Em mãos' ? document.getElementById('quem').value : null;
    const b0 = boletoDe(ids[0]), fornecedor = notaDe(b0.nota_id).fornecedor;
    const n = await estado.api.receberDireto(ids, origem, pessoa);
    estado.modal = null;
    await recarregar();
    const como = origem === 'E-mail' ? 'por e-mail' : origem === 'DDA' ? 'pelo DDA' : `em mãos por ${pessoa}`;
    avisar(`${n > 1 ? `${n} boletos` : 'Boleto'} de ${fornecedor} recebido${n > 1 ? 's' : ''} direto no financeiro, ${como}. Já ${n > 1 ? 'estão' : 'está'} com visto.`);
  }),
});

// ---- cancelar boleto / nota
registrarAcoes({
  'cancelar-boleto': (el) => { estado.modal = { ids: [el.dataset.id], tipo: 'cancelar' }; desenhar(); document.getElementById('motivo-canc')?.focus(); },
  'cancelar-nota': (el) => {
    const ids = estado.boletos.filter((b) => b.nota_id === el.dataset.nota && b.etapa !== 'cancelado')
      .sort((a, b) => a.parcela - b.parcela).map((b) => b.id);
    estado.modal = { ids, tipo: 'cancelar' }; desenhar(); document.getElementById('motivo-canc')?.focus();
  },
  'confirmar-cancelar': () => executar(async () => {
    const ids = estado.modal.ids, motivo = document.getElementById('motivo-canc').value.trim();
    const fornecedor = notaDe(boletoDe(ids[0]).nota_id).fornecedor;
    const n = await estado.api.cancelar(ids, motivo);
    estado.modal = null;
    await recarregar();
    avisar(`${n > 1 ? `${n} boletos` : 'Boleto'} de ${fornecedor} cancelado${n > 1 ? 's' : ''}. Motivo: ${motivo}`);
  }),
});
registrarAcoes({
  // volta "Enviado ao financeiro" para "Chegou" (é a mesma correção do painel, com o motivo daqui)
  'cancelar-envio': () => executar(async () => {
    const motivo = document.getElementById('motivo-canc').value.trim();
    const bs = estado.modal.ids.map(boletoDe).filter((b) => b && b.etapa === 'enviado');
    const fornecedor = notaDe(bs[0].nota_id).fornecedor;
    for (const b of bs) await estado.api.corrigir(b.id, motivo);
    estado.modal = null;
    await recarregar();
    avisar(`Envio ao financeiro cancelado: ${bs.length > 1 ? `${bs.length} boletos` : 'boleto'} de ${fornecedor} voltou para Chegou.`);
  }),
});
registrarCampo('motivo-canc', (el) => {
  const curto = el.value.trim().length < 5;
  document.getElementById('b-canc').disabled = curto;
  const e = document.getElementById('b-canc-envio'); if (e) e.disabled = curto;
});

// mostra "Entregue por" só quando a opção é "Em mãos"
registrarCampo('origem', (el) => { document.getElementById('campo-quem').hidden = el.value !== 'Em mãos'; });
