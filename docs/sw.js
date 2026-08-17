/* Gym Tracker service worker — precaches the whole app for offline use.
   Bump CACHE when any asset changes so clients pick up the new version. */
const CACHE = 'gym-tracker-v1';

const ASSETS = [
  '.',
  'index.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'fonts/caprasimo-latin.woff2',
  'fonts/caprasimo-latin-ext.woff2',
  'fonts/figtree-latin.woff2',
  'fonts/figtree-latin-ext.woff2',
  'images/pullup-0.jpg', 'images/pullup-1.jpg',
  'images/row-0.jpg', 'images/row-1.jpg',
  'images/hammer-0.jpg', 'images/hammer-1.jpg',
  'images/conc-0.jpg', 'images/conc-1.jpg',
  'images/floorpress-0.jpg', 'images/floorpress-1.jpg',
  'images/inclinepu-0.jpg', 'images/inclinepu-1.jpg',
  'images/ohp-0.jpg', 'images/ohp-1.jpg',
  'images/latraise-0.jpg', 'images/latraise-1.jpg',
  'images/kneeraise-0.jpg', 'images/kneeraise-1.jpg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // Navigations go network-first so app updates arrive without a manual
  // cache bump; the cached shell is the offline fallback.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('index.html', copy));
        return res;
      }).catch(() => caches.match('index.html'))
    );
    return;
  }

  // Static assets: cache-first with network fill.
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      });
    })
  );
});
