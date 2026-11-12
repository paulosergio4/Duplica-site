// =====================================================================
// DUPLICA · telas/calendario.js
// Calendário de vencimentos (só Financeiro e gerente).
// Cada dia mostra quantos boletos vencem e o total; clicando no dia,
// a lista aparece ao lado. Cores:
//   vermelho = tem boleto que não chegou   azul = chegou, falta visto
//   verde    = tudo com visto
// =====================================================================
import { estado, notaDe, filialDe, naLoja } from '../nucleo/estado.js?v=499bdd4';
import { registrarAcoes } from '../nucleo/eventos.js?v=499bdd4';
import { desenhar } from '../nucleo/desenhar.js?v=499bdd4';
import { cabecalho, toastHtml, faixaFiliais, pillEtapa, vazio, docNota } from '../componentes/comuns.js?v=499bdd4';
import { esc, brl, brlCurto, isoDe, hojeISO, MESES, plural } from '../util/formato.js?v=499bdd4';

export const telaCalendario = {
  id: 'calendario',
  rotulo: () => 'Calendário',
  visivel: (p) => p.setor === 'Financeiro' || p.papel === 'gerente',

  render() {
    const ano = estado.calAno, mes = estado.calMes, hoje = hojeISO();
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const bs = estado.boletos.filter((b) => naLoja(b) && b.etapa !== 'cancelado');   // cancelados não entram

    let celulas = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => `<div class="cal-dow">${d}</div>`).join('');
    celulas += '<div class="cal-vazio" aria-hidden="true"></div>'.repeat(primeiroDiaSemana);

    let totalMes = 0, qtdMes = 0;
    for (let d = 1; d <= diasNoMes; d++) {
      const dia = isoDe(ano, mes, d);
      const doDia = bs.filter((b) => b.vencimento === dia);
      const total = doDia.reduce((s, b) => s + Number(b.valor), 0);
      totalMes += total; qtdMes += doDia.length;
      const cor = !doDia.length ? '' : doDia.some((b) => b.etapa === 'esperado') ? ' risco' : doDia.some((b) => b.etapa !== 'visto') ? ' aberto' : ' ok';
      celulas += `<button type="button" class="cal-dia${dia === hoje ? ' hoje' : ''}${dia === estado.calDia ? ' sel' : ''}${cor}"
          data-acao="escolher-dia" data-dia="${dia}" aria-pressed="${dia === estado.calDia}"
          aria-label="${d} de ${MESES[mes]}: ${doDia.length ? `${plural(doDia.length, 'boleto', 'boletos')}, ${brl(total)}` : 'nenhum boleto'}">
        <span class="cal-n num">${d}</span>${doDia.length ? `<span class="cal-q">${plural(doDia.length, 'boleto', 'boletos')}</span><span class="cal-v num">${brlCurto(total)}</span>` : ''}</button>`;
    }

    // lista do dia escolhido
    const sel = bs.filter((b) => b.vencimento === estado.calDia)
      .sort((a, b) => (a.nota_id < b.nota_id ? -1 : a.nota_id > b.nota_id ? 1 : a.parcela - b.parcela));
    const [, sm, sd] = estado.calDia.split('-');
    const totalSel = sel.reduce((s, b) => s + Number(b.valor), 0);
    const itens = sel.map((b) => {
      const n = notaDe(b.nota_id), f = filialDe(n.filial_id);
      return `<div class="cal-item"><div class="kv"><b style="color:var(--petroleo)">${esc(n.fornecedor)}</b>
        <small>${docNota(n)} · parcela ${b.parcela}/${b.total_parcelas} · ${esc(f?.nome || '')}</small></div>
        <div class="cal-item-d"><b class="num">${brl(b.valor)}</b>${pillEtapa(b)}</div></div>`;
    }).join('');

    const nomeMes = MESES[mes].charAt(0).toUpperCase() + MESES[mes].slice(1);
    return cabecalho('Financeiro', 'Calendário de vencimentos') + toastHtml()
      + faixaFiliais(estado.boletos.filter((b) => !['visto', 'cancelado'].includes(b.etapa)), 'boletos em aberto')
      + `<div class="cal-wrap"><section class="secao cal">
          <div class="secao-h"><button class="bg" type="button" data-acao="mudar-mes" data-passo="-1" aria-label="Mês anterior">‹</button>
            <h2>${nomeMes} de ${ano}</h2>
            <button class="bg" type="button" data-acao="mudar-mes" data-passo="1" aria-label="Próximo mês">›</button></div>
          <div class="cal-grid">${celulas}</div>
          <div class="cal-leg"><span><i class="l-risco"></i>tem boleto que não chegou</span><span><i class="l-aberto"></i>chegou, falta visto</span>
            <span><i class="l-ok"></i>tudo com visto</span><b class="num" style="margin-left:auto">${plural(qtdMes, 'boleto', 'boletos')} no mês · ${brl(totalMes)}</b></div>
        </section>
        <section class="secao cal-lado"><div class="secao-h"><h2>Vencem em ${Number(sd)} de ${MESES[Number(sm) - 1]}</h2>
          <span class="pill p-enviado num">${brl(totalSel)}</span></div>
          ${itens ? `<div>${itens}</div>` : vazio('Nenhum boleto vence neste dia.')}</section></div>`;
  },
};

registrarAcoes({
  'escolher-dia': (el) => { estado.calDia = el.dataset.dia; desenhar(); },
  'mudar-mes': (el) => {
    estado.calMes += Number(el.dataset.passo);
    if (estado.calMes < 0) { estado.calMes = 11; estado.calAno--; }
    if (estado.calMes > 11) { estado.calMes = 0; estado.calAno++; }
    desenhar();
  },
});
