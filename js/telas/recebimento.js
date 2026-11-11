// =====================================================================
// DUPLICA · telas/recebimento.js
// Tela "Receber notas" (feita para o CELULAR, no recebimento da loja).
//   - Abrir câmera → bipa o código de barras da DANFE (chave de 44 números)
//   - ou digita/bipa a chave com leitor USB no campo
// O Duplica marca os boletos daquela nota como "Chegou", recebido por
// quem bipou, e o Fiscal é avisado na hora (ver avisoRecebimento em app.js).
// Se a nota ainda não entrou pelo XML, fica guardada e é marcada sozinha
// quando o XML chegar.
// =====================================================================
import { estado, notaDe, filialDe } from '../nucleo/estado.js?v=149a3a4';
import { registrarAcoes, registrarFormulario, avisar } from '../nucleo/eventos.js?v=149a3a4';
import { desenhar, recarregar } from '../nucleo/desenhar.js?v=149a3a4';
import { cabecalho, toastHtml, vazio, docNota } from '../componentes/comuns.js?v=149a3a4';
import { esc, plural } from '../util/formato.js?v=149a3a4';
import { chaveValida, chaveFormatada, numeroDaChave } from '../util/chave.js?v=149a3a4';
import { abrirCamera, bip } from '../util/camera.js?v=149a3a4';

export const telaRecebimento = {
  id: 'receber',
  rotulo: () => 'Receber notas',
  visivel: (p) => p.setor === 'Recebimento' || p.setor === 'Fiscal' || p.papel === 'gerente',

  render() {
    const u = estado.ultimoRecebimento;
    const meus = (estado.recebimentos || []).filter((r) => estado.perfil.setor !== 'Recebimento' || r.perfil_id === estado.perfil.id);
    return cabecalho('Recebimento', 'Receber notas') + toastHtml()
      + `<section class="secao receber">
          <button class="bp receber-bipar" type="button" data-acao="receber-camera">${iconeCamera()}Bipar nota com a câmera</button>
          <form id="form-chave" class="receber-manual" novalidate>
            <label for="rc-chave">Ou digite a chave (44 números) / use o leitor USB</label>
            <div style="display:flex;gap:8px"><input class="inp num" id="rc-chave" inputmode="numeric" autocomplete="off" placeholder="0000 0000 0000 ..." style="flex:1;min-width:0"><button class="bg" type="submit" style="height:48px">OK</button></div>
          </form>
          ${u ? resultadoHtml(u) : ''}
        </section>
        <section class="secao"><div class="secao-h"><h2>${estado.perfil.setor === 'Recebimento' ? 'Você bipou hoje' : 'Notas bipadas hoje'}</h2><span class="pill p-breve num">${plural(meus.length, 'nota', 'notas')}</span></div>
          ${meus.length ? `<div class="rolagem">${meus.map(linhaRecebimento).join('')}</div>` : vazio('Nenhuma nota bipada hoje.')}</section>`;
  },
};

const iconeCamera = () => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';

/** Cartão com o resultado da última leitura */
function resultadoHtml(r) {
  const cor = { casada: 'var(--musgo)', ja: 'var(--ocre-txt)', pendente: 'var(--terra)', repetida: 'var(--ocre-txt)', erro: 'var(--alerta)' }[r.situacao];
  const titulo = {
    casada: r.marcados ? `Nota recebida: ${plural(r.marcados, 'boleto marcado', 'boletos marcados')} como "Chegou"` : 'Nota recebida (sem boleto)',
    ja: 'Essa nota já tinha sido recebida',
    pendente: 'Nota guardada: ainda não entrou no sistema',
    repetida: 'Essa nota já foi bipada e está aguardando o XML',
    erro: 'Não deu certo',
  }[r.situacao];
  const corpo = r.situacao === 'erro' ? esc(r.erro)
    : r.fornecedor ? `${esc(r.fornecedor)} · NF ${esc(r.numero)} · ${esc(r.filial || '')}`
    : `NF ${esc(numeroDaChave(r.chave))} · chave ${esc(chaveFormatada(r.chave))}<br>Quando o XML chegar, os boletos dela já entram como "Chegou".`;
  return `<div class="receber-resultado" style="border-color:${cor}" role="status"><b style="color:${cor}">${titulo}</b><small>${corpo}</small></div>`;
}

function linhaRecebimento(r) {
  const n = r.nota_id ? notaDe(r.nota_id) : null, f = n ? filialDe(n.filial_id) : null;
  const hora = new Date(r.feito_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const desc = n ? `${esc(n.fornecedor)} · ${docNota(n)} · ${esc(f?.nome || '')}` : `NF ${esc(numeroDaChave(r.chave))} · XML ainda não entrou`;
  const pill = r.situacao === 'pendente' ? '<span class="pill p-esperado">Aguardando XML</span>'
    : r.situacao === 'repetida' ? '<span class="pill p-breve">Repetida</span>'
    : `<span class="pill p-chegou">${plural(r.boletos, 'boleto', 'boletos')} chegou</span>`;
  return `<div class="linha"><div class="kv" style="flex:1 1 220px;min-width:0"><b style="color:var(--petroleo)">${desc}</b>
    <small>${hora} · ${esc(r.nome)}</small></div>${pill}</div>`;
}

/** Manda a chave para o banco e mostra o resultado */
async function receber(texto) {
  const chave = String(texto).replace(/\D/g, '');
  if (!chaveValida(chave)) {
    bip(false);
    estado.ultimoRecebimento = { situacao: 'erro', erro: chave.length === 44 ? 'O código não confere. Bipe de novo.' : `Li ${chave.length} números; a chave da nota tem 44. Bipe o código de barras grande da DANFE.` };
    desenhar();
    return false;
  }
  try {
    const r = await estado.api.receberNota(chave);
    bip(r.situacao === 'casada' || r.situacao === 'pendente');
    estado.ultimoRecebimento = { ...r, chave };
    await recarregar();
  } catch (e) {
    bip(false);
    estado.ultimoRecebimento = { situacao: 'erro', erro: e.message };
    desenhar();
  }
  return true;
}

registrarFormulario('form-chave', async () => {
  const campo = document.getElementById('rc-chave');
  const ok = await receber(campo.value);
  if (ok) { const c = document.getElementById('rc-chave'); if (c) { c.value = ''; c.focus(); } }
});

registrarAcoes({
  'receber-camera': async () => {
    try {
      await abrirCamera({
        titulo: 'Bipe o código de barras da DANFE',
        // só fecha a câmera quando ler uma chave válida (44 números)
        aoLer: async (texto) => {
          const c = String(texto).replace(/\D/g, '');
          if (!chaveValida(c)) return false;
          return receber(c);
        },
      });
    } catch (e) { avisar(e.message, true); }
  },
});
