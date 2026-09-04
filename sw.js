/* Service worker · Fichas de Producción RICCHARY
   Estrategia:
   - sw.js se revalida siempre (la página lo registra con updateViaCache:'none')
   - la app y los íconos: caché primero + revalidación en segundo plano
   - el Apps Script (otro dominio): SIEMPRE red, nunca caché — el dato debe ser el actual
   - al haber versión nueva, la app muestra la barra "Actualizar" y aquí se activa   */
const VERSION = '4.14.1';
const CACHE   = 'ricchary-fichas-' + VERSION;
const SHELL   = ['./', './manifest.json',
  './icon-192.png', './icon-512.png',
  './icon-192-maskable.png', './icon-512-maskable.png',
  './apple-touch-icon-180.png', './favicon-32.png'];

/* addAll es todo-o-nada: si falta un archivo NO se instala nada.
   Por eso se guarda uno por uno y un fallo no tumba la instalación. */
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(async u => {
      try { const r = await fetch(u, {cache:'no-store'}); if (r.ok) await c.put(u, r); } catch (_) {}
    }));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const viejas = (await caches.keys()).filter(k => k.startsWith('ricchary-fichas-') && k !== CACHE);
    await Promise.all(viejas.map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* La app pide activar la versión nueva al tocar "Actualizar" */
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                          /* POST al Apps Script: pasa directo */
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           /* otro dominio: pasa directo */

  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const enCache = await c.match(req, {ignoreSearch: req.mode === 'navigate'});
    /* revalidación en segundo plano: la próxima vez ya está fresco */
    const red = fetch(req).then(r => {
      if (r && r.ok && r.type === 'basic') c.put(req, r.clone()).catch(() => {});
      return r;
    }).catch(() => null);
    if (enCache) { e.waitUntil(red); return enCache; }
    const r = await red;
    if (r) return r;
    /* sin red y sin caché: si es una navegación, devolver la app guardada */
    if (req.mode === 'navigate') {
      const app = await c.match('./', {ignoreSearch: true});
      if (app) return app;
    }
    return new Response('Sin conexión y sin copia guardada.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
  })());
});
