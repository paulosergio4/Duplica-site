// =====================================================================
// DUPLICA · telas/filiais.js
// Empresa e filiais (só o Admin).
// O CNPJ de cada filial é o que liga o XML à loja certa.
// =====================================================================
import { estado } from '../nucleo/estado.js?v=4d27135';
import { registrarAcoes, registrarFormulario, registrarCampo, avisar, executar } from '../nucleo/eventos.js?v=4d27135';
import { desenhar, recarregar } from '../nucleo/desenhar.js?v=4d27135';
import { cabecalho, toastHtml } from '../componentes/comuns.js?v=4d27135';
import { esc, cnpjFormatado, cnpjValido, mascaraCnpj, plural } from '../util/formato.js?v=4d27135';

export const telaFiliais = {
  id: 'filiais',
  rotulo: () => 'Empresa e filiais',
  visivel: (p) => p.papel === 'gerente',

  render() {
    const r = estado.rascunho, erro = estado.erroForm.filial;
    const linhas = estado.filiais.map((f, i) => {
      const qtd = estado.notas.filter((n) => n.filial_id === f.id).length;
      // nome: texto normal, ou campo de edição quando a pessoa clicou em "Editar nome"
      const nome = estado.editandoFilial === f.id
        ? `<form class="editar-filial" id="form-renomear" novalidate>
             <label for="novo-nome" class="sr">Novo nome da ${esc(f.nome)}</label>
             <input class="inp" id="novo-nome" value="${esc(f.nome)}" maxlength="60">
             <button class="bp bs" type="submit">Salvar</button>
             <button class="bg" type="button" data-acao="cancelar-nome">Cancelar</button></form>`
        : `<div><b>${esc(f.nome)}</b><small>${plural(qtd, 'nota', 'notas')} carregadas agora</small></div>`;
      const editar = estado.editandoFilial === f.id ? ''
        : `<button class="bg" type="button" data-acao="editar-nome" data-id="${f.id}" style="width:110px">Editar nome</button>`;
      return `<div class="u-linha" style="min-width:680px"><span class="av" aria-hidden="true">${i + 1}</span>
        ${nome}
        ${f.cnpj ? `<span class="num" style="font-weight:700;width:170px">${cnpjFormatado(f.cnpj)}</span><span class="pill p-visto">Ligada ao XML</span>`
          : '<span style="width:170px;font-size:13px;color:var(--alerta-txt);font-weight:700">CNPJ não informado</span><span class="pill p-breve">Notas não entram</span>'}
        ${editar}</div>`;
    }).join('');

    return cabecalho('Admin', 'Empresa e filiais') + toastHtml()
      + `<div class="users"><section class="secao"><div class="secao-h"><h2>${esc(estado.empresa?.nome || '')} · ${plural(estado.filiais.length, 'filial', 'filiais')}</h2>
          <span style="font-size:13px;color:var(--terra);font-weight:600">código de login: <b>${esc(estado.empresa?.codigo || '')}</b></span></div>
          <p style="margin:0;padding:14px 20px;font-size:13px;line-height:1.5;color:var(--terra);border-bottom:1px solid var(--linha)">Cada XML é lido pelo CNPJ do destinatário: se bater com uma filial daqui, a nota entra nela. XML de CNPJ que não está na lista não entra.</p>
          <div class="rolagem">${linhas}</div></section>
        <form class="form-u" id="form-filial" novalidate><h2>Cadastrar filial</h2>
          <div class="field"><label for="fn">Nome da filial</label><input class="inp" id="fn" data-rascunho="1" placeholder="ex.: Loja 7 · Centro" value="${esc(r.fn || '')}"></div>
          <div class="field"><label for="fc">CNPJ</label><input class="inp num" id="fc" data-rascunho="1" inputmode="numeric" placeholder="00.000.000/0000-00" maxlength="18" value="${esc(r.fc || '')}"></div>
          <p style="margin:0;font-size:13px;line-height:1.5;color:var(--terra)">O CNPJ é conferido pelos dígitos verificadores. Uma filial já cadastrada sem CNPJ é completada se você usar o mesmo nome.</p>
          ${erro ? `<p class="erro" role="alert">${esc(erro)}</p>` : ''}
          <button class="bp" type="submit">Salvar filial</button></form></div>`;
  },
};

// máscara do CNPJ enquanto digita
registrarCampo('fc', (el) => { el.value = mascaraCnpj(el.value); estado.rascunho.fc = el.value; });

registrarFormulario('form-filial', () => executar(async () => {
  const nome = document.getElementById('fn').value.trim();
  const cnpj = document.getElementById('fc').value;
  const erro = !nome ? 'Informe o nome da filial.' : !cnpjValido(cnpj) ? 'CNPJ inválido. Confira os 14 números.' : '';
  if (erro) { estado.erroForm.filial = erro; desenhar(); return; }
  let resultado;
  try { resultado = await estado.api.salvarFilial(nome, cnpj); } catch (e) { estado.erroForm.filial = e.message; desenhar(); return; }
  estado.erroForm.filial = '';
  estado.rascunho.fn = estado.rascunho.fc = '';
  await recarregar();
  avisar(resultado === 'completada' ? `CNPJ da ${nome} salvo. As notas dela já podem entrar.` : `${nome} cadastrada com o CNPJ ${cnpjFormatado(cnpj)}.`);
}));

// ------------------------- editar o nome da filial -------------------------
registrarAcoes({
  'editar-nome': (el) => {
    estado.editandoFilial = el.dataset.id;
    desenhar();
    const campo = document.getElementById('novo-nome');
    campo?.focus(); campo?.select();
  },
  'cancelar-nome': () => { estado.editandoFilial = null; desenhar(); },
});

registrarFormulario('form-renomear', () => executar(async () => {
  const filial = estado.filiais.find((f) => f.id === estado.editandoFilial);
  const novo = document.getElementById('novo-nome').value.trim();
  if (!novo || novo === filial.nome) { estado.editandoFilial = null; desenhar(); return; }
  const antigo = filial.nome;
  await estado.api.renomearFilial(filial.id, novo);
  estado.editandoFilial = null;
  await recarregar();
  avisar(`“${antigo}” agora se chama “${novo}”. As notas dela continuam ligadas.`);
}));
