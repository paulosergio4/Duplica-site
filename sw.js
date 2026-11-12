// =====================================================================
// DUPLICA · sw.js  (service worker: deixa o site instalável como aplicativo)
// Regra simples: SEMPRE tenta a internet primeiro (o Duplica precisa do
// banco, então não faz sentido mostrar tela velha). Guarda uma cópia dos
// arquivos do site só para abrir rápido e mostrar um aviso quando estiver
// sem internet. Nada do Supabase passa por aqui.
// =====================================================================
const CACHE = 'duplica-2ef8d9d';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const SEM_INTERNET = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Duplica · sem internet</title>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0F2A43;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div><h1 style="font-size:24px;margin:0 0 8px">Sem internet</h1><p style="margin:0 0 20px;color:#B8C7D6">O Duplica precisa de conexão para mostrar os boletos.</p>
<button onclick="location.reload()" style="height:46px;padding:0 20px;border:0;border-radius:12px;background:#fff;color:#0F2A43;font-weight:700;font-size:15px">Tentar de novo</button></div></body></html>`;

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;   // Supabase, fontes etc.: direto
  ev.respondWith((async () => {
    try {
      const resp = await fetch(req);
      if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {}); }
      return resp;
    } catch {
      const guardado = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (guardado) return guardado;
      if (req.mode === 'navigate') return new Response(SEM_INTERNET, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      return Response.error();
    }
  })());
});
