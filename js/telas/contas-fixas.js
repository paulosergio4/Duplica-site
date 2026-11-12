// =====================================================================
// DUPLICA · telas/contas-fixas.js
// Contas que se repetem todo mês (internet, aluguel, manutenção...).
// Cadastrou uma vez, o Duplica cria sozinho o boleto de cada mês como
// "Não chegou" no começo do mês do vencimento (só o mês corrente), para ninguém esquecer.
// Quem vê: Fiscal, Financeiro e gerente.
// =====================================================================
import { estado, filialDe } from '../nucleo/estado.js?v=543c57a';
import { registrarAcoes, registrarFormulario, registrarCampo, avisar, executar } from '../nucleo/eventos.js?v=543c57a';
import { desenhar, recarregar } from '../nucleo/desenhar.js?v=543c57a';
import { cabecalho, toastHtml, vazio } from '../componentes/comuns.js?v=543c57a';
import { esc, brl, cnpjFormatado, mascaraCnpj, plural } from '../util/formato.js?v=543c57a';

const numero = (t) => Number(String(t).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
const valorBR = (v) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export const telaContasFixas = {
  id: 'contas-fixas',
  rotulo: () => 'Contas fixas',
  visivel: (p) => p.papel === 'gerente' || ['Fiscal', 'Financeiro'].includes(p.setor),

  render() {
    const lista = [...(estado.recorrencias || [])].sort((a, b) => (a.ativa === b.ativa ? a.dia - b.dia : a.ativa ? -1 : 1));
    const ed = estado.editandoConta ? lista.find((r) => r.id === estado.editandoConta) : null;
    const erro = estado.erroForm.conta;
    const ativas = lista.filter((r) => r.ativa);
    const totalMes = ativas.reduce((s, r) => s + Number(r.valor), 0);

    const linhas = lista.map((r) => `<div class="u-linha${r.ativa ? '' : ' off'}" style="min-width:720px">
        <span class="av num" aria-hidden="true" title="dia do vencimento">${r.dia}</span>
        <div><b>${esc(r.descricao)}</b><small>${esc(r.fornecedor)}${r.fornecedor_cnpj ? ' · ' + cnpjFormatado(r.fornecedor_cnpj) : ''} · ${esc(filialDe(r.filial_id)?.nome || '')}</small></div>
        <b class="num" style="width:120px">${brl(r.valor)}</b>
        <span class="pill ${r.ativa ? 'p-visto' : 'p-vencido'}">${r.ativa ? `Todo dia ${r.dia === 31 ? 'último' : r.dia}` : 'Pausada'}</span>
        <button class="bg" type="button" data-acao="editar-conta" data-id="${r.id}" style="width:80px">Editar</button>
        <button class="bg" type="button" data-acao="pausar-conta" data-id="${r.id}" style="width:96px">${r.ativa ? 'Pausar' : 'Reativar'}</button>
      </div>`).join('');

    const filiais = estado.filiais.map((f) => `<option value="${f.id}"${ed?.filial_id === f.id ? ' selected' : ''}>${esc(f.nome)}</option>`).join('');

    return cabecalho('Fiscal e Financeiro', 'Contas fixas') + toastHtml()
      + `<div class="users"><section class="secao"><div class="secao-h"><h2>${plural(ativas.length, 'conta ativa', 'contas ativas')}</h2>
          <span style="font-size:13px;color:var(--terra);font-weight:600">por mês: <b class="num">${brl(totalMes)}</b></span></div>
          <p style="margin:0;padding:14px 20px;font-size:13px;line-height:1.5;color:var(--terra);border-bottom:1px solid var(--linha)">O boleto de cada mês aparece sozinho no Fiscal como “Não chegou” quando o mês começa (só o do mês corrente; o do mês que vem aparece quando o mês virar). Pausar não apaga os boletos já criados.</p>
          ${linhas ? `<div class="rolagem">${linhas}</div>` : vazio('Nenhuma conta fixa ainda. Cadastre ao lado a primeira (ex.: internet, aluguel).')}</section>
        <form class="form-u" id="form-conta" novalidate><h2>${ed ? 'Editar conta fixa' : 'Nova conta fixa'}</h2>
          <div class="field"><label for="cf-desc">Descrição</label><input class="inp" id="cf-desc" placeholder="ex.: Internet da Matriz" value="${esc(ed?.descricao || '')}"></div>
          <div class="field"><label for="cf-forn">Fornecedor</label><input class="inp" id="cf-forn" placeholder="ex.: Net Pompéu Telecom" value="${esc(ed?.fornecedor || '')}"></div>
          <div class="field"><label for="cf-cnpj">CNPJ do fornecedor (opcional)</label><input class="inp num" id="cf-cnpj" inputmode="numeric" maxlength="18" placeholder="00.000.000/0000-00" value="${esc(ed?.fornecedor_cnpj ? cnpjFormatado(ed.fornecedor_cnpj) : '')}"></div>
          <div class="field"><label for="cf-filial">Filial</label><select class="inp" id="cf-filial"><option value="">Escolha…</option>${filiais}</select></div>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
            <div class="field"><label for="cf-valor">Valor (R$)</label><input class="inp num" id="cf-valor" inputmode="decimal" placeholder="0,00" value="${ed ? valorBR(ed.valor) : ''}"></div>
            <div class="field"><label for="cf-dia">Dia do vencimento</label><input class="inp num" id="cf-dia" type="number" min="1" max="31" placeholder="ex.: 10" value="${ed?.dia || ''}"></div>
          </div>
          <p style="margin:0;font-size:12px;color:var(--terra)">Dia 31 = último dia de cada mês. Se o valor mudar, edite aqui: vale para os próximos meses.</p>
          ${erro ? `<p class="erro" role="alert">${esc(erro)}</p>` : ''}
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="bp" type="submit" style="flex:1">${ed ? 'Salvar alterações' : 'Cadastrar conta fixa'}</button>
            ${ed ? '<button class="bg" type="button" data-acao="cancelar-conta" style="height:46px">Cancelar</button>' : ''}</div>
        </form></div>`;
  },
};

registrarAcoes({
  'editar-conta': (el) => { estado.editandoConta = el.dataset.id; estado.erroForm.conta = ''; desenhar(); document.getElementById('cf-desc')?.focus(); },
  'cancelar-conta': () => { estado.editandoConta = null; estado.erroForm.conta = ''; desenhar(); },
  'pausar-conta': (el) => executar(async () => {
    const r = estado.recorrencias.find((x) => x.id === el.dataset.id);
    await estado.api.salvarRecorrencia({ ...r, ativa: !r.ativa });
    await recarregar();
    avisar(r.ativa ? `“${r.descricao}” pausada. Não cria mais boletos novos.` : `“${r.descricao}” reativada.`);
  }),
});

registrarCampo('cf-cnpj', (el) => { el.value = mascaraCnpj(el.value); });

registrarFormulario('form-conta', () => executar(async () => {
  const v = (id) => document.getElementById(id).value.trim();
  const dados = { id: estado.editandoConta || null, descricao: v('cf-desc'), fornecedor: v('cf-forn'), fornecedor_cnpj: v('cf-cnpj'),
    filial_id: v('cf-filial'), valor: numero(v('cf-valor')), dia: Number(v('cf-dia')) };
  const erro = !dados.descricao ? 'Informe a descrição (ex.: Internet).' : !dados.fornecedor ? 'Informe o fornecedor.'
    : !dados.filial_id ? 'Escolha a filial.' : !(dados.valor > 0) ? 'Informe o valor (ex.: 199,90).'
    : !(dados.dia >= 1 && dados.dia <= 31) ? 'Dia do vencimento: de 1 a 31.' : '';
  if (erro) { estado.erroForm.conta = erro; desenhar(); return; }
  try { await estado.api.salvarRecorrencia(dados); } catch (e) { estado.erroForm.conta = e.message; desenhar(); return; }
  const novo = !estado.editandoConta;
  estado.erroForm.conta = ''; estado.editandoConta = null;
  const criados = novo ? await estado.api.gerarRecorrentes() : 0;
  await recarregar();
  avisar(novo ? `Conta fixa “${dados.descricao}” cadastrada.${criados ? ` ${plural(criados, 'boleto já foi criado', 'boletos já foram criados')} no Fiscal.` : ' O boleto aparece no Fiscal quando chegar o mês do vencimento.'}`
    : `“${dados.descricao}” atualizada.`);
}));
