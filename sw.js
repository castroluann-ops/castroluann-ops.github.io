// Preceptor — service worker: funciona offline e guarda imagens já vistas.
const SHELL = 'preceptor-shell-v2';
const RUNTIME = 'preceptor-runtime-v2';
const SHELL_FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Páginas: tenta a rede (pega atualizações), cai no cache se estiver offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => { caches.open(SHELL).then(c => c.put('./index.html', r.clone())); return r; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Arquivos do próprio app, fontes e imagens das lições: cache primeiro.
  const cacheable = url.origin === location.origin
    || url.hostname.endsWith('fonts.googleapis.com')
    || url.hostname.endsWith('fonts.gstatic.com')
    || req.destination === 'image';
  if (!cacheable) return;

  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(r => {
        if (r && (r.ok || r.type === 'opaque')) {
          const copy = r.clone();
          caches.open(url.origin === location.origin ? SHELL : RUNTIME).then(c => c.put(req, copy));
        }
        return r;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
