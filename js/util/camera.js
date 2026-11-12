// =====================================================================
// DUPLICA · util/camera.js
// Lê código de barras pela câmera do celular (chave da DANFE ou boleto).
//   - Pede a câmera traseira na maior resolução que ela der, com foco
//     contínuo e um pouco de zoom (código de nota é fino e denso).
//   - A cada ~150 ms recorta a área do retângulo em resolução cheia e
//     tenta ler: primeiro com o leitor do próprio navegador
//     (BarcodeDetector, Chrome no Android); se não tiver, com a ZXing
//     (iPhone, alguns PCs), carregada na hora.
//   - Se a leitura ao vivo não sair, "Tirar foto" usa a câmera do celular
//     em resolução máxima e lê da foto (bem mais nítido).
//   - Lanterna, quando o aparelho permite.
//   - Lê com o celular em pé ou deitado: se a pessoa virar o celular,
//     a tela acompanha (CSS de paisagem em telas.css).
// A janela da câmera fica num elemento PRÓPRIO no <body>, fora do
// redesenho das telas, para o vídeo não piscar.
// =====================================================================
import { temScandit, abrirScandit } from './scandit.js?v=31e0c6d';

const ZXING = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm';
const FORMATOS = ['code_128', 'itf', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'];

let aberto = null;   // { parar }
let scanditFalhou = '';   // motivo de a Scandit não abrir neste aparelho/sessão (aí usa o leitor próprio)
let leitorZxing = null;

/** Monta (uma vez) o leitor que serve para este aparelho. Devolve async (fonte) => [textos] */
async function prepararLeitor() {
  if ('BarcodeDetector' in window) {
    try {
      const suportados = await window.BarcodeDetector.getSupportedFormats();
      const formats = FORMATOS.filter((f) => suportados.includes(f));
      if (formats.includes('code_128')) {
        const detector = new window.BarcodeDetector({ formats });
        return async (fonte) => (await detector.detect(fonte)).map((c) => c.rawValue);
      }
    } catch { /* cai para a ZXing */ }
  }
  if (!leitorZxing) {
    const { BrowserMultiFormatReader, BarcodeFormat } = await import(ZXING);
    // 2 = POSSIBLE_FORMATS, 3 = TRY_HARDER (DecodeHintType da ZXing)
    const dicas = new Map([[2, [BarcodeFormat.CODE_128, BarcodeFormat.ITF, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.QR_CODE]], [3, true]]);
    leitorZxing = new BrowserMultiFormatReader(dicas);
  }
  return async (fonte) => {
    let tela = fonte;
    if (!(fonte instanceof HTMLCanvasElement)) {
      tela = document.createElement('canvas');
      tela.width = fonte.videoWidth || fonte.width; tela.height = fonte.videoHeight || fonte.height;
      tela.getContext('2d').drawImage(fonte, 0, 0);
    }
    try { return [leitorZxing.decodeFromCanvas(tela).getText()]; } catch { return []; }
  };
}

/** Desenha num canvas a região do vídeo que está dentro do retângulo (um pouco maior, para sobrar margem) */
function recortar(video, mira, tela) {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return null;
  // o vídeo é mostrado com object-fit: cover → converter a posição da mira para pixels do vídeo
  const caixa = video.getBoundingClientRect(), m = mira.getBoundingClientRect();
  const escala = Math.max(caixa.width / vw, caixa.height / vh);
  const dx = (caixa.width - vw * escala) / 2, dy = (caixa.height - vh * escala) / 2;
  const folga = 0.12;
  let x = (m.left - caixa.left - dx) / escala, y = (m.top - caixa.top - dy) / escala;
  let w = m.width / escala, h = m.height / escala;
  x -= w * folga; y -= h * folga; w *= 1 + 2 * folga; h *= 1 + 2 * folga;
  x = Math.max(0, x); y = Math.max(0, y); w = Math.min(vw - x, w); h = Math.min(vh - y, h);
  tela.width = Math.round(w); tela.height = Math.round(h);
  tela.getContext('2d').drawImage(video, x, y, w, h, 0, 0, tela.width, tela.height);
  return tela;
}

/**
 * Abre a câmera em tela cheia e chama aoLer(texto, { foto }) com cada código lido.
 *   foto() devolve a imagem (JPEG) do momento da leitura, para guardar.
 * aoLer devolve true para fechar a câmera (código aceito), false para continuar,
 * ou um texto: mostra o texto e continua (ex.: conferência de vários produtos).
 */
export async function abrirCamera({ titulo = 'Aponte para o código de barras', dica = 'Encaixe o código de barras inteiro no retângulo, bem iluminado.', aoLer }) {
  fecharCamera();
  const caixa = document.createElement('div');
  caixa.className = 'camera';
  caixa.innerHTML = `<div class="camera-topo"><b>${titulo}</b><button type="button" class="bg camera-fechar">Fechar</button></div>
    <div class="camera-video"><video playsinline muted></video><div class="camera-mira"><span class="camera-linha"></span></div></div>
    <div class="camera-baixo">
      <p class="camera-dica">${dica}</p>
      <p class="camera-status" role="status">Abrindo a câmera…</p>
      <small class="camera-info"></small>
      <div class="camera-botoes">
        <label class="bg camera-foto">Não lê? Tirar foto<input type="file" accept="image/*" capture="environment" hidden></label>
        <button type="button" class="bg camera-luz" hidden>Lanterna</button>
      </div>
    </div>`;
  document.body.appendChild(caixa);
  const video = caixa.querySelector('video'), mira = caixa.querySelector('.camera-mira');
  const status = caixa.querySelector('.camera-status');
  const dizer = (t) => { status.textContent = t; };
  let parado = false, stream = null, timer = null, scandit = null;

  const parar = () => {
    parado = true;
    clearTimeout(timer);
    stream?.getTracks().forEach((t) => t.stop());
    scandit?.parar();
    caixa.remove();
    aberto = null;
  };
  aberto = { parar };
  caixa.querySelector('.camera-fechar').addEventListener('click', parar);

  let ocupado = false, recusados = 0, ultimo = '', ultimoEm = 0;
  // foto do momento da leitura: quadro do vídeo (ou a foto tirada), no máximo 1280 px
  const fotoDe = (fonte) => () => new Promise((ok, erro) => {
    const w = fonte.videoWidth || fonte.width, h = fonte.videoHeight || fonte.height, k = Math.min(1, 1280 / Math.max(w, h));
    const t = document.createElement('canvas');
    t.width = Math.round(w * k); t.height = Math.round(h * k);
    t.getContext('2d').drawImage(fonte, 0, 0, t.width, t.height);
    t.toBlob((b) => (b ? ok(b) : erro(new Error('Não consegui guardar a foto.'))), 'image/jpeg', 0.8);
  });
  let fonteAtual = null;
  const entregar = async (textos) => {
    for (const texto of textos) {
      if (parado || !texto) return;
      // o mesmo código continua na frente da câmera: não repete por 2,5 s
      if (texto === ultimo && Date.now() - ultimoEm < 2500) continue;
      ultimo = texto; ultimoEm = Date.now();
      const r = await aoLer(texto, { foto: scandit && !fonteAtual ? scandit.foto : fotoDe(fonteAtual || video) });
      if (r === true) { parar(); return; }
      if (typeof r === 'string') { dizer(r); continue; }
      recusados++;
      const n = String(texto).replace(/\D/g, '').length;
      dizer(recusados > 2 ? `Li um código com ${n} números, que não é o certo. Aponte para o código de barras grande.` : 'Lendo… segure firme.');
    }
  };

  // leitor próprio (BarcodeDetector/ZXing): ao vivo quando não há Scandit, e sempre para "Tirar foto"
  let ler = null;
  const leitor = async () => (ler ??= await prepararLeitor());

  // Plano B: foto em resolução máxima
  caixa.querySelector('.camera-foto input').addEventListener('change', async (ev) => {
    const arq = ev.target.files?.[0];
    ev.target.value = '';
    if (!arq) return;
    dizer('Lendo a foto…');
    ocupado = true;
    try {
      const img = await createImageBitmap(arq);
      // tenta inteira, e também reduzida (algumas câmeras dão foto grande demais para o leitor)
      const tentativas = [img];
      if (Math.max(img.width, img.height) > 2000) {
        const k = 2000 / Math.max(img.width, img.height), t = document.createElement('canvas');
        t.width = Math.round(img.width * k); t.height = Math.round(img.height * k);
        t.getContext('2d').drawImage(img, 0, 0, t.width, t.height);
        tentativas.push(t);
      }
      for (const fonte of tentativas) {
        fonteAtual = img;
        const lidos = await (await leitor())(fonte).catch(() => []);
        if (lidos.length) { await entregar(lidos); if (parado) return; }
      }
      fonteAtual = null;
      if (!parado && status.textContent === 'Lendo a foto…') dizer('Não achei o código na foto. Tire de novo mais perto, com o código reto e nítido.');
    } catch {
      dizer('Não consegui abrir a foto. Tente de novo.');
    } finally { ocupado = false; }
  });

  // 1º: Scandit (lê o código fino da nota com o celular em pé). Se não abrir, segue com o leitor próprio.
  if (temScandit() && !scanditFalhou) {
    const area = caixa.querySelector('.camera-video');
    const alvo = document.createElement('div');
    alvo.className = 'camera-scandit';
    area.prepend(alvo);
    try {
      dizer('Abrindo o leitor… (na primeira vez demora um pouco)');
      const motivo = (e) => (String(e?.message || e).match(/\((\d+)\)/) ? `Scandit ${String(e.message).match(/\((\d+)\)/)[1]}` : 'Scandit não abriu');
      const aberta = await Promise.race([
        abrirScandit(alvo, (texto) => entregar([texto]), (e) => {
          // licença recusada com a câmera já aberta: reabre com o leitor próprio
          scanditFalhou = motivo(e);
          console.warn('Scandit recusou a licença; usando o leitor próprio.', e);
          if (!parado) { parar(); abrirCamera({ titulo, dica, aoLer }).catch(() => {}); }
        }),
        new Promise((_, erro) => setTimeout(() => erro(new Error('demorou')), 40000)),
      ]);
      if (parado) { aberta.parar(); return parar; }
      scandit = aberta;
      caixa.classList.add('com-scandit');
      video.remove();
      dizer('Procurando o código…');
      caixa.querySelector('.camera-info').textContent = 'Scandit';
      return parar;
    } catch (e) {
      scanditFalhou = String(e?.message || e).match(/\((\d+)\)/) ? `Scandit ${String(e.message).match(/\((\d+)\)/)[1]}` : 'Scandit não abriu';
      alvo.remove();
      console.warn('Scandit não abriu; usando o leitor próprio.', e);
      if (parado) return parar;
    }
  }

  try {
    ler = await prepararLeitor();
  } catch (e) {
    parar();
    throw new Error('Não consegui carregar o leitor de código. Confira a internet e tente de novo.');
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      // pede o máximo (4K); o aparelho entrega o que tiver. Mais pixels = barras finas da nota legíveis com o celular em pé
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
      audio: false,
    });
  } catch (e) {
    parar();
    const msg = /Permission|NotAllowed/i.test(e?.name + e?.message)
      ? 'O navegador não deixou usar a câmera. Libere a câmera para este site e tente de novo.'
      : /NotFound|Overconstrained/i.test(e?.name) ? 'Não achei a câmera deste aparelho.' : 'Não foi possível abrir a câmera: ' + (e?.message || e);
    throw new Error(msg);
  }
  if (parado) { stream.getTracks().forEach((t) => t.stop()); return parar; }

  // foco contínuo, um pouco de zoom e lanterna (quando o aparelho deixa)
  const trilha = stream.getVideoTracks()[0];
  const cap = trilha.getCapabilities?.() || {};
  // Zoom 2x: o celular recorta do sensor inteiro (12 MP) antes de reduzir para o vídeo,
  // então o código ganha detalhe — e a pessoa segura um pouco mais longe, onde o foco pega.
  // Cada ajuste vai separado: se o aparelho recusar um, os outros continuam valendo.
  let zoom = 1;
  if (cap.zoom && cap.zoom.max > 1) {
    zoom = Math.min(cap.zoom.max, 2);
    await trilha.applyConstraints({ advanced: [{ zoom }] }).catch(() => { zoom = 1; });
  }
  if (cap.focusMode?.includes('continuous')) trilha.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
  if (cap.torch) {
    const luz = caixa.querySelector('.camera-luz');
    let acesa = false;
    luz.hidden = false;
    luz.addEventListener('click', () => {
      acesa = !acesa;
      trilha.applyConstraints({ advanced: [{ torch: acesa }] }).catch(() => {});
      luz.textContent = acesa ? 'Apagar lanterna' : 'Lanterna';
    });
  }

  video.srcObject = stream;
  await video.play().catch(() => {});
  dizer('Procurando o código…');
  // informação técnica pequena (ajuda a entender quando um aparelho não lê)
  caixa.querySelector('.camera-info').textContent = `${video.videoWidth}×${video.videoHeight}${zoom > 1 ? ` · zoom ${zoom}x` : ''}${'BarcodeDetector' in window ? '' : ' · zx'}${scanditFalhou ? ` · ${scanditFalhou}` : ''}`;

  // leitura ao vivo: alterna o recorte do retângulo (mais nítido) com o quadro inteiro
  const tela = document.createElement('canvas');
  let volta = 0;
  const passo = async () => {
    if (parado) return;
    if (!ocupado && video.readyState >= 2) {
      ocupado = true;
      try {
        const fonte = volta++ % 3 === 2 ? video : recortar(video, mira, tela);
        if (fonte) await entregar(await ler(fonte));
      } catch { /* quadro ruim */ }
      ocupado = false;
    }
    if (!parado) timer = setTimeout(passo, 150);
  };
  passo();
  return parar;
}

export function fecharCamera() { aberto?.parar(); }

/** Bip curto de confirmação (sem arquivo de som) */
export function bip(ok = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = ok ? 880 : 220; o.type = 'sine';
    g.gain.setValueAtTime(0.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ok ? 0.18 : 0.4));
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + (ok ? 0.2 : 0.42));
    if (ok && navigator.vibrate) navigator.vibrate(80);
  } catch { /* sem áudio */ }
}
