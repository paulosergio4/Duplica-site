// =====================================================================
// DUPLICA · util/instalar.js
// "Instalar aplicativo": registra o service worker (sw.js) e cuida do
// botão de instalar.
//   - Android / Chrome / Edge: o navegador avisa (beforeinstallprompt) e o
//     botão #instalar-app chama a instalação.
//   - iPhone (Safari): não existe botão; mostramos o passo a passo em
//     #instalar-ios (Compartilhar → Adicionar à Tela de Início).
// Já instalado (abre sem a barra do navegador): não mostra nada.
// =====================================================================
const instalado = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export function prepararInstalacao() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register(new URL('../../sw.js', import.meta.url)).catch((e) => console.warn('Service worker:', e.message));
  }
  if (instalado()) return;
  const botao = document.getElementById('instalar-app');
  const ios = document.getElementById('instalar-ios');
  let convite = null;
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    convite = ev;
    if (botao) botao.hidden = false;
  });
  botao?.addEventListener('click', async () => {
    if (!convite) return;
    convite.prompt();
    await convite.userChoice;
    convite = null;
    botao.hidden = true;
  });
  window.addEventListener('appinstalled', () => { if (botao) botao.hidden = true; });
  const ehIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ehIos && ios) ios.hidden = false;
}
