/* Gym Tracker service worker — offline support.
   App code (HTML/JS/CSS/manifest) is network-first so pushes to the repo show
   up on the next launch; images, fonts and icons are cache-first.
   Bump CACHE when images, fonts or icons change. */
const CACHE = 'gym-tracker-v2';

const CODE = [
  './', 'index.html', 'manifest.json', 'css/app.css',
  'js/app.js', 'js/views.js', 'js/store.js', 'js/sync.js', 'js/stats.js', 'js/charts.js',
  'js/timer.js', 'js/prefs.js', 'js/program.js', 'js/dates.js', 'js/icons.js', 'js/ui.js',
];
const MEDIA = [
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'fonts/figtree-latin.woff2', 'fonts/figtree-latin-ext.woff2',
  ...['pullup', 'row', 'hammer', 'conc', 'floorpress', 'inclinepu', 'ohp', 'latraise', 'kneeraise']
    .flatMap((id) => ['images/' + id + '-0.jpg', 'images/' + id + '-1.jpg']),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([...CODE, ...MEDIA])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isMedia(url) { return /\/(images|fonts|icons)\//.test(url.pathname); }

/* Network-first with a short timeout, so a slow gym connection falls back
   to the cached copy quickly. */
function networkFirst(req) {
  return new Promise((resolve) => {
    let settled = false;
    const fallback = () => caches.match(req, { ignoreSearch: true })
      .then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : null));
    const timer = setTimeout(() => {
      fallback().then((hit) => { if (hit && !settled) { settled = true; resolve(hit); } });
    }, 3000);
    fetch(req).then((res) => {
      clearTimeout(timer);
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req.mode === 'navigate' ? 'index.html' : req, copy));
      }
      if (!settled) { settled = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      fallback().then((hit) => { if (!settled) { settled = true; resolve(hit || Response.error()); } });
    });
  });
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // GitHub API, remote photos: straight to network

  if (isMedia(url)) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    })));
    return;
  }
  e.respondWith(networkFirst(e.request));
});

// Tapping the rest-timer notification brings the app back.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('./'))));
});
