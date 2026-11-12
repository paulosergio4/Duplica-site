// =====================================================================
// DUPLICA · servicos/api-supabase.js
// A API de verdade: fala com o Supabase. Mesmas funções do api-demo.js.
//
// Leitura  → supabase.from('tabela').select(...)  (protegida pelas regras RLS)
// Gravação → supabase.rpc('funcao', {...})         (sql/02_funcoes.sql)
// Usuários → função "usuarios" no servidor          (supabase/functions/usuarios)
// =====================================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { CONFIG } from '../config.js?v=59d8fd7';
import { normalizarLogin } from '../util/formato.js?v=59d8fd7';

// login guardado só nesta aba (sessionStorage): fechou a aba ou o navegador, pede usuário e senha de novo
let guarda;
try { sessionStorage.setItem('duplica-teste', '1'); sessionStorage.removeItem('duplica-teste'); guarda = sessionStorage; } catch { guarda = undefined; }
try { Object.keys(localStorage).filter((k) => /^sb-.*-auth-token/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch { /* sem storage */ }
const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { storage: guarda, persistSession: true } });

/** Monta o e-mail interno do login: paulo + saoluiz → paulo@saoluiz.duplica.app */
const emailDe = (empresa, usuario) =>
  `${normalizarLogin(usuario)}@${normalizarLogin(empresa).replace(/[._-]/g, '')}.${CONFIG.DOMINIO_LOGIN}`;

/** Transforma o erro do Supabase numa mensagem que a pessoa entende */
function falha(error) {
  if (!error) return;
  const msg = error.message || String(error);
  if (/Invalid login credentials/i.test(msg)) throw new Error('Empresa, usuário ou senha incorretos.');
  throw new Error(msg);
}

/** O Supabase devolve no máximo 1000 linhas por vez: busca em páginas */
async function buscarTodas(montarConsulta) {
  const todas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montarConsulta().range(de, de + 999);
    falha(error);
    todas.push(...data);
    if (data.length < 1000) return todas;
  }
}

async function meuPerfil() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data, error } = await sb.from('perfis').select('*').eq('id', user.id).maybeSingle();
  falha(error);
  return data;
}

export const apiSupabase = {
  demo: false,

  async entrar(empresa, usuario, senha) {
    const { error } = await sb.auth.signInWithPassword({ email: emailDe(empresa, usuario), password: senha });
    falha(error);
    const p = await meuPerfil();
    if (!p) { await sb.auth.signOut(); throw new Error('Usuário sem cadastro nesta empresa.'); }
    if (!p.ativo) { await sb.auth.signOut(); throw new Error('Este acesso foi desativado. Fale com o gerente.'); }
    return p;
  },

  async sair() { await sb.auth.signOut(); },

  async sessao() {
    const p = await meuPerfil();
    if (!p || !p.ativo) return null;
    const { data: empresa } = await sb.from('empresas').select('*').eq('id', p.empresa_id).maybeSingle();
    return { perfil: p, empresa };
  },

  async trocarSenha(nova) {
    if (nova.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
    falha((await sb.auth.updateUser({ password: nova })).error);
    falha((await sb.rpc('concluir_primeiro_acesso')).error);
  },

  /**
   * Carrega tudo que as telas usam. Para não pesar com o tempo, traz:
   *  - boletos ainda sem visto (qualquer data) e
   *  - boletos com vencimento nos últimos 120 dias ou no futuro
   */
  async carregarTudo() {
    const corte = new Date(); corte.setDate(corte.getDate() - 120);
    const corteISO = corte.toISOString().slice(0, 10);

    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0); inicioDia.setDate(inicioDia.getDate() - 45);   // recebimentos e notas dos últimos 45 dias
    const [emp, filiais, perfis, boletos, recorrencias, recebimentos] = await Promise.all([
      sb.from('empresas').select('*').maybeSingle(),
      buscarTodas(() => sb.from('filiais').select('*').order('ordem')),
      buscarTodas(() => sb.from('perfis').select('id,nome,usuario,setor,papel,ativo,pendente').order('nome')),
      buscarTodas(() => sb.from('boletos')
        .select('*, nota:notas(id,filial_id,tipo,numero,serie,valor,fornecedor,fornecedor_cnpj,descricao,chave,emissao)')
        .or(`etapa.not.in.(visto,cancelado),vencimento.gte.${corteISO}`)
        .order('vencimento')),
      buscarTodas(() => sb.from('recorrencias').select('*').order('dia')),
      buscarTodas(() => sb.from('recebimentos').select('*, nota:notas(id,filial_id,tipo,numero,serie,valor,fornecedor,fornecedor_cnpj,descricao,chave,emissao)')
        .gte('feito_em', inicioDia.toISOString()).order('feito_em', { ascending: false })),
    ]);
    falha(emp.error);

    // separa as notas que vieram junto com os boletos
    const notas = new Map();
    for (const b of boletos) { if (b.nota) notas.set(b.nota.id, b.nota); delete b.nota; }
    // notas bipadas hoje (inclui as SEM boleto, que não vêm na lista acima)
    for (const r of recebimentos) { if (r.nota) notas.set(r.nota.id, r.nota); delete r.nota; }
    // Recebimento de mercadoria: toda nota com XML emitida desde empresas.recebimento_desde (no máximo 45 dias)
    if (emp.data?.recebimento_desde) {
      const de = [emp.data.recebimento_desde, inicioDia.toISOString().slice(0, 10)].sort().pop();
      const doXml = await buscarTodas(() => sb.from('notas')
        .select('id,filial_id,tipo,numero,serie,valor,fornecedor,fornecedor_cnpj,descricao,chave,emissao')
        .not('chave', 'is', null).gte('emissao', de).order('emissao', { ascending: false }));
      for (const n of doXml) if (!notas.has(n.id)) notas.set(n.id, n);
    }
    // conferência de produtos: quantos itens de cada nota já foram conferidos
    const conferencia = emp.data?.recebimento_desde ? await this.resumoConferencia(emp.data.recebimento_desde).catch(() => []) : [];
    return { empresa: emp.data, filiais, perfis, notas: [...notas.values()], boletos, recorrencias, recebimentos, conferencia };
  },

  /** Relatório: todos os boletos do período (pagos, não pagos, cancelados), com a nota de cada um.
   *  campo = 'vencimento' (data do boleto) ou 'emissao' (data da nota) */
  async relatorio(de, ate, campo = 'vencimento') {
    const cols = 'id,filial_id,tipo,numero,serie,valor,fornecedor,fornecedor_cnpj,descricao,chave,emissao';
    const rel = campo === 'emissao' ? `nota:notas!inner(${cols})` : `nota:notas(${cols})`;
    const filtro = campo === 'emissao' ? 'nota.emissao' : 'vencimento';
    return buscarTodas(() => sb.from('boletos').select(`*, ${rel}`).gte(filtro, de).lte(filtro, ate).order('vencimento'));
  },

  /** Recebimento: bipou a DANFE (chave de 44 números) ou o Fiscal marcou na tela (manual) */
  async receberNota(chave, manual = false) {
    const { data, error } = await sb.rpc('receber_nota', { chave, manual });
    falha(error);
    return data;
  },

  /** Guarda a foto do boleto (Storage, pasta da empresa) e devolve o caminho */
  async enviarFotoBoleto(recebimentoId, blob) {
    const p = await meuPerfil();
    const caminho = `${p.empresa_id}/${recebimentoId}-${Date.now()}.jpg`;
    const { error } = await sb.storage.from('boletos-fotos').upload(caminho, blob, { contentType: 'image/jpeg' });
    falha(error);
    return caminho;
  },

  /** Resposta do "Tem boleto?": com fotos, os boletos da nota viram "Chegou" */
  async recebimentoBoleto(id, tem, fotos = []) {
    const { data, error } = await sb.rpc('recebimento_boleto', { p_id: id, tem, p_fotos: fotos });
    falha(error);
    return data;
  },

  /** Bipou o código de barras do boleto no recebimento: preenche valor, vencimento e linha do boleto criado */
  async recebimentoCodigoBoleto(id, { barras, linha, valor, vencimento }) {
    const { data, error } = await sb.rpc('recebimento_codigo_boleto', { p_id: id, p_barras: barras, p_linha: linha || null, p_valor: valor, p_vencimento: vencimento || null });
    falha(error);
    return data;
  },

  /** Endereço temporário (10 min) para ver uma foto */
  async urlFotoBoleto(caminho) {
    const { data, error } = await sb.storage.from('boletos-fotos').createSignedUrl(caminho, 600);
    falha(error);
    return data.signedUrl;
  },

  /** Avisa na hora quando alguém da empresa recebe uma nota ou anexa o boleto (Supabase Realtime) */
  ouvirRecebimentos(aoReceber) {
    const canal = sb.channel('recebimentos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'recebimentos' }, (ev) => aoReceber(ev.new, false))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'recebimentos' }, (ev) => aoReceber(ev.new, true))
      .subscribe();
    return () => sb.removeChannel(canal);
  },

  async historico(boletoId) {
    const { data, error } = await sb.from('historico').select('*').eq('boleto_id', boletoId).order('feito_em');
    falha(error);
    return data;
  },

  async importarNota({ itens = [], ...dados }) {
    const { data, error } = await sb.rpc('importar_nota', { dados });
    falha(error);
    if (itens.length && ['importada', 'importada_sem_vencimento', 'importada_sem_boleto', 'duplicada'].includes(data)) {
      await sb.rpc('salvar_itens_nota', { chave: dados.chave, itens });   // produtos: se falhar, a nota já entrou
    }
    return data;
  },

  // ---------- conferência de produtos ----------
  async itensDaNota(notaId) {
    const { data, error } = await sb.from('nota_itens').select('*').eq('nota_id', notaId).order('n_item');
    falha(error);
    return data;
  },

  async resumoConferencia(desde) {
    const { data, error } = await sb.rpc('resumo_conferencia', { desde });
    falha(error);
    return data || [];
  },

  async enviarFotoProduto(itemId, blob) {
    const p = await meuPerfil();
    const caminho = `${p.empresa_id}/${itemId}-${Date.now()}.jpg`;
    const { error } = await sb.storage.from('produtos-fotos').upload(caminho, blob, { contentType: 'image/jpeg' });
    falha(error);
    return caminho;
  },

  async conferirItem(itemId, eanLido, foto, manual = false, divergente = false) {
    const { data, error } = await sb.rpc('conferir_item', { p_item: itemId, p_ean_lido: eanLido || null, p_foto: foto || null, p_manual: manual, p_divergente: divergente });
    falha(error);
    return data;
  },

  async desconferirItem(itemId) {
    const { data, error } = await sb.rpc('desconferir_item', { p_item: itemId });
    falha(error);
    return data;
  },

  async urlFotoProduto(caminho) {
    const { data, error } = await sb.storage.from('produtos-fotos').createSignedUrl(caminho, 600);
    falha(error);
    return data.signedUrl;
  },

  /** Apaga as fotos de produto com mais de 3 meses (fica só quem conferiu e quando) */
  async limparFotosAntigas() {
    const { data: caminhos, error } = await sb.rpc('fotos_produto_vencidas');
    falha(error);
    if (!caminhos?.length) return 0;
    falha((await sb.storage.from('produtos-fotos').remove(caminhos)).error);
    const { data } = await sb.rpc('fotos_produto_apagadas', { caminhos });
    return data || 0;
  },

  async avancar(ids, pessoa) {
    const { data, error } = await sb.rpc('avancar_boletos', { ids, pessoa: pessoa || null });
    falha(error);
    return data;
  },

  async receberDireto(ids, origem, pessoa) {
    const { data, error } = await sb.rpc('receber_direto_financeiro', { ids, origem, pessoa: pessoa || null });
    falha(error);
    return data;
  },

  async lancarAvulso(dados) {
    const { data, error } = await sb.rpc('lancar_avulso', { dados });
    falha(error);
    return data;
  },

  async definirParcelas(notaId, parcelas) {
    const { data, error } = await sb.rpc('definir_parcelas', { nota: notaId, parcelas });
    falha(error);
    return data;
  },

  async salvarRecorrencia(dados) {
    const { data, error } = await sb.rpc('salvar_recorrencia', { dados });
    falha(error);
    return data;
  },

  async gerarRecorrentes() {
    const { data, error } = await sb.rpc('gerar_recorrentes');
    falha(error);
    return data;
  },

  async cancelar(ids, motivo) {
    const { data, error } = await sb.rpc('cancelar_boletos', { ids, motivo });
    falha(error);
    return data;
  },

  /** forma: 'Boleto' (só com visto) ou pago direto ao fornecedor: 'Pix', 'Transferência', 'Dinheiro', 'Outro' */
  async marcarPago(ids, forma = 'Boleto', obs = null) {
    const { data, error } = await sb.rpc('marcar_pago', { ids, forma, obs: obs || null });
    falha(error);
    return data;
  },

  async fiscalPago(ids, forma, obs = null) {
    const { data, error } = await sb.rpc('fiscal_pago', { ids, forma, obs: obs || null });
    falha(error);
    return data;
  },
  async desfazerPago(boletoId, motivo) {
    falha((await sb.rpc('desfazer_pago', { boleto: boletoId, motivo })).error);
  },

  async corrigir(boletoId, motivo) {
    falha((await sb.rpc('corrigir_boleto', { boleto: boletoId, motivo })).error);
  },

  async vincularCodigo(boletoId, barras, linha, venc) {
    falha((await sb.rpc('vincular_codigo', { boleto: boletoId, barras, linha, venc: venc || null })).error);
  },

  async alterarVencimento(boletoId, nova, motivo) {
    falha((await sb.rpc('alterar_vencimento', { boleto: boletoId, nova, motivo: motivo || null })).error);
  },

  async salvarAnotacao(boletoId, texto) {
    falha((await sb.rpc('salvar_anotacao', { boleto: boletoId, texto })).error);
  },

  async enviarFoto(boletoId, arquivo) {
    const p = await meuPerfil();
    const nomeLimpo = arquivo.name.normalize('NFD').replace(/[^\w.-]/g, '_');
    const caminho = `${p.empresa_id}/${boletoId}/${Date.now()}-${nomeLimpo}`;
    falha((await sb.storage.from('comprovantes').upload(caminho, arquivo, { upsert: false })).error);
    falha((await sb.rpc('registrar_foto', { boleto: boletoId, caminho })).error);
    return caminho;
  },

  async urlFoto(caminho) {
    const { data, error } = await sb.storage.from('comprovantes').createSignedUrl(caminho, 3600);
    falha(error);
    return data.signedUrl;
  },

  /** Cadastro aberto (página Criar conta): cria a empresa em teste grátis e já entra */
  async cadastrarEmpresa(dados) {
    const { data, error } = await sb.functions.invoke('usuarios', { body: { acao: 'cadastro_publico', ...dados } });
    if (error) {
      let msg = error.message;
      try { msg = (await error.context.json()).erro || msg; } catch { /* mantém a mensagem padrão */ }
      throw new Error(msg);
    }
    if (!data?.empresa) throw new Error('Não foi possível concluir o cadastro. Tente de novo.');
    return data;
  },

  async criarUsuario(dados) {
    // pega a sessão atual (o Supabase renova o token se ele já venceu) e manda junto
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Sua sessão expirou. Saia e entre de novo.');
    const { data, error } = await sb.functions.invoke('usuarios', {
      body: { acao: 'criar_usuario', ...dados },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error) {
      // a função devolve { erro: "mensagem" } quando recusa
      let msg = error.message;
      try { msg = (await error.context.json()).erro || msg; } catch { /* mantém a mensagem padrão */ }
      throw new Error(msg);
    }
    return data;
  },

  async editarUsuario(dados) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Sua sessão expirou. Saia e entre de novo.');
    const { data, error } = await sb.functions.invoke('usuarios', {
      body: { acao: 'editar_usuario', ...dados },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error) {
      let msg = error.message;
      try { msg = (await error.context.json()).erro || msg; } catch { /* mantém a mensagem padrão */ }
      throw new Error(msg);
    }
    return data;
  },

  async atualizarPessoa(alvoId, { ativo = null, papel = null }) {
    falha((await sb.rpc('atualizar_pessoa', { alvo: alvoId, novo_ativo: ativo, novo_papel: papel })).error);
  },

  async renomearFilial(filialId, novoNome) {
    falha((await sb.rpc('renomear_filial', { filial: filialId, novo_nome: novoNome })).error);
  },

  async salvarFilial(nome, cnpj) {
    const { data, error } = await sb.rpc('salvar_filial', { nome_filial: nome, cnpj_filial: cnpj });
    falha(error);
    return data;
  },
};
