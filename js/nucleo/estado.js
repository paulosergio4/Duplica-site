// =====================================================================
// DUPLICA · nucleo/estado.js
// Tudo que está na tela vem deste objeto "estado". As telas LEEM daqui;
// as ações MUDAM aqui e depois chamam render() para redesenhar.
// =====================================================================
import { hojeISO, diasAte } from '../util/formato.js?v=7c22e1d';
import { CONFIG } from '../config.js?v=7c22e1d';

export const estado = {
  api: null,          // funções de dados (demo ou Supabase) – ver servicos/api.js

  // dados vindos do banco
  perfil: null,       // quem está logado
  empresa: null,
  filiais: [],
  perfis: [],
  notas: [],
  boletos: [],
  recorrencias: [],   // contas fixas
  recebimentos: [],   // notas bipadas hoje no recebimento
  impMes: 0,          // Contabilidade: 0 = este mês, 1 = mês que vem, -1 = mês passado
  recFiltro: 'falta', // Recebimento de mercadoria: 'falta' | 'chegou' | 'finalizadas' | 'todas' (conferente: 'finalizadas' ou o resto = abertas)
  recBusca: '',
  ultimoRecebimento: null, // resultado da última nota bipada nesta tela

  // escolhas da pessoa na tela
  tela: 'fiscal',     // id da tela aberta (ver telas/index.js)
  filtro: 'todos',    // filtro de etapa no Fiscal
  busca: '',
  loja: 'todas',      // id da filial escolhida no filtro, ou 'todas'
  sel: null,          // id do boleto aberto no painel de detalhes
  hist: null,         // histórico do boleto aberto (carregado sob demanda)
  fotoUrl: null,      // link temporário da foto do boleto aberto
  corrigindo: false,
  editandoVenc: false,
  leitura: null,       // resultado do campo "Ler boleto" { tela, texto, res } // painel de detalhes: editando o vencimento?
  modal: null,        // janela aberta: { ids: [...] }
  menuAberto: false,  // menu aberto na tela estreita (celular)
  editandoFilial: null, // id da filial com o nome em edição
  editandoConta: null,  // id da conta fixa em edição
  emissaoDe: '',      // filtro de data de emissão no Fiscal (aaaa-mm-dd)
  emissaoAte: '',
  ordemFin: 'chegada', // aba do Financeiro: 'chegada' ou 'vencimento'
  toast: null,        // aviso no topo: { texto, erro }
  resultadoImport: null,
  calAno: new Date().getFullYear(),
  calMes: new Date().getMonth(),
  calDia: hojeISO(),
  rascunho: {},       // o que a pessoa digitou nos formulários (não se perde ao redesenhar)
  erroForm: {},       // mensagens de erro por formulário
};

// ------------------------- consultas rápidas -------------------------
export const notaDe = (id) => estado.notas.find((n) => n.id === id);
export const filialDe = (id) => estado.filiais.find((f) => f.id === id);
export const boletoDe = (id) => estado.boletos.find((b) => b.id === id);
export const filialDoBoleto = (b) => filialDe(notaDe(b.nota_id)?.filial_id);

/** O boleto está na filial escolhida no filtro? */
export const naLoja = (b) => estado.loja === 'todas' || notaDe(b.nota_id)?.filial_id === estado.loja;

/** Não chegou e vence em até N dias (ou já venceu) */
export const precisaAtencao = (b) => b.etapa === 'esperado' && (!b.vencimento || diasAte(b.vencimento) <= CONFIG.DIAS_ATENCAO);

/** Pessoas ativas (para escolher "recebido por" / "entregue por") */
export const pessoasAtivas = () => estado.perfis.filter((p) => p.ativo);

export const ordenarPorVencimento = (a, b) => {
  const va = a.vencimento || '0000', vb = b.vencimento || '0000';   // sem vencimento vem primeiro
  return va < vb ? -1 : va > vb ? 1 : a.parcela - b.parcela;
};
