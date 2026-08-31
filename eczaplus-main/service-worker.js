const CACHE='eczaplus-pages-v9-index-top';
const BASE=new URL('./',self.registration.scope).pathname;
const CORE=['','index.html','styles.css','script.js','logo.png','site.webmanifest','og-image.jpg'].map(x=>BASE+x);
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{})));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const clone=r.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match(BASE+'index.html'))))});
