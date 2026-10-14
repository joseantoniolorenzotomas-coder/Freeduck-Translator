/* Freeduck-Translator — motor de traducción offline (texto ES↔EN).
   Usa Bergamot (MPL-2.0, ver vendor/bergamot/NOTICE.txt) con modelos de
   Mozilla (MPL-2.0). Los modelos se descargan una vez (con conexión) y se
   guardan en la caché del navegador para traducir sin conexión.
   La VOZ (dictado) sigue necesitando internet: solo el texto es offline. */
import { LatencyOptimisedTranslator, TranslatorBacking } from './vendor/bergamot/translator.js';

const REGISTRY_URL = './models/registry.json';
const BASE_URL = './models';
const MODEL_CACHE = 'freeduck-models-v1';

// Pares con modelo verificado en la v1 offline. No ampliar sin probar.
const OFFLINE_PAIRS = [['es', 'en'], ['en', 'es']];

class MozillaBacking extends TranslatorBacking {
  async loadModelRegistery() {
    const j = await fetchRegistry();
    const out = [];
    for (const arr of Object.values(j.models)) {
      const m = arr.find((x) => x.releaseStatus === 'Release') || arr[0];
      const files = {
        model: { name: `${BASE_URL}/${m.files.model.path}` },
        lex: { name: `${BASE_URL}/${m.files.lexicalShortlist.path}` },
      };
      if (m.files.vocab) files.vocab = { name: `${BASE_URL}/${m.files.vocab.path}` };
      else {
        files.srcvocab = { name: `${BASE_URL}/${m.files.srcVocab.path}` };
        files.trgvocab = { name: `${BASE_URL}/${m.files.trgVocab.path}` };
      }
      out.push({ from: m.sourceLanguage, to: m.targetLanguage, files });
    }
    return out;
  }

  async fetch(url, checksum, extra) {
    const data = await downloadModelFile(url, this._onProgress);
    if (url.endsWith('.gz')) return gunzip(data);
    return data;
  }
}

async function fetchRegistry() {
  try {
    const res = await fetch(REGISTRY_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    const cache = await caches.open(MODEL_CACHE);
    await cache.put(REGISTRY_URL, new Response(JSON.stringify(j), {
      headers: { 'Content-Type': 'application/json' },
    }));
    return j;
  } catch (e) {
    const cache = await caches.open(MODEL_CACHE);
    const hit = await cache.match(REGISTRY_URL);
    if (hit) return hit.json();
    throw new Error('REGISTRY');
  }
}

async function downloadModelFile(url, onProgress) {
  const cache = await caches.open(MODEL_CACHE);
  const hit = await cache.match(url);
  if (hit) return hit.arrayBuffer();
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const total = parseInt(res.headers.get('content-length') || '0', 10) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    if (onProgress) onProgress(got, total);
  }
  const data = await new Blob(chunks).arrayBuffer();
  await cache.put(url, new Response(data, {
    headers: { 'Content-Type': 'application/octet-stream' },
  }));
  return data;
}

async function gunzip(data) {
  if (typeof DecompressionStream === 'undefined') throw new Error('GZIP');
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

async function pairFiles(from, to) {
  const j = await fetchRegistry();
  const arr = Object.values(j.models).flat().filter(
    (m) => m.sourceLanguage === from && m.targetLanguage === to
  );
  const m = arr.find((x) => x.releaseStatus === 'Release') || arr[0];
  if (!m) throw new Error('PAIR');
  const urls = [`${BASE_URL}/${m.files.model.path}`, `${BASE_URL}/${m.files.lexicalShortlist.path}`];
  if (m.files.vocab) urls.push(`${BASE_URL}/${m.files.vocab.path}`);
  else urls.push(`${BASE_URL}/${m.files.srcVocab.path}`, `${BASE_URL}/${m.files.trgVocab.path}`);
  return urls;
}

let engine = null;
async function getEngine() {
  if (!engine) {
    engine = new LatencyOptimisedTranslator({ downloadTimeout: 0 }, new MozillaBacking({ downloadTimeout: 0 }));
  }
  return engine;
}

function withTimeout(promise, ms, fase) {
  let to = null;
  const timeout = new Promise((_, reject) => {
    to = setTimeout(() => reject(new Error('TIMEOUT ' + fase)), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(to)), timeout]);
}

window.Offline = {
  pairs: OFFLINE_PAIRS,
  isSupported(from, to) {
    return OFFLINE_PAIRS.some(([a, b]) => a === from && b === to);
  },
  async isReady(from, to) {
    try {
      const cache = await caches.open(MODEL_CACHE);
      for (const url of await pairFiles(from, to)) {
        if (!await cache.match(url)) return false;
      }
      return true;
    } catch { return false; }
  },
  // Descarga el modelo del sentido indicado. onProgress(recibidos, total).
  async download(from, to, onProgress) {
    const backing = new MozillaBacking({ downloadTimeout: 0 });
    backing._onProgress = onProgress;
    await backing.getTranslationModel({ from, to });
  },
  async remove(from, to) {
    const cache = await caches.open(MODEL_CACHE);
    for (const url of await pairFiles(from, to)) await cache.delete(url);
  },
  async translate(from, to, text) {
    const eng = await withTimeout(getEngine(), 90000, 'motor');
    const res = await withTimeout(
      eng.translate({ from, to, text, html: false }).then((r) => r.target.text),
      180000, 'traducción');
    return res;
  },
};

// Aviso a la página de que el motor offline ya está disponible
window.dispatchEvent(new Event('freeduck:offline-ready'));
