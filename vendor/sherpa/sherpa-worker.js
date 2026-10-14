/* Freeduck-Translator — worker de voz natural (Piper/sherpa).
   Una instancia por idioma: cada worker escribe su modelo en su propio FS
   virtual (model.onnx + tokens.txt) y crea el motor con la config estándar
   en modo fonemización (sin lexicon). */
'use strict';

let tts = null;
let runtimeReady = false;
let pendingInit = null;

async function doInit(d) {
  try {
    const [modelBuf, tokensBuf] = await Promise.all([
      fetchBytes(d.modelUrl, (p) => self.postMessage({ type: 'sherpa-dl', file: 'model.onnx', ...p })),
      fetchBytes(d.tokensUrl, (p) => self.postMessage({ type: 'sherpa-dl', file: 'tokens.txt', ...p })),
    ]);
    self.Module.FS_createDataFile('/', 'model.onnx', new Uint8Array(modelBuf), true, true);
    self.Module.FS_createDataFile('/', 'tokens.txt', new Uint8Array(tokensBuf), true, true);
    // Config estándar vits en modo fonemización (sin lexicon).
    tts = createOfflineTts(self.Module);
    self.postMessage({
      type: 'sherpa-ready',
      numSpeakers: tts.numSpeakers,
      sampleRate: tts.sampleRate,
    });
  } catch (err) {
    self.postMessage({ type: 'error', message: 'init: ' + String((err && err.message) || err) });
  }
}

async function fetchBytes(url, onProgress) {
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
    if (onProgress) onProgress({ loaded: got, total });
  }
  return new Blob(chunks).arrayBuffer();
}

self.Module = {
  // Los .wasm/.data se resuelven junto a este script (vendor/sherpa/).
  locateFile: function (path, scriptDirectory) {
    return (scriptDirectory || '') + path;
  },
  // No usamos los archivos embebidos en el .data de la demo (voz inglesa):
  // escribiremos nuestros modelos con FS.writeFile. Sin este hook, el
  // pegamento intentaría descargar el .data (78 MB) y se quedaría colgado.
  getPreloadedPackage: function () {
    return new ArrayBuffer(0);
  },
  setStatus: function (status) {
    self.postMessage({ type: 'sherpa-progress', status });
  },
  onRuntimeInitialized: function () {
    runtimeReady = true;
    if (pendingInit) {
      const d = pendingInit;
      pendingInit = null;
      doInit(d);
    } else {
      self.postMessage({ type: 'sherpa-wasm-ready' });
    }
  },
};

importScripts('sherpa-onnx-wasm-main-tts.js');
importScripts('sherpa-onnx-tts.js');

self.onmessage = async (e) => {
  const d = e.data || {};
  if (d.type === 'diag') {
    self.postMessage({ type: 'sherpa-diag',
      runtimeReady,
      hasModule: typeof self.Module,
      hasFS: !!(self.Module && self.Module.FS),
      hasPending: !!pendingInit,
      hasTts: !!tts });
    return;
  }
  if (d.type === 'init') {
    // El runtime WASM puede tardar: se encola hasta que esté listo.
    if (!runtimeReady) {
      pendingInit = d;
      self.postMessage({ type: 'sherpa-progress', status: 'Cargando motor…' });
      return;
    }
    await doInit(d);
    return;
  }
  if (d.type === 'generateWithConfig') {
    if (!tts) {
      self.postMessage({ type: 'error', message: 'motor no iniciado' });
      return;
    }
    try {
      const config = Object.assign({}, d.genConfig || {});
      config.callback = (samples, n, progress) => {
        self.postMessage({ type: 'sherpa-generation-progress', progress });
        return 1;
      };
      const audio = tts.generateWithConfig(d.text || '', config);
      const samples = audio.samples;
      self.postMessage(
        { type: 'sherpa-result', samples, sampleRate: tts.sampleRate },
        [samples.buffer]
      );
    } catch (err) {
      self.postMessage({ type: 'error', message: 'generate: ' + String((err && err.message) || err) });
    }
  }
};
