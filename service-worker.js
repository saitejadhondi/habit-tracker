const CACHE_NAME = 'habit-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/css/style.css',
  '/js/auth.js',
  '/js/habits.js',
  '/js/utils.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map(k => { if (k !== CACHE_NAME) return caches.delete(k); })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // API requests - try network first, fallback to cache
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/supabase')) {
    event.respondWith(
      fetch(event.request)
        .then(res => { if (res.ok) { const clone = res.clone(); caches.open(CACHE_NAME).then(c => c.put(event.request, clone)); } return res; })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Otherwise, try cache first, then network
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
      caches.open(CACHE_NAME).then((c) => c.put(event.request, res.clone()));
      return res;
    }).catch(() => caches.match('/index.html')))
  );
});
