// =====================================================================
// DUPLICA · telas/usuarios.js
// Cadastro de pessoas.
//   Admin (papel interno "gerente") → vê todos, cadastra em qualquer setor, cria admin do setor
//   Admin do setor → vê e cadastra só no próprio setor
// Ninguém é apagado: quem sai é DESATIVADO (o nome fica no histórico).
// "Editar" abre uma janela para mudar nome, usuário, setor ou dar senha nova.
// =====================================================================
import { estado } from '../nucleo/estado.js?v=77adb64';
import { ehGerente, podeAlterarPessoa, NOME_PAPEL } from '../nucleo/regras.js?v=77adb64';
import { registrarAcoes, registrarFormulario, avisar, executar } from '../nucleo/eventos.js?v=77adb64';
import { desenhar, recarregar } from '../nucleo/desenhar.js?v=77adb64';
import { cabecalho, toastHtml } from '../componentes/comuns.js?v=77adb64';
import { esc, normalizarLogin } from '../util/formato.js?v=77adb64';

const SETORES = [['Fiscal', 'marca chegou e envia'], ['Financeiro', 'dá o visto'], ['Contabilidade', 'etapa própria'], ['Recebimento', 'bipa as notas no celular']];

function linhaPessoa(u) {
  const eu = estado.perfil;
  const status = !u.ativo ? '<span class="pill p-vencido">Desativado</span>'
    : u.pendente ? '<span class="pill p-breve">Aguardando primeiro acesso</span>'
    : '<span class="pill p-visto">Ativo</span>';
  const papel = `<span class="pill ${u.papel === 'gerente' ? 'admin' : u.papel === 'admin_setor' ? 'p-enviado' : 'p-esperado'}">${NOME_PAPEL[u.papel]}${u.papel === 'admin_setor' ? ' ' + u.setor : ''}</span>`;
  const promover = ehGerente() && u.papel !== 'gerente' && u.ativo
    ? `<button class="bg" type="button" data-acao="mudar-papel" data-id="${u.id}" style="width:160px">${u.papel === 'admin_setor' ? 'Tirar admin do setor' : 'Tornar admin do setor'}</button>` : '';
  const ativar = u.id === eu.id ? '<span style="width:104px;font-size:12px;color:var(--terra);text-align:center">você</span>'
    : podeAlterarPessoa(u) ? `<button class="bg" type="button" data-acao="ativar-pessoa" data-id="${u.id}" style="width:104px">${u.ativo ? 'Desativar' : 'Reativar'}</button>`
    : '<span style="width:104px"></span>';
  const editar = podeAlterarPessoa(u)
    ? `<button class="bg" type="button" data-acao="editar-pessoa" data-id="${u.id}" style="width:84px">Editar</button>` : '<span style="width:84px"></span>';
  return `<div class="u-linha${u.ativo ? '' : ' off'}"><span class="av" aria-hidden="true">${esc(u.nome.charAt(0))}</span>
    <div><b>${esc(u.nome)}</b><small>usuário: ${esc(u.usuario)} · ${u.setor}</small></div>${papel}${status}${promover}${editar}${ativar}</div>`;
}

export const telaUsuarios = {
  id: 'usuarios',
  rotulo: (p) => (p.papel === 'gerente' ? 'Usuários' : 'Minha equipe'),
  visivel: (p) => p.papel === 'gerente' || p.papel === 'admin_setor',

  render() {
    const eu = estado.perfil, geral = ehGerente();
    const lista = estado.perfis.filter((u) => geral || u.setor === eu.setor);
    const r = estado.rascunho, erro = estado.erroForm.usuario;
    const opcoes = geral ? SETORES.map(([s, d]) => `<option value="${s}">${s}: ${d}</option>`).join('')
      : `<option value="${eu.setor}">${eu.setor}</option>`;

    return cabecalho(geral ? 'Admin' : `Admin do setor ${eu.setor}`, geral ? `Usuários do ${estado.empresa?.nome || ''}` : `Equipe do ${eu.setor}`) + toastHtml()
      + `<div class="users"><section class="secao"><div class="secao-h"><h2>${geral ? 'Todos os setores' : `Pessoas do ${eu.setor}`}</h2>
          <span style="font-size:13px;color:var(--terra);font-weight:600">${lista.length} pessoas</span></div>
          <div class="rolagem">${lista.map(linhaPessoa).join('')}</div></section>
        <form class="form-u" id="form-usuario" novalidate><h2>Cadastrar pessoa</h2>
          <div class="field"><label for="nn">Nome</label><input class="inp" id="nn" data-rascunho="1" placeholder="Nome da pessoa" value="${esc(r.nn || '')}"></div>
          <div class="field"><label for="nl">Usuário (o mesmo do Avanço)</label><input class="inp" id="nl" data-rascunho="1" placeholder="ex.: maria" autocomplete="off" value="${esc(r.nl || '')}"></div>
          <div class="field"><label for="ns">Setor</label><select class="inp" id="ns"${geral ? '' : ' disabled'}>${opcoes}</select>
            ${geral ? '' : '<span style="font-size:12px;color:var(--terra)">Você só cadastra pessoas no seu setor.</span>'}</div>
          ${geral ? '<label class="check"><input type="checkbox" id="na">Admin do setor: pode cadastrar e desativar pessoas do próprio setor</label>' : ''}
          <div class="field"><label for="nsenha">Senha provisória</label><input class="inp" id="nsenha" data-rascunho="1" placeholder="mínimo 6 caracteres" autocomplete="new-password" value="${esc(r.nsenha || '')}"></div>
          <p style="margin:0;font-size:13px;line-height:1.5;color:var(--terra)">Depois de cadastrar, aparece uma mensagem pronta com os dados de acesso para você copiar e mandar. No primeiro acesso ela cria a própria senha; até lá aparece como “Aguardando primeiro acesso”.</p>
          ${erro ? `<p class="erro" role="alert">${esc(erro)}</p>` : ''}
          <button class="bp" type="submit">Cadastrar</button></form></div>`;
  },
};

/** Janela "Editar pessoa" (aberta pelo botão Editar; desenhada em componentes/modal-pessoa.js) */
export function modalEditarPessoaHtml() {
  const u = estado.perfis.find((p) => p.id === estado.modal.id);
  if (!u) return '';
  const geral = ehGerente(), r = estado.rascunho, erro = estado.erroForm.editar;
  const opcoes = SETORES.map(([s]) => `<option value="${s}"${(r.edsetor || u.setor) === s ? ' selected' : ''}>${s}</option>`).join('');
  return `<div class="modal-fundo" data-fechar-fundo="fechar-modal"><form class="modal" id="form-editar-pessoa" role="dialog" aria-modal="true" aria-labelledby="m-t" novalidate>
    <h2 id="m-t">Editar ${esc(u.nome.split(' ')[0])}</h2>
    <div class="field"><label for="ednome">Nome</label><input class="inp" id="ednome" data-rascunho="1" value="${esc(r.ednome ?? u.nome)}"></div>
    <div class="field"><label for="edusuario">Usuário de login</label><input class="inp" id="edusuario" data-rascunho="1" autocomplete="off" value="${esc(r.edusuario ?? u.usuario)}">
      <span class="dica-campo">Se mudar, a pessoa passa a entrar com o usuário novo.</span></div>
    <div class="field"><label for="edsetor">Setor</label><select class="inp" id="edsetor" data-rascunho="1"${geral ? '' : ' disabled'}>${opcoes}</select>
      ${geral ? '' : '<span class="dica-campo">Só o Admin muda o setor.</span>'}</div>
    <div class="field"><label for="edsenha">Nova senha provisória (opcional)</label><input class="inp" id="edsenha" data-rascunho="1" placeholder="deixe vazio para manter a senha" autocomplete="new-password" value="${esc(r.edsenha || '')}">
      <span class="dica-campo">Use quando a pessoa esquecer a senha. No próximo acesso ela cria uma nova.</span></div>
    ${erro ? `<p class="erro" role="alert">${esc(erro)}</p>` : ''}
    <div class="botoes">
      <button class="bp" type="submit" style="flex:1;height:46px">Salvar</button>
      <button class="bg" type="button" data-acao="fechar-modal" style="height:46px">Cancelar</button>
    </div>
  </form></div>`;
}

/** Texto pronto para mandar à pessoa (WhatsApp, e-mail…) com os dados de acesso */
function mensagemAcesso({ nome, usuario, senha, setor }, nova) {
  const emp = estado.empresa || {};
  return [
    `Olá, ${nome.split(' ')[0]}!`,
    nova ? `Sua senha do Duplica (${emp.nome || 'controle de boletos'}) foi trocada. Seguem os dados para entrar:`
      : `Seu acesso ao Duplica (${emp.nome || 'controle de boletos'}) foi criado, no setor ${setor}. Seguem os dados para entrar:`,
    '',
    `Site: ${location.origin}`,
    `Empresa: ${emp.codigo || ''}`,
    `Usuário: ${usuario}`,
    `Senha provisória: ${senha}`,
    '',
    'No primeiro acesso o sistema pede para você criar a sua própria senha. Não passe a senha para outra pessoa.',
  ].join('\n');
}

/** Janela com a mensagem pronta para copiar (aparece depois de cadastrar ou de dar senha nova) */
export function modalMensagemAcessoHtml() {
  const m = estado.modal;
  return `<div class="modal-fundo" data-fechar-fundo="fechar-modal"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-t">
    <h2 id="m-t">${esc(m.titulo)}</h2>
    <p class="dica-campo" style="margin:0;font-size:13px">Copie a mensagem abaixo e mande para a pessoa. A senha provisória não aparece de novo depois que você fechar.</p>
    <textarea class="inp" id="msg-acesso" readonly rows="10" style="min-height:230px;font-size:14px;line-height:1.5">${esc(m.texto)}</textarea>
    <div class="botoes">
      <button class="bp" type="button" data-acao="copiar-acesso" style="flex:1;height:46px">${m.copiado ? 'Copiado ✓' : 'Copiar mensagem'}</button>
      <button class="bg" type="button" data-acao="whats-acesso" style="height:46px">WhatsApp</button>
      <button class="bg" type="button" data-acao="fechar-modal" style="height:46px">Fechar</button>
    </div>
  </div></div>`;
}

function limparEdicao() {
  for (const k of ['ednome', 'edusuario', 'edsetor', 'edsenha']) delete estado.rascunho[k];
  estado.erroForm.editar = '';
}

registrarAcoes({
  'copiar-acesso': () => executar(async () => {
    const t = estado.modal.texto;
    try { await navigator.clipboard.writeText(t); }
    catch { const c = document.getElementById('msg-acesso'); c.select(); document.execCommand('copy'); }
    estado.modal.copiado = true; desenhar();
  }),
  'whats-acesso': () => { window.open('https://wa.me/?text=' + encodeURIComponent(estado.modal.texto), '_blank', 'noopener'); },
  'editar-pessoa': (el) => { limparEdicao(); estado.modal = { tipo: 'editar-pessoa', id: el.dataset.id }; desenhar(); },
  'ativar-pessoa': (el) => executar(async () => {
    const u = estado.perfis.find((p) => p.id === el.dataset.id);
    await estado.api.atualizarPessoa(u.id, { ativo: !u.ativo });
    await recarregar();
    avisar(u.ativo ? `${u.nome} foi desativado. Não entra mais, mas o nome continua no histórico.` : `${u.nome} foi reativado.`);
  }),
  'mudar-papel': (el) => executar(async () => {
    const u = estado.perfis.find((p) => p.id === el.dataset.id);
    const novo = u.papel === 'admin_setor' ? 'usuario' : 'admin_setor';
    await estado.api.atualizarPessoa(u.id, { papel: novo });
    await recarregar();
    avisar(novo === 'admin_setor' ? `${u.nome} agora é admin do ${u.setor}.` : `${u.nome} não é mais admin do ${u.setor}.`);
  }),
});

registrarFormulario('form-editar-pessoa', () => executar(async () => {
  const u = estado.perfis.find((p) => p.id === estado.modal.id);
  const v = (id) => document.getElementById(id)?.value.trim() || '';
  const dados = {
    id: u.id,
    nome: v('ednome'),
    usuario: normalizarLogin(v('edusuario')),
    setor: ehGerente() ? v('edsetor') : u.setor,
    senha: v('edsenha'),
  };
  const erro = !dados.nome || !dados.usuario ? 'Preencha o nome e o usuário.'
    : !/^[a-z0-9._-]{2,30}$/.test(dados.usuario) ? 'Usuário: use só letras minúsculas, números, ponto, traço ou _ (sem espaço e sem acento).'
    : dados.senha && dados.senha.length < 6 ? 'A senha provisória precisa ter pelo menos 6 caracteres.' : '';
  if (erro) { estado.erroForm.editar = erro; desenhar(); return; }
  try {
    await estado.api.editarUsuario(dados);
  } catch (e) { estado.erroForm.editar = e.message; desenhar(); return; }
  limparEdicao();
  estado.modal = dados.senha ? { tipo: 'mensagem-acesso', titulo: `Senha nova de ${dados.nome.split(' ')[0]}`, texto: mensagemAcesso(dados, true) } : null;
  await recarregar();
  avisar(`${dados.nome} atualizado.${dados.usuario !== u.usuario ? ` Agora entra com o usuário “${dados.usuario}”.` : ''}${dados.senha ? ' Passe a senha provisória nova para a pessoa.' : ''}`);
}));

registrarFormulario('form-usuario', () => executar(async () => {
  const v = (id) => document.getElementById(id)?.value.trim() || '';
  const dados = {
    nome: v('nn'),
    usuario: normalizarLogin(v('nl')),   // "Rafaela" vira "rafaela", "João" vira "joao"
    setor: ehGerente() ? v('ns') : estado.perfil.setor,
    papel: document.getElementById('na')?.checked ? 'admin_setor' : 'usuario',
    senha: v('nsenha'),
  };
  const erro = !dados.nome || !dados.usuario ? 'Preencha o nome e o usuário.'
    : !/^[a-z0-9._-]{2,30}$/.test(dados.usuario) ? 'Usuário: use só letras minúsculas, números, ponto, traço ou _ (sem espaço e sem acento).'
    : dados.senha.length < 6 ? 'A senha provisória precisa ter pelo menos 6 caracteres.' : '';
  if (erro) { estado.erroForm.usuario = erro; desenhar(); return; }
  try {
    await estado.api.criarUsuario(dados);
  } catch (e) { estado.erroForm.usuario = e.message; desenhar(); return; }
  estado.erroForm.usuario = '';
  estado.rascunho.nn = estado.rascunho.nl = estado.rascunho.nsenha = '';
  estado.modal = { tipo: 'mensagem-acesso', titulo: `${dados.nome.split(' ')[0]} cadastrado`, texto: mensagemAcesso(dados, false) };
  await recarregar();
  avisar(`${dados.nome} cadastrado no ${dados.setor}. Entra com a empresa “${estado.empresa.codigo}”, usuário “${dados.usuario}” e a senha provisória.`);
}));
