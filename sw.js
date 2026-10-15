/* Freeduck-Translator — Service Worker (PWA).
   Guarda la carcasa de la app para que abra instalada, cargue rápido y siga
   funcionando sin conexión.
   Los modelos, las voces y el dictado son pesados: se descargan una vez bajo
   demanda y quedan en la caché del navegador. */
'use strict';

// ─────────────────────────────────────────────────────────────
// Runtime del dictado offline (Whisper)
// ─────────────────────────────────────────────────────────────
// GitHub marca estos archivos como secretos en un push, así que no se pueden
// versionar. El service worker los trae del CDN oficial la primera vez y los
// cachea como si fueran nuestros; a partir de ahí ya no hace falta internet.
//
// Se localizan por NOMBRE y no por ruta exacta a propósito: el bundle de
// Transformers apunta por su cuenta a su propio CDN, que cambia con cada
// versión. Interceptando el nombre, da igual qué ruta calculen.
const ORT_ARCHIVOS = {
  'transformers.min.js': 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js',
  'ort-wasm-simd-threaded.asyncify.wasm':
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.asyncify.mjs':
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/ort-wasm-simd-threaded.asyncify.mjs',
  'ort.webgpu.bundle.min.mjs':
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/ort.webgpu.bundle.min.mjs',
};

// Rutas propias donde dejamos esos archivos (una copia vendored o la caché).
const ORT_LOCAL = {
  'ort-wasm-simd-threaded.asyncify.mjs': './vendor/stt/ort-wasm-simd-threaded.asyncify.mjs',
  'ort.webgpu.bundle.min.mjs': './vendor/stt/ort.webgpu.bundle.min.mjs',
};

function nombreOrt(ruta) {
  return ORT_ARCHIVOS[ruta.slice(ruta.lastIndexOf('/') + 1)] || null;
}

// ─────────────────────────────────────────────────────────────
// Carcasa de la app
// ─────────────────────────────────────────────────────────────
// Subir este número es lo que publica una versión nueva: al activarse borra
// las cachés viejas.
const CACHE = 'freeduck-v30';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './offline.js',
  './voice-sherpa.js',
  './voice-whisper.js',
  './vendor/stt/ort-wasm-simd-threaded.asyncify.mjs',
  './vendor/stt/ort.webgpu.bundle.min.mjs',
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
  './img/micro-azul-ondas.png',
  './img/fondopantalla1.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // 'reload' evita que la instalación guarde copias de la caché HTTP.
      // Best-effort: un archivo que falle no tumba toda la instalación.
      .then((cache) =>
        Promise.all(
          ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {}))
        )
      )
      .then(() => self.skipWaiting())
  );
});

// Versiones anteriores de la caché de la app. Solo se borran las nuestras:
// 'freeduck-models-v1' y 'transformers-cache' las gestiona la app y contienen
// los modelos y las voces que el usuario ya descargó.
const CACHE_VIEJA = /^freeduck-v\d+$/;

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => CACHE_VIEJA.test(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ─────────────────────────────────────────────────────────────
// Peticiones
// ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // 1) Runtime del dictado, venga de la ruta que sea (el bundle de
  //    Transformers usa su propio CDN). Se sirve desde nuestra caché como si
  //    fuera nuestro: así el CSP lo permite y funciona sin conexión.
  const ortCdn = nombreOrt(url.pathname);
  if (ortCdn) {
    event.respondWith(servirOrt(event.request, url, ortCdn));
    return;
  }

  // El resto de lo nuestro se cachea; la API de traducción, los modelos de
  // Hugging Face y las fuentes siempre van a la red.
  if (url.origin !== location.origin) return;

  // 2) Navegación: primero la red (así siempre se ve la última versión) y,
  //    sin conexión, la caché. 'reload' fuerza a revalidar el documento.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(new Request(event.request, { cache: 'reload' }))
        .then((res) => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          guardar(event.request, res.clone());
          return res;
        })
        .catch(() =>
          caches.match(event.request).then((hit) => hit || caches.match('./index.html'))
        )
    );
    return;
  }

  // 3) Resto: caché primero (sin conexión garantizado). OJO: si un archivo
  //    falta no se devuelve index.html en su lugar; un módulo pediría HTML y
  //    el navegador lo parsearía como JavaScript ("Unexpected token '<'").
  event.respondWith(
    caches.match(event.request).then(
      (hit) =>
        hit ||
        fetch(event.request)
          .then((res) => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            guardar(event.request, res.clone());
            return res;
          })
          .catch(() => Response.error())
    )
  );
});

/* Guarda una copia en la caché de la app. Best-effort: si la cuota está llena
   o el navegador lo rechaza, la app sigue funcionando con red. */
function guardar(request, response) {
  caches
    .open(CACHE)
    .then((cache) => cache.put(request, response))
    .catch(() => {});
}

/* Devuelve un archivo del runtime del dictado.
   Orden: caché -> copia propia en el repo -> CDN.
   OJO: la respuesta del CDN se reempaqueta como si fuera nuestra; si se
   devuelve tal cual, el navegador la trata como script de otro origen y el CSP
   la bloquea. */
async function servirOrt(request, url, cdnUrl) {
  const hit = await caches.match(request);
  if (hit) return hit;

  const nombre = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
  const esWasm = nombre.endsWith('.wasm');
  const preparar = async (res) => {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const cuerpo = esWasm ? await res.arrayBuffer() : await res.text();
    return new Response(cuerpo, {
      status: 200,
      headers: { 'Content-Type': esWasm ? 'application/wasm' : 'application/javascript' },
    });
  };

  const probar = async (entrada) => (entrada ? preparar(await fetch(entrada)) : null);

  const res =
    (await probar(ORT_LOCAL[nombre]).catch(() => null)) ||
    (await probar(cdnUrl).catch(() => null)) ||
    (await probar(new URL(nombre, location.origin + '/vendor/stt/').href).catch(() => null));
  if (!res) return Response.error();
  guardar(request, res.clone());
  return res;
}