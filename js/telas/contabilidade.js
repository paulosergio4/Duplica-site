// =====================================================================
// DUPLICA · telas/contabilidade.js
// Tela da CONTABILIDADE. Por enquanto só consulta os boletos que já têm
// visto do financeiro. A etapa própria da contabilidade (boletos avulsos
// que ela envia ao financeiro) ainda vai ser definida.
// =====================================================================
import { estado, notaDe, naLoja, ordenarPorVencimento } from '../nucleo/estado.js?v=9b9ec3e';
import { cabecalho, sobretituloHoje, toastHtml, vazio, docNota } from '../componentes/comuns.js?v=9b9ec3e';
import { esc, brl, dataBR, dataHoraBR } from '../util/formato.js?v=9b9ec3e';

export const telaContabilidade = {
  id: 'contabilidade',
  rotulo: () => 'Contabilidade',
  visivel: (p) => p.setor === 'Contabilidade' || p.papel === 'gerente',

  render() {
    const vistos = estado.boletos.filter((b) => b.etapa === 'visto' && naLoja(b)).sort(ordenarPorVencimento);
    const linhas = vistos.map((b) => {
      const n = notaDe(b.nota_id);
      return `<div class="linha"><div class="kv" style="flex:1 1 220px;min-width:180px"><b style="color:var(--petroleo)">${esc(n.fornecedor)}</b>
        <small>${docNota(n)} · parcela ${b.parcela}/${b.total_parcelas} · visto por ${esc(b.visto_por)} em ${dataHoraBR(b.visto_em)}</small></div>
        <div class="kv" style="width:110px"><small>Vencimento</small><b class="num">${dataBR(b.vencimento)}</b></div>
        <div class="kv" style="width:120px"><small>Valor</small><b class="num">${brl(b.valor)}</b></div>
        <span class="pill p-visto">Visto do financeiro</span></div>`;
    }).join('');
    return cabecalho(sobretituloHoje('Contabilidade'), 'Boletos para a contabilidade') + toastHtml()
      + `<section class="secao"><div class="secao-h"><h2>Com visto do financeiro</h2><span class="pill p-breve">Etapa da contabilidade a definir</span></div>
        ${linhas ? `<div class="rolagem">${linhas}</div>` : vazio('Nenhum boleto com visto ainda.')}</section>`;
  },
};
