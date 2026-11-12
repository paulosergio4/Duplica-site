// =====================================================================
// DUPLICA · componentes/ler-boleto.js
// Campo "Ler boleto" (Fiscal e Financeiro).
//   Bipe o código de barras com o leitor USB (ele "digita" os números e
//   aperta Enter), leia pela câmera do celular ou digite a linha digitável.
//   1. util/boleto.js tira do código: banco, valor e vencimento;
//   2. aqui procuramos os boletos com o MESMO valor (e vencimento igual,
//      vazio ou até 7 dias de diferença);
//   3. a pessoa confirma qual é. O código fica guardado no boleto
//      (api.vincularCodigo) e já abre a janela "Chegou" / "Dar visto".
// =====================================================================
import { estado, notaDe, filialDe } from '../nucleo/estado.js?v=91dee6c';
import { registrarAcoes, registrarFormulario, avisar, executar } from '../nucleo/eventos.js?v=91dee6c';
import { desenhar, recarregar } from '../nucleo/desenhar.js?v=91dee6c';
import { pillEtapa, docNota } from './comuns.js?v=91dee6c';
import { lerBoleto, linhaFormatada } from '../util/boleto.js?v=91dee6c';
import { abrirCamera, bip } from '../util/camera.js?v=91dee6c';
import { chaveValida, numeroDaChave } from '../util/chave.js?v=91dee6c';
import { receber } from '../telas/recebimento.js?v=91dee6c';
import { esc, brl, dataBR } from '../util/formato.js?v=91dee6c';

const dias = (a, b) => Math.abs(Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 864e5));

/** Boletos que podem ser este: mesmo valor; vencimento igual primeiro, depois sem vencimento, depois até 7 dias */
function candidatos(res) {
  return estado.boletos
    .filter((b) => b.etapa !== 'cancelado' && !b.pago_em && Math.abs(Number(b.valor) - res.valor) < 0.005)
    .map((b) => ({ b, dist: !res.vencimento ? 0 : !b.vencimento ? 1 : dias(b.vencimento, res.vencimento) * 2 }))
    .filter((x) => x.dist <= 14)
    .sort((x, y) => x.dist - y.dist || (x.b.etapa === 'esperado' ? -1 : 1))
    .map((x) => x.b)
    .slice(0, 8);
}

/** Notas que vieram SEM parcelas no XML (1 boleto sem vencimento, valor = total da nota) e cujo total
 *  é maior que o boleto lido: o boleto lido pode ser uma das parcelas delas. */
function semParcelas(res) {
  return estado.boletos
    .filter((b) => b.etapa === 'esperado' && !b.vencimento && b.total_parcelas === 1 && Number(b.valor) > res.valor + 0.005)
    .map((b) => { const k = Math.round(Number(b.valor) / res.valor); return { b, exato: k > 1 && k <= 12 && Math.abs(k * res.valor - Number(b.valor)) < 0.05 }; })
    .sort((x, y) => (y.exato - x.exato) || (Number(x.b.valor) - Number(y.b.valor)))
    .slice(0, 6);
}

/** Botão de ação de cada candidato, conforme a tela e a etapa do boleto */
function botao(b, tela) {
  if (tela === 'financeiro') {
    if (['esperado', 'chegou'].includes(b.etapa)) return `<button class="visto" type="button" data-acao="ler-usar" data-id="${b.id}" data-depois="direto">É este · Chegou direto aqui</button>`;
    if (b.etapa === 'enviado') return `<button class="visto" type="button" data-acao="ler-usar" data-id="${b.id}" data-depois="visto">É este · Dar visto</button>`;
  } else if (b.etapa === 'esperado') {
    return `<button class="bp" type="button" data-acao="ler-usar" data-id="${b.id}" data-depois="chegou">É este · Chegou</button>`;
  }
  return `<button class="bg" type="button" data-acao="ler-usar" data-id="${b.id}" data-depois="">É este · Guardar o código</button>`;
}

/** Bloco "Ler boleto" para a tela (tela = 'fiscal' | 'financeiro') */
export function leitorHtml(tela) {
  const l = estado.leitura && estado.leitura.tela === tela ? estado.leitura : null;
  let resultado = '';
  if (l && l.res.chaveNota) {
    const c = l.res.chaveNota, n = estado.notas.find((x) => x.chave === c);
    const pode = estado.perfil.papel === 'gerente' || ['Fiscal', 'Recebimento'].includes(estado.perfil.setor);
    resultado = `<div class="lote ler-sugestao" role="status" style="border-radius:12px;display:flex;flex-direction:column;gap:10px">
        <b>Esse é o código de barras da nota, não do boleto.</b>
        <small>${n ? `${esc(n.fornecedor)} · NF ${esc(n.numero)} · ${esc(filialDe(n.filial_id)?.nome || '')}` : `NF ${esc(numeroDaChave(c))} (o XML ainda não entrou no sistema)`}</small>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${pode ? '<button class="bp" type="button" data-acao="ler-receber-nota">Marcar que a nota chegou</button>' : ''}
        ${n ? '<button class="bg" type="button" data-acao="ler-ver-nota">Ver boletos desta nota</button>' : ''}</div>
        <small>Para ler o boleto, aponte para o código de barras que fica no pé do boleto.</small></div>`;
  } else if (l && !l.res.ok) {
    resultado = `<p class="erro" role="alert" style="margin:0">${esc(l.res.erro)}</p>`;
  } else if (l) {
    const r = l.res;
    const jaLido = estado.boletos.find((b) => b.codigo_barras === r.barras);
    const cab = `<div class="kv"><small>${esc(r.bancoNome)} · linha ${esc(linhaFormatada(r.linha))}</small>
        <b class="num" style="font-size:17px;color:var(--petroleo)">${brl(r.valor)} · vence ${r.vencimento ? dataBR(r.vencimento) : 'sem data'}</b></div>`;
    if (jaLido) {
      const n = notaDe(jaLido.nota_id);
      resultado = cab + `<div class="lote" style="border-radius:12px"><small>Esse boleto <b>já foi lido</b>: ${esc(n.fornecedor)} · ${docNota(n)} · parcela ${jaLido.parcela}/${jaLido.total_parcelas}</small>
        ${pillEtapa(jaLido)}<button class="bg" type="button" data-acao="abrir-boleto" data-id="${jaLido.id}">Detalhes</button></div>`;
    } else {
      const lista = candidatos(r);
      resultado = cab + (lista.length
        ? `<small style="color:var(--terra)">${lista.length === 1 ? 'Achei este boleto com o mesmo valor:' : `Achei ${lista.length} boletos com o mesmo valor. Confira o fornecedor:`}</small>`
          + lista.map((b) => {
            const n = notaDe(b.nota_id), f = filialDe(n.filial_id);
            const aviso = !b.vencimento ? ' · <b>vai preencher o vencimento</b>' : r.vencimento && b.vencimento !== r.vencimento ? ` · <b style="color:var(--alerta)">vencimento no sistema: ${dataBR(b.vencimento)}</b>` : '';
            return `<div class="linha" style="border-radius:12px;border:1px solid var(--linha)"><div class="kv" style="flex:1 1 260px">
                <b style="color:var(--petroleo)">${esc(n.fornecedor)}</b>
                <small>${docNota(n)} · ${esc(f?.nome || '')} · parcela ${b.parcela}/${b.total_parcelas}${aviso}</small></div>
              ${pillEtapa(b)}${botao(b, tela)}</div>`;
          }).join('')
        : `<div class="lote" style="border-radius:12px"><small>Nenhum boleto em aberto com esse valor${r.vencimento ? ' e vencimento' : ''}. Pode ser de uma nota que ainda não entrou no sistema, ou o valor do boleto é diferente do da nota.</small>
            <button class="bg" type="button" data-acao="ler-avulso">Lançar como boleto avulso</button></div>`);
      // notas que vieram sem parcelas: o boleto lido pode ser uma parcela delas
      const sp = lista.length ? [] : semParcelas(r);
      if (sp.length) {
        resultado += `<small style="color:var(--terra)">Ou é parcela de uma nota que veio <b>sem as parcelas</b> no XML? Confira o fornecedor:</small>`
          + sp.map(({ b, exato }) => {
            const n = notaDe(b.nota_id), f = filialDe(n.filial_id);
            const k = Math.round(Number(b.valor) / r.valor);
            return `<div class="linha" style="border-radius:12px;border:1px solid var(--linha)"><div class="kv" style="flex:1 1 260px">
                <b style="color:var(--petroleo)">${esc(n.fornecedor)}</b>
                <small>${docNota(n)} · ${esc(f?.nome || '')} · total <span class="num">${brl(b.valor)}</span>${exato ? ` · <b>dá ${k} parcelas de ${brl(r.valor)}</b>` : ''}</small></div>
              <button class="bp" type="button" data-acao="ler-parcelas" data-nota="${n.id}">É desta nota · Informar parcelas</button></div>`;
          }).join('');
      }
    }
  }
  return `<section class="secao"><form id="form-ler-boleto" class="ler-boleto" novalidate style="padding:16px 20px;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="flex:1 1 360px"><label for="ler-codigo">Ler boleto: bipe o código de barras ou digite a linha digitável</label>
          <input class="inp num" id="ler-codigo" inputmode="numeric" autocomplete="off" placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000" value="${esc(l?.texto || '')}"></div>
        <button class="bp" type="submit" style="height:46px">Ler</button>
        <button class="bg ler-camera" type="button" data-acao="ler-camera"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Ler com a câmera</button>
        ${l ? '<button class="bg" type="button" data-acao="ler-limpar" style="height:46px">Limpar</button>' : ''}
      </div>${resultado}</form></section>`;
}

registrarFormulario('form-ler-boleto', () => {
  const texto = document.getElementById('ler-codigo').value;
  estado.leitura = { tela: estado.tela, texto, res: lerBoleto(texto) };
  desenhar();
  document.getElementById('ler-codigo')?.select();
});

registrarAcoes({
  // lê o código de barras do boleto pela câmera do celular
  'ler-camera': async () => {
    const tela = estado.tela;
    try {
      await abrirCamera({
        titulo: 'Aponte para o código de barras do boleto',
        dica: 'Pode ser com o celular em pé ou deitado. Encaixe o código de barras do boleto inteiro no retângulo, bem iluminado.',
        aoLer: (texto) => {
          const res = lerBoleto(texto);
          if (!res.ok) {
            // leu o código da NOTA (DANFE) em vez do boleto: avisa e oferece receber a nota
            const c = String(texto).match(/\d{44}/)?.[0];
            if (c && chaveValida(c)) {
              bip(true);
              estado.leitura = { tela, texto: c, res: { ok: false, chaveNota: c, erro: '' } };
              desenhar();
              return true;
            }
            return false;                        // leitura incompleta: continua tentando
          }
          bip(true);
          estado.leitura = { tela, texto: res.linha || res.barras, res };
          desenhar();
          return true;
        },
      });
    } catch (e) { avisar(e.message, true); }
  },
  // leu a DANFE no lugar do boleto
  'ler-receber-nota': async () => {
    const c = estado.leitura.res.chaveNota;
    estado.leitura = null;
    Object.assign(estado, { tela: 'receber', sel: null, modal: null });
    await receber(c, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  'ler-ver-nota': () => {
    const n = estado.notas.find((x) => x.chave === estado.leitura.res.chaveNota);
    estado.leitura = null;
    estado.busca = n ? String(n.numero) : '';
    desenhar();
  },
  'ler-limpar': () => { estado.leitura = null; desenhar(); document.getElementById('ler-codigo')?.focus(); },

  // guarda o código no boleto escolhido e já abre a próxima janela
  'ler-usar': (el) => executar(async () => {
    const r = estado.leitura.res, id = el.dataset.id, depois = el.dataset.depois;
    await estado.api.vincularCodigo(id, r.barras, r.linha, r.vencimento);
    estado.leitura = null;
    await recarregar();
    if (depois === 'chegou' || depois === 'visto') estado.modal = { ids: [id] };
    else if (depois === 'direto') estado.modal = { ids: [id], tipo: 'direto' };
    else avisar('Código do boleto guardado. A linha digitável aparece nos Detalhes para copiar.');
    desenhar();
  }),

  // nota sem parcelas: abre "Informar parcelas" já com o boleto lido como 1ª parcela
  'ler-parcelas': (el) => {
    const r = estado.leitura.res;
    const b = estado.boletos.find((x) => x.nota_id === el.dataset.nota && !x.vencimento);
    const total = Number(b.valor), fmt = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const k = Math.round(total / r.valor);
    let parcelas;
    if (k > 1 && k <= 12 && Math.abs(k * r.valor - total) < 0.05) {
      // divide certinho: k parcelas iguais; o vencimento das outras a pessoa completa
      parcelas = Array.from({ length: k }, (_, i) => ({ venc: i === 0 ? (r.vencimento || '') : '', valor: fmt(i === k - 1 ? total - r.valor * (k - 1) : r.valor) }));
    } else {
      parcelas = [{ venc: r.vencimento || '', valor: fmt(r.valor) }, { venc: '', valor: fmt(Math.round((total - r.valor) * 100) / 100) }];
    }
    estado.modal = { tipo: 'parcelas', nota: el.dataset.nota, parcelas, erro: '' };
    desenhar();
  },

  // nenhum boleto bateu: abre o boleto avulso já com valor e vencimento
  'ler-avulso': () => {
    const r = estado.leitura.res;
    estado.modal = {
      tipo: 'avulso', erro: '',
      parcelas: [{ venc: r.vencimento || '', valor: r.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }],
      v: { filial: estado.loja !== 'todas' ? estado.loja : '' },
    };
    desenhar();
    document.getElementById('av-forn')?.focus();
  },
});

/** Linha digitável nos Detalhes do boleto, com botão de copiar */
export function linhaDigitavelHtml(b) {
  if (!b.linha_digitavel) return '';
  return `<div class="field"><label>Linha digitável</label>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><code class="num" style="font-size:13px;background:var(--creme-2);padding:8px 10px;border-radius:8px;flex:1 1 300px">${esc(linhaFormatada(b.linha_digitavel))}</code>
    <button class="bg" type="button" data-acao="copiar-linha" data-linha="${esc(b.linha_digitavel)}">Copiar</button></div></div>`;
}

registrarAcoes({
  'copiar-linha': (el) => executar(async () => {
    await navigator.clipboard.writeText(el.dataset.linha);
    avisar('Linha digitável copiada. É só colar no banco para pagar.');
  }),
});

