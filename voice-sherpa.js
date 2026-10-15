/* Freeduck-Translator — voz natural offline (Piper + sherpa-onnx, ES/EN).
   Licencias en vendor/sherpa/NOTICE.txt. Las voces (~22/19 MB) se descargan
   una vez (con conexión) y el navegador las guarda; después hablan sin red.
   La fonemización (espeak-ng) corre en el hilo principal; la síntesis en
   un worker por idioma. */
'use strict';

const VOICES = {
  es: { model: 'voices/es/es_ES-sharvard-medium.onnx', tokens: 'voices/es/tokens.txt', phoneme: 'es', mb: '~22 MB' },
  en: { model: 'voices/en/en_US-amy-low.onnx', tokens: 'voices/en/tokens.txt', phoneme: 'en-us', mb: '~19 MB' },
};
const FLAG_PREFIX = 'fd_sherpa_ok_';

const workers = {}; // lang -> { worker, ready: Promise }
let piperReadyPromise = null;
let currentSource = null;
let audioCtx = null;

function flag(lang) {
  try { return localStorage.getItem(FLAG_PREFIX + lang) === '1'; } catch { return false; }
}
function setFlag(lang) {
  try { localStorage.setItem(FLAG_PREFIX + lang, '1'); } catch {}
}
function clearFlag(lang) {
  try { localStorage.removeItem(FLAG_PREFIX + lang); } catch {}
}

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}
function stopAudio() {
  if (currentSource) {
    try { currentSource.stop(); } catch {}
    try { currentSource.disconnect(); } catch {}
    currentSource = null;
  }
}

// Fonemización (piper-phonemize, cargado por <script> clásico).
function ensurePhonemize() {
  if (piperReadyPromise) return piperReadyPromise;
  piperReadyPromise = (async () => {
    if (!window.__piperReady) throw new Error('PHONEMIZE');
    await window.__piperReady;
    return true;
  })();
  return piperReadyPromise;
}

function ensureWorker(lang, onProgress) {
  if (workers[lang]) return workers[lang].ready;
  const worker = new Worker('vendor/sherpa/sherpa-worker.js');
  const entry = { worker, ready: null };
  workers[lang] = entry;
  entry.ready = new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('TIMEOUT')), 180000);
    worker.onmessage = (e) => {
      const d = e.data || {};
      if (d.type === 'sherpa-dl' && onProgress) {
        onProgress({ loaded: d.loaded || 0, total: d.total || 0, file: d.file || '' });
      } else if (d.type === 'sherpa-ready') {
        clearTimeout(to);
        setFlag(lang);
        resolve(true);
      } else if (d.type === 'error') {
        clearTimeout(to);
        reject(new Error(d.message || 'worker'));
      }
    };
    worker.onerror = (e) => {
      clearTimeout(to);
      reject(new Error('WORKER ' + String((e && e.message) || e)));
    };
    worker.postMessage({
      type: 'init',
      // URLs absolutas: en el worker las relativas resolverían junto al
      // script (vendor/sherpa/) en vez de junto a la página.
      modelUrl: new URL(VOICES[lang].model, document.baseURI).href,
      tokensUrl: new URL(VOICES[lang].tokens, document.baseURI).href,
    });
  });
  entry.ready.catch(() => {
    try { worker.terminate(); } catch {}
    if (workers[lang] === entry) delete workers[lang];
  });
  return entry.ready;
}

async function playSamples(samples, sampleRate) {
  const ctx = getCtx();
  stopAudio();
  const data = samples instanceof Float32Array ? samples : Float32Array.from(samples);
  const buf = ctx.createBuffer(1, data.length, sampleRate);
  buf.getChannelData(0).set(data);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  currentSource = src;
  return new Promise((resolve) => {
    src.onended = () => { if (currentSource === src) currentSource = null; resolve(true); };
    try { src.start(); } catch { resolve(true); }
    setTimeout(() => resolve(true), (data.length / sampleRate) * 1000 + 8000);
  });
}

window.SherpaVoice = {
  voices: { es: 'sharvard', en: 'amy' },
  isSupported(lang) {
    return !!VOICES[lang];
  },
  async isReady(lang) {
    if (!VOICES[lang]) return false;
    if (flag(lang)) return true;
    // Si el marcado se perdió (limpieza del navegador) pero los archivos
    // siguen en caché, se da por lista sin redescargar.
    try {
      for (const key of [VOICES[lang].model, VOICES[lang].tokens]) {
        const hit = await caches.match(new URL(key, document.baseURI).href);
        if (!hit) return false;
      }
      setFlag(lang);
      return true;
    } catch { return false; }
  },
  async download(lang, onProgress) {
    await ensurePhonemize();
    await ensureWorker(lang, onProgress);
    // Calentamiento (una vez): la primera inferencia compila el motor y
    // tarda; mejor esperar aquí con aviso que en el primer uso.
    // Si falla, no se anula la descarga: se reintenta al hablar.
    if (onProgress) onProgress({ status: 'warmup' });
    try {
      await SherpaVoice.speak(lang === 'en' ? 'Hello.' : 'Hola.', lang, { silent: true });
    } catch {}
  },
  async remove(lang) {
    const entry = workers[lang];
    if (entry) {
      try { entry.worker.terminate(); } catch {}
      delete workers[lang];
    }
    clearFlag(lang);
  },
  async speak(text, lang, opts) {
    await ensurePhonemize();
    await ensureWorker(lang);
    const entry = workers[lang];
    const sentences = piperPhonemize(String(text).slice(0, 600), VOICES[lang].phoneme);
    const codepoints = (sentences || []).filter((s) => s && s.length > 0);
    if (!codepoints.length) throw new Error('PHONEMIZE');
    const audio = await new Promise((resolve, reject) => {      const to = setTimeout(() => reject(new Error('TIMEOUT')), 180000);
      const prev = entry.worker.onmessage;
      entry.worker.onmessage = (e) => {
        const d = e.data || {};
        if (d.type === 'sherpa-result') {
          clearTimeout(to);
          entry.worker.onmessage = prev;
          resolve({ samples: d.samples, sampleRate: d.sampleRate });
        } else if (d.type === 'error') {
          clearTimeout(to);
          entry.worker.onmessage = prev;
          reject(new Error(d.message));
        } else if (prev && d.type !== 'sherpa-generation-progress') {
          prev(e);
        }
      };
      entry.worker.postMessage({
        type: 'generateWithConfig',
        text: '',
        genConfig: { phonemeCodepoints: codepoints, sid: 0, speed: 1.0 },
      });
    });
    if (opts && opts.silent) return true;
    return playSamples(audio.samples, audio.sampleRate);
  },
  stop() {
    stopAudio();
  },
};

// Aviso a la página de que la voz natural ya está disponible
window.dispatchEvent(new Event('freeduck:voice-ready'));
