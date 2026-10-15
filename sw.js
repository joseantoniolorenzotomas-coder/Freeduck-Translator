/* Freeduck-Translator — Service Worker (PWA).
   Guarda la carcasa de la app para que abra instalada y cargue rápido.
   Modelos y voces pesados se descargan una vez bajo demanda y la caché
   del navegador los guarda para el sin conexión. */
'use strict';

// WASM de ONNX Runtime Web (el repo no lo incluye: GitHub lo marca como
// secreto): CDN oficial, cacheado en la primera carga para el sin conexión.
const ORT_WASM_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/ort-wasm-simd-threaded.asyncify.wasm';

// Runtime de Transformers (su bundle minificado dispara el detector de
// secretos de GitHub): mismo trato que el WASM.
const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js';

// Archivos que no viajan en el repo y se traen del CDN en la primera carga
const CDN_FALLBACK = {
  '/vendor/stt/transformers.min.js': TRANSFORMERS_CDN,
  '/vendor/stt/ort-wasm-simd-threaded.asyncify.wasm': ORT_WASM_CDN,
};

const CACHE = 'freeduck-v24';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './offline.js',
  './voice-sherpa.js',
  './voice-whisper.js',
  './vendor/stt/ort-wasm-simd-threaded.asyncify.mjs',
  './vendor/sherpa/sherpa-worker.js',
  './vendor/sherpa/sherpa-onnx-tts.js',
  './vendor/sherpa/sherpa-onnx-wasm-main-tts.js',
  './vendor/sherpa/piper-setup.js',
  './vendor/sherpa/piper-phonemize/piper-phonemize.js',
  './vendor/sherpa/piper-phonemize/piper-phonemize-wasm-main.js',
  './vendor/mespeak/mespeak.js',
  './vendor/mespeak/mespeak-core.js',
  './vendor/mespeak/voices/es.json',
  './vendor/mespeak/voices/en/en-us.json',
  './vendor/bergamot/translator.js',
  './vendor/bergamot/worker/translator-worker.js',
  './vendor/bergamot/worker/bergamot-translator-worker.js',
  './vendor/bergamot/worker/bergamot-translator-worker.wasm',
  './img/icon-180.png',
  './img/icon-192.png',
  './img/icon-512.png',
  './img/icon-maskable-512.png',
  './img/Pato%20DJ%20logo.png',
  './img/fondopantalla1.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // 'reload' evita que la instalación guarde copias viejas de la caché HTTP.
      // Best-effort (no atómico): un archivo lento no tumba toda la instalación.
      .then((c) => Promise.all(ASSETS.map((u) =>
        c.add(new Request(u, { cache: 'reload' })).catch(() => {})
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Solo se cachea lo propio (misma origin). La API de traducción y las
  // fuentes siempre van a la red.
  if (url.origin !== location.origin) return;
  // Runtimes que no viajan en git: primero caché, luego local, luego CDN.
  // OJO: la respuesta del CDN se reempaqueta como misma origin; si se
  // devuelve tal cual, el navegador la trata como script cruzado y el CSP
  // la bloquea.
  const cdnUrl = CDN_FALLBACK[url.pathname];
  if (cdnUrl) {
    event.respondWith(
      caches.match(event.request).then((hit) => hit || fetch(event.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
          return res;
        }
        throw new Error('HTTP ' + res.status);
      }).catch(() => fetch(cdnUrl).then(async (res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const buf = await res.arrayBuffer();
        const ctype = url.pathname.endsWith('.wasm') ? 'application/wasm' : 'application/javascript';
        const same = new Response(buf, { status: 200, headers: { 'Content-Type': ctype } });
        caches.open(CACHE).then((c) => c.put(event.request, same.clone()));
        return same;
      })))
    );
    return;
  }
  // El WASM de ONNX (~27 MB) tampoco viaja en el repo: lo cubre CDN_FALLBACK.
  // Navegación: primero la red (para ver siempre la última versión),
  // con la caché como respaldo si no hay conexión. 'reload' obliga a
  // revalidar el documento (si no, la caché HTTP serviría versiones viejas).
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(new Request(event.request, { cache: 'reload' })).then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy));
        return res;
      }).catch(() =>
        caches.match(event.request).then((hit) => hit || caches.match('./index.html'))
      )
    );
    return;
  }
  // Mismo origen: caché primero (offline garantizado), guardando lo nuevo.
  // Las actualizaciones llegan subiendo la versión de CACHE en cada release.
  event.respondWith(
    caches.match(event.request).then(
      (hit) =>
        hit ||
        fetch(event.request).then((res) => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
          return res;
        }).catch(() => caches.match('./index.html'))
    )
  );
});
