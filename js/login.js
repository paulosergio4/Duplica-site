// =====================================================================
// DUPLICA · login.js
// Página de entrada (index.html):
//   - login com empresa + usuário + senha
//   - primeiro acesso: troca da senha provisória
// Depois de entrar, vai para html/app.html
// =====================================================================
import { obterApi } from './servicos/api.js?v=08ffbb8';
import { MODO_DEMO } from './config.js?v=08ffbb8';
import { normalizarLogin } from './util/formato.js?v=08ffbb8';

const $ = (id) => document.getElementById(id);
let api;

function mostrarErro(id, texto) {
  const el = $(id);
  el.textContent = texto;
  el.hidden = !texto;
}

function lembrarEmpresa(codigo) { try { localStorage.setItem('duplica-empresa', codigo); } catch { /* sem storage */ } }
function empresaLembrada() { try { return localStorage.getItem('duplica-empresa') || ''; } catch { return ''; } }

/** Troca o formulário de login pelo de criar senha */
function mostrarPrimeiroAcesso(nome) {
  $('form-login').hidden = true;
  $('form-senha').hidden = false;
  $('boas-vindas').textContent = `Bem-vindo, ${nome.split(' ')[0]}.`;
  $('s1').focus();
}

async function iniciar() {
  api = await obterApi();
  $('empresa').value = empresaLembrada() || (MODO_DEMO ? 'saoluiz' : '');
  $('dica-demo').hidden = !MODO_DEMO;

  // já logado? vai direto (ou para o primeiro acesso)
  const s = await api.sessao();
  if (s && s.perfil.pendente) mostrarPrimeiroAcesso(s.perfil.nome);
  else if (s && !new URLSearchParams(location.search).has('sair')) location.href = 'html/app.html';

  $(($('empresa').value ? 'usuario' : 'empresa')).focus();
}

$('form-login').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  mostrarErro('erro-login', '');
  // aceita do jeito que a pessoa digitar: "São Luiz", "SAOLUIZ", " Rafaela "...
  const empresa = normalizarLogin($('empresa').value).replace(/[._-]/g, '');
  const usuario = normalizarLogin($('usuario').value);
  const senha = $('senha').value;
  if (!empresa || !usuario || !senha) { mostrarErro('erro-login', 'Preencha empresa, usuário e senha.'); return; }
  const botao = ev.submitter; botao.disabled = true;
  try {
    const perfil = await api.entrar(empresa, usuario, senha);
    lembrarEmpresa(empresa);
    if (perfil.pendente) mostrarPrimeiroAcesso(perfil.nome);
    else location.href = 'html/app.html';
  } catch (e) {
    mostrarErro('erro-login', e.message);
  } finally { botao.disabled = false; }
});

$('form-senha').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  mostrarErro('erro-senha', '');
  const s1 = $('s1').value, s2 = $('s2').value;
  if (s1.length < 6) { mostrarErro('erro-senha', 'A senha precisa ter pelo menos 6 caracteres.'); return; }
  if (s1 !== s2) { mostrarErro('erro-senha', 'As duas senhas não são iguais. Digite de novo.'); return; }
  try {
    await api.trocarSenha(s1);
    location.href = 'html/app.html';
  } catch (e) { mostrarErro('erro-senha', e.message); }
});

iniciar().catch((e) => mostrarErro('erro-login', 'Não foi possível conectar: ' + e.message));
