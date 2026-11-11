// =====================================================================
// DUPLICA · componentes/comuns.js
// Pedaços de tela usados em várias telas: aviso (toast), cabeçalho,
// faixa de filiais e etiquetas de etapa/prazo.
// =====================================================================
import { estado, notaDe } from '../nucleo/estado.js?v=fbcaef1';
import { NOME_ETAPA } from '../nucleo/regras.js?v=fbcaef1';
import { registrarAcoes } from '../nucleo/eventos.js?v=fbcaef1';
import { desenhar } from '../nucleo/desenhar.js?v=fbcaef1';
import { esc, diasAte, hojeExtenso } from '../util/formato.js?v=fbcaef1';
import { CONFIG } from '../config.js?v=fbcaef1';

/** Aviso no topo (sucesso em azul, erro em terracota) */
export function toastHtml() {
  const t = estado.toast;
  if (!t) return '';
  return `<div class="toast" role="${t.erro ? 'alert' : 'status'}" ${t.erro ? 'style="background:var(--alerta)"' : ''}>${esc(t.texto)}</div>`;
}

/** Título de cada tela */
export function cabecalho(sobretitulo, titulo, direita = '') {
  return `<div class="topo"><div><div class="eyebrow">${esc(sobretitulo)}</div><h1>${esc(titulo)}</h1></div>${direita}</div>`;
}

export const sobretituloHoje = (setor) => `${setor} · ${hojeExtenso()}`;

/** Como chamar o documento: "NF 123", "NFS 45", "Doc 9", "Conta fixa 11/2026" */
export function docNota(n) {
  const pre = { nfe: 'NF', servico: 'NFS', outro: 'Doc', recorrente: 'Conta fixa' }[n?.tipo || 'nfe'] || 'NF';
  return `${pre} ${esc(n?.numero || '')}`;
}

/** Etiqueta do tipo (não aparece para NF-e comum) */
export function pillTipo(n) {
  if (!n || !n.tipo || n.tipo === 'nfe') return '';
  const t = { servico: 'Serviço', outro: 'Avulso', recorrente: 'Conta fixa' }[n.tipo];
  return `<span class="pill p-tipo">${t}${n.descricao ? ' · ' + esc(n.descricao) : ''}</span>`;
}

/** Etiqueta da etapa: "Não chegou", "Chegou"... */
export const pillEtapa = (b) => b.pago_em && b.etapa !== 'cancelado'
  ? `<span class="pill p-pago">Pago${b.pago_forma && b.pago_forma !== 'Boleto' ? ' · ' + esc(b.pago_forma) : ''}</span>`
  : b.direto_financeiro
  ? `<span class="pill p-visto">Direto no financeiro · ${esc(b.direto_financeiro)}</span>`
  : `<span class="pill p-${b.etapa}">${NOME_ETAPA[b.etapa]}</span>`;

/** Etiqueta de prazo: "Venceu há 2 dias", "Vence amanhã"... (vazia se não for urgente) */
export function pillPrazo(b) {
  // pago ou cancelado: não tem prazo. Com visto e ainda não pago: o prazo importa para o Financeiro pagar.
  if (b.pago_em || b.etapa === 'cancelado') return '';
  if (!b.vencimento) return '<span class="pill p-breve">Falta informar vencimento</span>';
  const d = diasAte(b.vencimento);
  if (d < 0) return `<span class="pill p-vencido">Venceu há ${-d} ${d === -1 ? 'dia' : 'dias'}</span>`;
  if (d === 0) return '<span class="pill p-vencido">Vence hoje</span>';
  if (d <= CONFIG.DIAS_ATENCAO) return `<span class="pill p-breve">${d === 1 ? 'Vence amanhã' : `Vence em ${d} dias`}</span>`;
  return '';
}

/**
 * Faixa "Filial: Todas | Loja 1 (4) | Loja 2 (2)..."
 * @param lista  boletos usados para contar
 * @param rotulo explicação do número (ex.: "boletos em aberto")
 */
export function faixaFiliais(lista, rotulo) {
  const conta = (fid) => lista.filter((b) => notaDe(b.nota_id)?.filial_id === fid).length;
  const botoes = [{ id: 'todas', nome: 'Todas as filiais', n: lista.length },
    ...estado.filiais.map((f) => ({ id: f.id, nome: f.nome, n: conta(f.id) }))];
  return `<div class="filiais" role="group" aria-label="Filial"><span class="eyebrow">Filial</span>${
    botoes.map((f) => `<button type="button" data-acao="escolher-filial" data-id="${f.id}" aria-pressed="${estado.loja === f.id}">${esc(f.nome)}<span class="num">${f.n}</span></button>`).join('')
  }<span style="font-size:12px;color:var(--terra)">${esc(rotulo)}</span></div>`;
}

/** Mensagem de lista vazia dentro de uma seção */
export const vazio = (texto) => `<p style="margin:0;padding:28px 20px;color:var(--terra)">${esc(texto)}</p>`;

registrarAcoes({
  'escolher-filial': (el) => { estado.loja = el.dataset.id; desenhar(); },
});
