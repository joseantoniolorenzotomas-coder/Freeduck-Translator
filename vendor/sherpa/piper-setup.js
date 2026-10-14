/* Freeduck-Translator — arranque de piper-phonemize (fonemización espeak-ng).
   Debe cargarse ANTES que piper-phonemize.js para que el pegamento
   Emscripten use este Module (ruta de datos + aviso de listo). */
'use strict';

window.__piperReady = new Promise((resolve, reject) => {
  window.__piperResolve = resolve;
  window.__piperReject = reject;
  setTimeout(() => reject(new Error('PHONEMIZE_TIMEOUT')), 60000);
});

window.Module = {
  // El pegamento pide el .data con directorio vacío: prefijamos la
  // ubicación real del paquete dentro de vendor/.
  locateFile: function (path, scriptDirectory) {
    return (scriptDirectory || 'vendor/sherpa/piper-phonemize/') + path;
  },
  onRuntimeInitialized: function () {
    try {
      const ret = piperPhonemizeInitialize();
      if (ret >= 0) window.__piperResolve(true);
      else window.__piperReject(new Error('espeak-ng'));
    } catch (e) {
      window.__piperReject(e);
    }
  },
};
