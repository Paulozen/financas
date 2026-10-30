// Service worker básico: guarda o "casco" do app para abrir mais rápido e
// mostrar algo offline. Dados (Supabase) sempre vêm da rede.
const CACHE = "financas-v1";

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Navegação: rede primeiro, cache como reserva.
  if (req.mode === "navigate") {
    evento.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
          return resp;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/"))),
    );
    return;
  }

  // Arquivos estáticos do Next e ícones: cache primeiro.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    evento.respondWith(
      caches.match(req).then(
        (r) =>
          r ||
          fetch(req).then((resp) => {
            const copia = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
            return resp;
          }),
      ),
    );
  }
});
