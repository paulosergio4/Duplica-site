// =====================================================================
// DUPLICA · servicos/api-demo.js
// MODO DEMONSTRAÇÃO: imita o banco usando o navegador (localStorage).
// Serve para testar as telas sem Supabase. Os dados são de exemplo.
// As regras de permissão aqui são as MESMAS do banco (sql/02_funcoes.sql).
//
// Lista de funções da API (a versão Supabase tem as mesmas):
//   entrar(empresa, usuario, senha)   sair()          sessao()
//   trocarSenha(nova)                 carregarTudo()  historico(boletoId)
//   importarNota(dados)               avancar(ids, pessoa)            receberDireto(ids, origem, pessoa)
//   corrigir(id, motivo)              salvarAnotacao(id, texto)       cancelar(ids, motivo)
//   enviarFoto(id, arquivo)           urlFoto(caminho)
//   criarUsuario(dados)               atualizarPessoa(id, mudancas)     editarUsuario(dados)
//   salvarFilial(nome, cnpj)          renomearFilial(id, novoNome)
//   lancarAvulso(dados)               salvarRecorrencia(dados)        gerarRecorrentes()
// =====================================================================
import { soDigitos, normalizarLogin } from '../util/formato.js?v=543c57a';
import { dvChave } from '../util/chave.js?v=543c57a';

const CHAVE = 'duplica-demo-v1';
const SESSAO = 'duplica-demo-sessao';
const id = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

/** Data daqui a N dias (para os exemplos ficarem sempre "atuais") */
function emDias(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const agora = () => new Date().toISOString();
const fotosDemo = new Map();   // fotos de boleto (só na memória)

// ------------------------- dados de exemplo -------------------------
function dadosIniciais() {
  const emp = { id: 'emp1', nome: 'Supermercado São Luiz', codigo: 'saoluiz', cidade: 'Pompéu – MG', recebimento_desde: emDias(-12) };
  const filiais = [
    ['Loja 1 · CD', '25123899000160'], ['Loja 2 · MV', '25123899000241'], ['Loja 3 · Matriz', '25123899000322'],
    ['Loja 4 · MD', '25123899000403'], ['Loja 5 · Populares', '25123899000594'], ['Loja 6', null],
  ].map(([nome, cnpj], i) => ({ id: 'f' + (i + 1), nome, cnpj, ordem: i + 1 }));

  const perfis = [
    ['paulo', 'Paulo Sérgio', 'Fiscal', 'gerente', false],
    ['rafaela', 'Rafaela', 'Financeiro', 'admin_setor', false],
    ['lucia', 'Lúcia (exemplo)', 'Financeiro', 'usuario', false],
    ['maria', 'Maria (exemplo)', 'Fiscal', 'usuario', false],
    ['joao', 'João (exemplo)', 'Fiscal', 'usuario', true],
    ['carlos', 'Carlos (exemplo)', 'Recebimento', 'usuario', false],
  ].map(([usuario, nome, setor, papel, pendente]) =>
    ({ id: 'u-' + usuario, usuario, nome, setor, papel, pendente, ativo: true, senha: '123456' }));

  const notas = [], boletos = [], historico = [];
  // [numero, fornecedor, filial, [ [diasParaVencer, valor, etapa], ... ]]
  const exemplo = [
    ['48213', 'Laticínios Serra Azul', 'f3', [[-2, 1620, 'visto'], [12, 1620, 'chegou'], [26, 1620, 'esperado']]],
    ['9921', 'Distribuidora Vale Verde', 'f2', [[-1, 1159.2, 'esperado'], [13, 1159.2, 'esperado']]],
    ['157430', 'Bebidas Rio Pará', 'f1', [[2, 3235, 'enviado'], [16, 3235, 'chegou'], [30, 3235, 'chegou'], [44, 3235, 'chegou']]],
    ['3307', 'Panificadora Trigo Bom', 'f5', [[3, 845.9, 'esperado']]],
    ['77102', 'Higiene Total Atacado', 'f4', [[4, 1575, 'enviado'], [34, 1575, 'esperado']]],
    ['210554', 'Refrigerantes Vale do Pará', 'f6', [[11, 1800, 'esperado'], [25, 1800, 'esperado'], [39, 1800, 'esperado']]],
    ['210561', 'Refrigerantes Vale do Pará', 'f3', [[11, 2400, 'enviado'], [25, 2400, 'enviado'], [39, 2400, 'enviado']]],
  ];
  exemplo.forEach(([numero, fornecedor, filial_id, parcelas], k) => {
    const base = ('3126' + '11' + String(k + 1).padStart(14, '0') + '55001' + numero.padStart(9, '0') + '1' + '12345678').slice(0, 43);
    const nota = { id: 'n' + k, filial_id, numero, serie: '1', fornecedor, chave: base + dvChave(base),
      emissao: emDias(-4 - k * 3), valor: parcelas.reduce((s, p) => s + p[1], 0) };
    notas.push(nota);
    parcelas.forEach(([dias, valor, etapa], i) => {
      const b = { id: `b${k}-${i}`, nota_id: nota.id, parcela: i + 1, total_parcelas: parcelas.length,
        vencimento: emDias(dias), valor, etapa, anotacao: null, foto_path: null };
      if (etapa !== 'esperado') Object.assign(b, { recebido_por: 'Maria (exemplo)', chegou_marcado_por: 'Paulo Sérgio', chegou_em: agora() });
      if (etapa === 'enviado' || etapa === 'visto') Object.assign(b, { enviado_por: 'Paulo Sérgio', enviado_em: agora() });
      if (etapa === 'visto') Object.assign(b, { entregue_por: 'Paulo Sérgio', visto_por: 'Rafaela', visto_em: agora() });
      boletos.push(b);
      if (b.chegou_em) historico.push({ boleto_id: b.id, acao: 'Chegou', detalhe: 'recebido por Maria (exemplo)', feito_por_nome: 'Paulo Sérgio', feito_em: agora() });
      if (b.enviado_em) historico.push({ boleto_id: b.id, acao: 'Enviado ao financeiro', detalhe: null, feito_por_nome: 'Paulo Sérgio', feito_em: agora() });
      if (b.visto_em) historico.push({ boleto_id: b.id, acao: 'Visto do financeiro', detalhe: 'entregue por Paulo Sérgio', feito_por_nome: 'Rafaela', feito_em: agora() });
    });
  });
  return { empresa: emp, filiais, perfis, notas, boletos, historico, recorrencias: [], geradas: {} };
}

// ------------------------- guardar / ler ----------------------------
let db = null;
function carregar() {
  if (db) return db;
  try { db = JSON.parse(localStorage.getItem(CHAVE)); } catch { db = null; }
  if (!db) { db = dadosIniciais(); salvar(); }
  return db;
}
function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(db)); } catch { /* sem storage: fica só na memória */ } }
function eu() {
  let uid = null;
  try { uid = sessionStorage.getItem(SESSAO); } catch { /* ignore */ }
  const p = carregar().perfis.find((x) => x.id === uid);
  if (!p) throw new Error('Faça login novamente.');
  if (!p.ativo) throw new Error('Seu acesso foi desativado. Fale com o gerente.');
  return p;
}
const semSenha = ({ senha, ...resto }) => resto;
let ouvintes = [];           // demo: avisos de "nota bipada" (no Supabase é o Realtime)
const fotosNaMemoria = {}; // no modo demo a foto não é salva de verdade

// ------------------------------ API ---------------------------------
export const apiDemo = {
  demo: true,

  async entrar(empresa, usuario, senha) {
    const d = carregar();
    if (normalizarLogin(empresa).replace(/[._-]/g, '') !== d.empresa.codigo) throw new Error('Empresa não encontrada. No exemplo, use "saoluiz".');
    const p = d.perfis.find((x) => x.usuario === normalizarLogin(usuario));
    if (!p || (!p.pendente && p.senha !== senha && senha !== '123456')) throw new Error('Usuário ou senha incorretos.');
    if (!p.ativo) throw new Error('Este acesso foi desativado. Fale com o gerente.');
    try { sessionStorage.setItem(SESSAO, p.id); } catch { /* ignore */ }
    return semSenha(p);
  },

  async sair() { try { sessionStorage.removeItem(SESSAO); } catch { /* ignore */ } },

  async sessao() {
    try { return { perfil: semSenha(eu()), empresa: carregar().empresa }; } catch { return null; }
  },

  async trocarSenha(nova) {
    const p = eu();
    if (nova.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
    p.senha = nova; p.pendente = false; salvar();
  },

  async carregarTudo() {
    eu();
    const d = carregar();
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0); hoje.setDate(hoje.getDate() - 45);
    const recebimentos = (d.recebimentos || []).filter((r) => new Date(r.feito_em) >= hoje).sort((a, b) => (a.feito_em < b.feito_em ? 1 : -1));
    return { empresa: d.empresa, filiais: d.filiais, perfis: d.perfis.map(semSenha), notas: d.notas, boletos: d.boletos, recorrencias: d.recorrencias || [], recebimentos };   // (no demo, notas já traz as sem boleto)
  },

  async relatorio(de, ate, campo = 'vencimento') {
    eu();
    const d = carregar();
    return d.boletos.map((b) => ({ ...b, nota: d.notas.find((n) => n.id === b.nota_id) }))
      .filter((b) => { const v = campo === 'emissao' ? b.nota?.emissao : b.vencimento; return v && v >= de && v <= ate; })
      .sort((a, b) => ((a.vencimento || '') < (b.vencimento || '') ? -1 : 1));
  },

  async historico(boletoId) {
    return carregar().historico.filter((h) => h.boleto_id === boletoId).sort((a, b) => (a.feito_em < b.feito_em ? -1 : 1));
  },

  async importarNota(dados) {
    const p = eu(), d = carregar();
    if (!(p.papel === 'gerente' || p.setor === 'Fiscal')) throw new Error('Só o Fiscal pode adicionar XML.');
    if (d.notas.some((n) => n.chave === dados.chave)) return 'duplicada';
    const filial = d.filiais.find((f) => f.cnpj && f.cnpj === soDigitos(dados.dest_cnpj));
    if (!filial) return 'filial_desconhecida';
    const nota = { id: id(), filial_id: filial.id, numero: dados.numero, serie: dados.serie, fornecedor: dados.fornecedor,
      chave: dados.chave, emissao: dados.emissao, valor: dados.valor };
    d.notas.push(nota);
    if (!dados.duplicatas.length && !dados.pagamento_boleto) {   // sem boleto: guardada só para o recebimento bipar
      (d.recebimentos || []).filter((r) => r.chave === nota.chave && r.situacao === 'pendente').forEach((r) => Object.assign(r, { situacao: 'casada', nota_id: nota.id }));
      salvar();
      return 'importada_sem_boleto';
    }
    if (!dados.duplicatas.length) {   // paga por boleto, mas o XML não trouxe as parcelas
      d.boletos.push({ id: id(), nota_id: nota.id, parcela: 1, total_parcelas: 1, vencimento: null,
        valor: dados.valor_pagamento || dados.valor, etapa: 'esperado', anotacao: null, foto_path: null });
      salvar();
      return 'importada_sem_vencimento';
    }
    [...dados.duplicatas].sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1)).forEach((dup, i, arr) => {
      d.boletos.push({ id: id(), nota_id: nota.id, parcela: i + 1, total_parcelas: arr.length, numero_dup: dup.numero,
        vencimento: dup.vencimento, valor: dup.valor, etapa: 'esperado', anotacao: null, foto_path: null });
    });
    salvar();
    return 'importada';
  },

  async avancar(ids, pessoa) {
    const p = eu(), d = carregar();
    let n = 0;
    for (const b of d.boletos.filter((x) => ids.includes(x.id))) {
      if (b.etapa === 'esperado') {
        if (!(p.papel === 'gerente' || p.setor === 'Fiscal')) throw new Error('Só o Fiscal marca "Chegou".');
        Object.assign(b, { etapa: 'chegou', recebido_por: pessoa, chegou_marcado_por: p.nome, chegou_em: agora() });
        reg(b.id, 'Chegou', 'recebido por ' + pessoa, p);
      } else if (b.etapa === 'chegou') {
        if (!(p.papel === 'gerente' || p.setor === 'Fiscal')) throw new Error('Só o Fiscal envia ao financeiro.');
        Object.assign(b, { etapa: 'enviado', enviado_por: p.nome, enviado_em: agora() });
        reg(b.id, 'Enviado ao financeiro', null, p);
      } else if (b.etapa === 'enviado') {
        if (!(p.papel === 'gerente' || p.setor === 'Financeiro')) throw new Error('Só o Financeiro dá o visto.');
        Object.assign(b, { etapa: 'visto', entregue_por: pessoa, visto_por: p.nome, visto_em: agora() });
        reg(b.id, 'Visto do financeiro', 'entregue por ' + pessoa, p);
      } else continue;
      n++;
    }
    salvar();
    return n;
  },

  async receberDireto(ids, origem, pessoa) {
    const p = eu(), d = carregar();
    if (!(p.papel === 'gerente' || p.setor === 'Financeiro')) throw new Error('Só o Financeiro marca boleto que chegou direto.');
    if (!['E-mail', 'DDA', 'Em mãos'].includes(origem)) throw new Error('Escolha por onde o boleto chegou.');
    if (origem === 'Em mãos' && !pessoa) throw new Error('Informe quem entregou o boleto.');
    const detalhe = origem === 'E-mail' ? 'por e-mail' : origem === 'DDA' ? 'pelo DDA' : 'entregue em mãos por ' + pessoa;
    let n = 0;
    for (const b of d.boletos.filter((x) => ids.includes(x.id) && ['esperado', 'chegou'].includes(x.etapa))) {
      Object.assign(b, { etapa: 'visto', direto_financeiro: origem, entregue_por: origem === 'Em mãos' ? pessoa : null, visto_por: p.nome, visto_em: agora() });
      reg(b.id, 'Recebido direto pelo financeiro', detalhe, p);
      n++;
    }
    salvar();
    return n;
  },

  async receberNota(chave, manual = false) {
    const p = eu(), d = carregar();
    if (!(p.papel === 'gerente' || ['Fiscal', 'Recebimento'].includes(p.setor))) throw new Error('Só o Recebimento ou o Fiscal recebem notas.');
    const c = String(chave).replace(/\D/g, '');
    if (c.length !== 44) throw new Error(`Li ${c.length} números. A chave da nota tem 44: bipe o código de barras da DANFE.`);
    d.recebimentos = d.recebimentos || [];
    const n = d.notas.find((x) => x.chave === c);
    const novo = (extra) => { const r = { id: id(), chave: c, perfil_id: p.id, nome: p.nome, boletos: 0, situacao: 'casada', feito_em: agora(), nota_id: null, tem_boleto: null, fotos: [], manual, ...extra }; d.recebimentos.push(r); salvar(); ouvintes.forEach((f) => setTimeout(() => f(r, false), 300)); return r; };
    if (!n) {
      const ja = d.recebimentos.find((r) => r.chave === c && r.situacao === 'pendente');
      if (ja) return { situacao: 'repetida', recebimento_id: ja.id, tem_boleto: ja.tem_boleto, recebido_por: ja.nome, recebido_em: ja.feito_em };
      return { situacao: 'pendente', recebimento_id: novo({ situacao: 'pendente' }).id };
    }
    const f = d.filiais.find((x) => x.id === n.filial_id);
    const base = { nota_id: n.id, fornecedor: n.fornecedor, numero: n.numero, filial: f?.nome, esperados: d.boletos.filter((b) => b.nota_id === n.id && b.etapa === 'esperado').length };
    const ja = d.recebimentos.find((r) => r.nota_id === n.id && r.situacao === 'casada');
    if (ja) return { situacao: 'ja', recebimento_id: ja.id, tem_boleto: ja.tem_boleto, recebido_por: ja.nome, recebido_em: ja.feito_em, ...base };
    return { situacao: 'casada', recebimento_id: novo({ nota_id: n.id }).id, ...base };
  },

  async enviarFotoBoleto(recebimentoId, blob) {
    const caminho = `demo/${recebimentoId}-${Date.now()}.jpg`;
    fotosDemo.set(caminho, URL.createObjectURL(blob));
    return caminho;
  },

  async recebimentoBoleto(idRec, tem, fotos = []) {
    const p = eu(), d = carregar();
    const r = (d.recebimentos || []).find((x) => x.id === idRec);
    if (!r) throw new Error('Recebimento não encontrado.');
    if (!tem) { if (r.tem_boleto == null) r.tem_boleto = false; salvar(); return { marcados: 0 }; }
    let marcados = 0;
    for (const b of d.boletos.filter((x) => r.nota_id && x.nota_id === r.nota_id && x.etapa === 'esperado')) {
      Object.assign(b, { etapa: 'chegou', recebido_por: p.nome, chegou_marcado_por: p.nome, chegou_em: agora() });
      reg(b.id, 'Chegou', 'boleto recebido junto com a nota por ' + p.nome + (fotos.length ? ' (foto anexada)' : ''), p);
      marcados++;
    }
    Object.assign(r, { tem_boleto: true, fotos: [...(r.fotos || []), ...fotos], boletos: (r.boletos || 0) + marcados });
    salvar();
    ouvintes.forEach((f) => setTimeout(() => f(r, true), 300));
    return { marcados };
  },

  async urlFotoBoleto(caminho) {
    if (!fotosDemo.has(caminho)) throw new Error('No modo demonstração a foto some quando a página é recarregada.');
    return fotosDemo.get(caminho);
  },

  ouvirRecebimentos(aoReceber) { ouvintes.push(aoReceber); return () => { ouvintes = ouvintes.filter((f) => f !== aoReceber); }; },

  async cadastrarEmpresa() {
    throw new Error('No modo demonstração não dá para criar conta. Use o endereço oficial do Duplica.');
  },

  async lancarAvulso(dados) {
    const p = eu(), d = carregar();
    if (!(p.papel === 'gerente' || ['Fiscal', 'Financeiro', 'Contabilidade'].includes(p.setor))) throw new Error('Só Fiscal, Financeiro ou Contabilidade lançam boleto avulso.');
    const nota = { id: id(), filial_id: dados.filial_id, tipo: dados.tipo, numero: dados.numero, fornecedor: dados.fornecedor,
      fornecedor_cnpj: soDigitos(dados.fornecedor_cnpj) || null, descricao: dados.descricao || null, chave: null,
      emissao: dados.emissao || new Date().toISOString().slice(0, 10), valor: dados.parcelas.reduce((s, x) => s + x.valor, 0) };
    d.notas.push(nota);
    [...dados.parcelas].sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1)).forEach((x, i, arr) => d.boletos.push({
      id: id(), nota_id: nota.id, parcela: i + 1, total_parcelas: arr.length, vencimento: x.vencimento, valor: x.valor,
      etapa: 'esperado', anotacao: null, foto_path: null }));
    salvar();
    return nota.id;
  },

  async definirParcelas(notaId, parcelas) {
    const p = eu(), d = carregar();
    if (!(p.papel === 'gerente' || ['Fiscal', 'Financeiro'].includes(p.setor))) throw new Error('Só Fiscal ou Financeiro informam parcelas.');
    if (d.boletos.some((b) => b.nota_id === notaId && b.etapa !== 'esperado')) throw new Error('Algum boleto desta nota já foi marcado. Corrija a marcação antes de mudar as parcelas.');
    d.boletos = d.boletos.filter((b) => b.nota_id !== notaId);
    [...parcelas].sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1)).forEach((x, i, arr) => {
      const b = { id: id(), nota_id: notaId, parcela: i + 1, total_parcelas: arr.length, vencimento: x.vencimento, valor: x.valor, etapa: 'esperado', anotacao: null, foto_path: null };
      d.boletos.push(b);
      reg(b.id, 'Parcelas informadas', `pelo boleto em papel: ${arr.length} parcela(s)`, p);
    });
    salvar();
    return parcelas.length;
  },

  async salvarRecorrencia(dados) {
    const p = eu(), d = carregar();
    if (!(p.papel === 'gerente' || ['Fiscal', 'Financeiro'].includes(p.setor))) throw new Error('Só Fiscal ou Financeiro cuidam das contas fixas.');
    d.recorrencias = d.recorrencias || [];
    const campos = { filial_id: dados.filial_id, fornecedor: dados.fornecedor, fornecedor_cnpj: soDigitos(dados.fornecedor_cnpj) || null,
      descricao: dados.descricao, valor: Number(dados.valor), dia: Number(dados.dia) };
    if (dados.id) Object.assign(d.recorrencias.find((r) => r.id === dados.id), campos, dados.ativa === undefined ? {} : { ativa: dados.ativa });
    else d.recorrencias.push({ id: id(), ...campos, ativa: true, inicio: new Date().toISOString().slice(0, 10), criado_por: p.nome });
    salvar();
  },

  async gerarRecorrentes() {
    eu();
    const d = carregar();
    d.geradas = d.geradas || {};
    const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
    // só o mês corrente: o boleto do mês que vem aparece quando o mês virar
    const limite = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 12);
    const iso = (x) => x.toISOString().slice(0, 10);
    let n = 0;
    for (const r of (d.recorrencias || []).filter((x) => x.ativa)) {
      const inicio = new Date(r.inicio + 'T12:00:00');
      let mes = new Date(Math.max(inicio, hoje)); mes.setDate(1);
      while (mes <= limite) {
        const ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0, 12).getDate();
        const venc = new Date(mes.getFullYear(), mes.getMonth(), Math.min(r.dia, ultimo), 12);
        const comp = `${r.id}|${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`;
        if (venc >= inicio && venc <= limite && !d.geradas[comp]) {
          const nota = { id: id(), filial_id: r.filial_id, tipo: 'recorrente', numero: `${String(mes.getMonth() + 1).padStart(2, '0')}/${mes.getFullYear()}`,
            fornecedor: r.fornecedor, fornecedor_cnpj: r.fornecedor_cnpj, descricao: r.descricao, chave: null, emissao: iso(hoje), valor: r.valor };
          d.notas.push(nota);
          d.boletos.push({ id: id(), nota_id: nota.id, parcela: 1, total_parcelas: 1, vencimento: iso(venc), valor: r.valor, etapa: 'esperado', anotacao: null, foto_path: null });
          d.geradas[comp] = nota.id; n++;
        }
        mes = new Date(mes.getFullYear(), mes.getMonth() + 1, 1, 12);
      }
    }
    salvar();
    return n;
  },

  async cancelar(ids, motivo) {
    const p = eu(), d = carregar();
    if (!(p.papel === 'gerente' || p.setor === 'Fiscal')) throw new Error('Só o Fiscal cancela boletos.');
    if (!motivo || motivo.trim().length < 5) throw new Error('Escreva o motivo do cancelamento.');
    let n = 0;
    for (const b of d.boletos.filter((x) => ids.includes(x.id) && x.etapa !== 'cancelado')) {
      Object.assign(b, { forma_indicada: null, forma_indicada_obs: null, etapa_antes_cancelar: b.etapa, etapa: 'cancelado', cancelado_por: p.nome, cancelado_em: agora(), cancelado_motivo: motivo.trim() });
      reg(b.id, 'Cancelado', motivo.trim(), p);
      n++;
    }
    salvar();
    return n;
  },

  async marcarPago(ids, forma = 'Boleto', obs = null) {
    const p = eu(), d = carregar();
    if (!(p.papel === 'gerente' || p.setor === 'Financeiro')) throw new Error('Só o Financeiro marca boleto como pago.');
    if (forma === 'Outro' && !(obs || '').trim()) throw new Error('Em "Outro", escreva como foi pago.');
    const det = [forma === 'Boleto' ? null : `pago direto ao fornecedor por ${forma}`, (obs || '').trim() || null].filter(Boolean).join(' · ') || null;
    let n = 0;
    for (const b of d.boletos.filter((x) => ids.includes(x.id) && !x.pago_em && x.etapa !== 'cancelado')) {
      if (forma === 'Boleto' && b.etapa !== 'visto') throw new Error('Dê o visto antes de marcar como pago no boleto. Se foi pago por Pix ou transferência, escolha essa forma.');
      if (b.etapa === 'visto') Object.assign(b, { pago_em: agora(), pago_por: p.nome, pago_forma: forma, etapa_antes_pago: null });
      else Object.assign(b, { pago_em: agora(), pago_por: p.nome, pago_forma: forma, etapa_antes_pago: b.etapa, etapa: 'visto', direto_financeiro: forma, visto_por: p.nome, visto_em: agora() });
      reg(b.id, 'Pago', det, p);
      n++;
    }
    salvar();
    return n;
  },

  async fiscalPago(ids, forma, obs = null) {
    const p = eu(), d = carregar();
    if (!(p.papel === 'gerente' || p.setor === 'Fiscal')) throw new Error('Só o Fiscal usa esta opção.');
    if (!['Cheque', 'Pix', 'Transferência', 'Dinheiro', 'Outro'].includes(forma)) throw new Error('Escolha como foi pago.');
    if (forma === 'Outro' && !(obs || '').trim()) throw new Error('Em "Outro", escreva como foi pago.');
    const det = [`marcado como pago por ${forma} (o Financeiro confirma)`, (obs || '').trim() || null].filter(Boolean).join(' · ');
    let n = 0;
    for (const b of d.boletos.filter((x) => ids.includes(x.id) && !x.pago_em && ['esperado', 'chegou'].includes(x.etapa))) {
      Object.assign(b, { etapa: 'enviado', enviado_por: p.nome, enviado_em: agora(), forma_indicada: forma, forma_indicada_obs: (obs || '').trim() || null });
      reg(b.id, 'Enviado ao financeiro', det, p);
      n++;
    }
    if (!n) throw new Error('Nenhum boleto pôde ser marcado (já foi enviado, pago ou cancelado).');
    salvar();
    return n;
  },

  async desfazerPago(boletoId, motivo) {
    const p = eu(), b = carregar().boletos.find((x) => x.id === boletoId);
    if (!(p.papel === 'gerente' || p.setor === 'Financeiro' || (p.setor === 'Fiscal' && b.etapa === 'enviado'))) throw new Error('Só o Financeiro desfaz o pagamento.');
    if (!motivo || motivo.trim().length < 5) throw new Error('Escreva o motivo da correção.');
    if (b.etapa_antes_pago) {
      const voltaFiscal = ['esperado', 'chegou'].includes(b.etapa_antes_pago);
      Object.assign(b, { etapa: b.etapa_antes_pago, direto_financeiro: null, visto_por: null, visto_em: null, entregue_por: null,
        ...(voltaFiscal ? { enviado_por: null, enviado_em: null } : {}) });
    }
    Object.assign(b, { pago_em: null, pago_por: null, pago_forma: null, etapa_antes_pago: null });
    reg(b.id, 'Corrigido', `desfez "Pago". Motivo: ${motivo.trim()}`, p);
    salvar();
  },

  async corrigir(boletoId, motivo) {
    const p = eu(), b = carregar().boletos.find((x) => x.id === boletoId);
    if (!motivo || motivo.trim().length < 5) throw new Error('Escreva o motivo da correção.');
    const nomes = { chegou: 'Chegou', enviado: 'Enviado ao financeiro', visto: 'Visto do financeiro' };
    if (['chegou', 'enviado'].includes(b.etapa) && !(p.papel === 'gerente' || p.setor === 'Fiscal')) throw new Error('Só o Fiscal corrige esta etapa.');
    if (b.etapa === 'visto' && !(p.papel === 'gerente' || p.setor === 'Financeiro')) throw new Error('Só o Financeiro corrige o visto.');
    if (b.etapa === 'cancelado') {
      if (!(p.papel === 'gerente' || p.setor === 'Fiscal')) throw new Error('Só o Fiscal desfaz cancelamento.');
      reg(b.id, 'Corrigido', `desfez "Cancelado". Motivo: ${motivo.trim()}`, p);
      Object.assign(b, { etapa: b.etapa_antes_cancelar || 'esperado', etapa_antes_cancelar: null, cancelado_por: null, cancelado_em: null, cancelado_motivo: null });
      salvar();
      return;
    }
    if (b.direto_financeiro) {
      reg(b.id, 'Corrigido', `desfez "Recebido direto pelo financeiro". Motivo: ${motivo.trim()}`, p);
      Object.assign(b, { etapa: b.chegou_em ? 'chegou' : 'esperado', direto_financeiro: null, entregue_por: null, visto_por: null, visto_em: null });
      salvar();
      return;
    }
    reg(b.id, 'Corrigido', `desfez "${nomes[b.etapa]}". Motivo: ${motivo.trim()}`, p);
    if (b.etapa === 'chegou') Object.assign(b, { etapa: 'esperado', recebido_por: null, chegou_marcado_por: null, chegou_em: null });
    else if (b.etapa === 'enviado') Object.assign(b, { etapa: 'chegou', enviado_por: null, enviado_em: null, forma_indicada: null, forma_indicada_obs: null });
    else if (b.etapa === 'visto') Object.assign(b, { etapa: 'enviado', entregue_por: null, visto_por: null, visto_em: null });
    salvar();
  },

  async vincularCodigo(boletoId, barras, linha, venc) {
    const p = eu(), d = carregar(), b = d.boletos.find((x) => x.id === boletoId);
    if (!(p.papel === 'gerente' || ['Fiscal', 'Financeiro'].includes(p.setor))) throw new Error('Só Fiscal ou Financeiro leem o código do boleto.');
    if (b.codigo_barras === barras) return;
    const outro = d.boletos.find((x) => x.codigo_barras === barras && x.id !== b.id);
    if (outro) throw new Error('Esse código já foi lido em outro boleto.');
    const preencheu = !b.vencimento && venc;
    Object.assign(b, { codigo_barras: barras, linha_digitavel: linha, vencimento: b.vencimento || venc || null });
    reg(b.id, 'Código do boleto lido', preencheu ? `vencimento preenchido: ${venc.split('-').reverse().join('/')}` : null, p);
    salvar();
  },

  async alterarVencimento(boletoId, nova, motivo) {
    const p = eu(), b = carregar().boletos.find((x) => x.id === boletoId);
    if (!(p.papel === 'gerente' || ['Fiscal', 'Financeiro'].includes(p.setor))) throw new Error('Só Fiscal ou Financeiro alteram o vencimento.');
    if (!nova) throw new Error('Informe a nova data de vencimento.');
    if (b.etapa === 'cancelado') throw new Error('Boleto cancelado não tem vencimento para alterar.');
    if (b.vencimento === nova) return;
    const br = (d) => (d ? d.split('-').reverse().join('/') : 'sem data');
    reg(b.id, 'Vencimento alterado', `de ${br(b.vencimento)} para ${br(nova)}${motivo && motivo.trim() ? ' · ' + motivo.trim() : ''}`, p);
    b.vencimento = nova;
    salvar();
  },

  async salvarAnotacao(boletoId, texto) {
    const p = eu(), b = carregar().boletos.find((x) => x.id === boletoId);
    b.anotacao = texto.trim() || null;
    reg(b.id, 'Anotação', texto.trim() || '(apagada)', p);
    salvar();
  },

  async enviarFoto(boletoId, arquivo) {
    const p = eu(), b = carregar().boletos.find((x) => x.id === boletoId);
    const caminho = `demo/${boletoId}/${arquivo.name}`;
    fotosNaMemoria[caminho] = URL.createObjectURL(arquivo);
    b.foto_path = caminho;
    reg(b.id, 'Foto do comprovante anexada', arquivo.name, p);
    salvar();
    return caminho;
  },

  async urlFoto(caminho) { return fotosNaMemoria[caminho] || null; },

  async criarUsuario({ nome, usuario, setor, papel, senha }) {
    const p = eu(), d = carregar();
    if (!(p.papel === 'gerente' || p.papel === 'admin_setor')) throw new Error('Sem permissão para cadastrar.');
    if (p.papel === 'admin_setor' && (setor !== p.setor || papel !== 'usuario')) throw new Error('Você só cadastra pessoas no seu setor.');
    if (!/^[a-z0-9._-]{2,30}$/.test(usuario)) throw new Error('Usuário: só letras minúsculas, números, ponto, traço ou _.');
    if (d.perfis.some((x) => x.usuario === usuario)) throw new Error(`Já existe alguém com o usuário "${usuario}".`);
    if (!senha || senha.length < 6) throw new Error('A senha provisória precisa ter pelo menos 6 caracteres.');
    d.perfis.push({ id: 'u-' + usuario, nome, usuario, setor, papel, ativo: true, pendente: true, senha });
    salvar();
  },

  async editarUsuario({ id: alvoId, nome, usuario, setor, senha }) {
    const p = eu(), d = carregar(), a = d.perfis.find((x) => x.id === alvoId);
    if (!a || a.id === p.id || a.papel === 'gerente') throw new Error('Essa pessoa não pode ser editada por aqui.');
    if (p.papel === 'admin_setor') {
      if (a.setor !== p.setor || a.papel !== 'usuario') throw new Error('Você só edita pessoas do seu setor.');
      if (setor !== a.setor) throw new Error('Só o Admin muda o setor.');
    } else if (p.papel !== 'gerente') throw new Error('Sem permissão para editar pessoas.');
    if (d.perfis.some((x) => x.usuario === usuario && x.id !== a.id)) throw new Error(`Já existe alguém com o usuário "${usuario}".`);
    Object.assign(a, { nome, usuario, setor });
    if (senha) Object.assign(a, { senha, pendente: true });
    salvar();
  },

  async atualizarPessoa(alvoId, { ativo, papel }) {
    const p = eu(), a = carregar().perfis.find((x) => x.id === alvoId);
    if (a.id === p.id) throw new Error('Você não pode alterar o seu próprio acesso.');
    if (a.papel === 'gerente') throw new Error('O Admin não pode ser alterado por aqui.');
    if (p.papel === 'admin_setor') {
      if (a.setor !== p.setor || a.papel !== 'usuario') throw new Error('Você só altera pessoas do seu setor.');
      if (papel) throw new Error('Só o Admin define administradores.');
    } else if (p.papel !== 'gerente') throw new Error('Sem permissão para alterar pessoas.');
    if (ativo !== undefined && ativo !== null) a.ativo = ativo;
    if (papel) a.papel = papel;
    salvar();
  },

  async salvarFilial(nome, cnpj) {
    const p = eu(), d = carregar(), c = soDigitos(cnpj);
    if (p.papel !== 'gerente') throw new Error('Só o Admin cadastra filiais.');
    if (d.filiais.some((f) => f.cnpj === c)) throw new Error('Esse CNPJ já está em outra filial.');
    const ex = d.filiais.find((f) => f.nome.toLowerCase() === nome.trim().toLowerCase());
    if (ex && ex.cnpj) throw new Error('Já existe uma filial com esse nome.');
    if (ex) ex.cnpj = c; else d.filiais.push({ id: id(), nome: nome.trim(), cnpj: c, ordem: d.filiais.length + 1 });
    salvar();
    return ex ? 'completada' : 'criada';
  },

  async renomearFilial(filialId, novoNome) {
    const p = eu(), d = carregar(), n = novoNome.trim();
    if (p.papel !== 'gerente') throw new Error('Só o Admin altera filiais.');
    if (!n) throw new Error('Informe o novo nome da filial.');
    if (d.filiais.some((f) => f.id !== filialId && f.nome.toLowerCase() === n.toLowerCase())) throw new Error('Já existe uma filial com esse nome.');
    d.filiais.find((f) => f.id === filialId).nome = n;
    salvar();
  },

  /** Só no modo demo: apaga tudo e volta aos dados de exemplo */
  async reiniciarDemo() { db = dadosIniciais(); salvar(); },
};

function reg(boleto_id, acao, detalhe, p) {
  carregar().historico.push({ boleto_id, acao, detalhe, feito_por_nome: p.nome, feito_em: agora() });
}

