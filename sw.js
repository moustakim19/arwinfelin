/* =====================================================================
   sw.js — Le service worker : l'appli marche même sans internet
   ---------------------------------------------------------------------
   Un service worker est un petit script que le navigateur garde en
   mémoire, à part de la page. Il se place entre l'appli et internet :
   chaque fois que l'appli demande un fichier, il peut répondre avec une
   copie gardée en cache. C'est ce qui permet le mode hors ligne.

   Il ne fonctionne que sur HTTPS ou sur http://localhost (Live Server).
   ===================================================================== */

// À changer à chaque nouvelle version pour forcer la mise à jour du cache
const VERSION = 'arwinfelin-v5';
const APP_CACHE = VERSION + '-app';
const CDN_CACHE = 'arwinfelin-cdn';

// Tous les fichiers de l'appli, mis en cache dès l'installation
const APP_FILES = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/utils.js',
  'js/icons.js',
  'js/db.js',
  'js/ui.js',
  'js/settings.js',
  'js/app.js',
  'js/health.js',
  'js/reminders-core.js',
  'js/notify.js',
  'js/pwa.js',
  'js/races.js',
  'js/races-details.js',
  'data/races-photos.json',
  'js/breed-ai.js',
  'data/clip-text-embeddings.json',
  'js/views/home.js',
  'js/views/cat-form.js',
  'js/views/cat-detail.js',
  'js/views/health.js',
  'js/views/weight.js',
  'js/views/food.js',
  'js/views/journal.js',
  'js/views/reminders.js',
  'js/views/profile.js',
  'js/views/breeds.js',
  'js/views/settings.js',
  'js/views/share.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/badge-96.png'
];

// Bibliothèques externes (CDN) : mises en cache au premier usage
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

// On réutilise exactement le même code que la page pour lire la base et calculer
// les rappels. (importScripts doit être appelé au chargement du service worker.)
importScripts('js/utils.js', 'js/icons.js', 'js/db.js', 'js/health.js', 'js/reminders-core.js');

/* ---------- 1. Installation : on remplit le cache ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then((cache) => cache.addAll(APP_FILES).then(() => cacheBreedPhotos(cache)))
      .then(() => self.skipWaiting()) // la nouvelle version prend la main tout de suite
  );
});

// Les photos des 72 races (environ 4 Mo) : si une photo échoue, on continue quand même
async function cacheBreedPhotos(cache) {
  try {
    const credits = await (await fetch('data/races-photos.json')).json();
    await Promise.all(Object.keys(credits).map((id) => cache.add('images/races/' + id + '.jpg').catch(() => {})));
  } catch (e) { /* pas grave : les photos seront gardées quand on les regarde */ }
}

/* ---------- 2. Activation : on supprime les vieux caches ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.endsWith('-app') && k !== APP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ---------- 3. Chaque requête passe par ici ---------- */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Nos propres fichiers : "réseau d'abord, cache en secours".
  // -> toujours la dernière version quand on est connecté (pratique pendant
  //    qu'on développe), et la copie du cache quand on est hors ligne.
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Bibliothèques du CDN : "cache d'abord" (elles ne changent jamais, la version est dans l'adresse)
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
  // Le reste (ex. le modèle d'IA sur huggingface.co) : on laisse passer sans toucher.
  // Transformers.js a déjà son propre cache.
});

async function networkFirst(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    // Hors ligne : on cherche dans le cache (en ignorant "?..." dans l'adresse)
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    // Pour une page, on renvoie l'appli (le routeur gère le reste)
    if (request.mode === 'navigate') return cache.match('index.html');
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CDN_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // "opaque" = réponse d'un autre site sans permission de lecture : on la garde quand même
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

/* ---------- 4. Notifications ---------- */

// Toucher une notification ouvre (ou ramène au premier plan) l'appli
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL('./' + ((event.notification.data && event.notification.data.url) || ''), self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) client.navigate(target);
        return;
      }
    }
    return self.clients.openWindow(target);
  })());
});

// Réveil périodique en arrière-plan (Chrome Android, appli installée seulement).
// Le navigateur décide lui-même quand réveiller l'appli : ce n'est jamais à l'heure pile.
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'af-reminders') event.waitUntil(checkReminders());
});

async function checkReminders() {
  const AF = self.AF;
  const [reminders, health, cats, notified] = await Promise.all([
    AF.db.getAll('reminders'), AF.db.getAll('health'), AF.getCats(), AF.db.getSetting('notified', {})
  ]);
  const list = AF.collectNotifications({ reminders, health, cats, notified });
  const clean = AF.pruneNotified(notified);
  for (const n of list) {
    await self.registration.showNotification(n.title, {
      body: n.body, tag: n.key, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', data: { url: '#/rappels' }
    });
    clean[n.key] = Date.now();
  }
  await AF.db.setSetting('notified', clean);
}
