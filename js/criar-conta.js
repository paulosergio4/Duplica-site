// =====================================================================
// DUPLICA · criar-conta.js
// Página html/criar-conta.html: a empresa se cadastra sozinha e entra em
// TESTE GRÁTIS de 14 dias.
//   1. a pessoa preenche empresa, lojas (CNPJ) e o próprio acesso;
//   2. api.cadastrarEmpresa → função "usuarios" (cadastro_publico) cria tudo;
//   3. já faz o login e abre o sistema (html/app.html).
// =====================================================================
import { ligarBotaoTema } from './util/tema.js?v=2ef8d9d';
import { obterApi } from './servicos/api.js?v=2ef8d9d';
import { CONFIG } from './config.js?v=2ef8d9d';
import { normalizarLogin, mascaraCnpj, cnpjValido, soDigitos } from './util/formato.js?v=2ef8d9d';

const $ = (id) => document.getElementById(id);
let api;
let codigoMexido = false;          // a pessoa editou o código? então não sugere mais

function erro(texto) { const el = $('erro-cadastro'); el.textContent = texto; el.hidden = !texto; if (texto) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }

/** Uma linha de loja: nome + CNPJ + remover */
function novaLoja(nome = '', cnpj = '') {
  const n = $('lojas').children.length + 1;
  const div = document.createElement('div');
  div.className = 'loja-linha';
  div.innerHTML = `<div class="field"><label>Nome da loja</label><input class="inp loja-nome" placeholder="ex.: Loja ${n} · Centro"></div>
    <div class="field"><label>CNPJ</label><input class="inp num loja-cnpj" inputmode="numeric" maxlength="18" placeholder="00.000.000/0000-00"></div>
    <button class="bg remover" type="button" title="Tirar esta loja" aria-label="Tirar esta loja">×</button>`;
  div.querySelector('.loja-nome').value = nome;
  div.querySelector('.loja-cnpj').value = cnpj;
  div.querySelector('.loja-cnpj').addEventListener('input', (ev) => { ev.target.value = mascaraCnpj(ev.target.value); });
  div.querySelector('.remover').addEventListener('click', () => { if ($('lojas').children.length > 1) div.remove(); });
  $('lojas').appendChild(div);
  return div;
}

/** "Supermercado Bom Preço" → "supermercadobompreco" (sugestão do código) */
const sugerirCodigo = (nome) => normalizarLogin(nome).replace(/[^a-z0-9]/g, '').slice(0, 30);

function mascaraFone(v) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function suporteTexto() {
  const partes = [];
  if (CONFIG.SUPORTE_WHATSAPP) partes.push(`<a style="color:inherit" href="https://wa.me/${CONFIG.SUPORTE_WHATSAPP}" target="_blank" rel="noopener">WhatsApp do suporte</a>`);
  if (CONFIG.SUPORTE_EMAIL) partes.push(`<a style="color:inherit" href="mailto:${CONFIG.SUPORTE_EMAIL}">${CONFIG.SUPORTE_EMAIL}</a>`);
  return partes.length ? `Dúvidas? ${partes.join(' · ')}` : 'Controle de boletos das notas de entrada';
}

async function iniciar() {
  api = await obterApi();
  novaLoja();
  $('suporte-hero').innerHTML = suporteTexto();
  $('mais-loja').addEventListener('click', () => novaLoja().querySelector('.loja-nome').focus());
  $('c-nome').addEventListener('input', () => { if (!codigoMexido) $('c-codigo').value = sugerirCodigo($('c-nome').value); });
  $('c-codigo').addEventListener('input', (ev) => { codigoMexido = true; ev.target.value = sugerirCodigo(ev.target.value); });
  $('c-usuario').addEventListener('input', (ev) => { ev.target.value = normalizarLogin(ev.target.value); });
  $('c-fone').addEventListener('input', (ev) => { ev.target.value = mascaraFone(ev.target.value); });
  $('c-nome').focus();
}

/** Confere no próprio navegador antes de mandar (o servidor confere de novo) */
function validar(d) {
  if (d.empresa.nome.length < 3) return ['c-nome', 'Informe o nome da empresa.'];
  if (!/^[a-z0-9]{3,30}$/.test(d.empresa.codigo)) return ['c-codigo', 'Código de acesso: 3 a 30 letras ou números, sem espaço.'];
  if (!d.filiais.length) return [null, 'Cadastre pelo menos uma loja com o CNPJ.'];
  for (const [i, f] of d.filiais.entries()) {
    if (!f.nome) return [null, `Informe o nome da loja ${i + 1}.`];
    if (!cnpjValido(f.cnpj)) return [null, `O CNPJ da loja "${f.nome}" está errado. Confira os números.`];
  }
  if (d.responsavel.nome.length < 2) return ['c-pessoa', 'Informe o seu nome.'];
  if (!/^[a-z0-9._-]{2,30}$/.test(d.responsavel.usuario)) return ['c-usuario', 'Usuário: use letras minúsculas, números, ponto, traço ou _.'];
  if (d.responsavel.senha.length < 6) return ['c-senha', 'A senha precisa ter pelo menos 6 caracteres.'];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.responsavel.email)) return ['c-email', 'Informe um e-mail válido.'];
  if (soDigitos(d.responsavel.telefone).length < 10) return ['c-fone', 'Informe o WhatsApp com DDD.'];
  if (!d.aceite) return ['c-aceite', 'Para continuar, aceite os termos de uso.'];
  return null;
}

$('form-cadastro').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  erro('');
  const dados = {
    site: $('c-site').value,
    empresa: { nome: $('c-nome').value.trim(), codigo: $('c-codigo').value.trim(), cidade: $('c-cidade').value.trim() },
    filiais: [...document.querySelectorAll('.loja-linha')]
      .map((l) => ({ nome: l.querySelector('.loja-nome').value.trim(), cnpj: soDigitos(l.querySelector('.loja-cnpj').value) }))
      .filter((f) => f.nome || f.cnpj),
    responsavel: {
      nome: $('c-pessoa').value.trim(), setor: $('c-setor').value, usuario: $('c-usuario').value.trim(),
      senha: $('c-senha').value, email: $('c-email').value.trim(), telefone: $('c-fone').value,
    },
    aceite: $('c-aceite').checked,
  };
  const problema = validar(dados);
  if (problema) { erro(problema[1]); if (problema[0]) $(problema[0]).focus(); return; }

  const botao = ev.submitter; botao.disabled = true; botao.textContent = 'Criando a sua conta…';
  try {
    const r = await api.cadastrarEmpresa(dados);
    await api.entrar(r.empresa, dados.responsavel.usuario, dados.responsavel.senha);
    try { localStorage.setItem('duplica-empresa', r.empresa); } catch { /* sem storage */ }
    location.href = 'app.html';
  } catch (e) {
    erro(e.message);
    botao.disabled = false; botao.textContent = 'Criar conta e começar o teste';
  }
});

iniciar();

ligarBotaoTema();
