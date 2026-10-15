/* FreeDuck — dictado offline (Whisper tiny, ES/EN).
   El modelo (~42 MB) se descarga una vez (con conexión) y el navegador lo
   guarda; después transcribe sin red. Licencias en vendor/stt/NOTICE.txt. */
import { pipeline } from './vendor/stt/transformers.min.js';

const MODEL_ID = 'Xenova/whisper-tiny';
const DTYPE = 'q8';
const FLAG_KEY = 'fd_whisper_ok';
const LANGS = { es: 'spanish', en: 'english' };

let asr = null;
let recorder = null;
let micStream = null;
let recChunks = [];
let recTimer = null;

function modelFlag() {
  try { return localStorage.getItem(FLAG_KEY) === '1'; } catch { return false; }
}

async function getASR(onProgress) {
  if (!asr) {
    asr = await pipeline('automatic-speech-recognition', MODEL_ID, {
      dtype: DTYPE,
      progress_callback: onProgress || null,
    });
    try { localStorage.setItem(FLAG_KEY, '1'); } catch {}
  }
  return asr;
}

// Remuestrea a 16 kHz mono para Whisper
async function to16k(blob) {
  const raw = await blob.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const tmp = new Ctx();
  const decoded = await tmp.decodeAudioData(raw.slice(0));
  try { tmp.close(); } catch {}
  const rate = decoded.sampleRate;
  const data = decoded.getChannelData(0);
  if (rate === 16000) return data;
  const off = new OfflineAudioContext(1, Math.ceil(data.length * 16000 / rate), 16000);
  const src = off.createBufferSource();
  const buf = off.createBuffer(1, data.length, rate);
  buf.getChannelData(0).set(data);
  src.buffer = buf;
  src.connect(off.destination);
  src.start();
  const out = await off.startRendering();
  return out.getChannelData(0);
}

window.LocalSTT = {
  isSupported(lang) {
    return !!LANGS[lang] && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      && typeof window.MediaRecorder !== 'undefined';
  },
  async isReady() {
    return modelFlag();
  },
  // Descarga el modelo (vale para ES y EN: es el mismo).
  async download(onProgress) {
    await getASR((ev) => {
      if (onProgress && ev) {
        onProgress({
          status: ev.status || '',
          file: (ev.file || '').split('/').pop() || '',
          progress: typeof ev.progress === 'number' ? ev.progress : 0,
          loaded: ev.loaded || 0,
          total: ev.total || 0,
        });
      }
    });
  },
  async remove() {
    try {
      const cache = await caches.open('transformers-cache');
      for (const r of await cache.keys()) {
        if (r.url.includes('whisper-tiny')) await cache.delete(r);
      }
    } catch {}
    try { localStorage.removeItem(FLAG_KEY); } catch {}
    asr = null;
  },
  // Empieza a grabar del micro (estilo toggle como el dictado online).
  async start() {
    if (recorder) throw new Error('BUSY');
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recChunks = [];
    recorder = new MediaRecorder(micStream);
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
    recorder.start(250);
    clearTimeout(recTimer);
    recTimer = setTimeout(() => { LocalSTT.stop().catch(() => {}); }, 60000);
  },
  // Para, transcribe lo grabado y devuelve el texto (puede ser '').
  async stop(lang) {
    clearTimeout(recTimer);
    const rec = recorder;
    const stream = micStream;
    recorder = null;
    micStream = null;
    const blob = await new Promise((resolve, reject) => {
      if (!rec || rec.state === 'inactive') return resolve(new Blob(recChunks));
      rec.onerror = () => reject(new Error('REC'));
      rec.onstop = () => resolve(new Blob(recChunks));
      try { rec.stop(); } catch (e) { reject(new Error('REC')); }
    });
    if (stream) stream.getTracks().forEach((t) => { try { t.stop(); } catch {} });
    recChunks = [];
    return transcribir(blob, lang);
  },
  // Transcribe un audio ya grabado (diagnóstico y pruebas).
  async transcribeBlob(blob, lang) {
    return transcribir(blob, lang);
  },
  abort() {
    clearTimeout(recTimer);
    if (recorder) { try { recorder.stop(); } catch {} recorder = null; }
    if (micStream) { micStream.getTracks().forEach((t) => { try { t.stop(); } catch {} }); micStream = null; }
    recChunks = [];
  },
};

/* Carga el modelo si hace falta y transcribe un blob de audio.
   Devuelve '' si no hay audio útil. */
async function transcribir(blob, lang) {
  if (!blob || !blob.size) return '';
  const pipe = await getASR();
  const samples = await to16k(blob);
  if (samples.length < 1600) return ''; // menos de 0,1 s: nada útil
  const out = await pipe(samples, { language: LANGS[lang] || 'spanish', task: 'transcribe' });
  return String((out && out.text) || '').trim();
}

// Aviso a la página de que el dictado local ya está disponible
window.dispatchEvent(new Event('freeduck:stt-ready'));
