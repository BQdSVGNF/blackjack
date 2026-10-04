// Service worker de Blackjack École :
//  1. garde l'application disponible hors ligne ;
//  2. ajoute les en-têtes d'« isolation » qui permettent au mode processeur d'utiliser tous les cœurs
//     (GitHub Pages ne permet pas de les configurer autrement).
// (Les modèles d'IA sont mis en cache séparément par WebLLM / wllama.)
const CACHE = "blackjack-ecole-v2";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("blackjack-ecole-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Ajoute COOP/COEP aux pages de l'application
function isolate(res) {
  if (!res || res.type === "opaque" || res.status === 0) return res;
  const headers = new Headers(res.headers);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Fichiers de l'application : réseau d'abord (pour les mises à jour), sinon la copie locale
  if (url.origin === location.origin) {
    const isPage = req.mode === "navigate" || req.destination === "document";
    e.respondWith(
      fetch(req)
        .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
        .then(res => isPage ? isolate(res) : res)
    );
    return;
  }

  // Bibliothèques (moteurs IA, formules) : copie locale d'abord, elles ne changent pas
  if (url.hostname === "cdn.jsdelivr.net") {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
