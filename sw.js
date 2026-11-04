/* Bellaquitas Fest: PWA de contenido estático. Nunca almacenar respuestas de Supabase ni datos privados. */
const CACHE = 'bellaquitas-static-2026-11-04-v5';
const STATIC = ['./','./index.html','./styles.css','./app.js','./config.js','./manifest.webmanifest',
  './assets/favicon.svg','./assets/google-g.svg','./assets/logo-bellaquitas.webp',
  './assets/icon-180.png','./assets/icon-192.png','./assets/icon-512.png','./assets/icon-maskable-512.png',
  './assets/tarjeta-conejita-frente.webp','./assets/tarjeta-qr-dorso.webp'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    const outcomes = await Promise.allSettled(STATIC.map(url => cache.add(new Request(url, {cache:'reload'}))));
    if(outcomes.every(x => x.status==='rejected')) throw new Error('No se pudieron guardar recursos estáticos');
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('bellaquitas-static-') && key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()]));
});
self.addEventListener('fetch', event => {
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
  // No almacenar callbacks de autenticación, códigos OAuth ni solicitudes con parámetros.
  if(request.mode==='navigate' && url.search) return;
  const staticPath=url.pathname.replace(new URL(self.registration.scope).pathname, '');
  const approved=['','index.html','styles.css','app.js','config.js','manifest.webmanifest','assets/favicon.svg',
    'assets/google-g.svg','assets/logo-bellaquitas.webp','assets/icon-180.png','assets/icon-192.png',
    'assets/icon-512.png','assets/icon-maskable-512.png',
    'assets/tarjeta-conejita-frente.webp','assets/tarjeta-qr-dorso.webp'];
  if(!approved.includes(staticPath)) return;
  event.respondWith((async()=>{
    const cached=await caches.open(CACHE);
    try{
      const response=await fetch(request);
      if(response.ok && response.type==='basic') await cached.put(request,response.clone());
      return response;
    }catch{
      return (await cached.match(request)) || (request.mode==='navigate' ? await cached.match('./index.html') : undefined) || Response.error();
    }
  })());
});