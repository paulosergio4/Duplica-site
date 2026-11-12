// =====================================================================
// DUPLICA · util/camera.js
// Lê código de barras pela câmera do celular.
//   1. Se o navegador tem o leitor próprio (BarcodeDetector: Chrome no
//      Android), usa ele — é o mais rápido.
//   2. Senão (iPhone, alguns PCs), carrega a biblioteca ZXing na hora.
// A janela da câmera fica num elemento PRÓPRIO no <body>, fora do
// redesenho das telas, para o vídeo não piscar.
// =====================================================================
const ZXING = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm';

let aberto = null;   // { parar }

/**
 * Abre a câmera em tela cheia e chama aoLer(texto) com cada código lido.
 * aoLer devolve true para fechar a câmera (código aceito) ou false para continuar.
 */
export async function abrirCamera({ titulo = 'Aponte para o código de barras', dica = 'Deixe o código de barras da nota inteiro dentro do retângulo, bem iluminado.', aoLer }) {
  fecharCamera();
  const caixa = document.createElement('div');
  caixa.className = 'camera';
  caixa.innerHTML = `<div class="camera-topo"><b>${titulo}</b><button type="button" class="bg camera-fechar">Fechar</button></div>
    <div class="camera-video"><video playsinline muted></video><div class="camera-mira"></div></div>
    <p class="camera-dica">${dica}</p>`;
  document.body.appendChild(caixa);
  const video = caixa.querySelector('video');
  let parado = false, stream = null, controleZxing = null;

  const parar = () => {
    parado = true;
    try { controleZxing?.stop(); } catch { /* já parou */ }
    stream?.getTracks().forEach((t) => t.stop());
    caixa.remove();
    aberto = null;
  };
  aberto = { parar };
  caixa.querySelector('.camera-fechar').addEventListener('click', parar);

  let ocupado = false;
  const entregar = async (texto) => {
    if (parado || ocupado || !texto) return;
    ocupado = true;
    try { if (await aoLer(texto)) parar(); } finally { ocupado = false; }
  };

  try {
    if ('BarcodeDetector' in window) {
      const formatos = await window.BarcodeDetector.getSupportedFormats();
      if (formatos.includes('code_128') || formatos.includes('itf')) {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false });
        video.srcObject = stream;
        await video.play();
        const detector = new window.BarcodeDetector({ formats: formatos.filter((f) => ['code_128', 'itf', 'ean_13', 'qr_code'].includes(f)) });
        const passo = async () => {
          if (parado) return;
          try { const r = await detector.detect(video); for (const c of r) await entregar(c.rawValue); } catch { /* quadro ruim */ }
          if (!parado) setTimeout(passo, 120);
        };
        passo();
        return parar;
      }
    }
    // sem leitor próprio: ZXing
    const { BrowserMultiFormatReader } = await import(ZXING);
    const leitor = new BrowserMultiFormatReader();
    controleZxing = await leitor.decodeFromConstraints(
      { video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false }, video,
      (res) => { if (res) entregar(res.getText()); });
    return parar;
  } catch (e) {
    parar();
    const msg = /Permission|NotAllowed/i.test(e?.name + e?.message)
      ? 'O navegador não deixou usar a câmera. Libere a câmera para este site e tente de novo.'
      : /NotFound|Overconstrained/i.test(e?.name) ? 'Não achei a câmera deste aparelho.' : 'Não foi possível abrir a câmera: ' + (e?.message || e);
    throw new Error(msg);
  }
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
