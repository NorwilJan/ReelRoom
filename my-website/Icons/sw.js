const CACHE_NAME = 'reelroom-cache-v1';
// List of all essential files for offline functionality (The App Shell)
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/home.css',
  '/js/home.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  // Ensure your icon paths are correct!
  '/icon-72x72.png',
  '/icon-96x96.png',
  '/icon-128x128.png',
  '/icon-152x152.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// 1. Install Event: Caches necessary assets (App Shell)
self.addEventListener('install', event => {
  console.log('[Service Worker] Install Event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching App Shell');
        return cache.addAll(ASSETS_TO_CACHE.filter(path => path));
      })
      .catch(err => {
        console.error('Failed to cache assets:', err);
      })
  );
  self.skipWaiting();
});

// 2. Activate Event: Cleans up old caches (Cache Busting)
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate Event');
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

// 3. Fetch Event: Intercepts network requests
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Cache-First strategy for the static files (App Shell and CDN fonts)
  if (ASSETS_TO_CACHE.includes(url.pathname) || url.origin === 'https://cdnjs.cloudflare.com') {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(event.request);
        })
    );
  } 
  // All other requests (TMDB API, video embeds) go Network-Only
  return; 
});
