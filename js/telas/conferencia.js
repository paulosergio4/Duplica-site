// =====================================================================
// DUPLICA · telas/conferencia.js
// Conferência de produtos no recebimento (dentro da tela Recebimento).
//   - Os produtos vêm do XML (nota_itens, mandados pelo importador).
//   - "Bipar produtos": a câmera fica aberta; cada EAN lido é conferido com
//     o XML e a foto daquele momento fica guardada no produto.
//   - Produto sem código de barras (ou que não lê): "Foto" confere só pela foto.
//   - As fotos ficam 3 meses; depois o Fiscal/Admin apaga sozinho (ver
//     limparFotosProduto) e fica só quem conferiu e quando.
// =====================================================================
import { estado, notaDe, filialDe } from '../nucleo/estado.js?v=1ec4033';
import { registrarAcoes, registrarCampo, avisar } from '../nucleo/eventos.js?v=1ec4033';
import { desenhar } from '../nucleo/desenhar.js?v=1ec4033';
import { esc, plural, dataHoraBR } from '../util/formato.js?v=1ec4033';
import { abrirCamera, bip } from '../util/camera.js?v=1ec4033';

const semZeros = (t) => String(t || '').replace(/\D/g, '').replace(/^0+/, '');

/** Quantos produtos da nota já foram conferidos ({ total, conferidos } ou null se o XML não trouxe produtos) */
export function resumoDaNota(notaId) {
  return (estado.conferencia || []).find((r) => r.nota_id === notaId) || null;
}

/** Selo "Produtos 3/12" para as listas */
export function seloConferencia(notaId) {
  const r = resumoDaNota(notaId);
  if (!r) return '';
  const ok = r.conferidos >= r.total;
  return `<span class="pill ${ok ? 'p-visto' : r.conferidos ? 'p-breve' : 'p-esperado'}">Produtos <span class="num">${r.conferidos}/${r.total}</span></span>`;
}

/** Abre a conferência de uma nota (carrega os produtos) */
export async function abrirConferencia(notaId) {
  estado.conferindo = { notaId, itens: null, erro: '' };
  desenhar();
  try {
    estado.conferindo.itens = await estado.api.itensDaNota(notaId);
  } catch (e) {
    estado.conferindo.erro = e.message;
  }
  desenhar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Seção da conferência (no lugar da lista de notas) */
export function conferenciaHtml() {
  const c = estado.conferindo, n = notaDe(c.notaId);
  const titulo = n ? `${esc(n.fornecedor)} · NF ${esc(n.numero)} · ${esc(filialDe(n.filial_id)?.nome || '')}` : 'Nota';
  const fechar = '<button class="bg" type="button" data-acao="conf-fechar">Voltar</button>';
  if (c.erro) return `<section class="secao conf"><div class="secao-h"><h2>Conferência de produtos</h2>${fechar}</div><p class="erro" style="padding:16px 20px;margin:0">${esc(c.erro)}</p></section>`;
  if (!c.itens) return `<section class="secao conf"><div class="secao-h"><h2>Conferência de produtos</h2>${fechar}</div><p style="padding:16px 20px;margin:0">Carregando os produtos…</p></section>`;
  if (!c.itens.length) {
    return `<section class="secao conf"><div class="secao-h"><h2>Conferência de produtos</h2>${fechar}</div>
      <p style="padding:16px 20px;margin:0">${titulo}<br><br>Os produtos desta nota ainda não chegaram no sistema. Eles vêm do XML pelo importador; se a nota entrou antes da atualização, aparecem na próxima varredura.</p></section>`;
  }
  const feitos = c.itens.filter((i) => i.conferido_em).length, total = c.itens.length;
  const pct = Math.round((feitos / total) * 100);
  const ordenados = [...c.itens].sort((a, b) => (Boolean(a.conferido_em) - Boolean(b.conferido_em)) || a.n_item - b.n_item);
  return `<section class="secao conf">
    <div class="secao-h"><div><h2>Conferência de produtos</h2><small style="color:var(--terra)">${titulo}</small></div>${fechar}</div>
    <div class="conf-topo">
      <div class="conf-progresso" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${feitos}"><span style="width:${pct}%"></span></div>
      <b class="num">${feitos} de ${plural(total, 'produto', 'produtos')} conferidos</b>
      ${feitos < total ? '<button class="bp receber-bipar" type="button" data-acao="conf-camera"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5v14M7 5v14M11 5v14M14 5v14M18 5v14M21 5v14"/></svg>Bipar produtos com a câmera</button>'
        : '<p class="conf-pronto">Todos os produtos conferidos.</p>'}
      <input type="file" id="conf-foto" accept="image/*" capture="environment" hidden>
    </div>
    <div class="rolagem">${ordenados.map(linhaItem).join('')}</div>
  </section>`;
}

function linhaItem(i) {
  const qtd = i.quantidade != null ? `${Number(i.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${esc(i.unidade || '')}` : '';
  const codigo = i.ean ? `EAN <span class="num">${esc(i.ean)}</span>` : 'Sem código de barras';
  const feito = i.conferido_em
    ? `<span class="pill p-visto">${i.sem_codigo ? 'Conferido pela foto' : 'Conferido'}</span>
       <small class="conf-quem">${esc(i.conferido_por || '')} · <span class="num">${dataHoraBR(i.conferido_em)}</span></small>`
    : '<span class="pill p-esperado">Falta conferir</span>';
  const acoes = [
    i.foto ? `<button class="bg" type="button" data-acao="conf-ver-foto" data-id="${i.id}">Ver foto</button>` : (i.foto_apagada ? '<small class="conf-quem">Foto apagada (mais de 3 meses)</small>' : ''),
    !i.conferido_em ? `<button class="bg" type="button" data-acao="conf-foto-item" data-id="${i.id}">${i.ean ? 'Não lê? Foto' : 'Conferir com foto'}</button>` : '',
  ].join('');
  return `<div class="linha"><div class="kv" style="flex:1 1 260px;min-width:0"><b>${esc(i.descricao)}</b><small>${codigo}${qtd ? ` · ${qtd}` : ''}</small></div>
    ${feito}${acoes ? `<div class="acoes">${acoes}</div>` : ''}</div>`;
}

/** Guarda a foto e confere o produto; atualiza a lista e o resumo */
async function conferir(item, eanLido, blob) {
  const foto = blob ? await estado.api.enviarFotoProduto(item.id, blob) : null;
  const r = await estado.api.conferirItem(item.id, eanLido, foto);
  Object.assign(item, { conferido_em: new Date().toISOString(), conferido_por: estado.perfil.nome, ean_lido: eanLido || null, sem_codigo: !eanLido, foto: foto || item.foto });
  const resumo = (estado.conferencia = estado.conferencia || []).find((x) => x.nota_id === estado.conferindo.notaId);
  if (resumo) Object.assign(resumo, r); else estado.conferencia.push({ nota_id: estado.conferindo.notaId, ...r });
  return r;
}

/** Diminui a foto escolhida (lado maior até 1280 px, JPEG) */
async function reduzir(arquivo) {
  const img = await createImageBitmap(arquivo);
  const k = Math.min(1, 1280 / Math.max(img.width, img.height)), t = document.createElement('canvas');
  t.width = Math.round(img.width * k); t.height = Math.round(img.height * k);
  t.getContext('2d').drawImage(img, 0, 0, t.width, t.height);
  return new Promise((ok, erro) => t.toBlob((b) => (b ? ok(b) : erro(new Error('Não consegui preparar a foto.'))), 'image/jpeg', 0.8));
}

/** Apaga as fotos de produto com mais de 3 meses — Fiscal/Admin, no máximo uma vez por dia */
export async function limparFotosProduto() {
  const p = estado.perfil;
  if (!(p.papel === 'gerente' || p.setor === 'Fiscal')) return;
  const hoje = new Date().toISOString().slice(0, 10);
  try { if (localStorage.getItem('duplica-limpeza') === hoje) return; } catch { /* sem storage */ }
  try {
    await estado.api.limparFotosAntigas();
    try { localStorage.setItem('duplica-limpeza', hoje); } catch { /* sem storage */ }
  } catch { /* tenta de novo outro dia */ }
}

registrarAcoes({
  'conf-abrir': (el) => abrirConferencia(el.dataset.id),
  'conf-fechar': () => { estado.conferindo = null; desenhar(); },

  'conf-camera': async () => {
    const c = estado.conferindo;
    try {
      await abrirCamera({
        titulo: 'Bipe o código de barras de cada produto',
        dica: 'Um produto de cada vez. A câmera fica aberta: bipe o próximo assim que ouvir o bip.',
        aoLer: async (texto, { foto }) => {
          const lido = semZeros(texto);
          if (String(texto).replace(/\D/g, '').length === 44) return 'Esse é o código da nota. Bipe o código de barras dos produtos.';
          const iguais = c.itens.filter((i) => i.ean && semZeros(i.ean) === lido);
          if (!iguais.length) { bip(false); return `O código ${texto} não está nesta nota.`; }
          const item = iguais.find((i) => !i.conferido_em);
          if (!item) return `Já conferido: ${iguais[0].descricao}`;
          try {
            const r = await conferir(item, texto, await foto());
            bip(true);
            desenhar();
            if (r.conferidos >= r.total) { avisar('Todos os produtos da nota foram conferidos.'); return true; }
            return `✓ ${item.descricao} · ${r.conferidos} de ${r.total}`;
          } catch (e) { bip(false); return e.message; }
        },
      });
    } catch (e) { avisar(e.message, true); }
  },

  // foto de um produto (sem código, ou que a câmera não lê)
  'conf-foto-item': (el) => {
    estado.confItemFoto = el.dataset.id;
    document.getElementById('conf-foto')?.click();
  },

  'conf-ver-foto': async (el) => {
    const i = estado.conferindo?.itens?.find((x) => String(x.id) === el.dataset.id);
    if (!i?.foto) return;
    estado.modal = { tipo: 'fotos-boleto', cabecalho: 'Foto do produto', titulo: `${i.descricao} · conferido por ${i.conferido_por} em ${dataHoraBR(i.conferido_em)}`, urls: null };
    desenhar();
    try {
      const url = await estado.api.urlFotoProduto(i.foto);
      if (estado.modal?.tipo === 'fotos-boleto') { estado.modal.urls = [url]; desenhar(); }
    } catch (e) { estado.modal = null; avisar(e.message, true); }
  },
});

registrarCampo('conf-foto', async (el) => {
  const arquivo = el.files?.[0], c = estado.conferindo;
  const item = c?.itens?.find((x) => String(x.id) === String(estado.confItemFoto));
  el.value = '';
  if (!arquivo || !item) return;
  try {
    avisar('Enviando a foto…');
    const r = await conferir(item, null, await reduzir(arquivo));
    bip(true);
    avisar(r.conferidos >= r.total ? 'Todos os produtos da nota foram conferidos.' : `Conferido: ${item.descricao} (${r.conferidos} de ${r.total})`);
  } catch (e) {
    bip(false);
    avisar(`Não conferiu: ${e.message}`, true);
  }
});
