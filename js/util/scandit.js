// =====================================================================
// DUPLICA · util/scandit.js
// Leitor profissional da Scandit (licença em CONFIG.SCANDIT_KEY).
// Lê o código de barras fino da DANFE com o celular em pé, papel
// amassado, pouca luz… Carregado só quando a câmera abre, direto da CDN
// (o mapa de módulos está em html/app.html).
// Se faltar a chave, a licença vencer ou o aparelho não aguentar
// (sem WebGL etc.), quem chama cai no leitor próprio (util/camera.js).
// =====================================================================
import { CONFIG } from '../config.js?v=a3d7d3b';

const VERSAO = '8.7.0';
const LIB = `https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@${VERSAO}/sdc-lib/`;

let pronto = null;   // promessa: { core, bc, context, captura } (o motor é carregado uma vez só)
let ouvinteAtual = null;
let licencaRecusada = null;   // { code, message } quando a Scandit recusa a chave
let aoRecusar = null;

export const temScandit = () => Boolean(CONFIG.SCANDIT_KEY);

async function carregar() {
  const [core, bc] = await Promise.all([
    import('@scandit/web-datacapture-core'),
    import('@scandit/web-datacapture-barcode'),
  ]);
  const context = await core.DataCaptureContext.forLicenseKey(CONFIG.SCANDIT_KEY, {
    libraryLocation: LIB,
    moduleLoaders: [bc.barcodeCaptureLoader()],
  });
  // a Scandit avisa se a licença vale (vencida, domínio errado…) — pode chegar só depois que a câmera liga
  context.addListener({
    didChangeStatus: (_c, st) => {
      if (st && st.isValid === false) { licencaRecusada = st; aoRecusar?.(st); }
    },
  });
  const S = bc.Symbology;
  const ajustes = new bc.BarcodeCaptureSettings();
  // DANFE (Code 128), boleto (Interleaved 2 of 5), produtos (EAN/UPC) e QR da NFC-e
  ajustes.enableSymbologies([S.Code128, S.InterleavedTwoOfFive, S.EAN13UPCA, S.EAN8, S.UPCE, S.QR]);
  // a chave da nota e o boleto têm 44 números: o padrão da Scandit não lê códigos tão compridos
  const c128 = ajustes.settingsForSymbology(S.Code128);
  c128.activeSymbolCounts = Array.from({ length: 77 }, (_, i) => i + 4);          // 4 a 80 símbolos
  const itf = ajustes.settingsForSymbology(S.InterleavedTwoOfFive);
  itf.activeSymbolCounts = Array.from({ length: 45 }, (_, i) => i * 2 + 4).filter((n) => n <= 90);   // pares, até 90
  ajustes.codeDuplicateFilter = 1500;   // o mesmo código só volta depois de 1,5 s
  const captura = await bc.BarcodeCapture.forContext(context, ajustes);
  // bip/vibração: o Duplica toca o próprio bip (util/camera.js); o da Scandit fica no padrão
  captura.addListener({
    didScan: async (modo, sessao) => {
      const codigo = sessao.newlyRecognizedBarcode;
      if (!codigo?.data || !ouvinteAtual) return;
      await captura.setEnabled(false);          // segura a próxima leitura enquanto trata esta
      try { await ouvinteAtual(codigo.data); } finally { if (ouvinteAtual) await captura.setEnabled(true); }
    },
  });
  return { core, bc, context, captura };
}

/**
 * Liga a câmera da Scandit dentro de `elemento`; cada código lido vai para aoCodigo(texto).
 * Devolve { parar, foto, info }. Lança erro se não der (quem chama usa o leitor próprio);
 * se a licença for recusada depois de abrir, chama aoFalhar(erro).
 */
export async function abrirScandit(elemento, aoCodigo, aoFalhar) {
  const recusa = (st) => new Error(`licença Scandit recusada (${st.code}): ${st.message}`);
  if (licencaRecusada) throw recusa(licencaRecusada);
  pronto ??= carregar().catch((e) => { pronto = null; throw e; });
  const { core, bc, context, captura } = await pronto;
  if (licencaRecusada) throw recusa(licencaRecusada);
  aoRecusar = (st) => aoFalhar?.(recusa(st));

  const view = await core.DataCaptureView.forContext(context);
  view.connectToElement(elemento);
  await bc.BarcodeCaptureOverlay.withBarcodeCaptureForView(captura, view).catch(() => null);

  const camera = core.Camera.pickBestGuess();
  const ajustesCamera = bc.BarcodeCapture.recommendedCameraSettings;
  await camera.applySettings(ajustesCamera);
  await context.setFrameSource(camera);
  ouvinteAtual = aoCodigo;
  await captura.setEnabled(true);
  await camera.switchToDesiredState(core.FrameSourceState.On);

  return {
    info: 'Scandit',
    // foto do momento da leitura: o quadro que está na tela
    foto: () => new Promise((ok) => {
      const fonte = elemento.querySelector('video') || elemento.querySelector('canvas');
      if (!fonte) { ok(null); return; }
      const w = fonte.videoWidth || fonte.width, h = fonte.videoHeight || fonte.height;
      if (!w || !h) { ok(null); return; }
      const k = Math.min(1, 1280 / Math.max(w, h)), t = document.createElement('canvas');
      t.width = Math.round(w * k); t.height = Math.round(h * k);
      try { t.getContext('2d').drawImage(fonte, 0, 0, t.width, t.height); } catch { ok(null); return; }
      t.toBlob((b) => ok(b), 'image/jpeg', 0.8);
    }),
    parar: async () => {
      ouvinteAtual = null;
      aoRecusar = null;
      try { await captura.setEnabled(false); } catch { /* ok */ }
      try { await camera.switchToDesiredState(core.FrameSourceState.Off); } catch { /* ok */ }
      try { view.detachFromElement(); } catch { /* ok */ }
    },
  };
}
