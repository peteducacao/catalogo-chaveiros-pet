/* Shell estático do catálogo PET. Produtos e disponibilidade seguem on-line. */
const CACHE='pet-catalogo-shell-v7';
const SHELL=[
  './index.html','./catalogo.html','./contato.html',
  './assets/catalog-v57.css','./assets/catalog-modern-v70.css',
  './assets/contact-v40.css','./assets/site-v58.js','./assets/site-v31.js',
  './assets/pwa-install.css','./assets/pwa-install.js',
  './assets/pwa-splash.css','./assets/pwa-splash.js',
  './assets/logo-pet.svg','./assets/favicon.svg',
  './assets/pwa-icon.svg','./assets/catalogo-180-v2.png','./assets/catalogo-192-v2.png','./assets/catalogo-512-v2.png','./assets/catalogo-maskable-192-v2.png','./assets/catalogo-maskable-512-v2.png',
  './manifest.webmanifest'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(SHELL.map(url=>cache.add(url)))));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('pet-catalogo-')&&key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  const pathname=new URL(request.url).pathname;
  if(/(?:painel|admin)(?:\.html|\/|$)/.test(pathname)||pathname.includes('/api/'))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      if(response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(request,copy));
      }
      return response;
    }).catch(async()=>await caches.match(request)||await caches.match('./catalogo.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok&&['style','script','image','font'].includes(request.destination)){
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(request,copy));
    }
    return response;
  })));
});
