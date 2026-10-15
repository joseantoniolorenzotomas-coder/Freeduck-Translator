# Documentación del proyecto

## 1. Descripción

El proyecto consiste en crear un traductor gratuito y descargable que pueda utilizarse sin conexión después de instalarse y obtener los recursos necesarios.

También se creará una web sencilla y profesional para presentar el proyecto y facilitar la descarga de las versiones disponibles.

## 2. Objetivo de la primera versión

El alcance de la primera versión está pendiente de aprobación. Antes de iniciar la implementación se deben definir:

- plataformas y sistemas operativos compatibles;
- idiomas disponibles;
- motor de traducción;
- modelos necesarios;
- tamaño aproximado de las descargas;
- proceso de instalación y actualización.

## 3. Cómo se plantea el producto

El proyecto tendrá dos partes diferenciadas:

1. **Web informativa y de descarga:** presenta el producto, explica cómo instalarlo y enlaza las versiones publicadas.
2. **Aplicación traductora:** ofrece la interfaz y ejecuta la traducción en el dispositivo, utilizando el motor y los modelos locales necesarios.

La web de descarga no debe confundirse con la aplicación. La aplicación tendrá que disponer de los recursos necesarios para traducir offline.

## 4. Experiencia de uso prevista

Flujo previsto, pendiente de concretar:

1. La persona visita la web del proyecto.
2. Selecciona la descarga compatible con su dispositivo.
3. Instala o abre la aplicación según las instrucciones de esa plataforma.
4. Obtiene los idiomas o modelos necesarios, si no vienen incluidos.
5. Traduce sin conexión cuando los recursos estén disponibles.

> Nota de la versión web actual (online): el idioma de origen ofrece
> «🌐 Detectar idioma» como primera opción (detección vía MyMemory con
> `autodetect`). Los nombres de los idiomas en los desplegables se muestran
> localizados al idioma de la página mediante `Intl.DisplayNames` (p. ej.
> «Sueco» en español, «Swedish» en inglés), sin dependencias externas. Debajo del traductor hay un botón redondo para hablar. Lo dicho se transcribe, se traduce al idioma de destino
> y suena en voz alta; al terminar, los idiomas se intercambian solos para que
> la otra persona conteste en su idioma (p. ej. ES→EN y luego EN→ES). Se puede
> desactivar con la casilla «Cambio automático», y el botón «Responder» inicia
> el turno de la otra persona. La pestaña «Conversación» ofrece lo mismo con dos
> micrófonos (Persona A / Persona B). Ambas funciones requieren internet
> (Web Speech API + motor online) y Chrome/Edge para el dictado.

## 5. Descargas e instalación

Las instrucciones de instalación dependerán de las plataformas aprobadas. La web deberá indicar, para cada descarga:

- plataforma y versión compatibles;
- versión del producto;
- tamaño del archivo;
- requisitos;
- pasos de instalación;
- idiomas o modelos incluidos;
- recursos que deben descargarse por separado;
- cambios y problemas conocidos.

No se debe anunciar una descarga como universal si no funciona en todos los dispositivos.

### 5.1. PWA instalable (versión actual)
- La app es una PWA: se instala desde el navegador (Chrome/Edge) en móvil y
  escritorio con su icono, sin tiendas ni ejecutables por sistema.
- Requisitos para instalar: servir la carpeta por **HTTPS** (vale
  `http://localhost` para probar, p. ej. `python3 -m http.server 8901`) y
  abrirla en un navegador compatible; el menú ofrece entonces «Instalar».
- Archivos implicados: `index.html`, `manifest.webmanifest`, `sw.js` e
  `img/icon-*.png`. No se debe publicar uno sin los otros.
- **Aviso obligatorio:** esta versión requiere conexión a internet para
  traducir y para la voz (motor online). El service worker solo acelera la
  apertura; no la convierte en offline.
- La propia página trae la sección «Descargas»: instalar como app y guía
  de uso del modo offline.

### 5.3. Docker (probar igual en Windows, macOS y Linux)
- Requiere Docker Desktop instalado. En la carpeta: `docker compose up --build`.
- Abrir `http://localhost:8901` (localhost es contexto seguro: valen micro,
  PWA instalable y voces offline tras descargarlas).
- La imagen (nginx:alpine) ya envía las cabeceras COOP/COEP que exige la voz
  natural; con `python3 servir.py` se consigue lo mismo sin Docker.
- Docker NO arregla por sí solo la voz natural (sigue en beta) ni el permiso
  de micro (lo pide tu navegador). La imagen no se ha podido compilar aquí
  (sin Docker en este equipo): pendiente de probar `up --build`.

### 5.2. Ejecutables de escritorio (Electron)
- Carpeta `electron/`: `main.js` carga el mismo `index.html` local en una
  ventana propia (sin integración Node, enlaces externos al navegador).
- Requisitos de compilación: Node 18+ y `npm install` dentro de `electron/`.
- Comandos: `npm run dist:mac` (DMG x64+arm64), `npm run dist:win`
  (instalador NSIS x64), o `npm run dist` para ambos. Salen en `electron/dist/`.
- **Sin firmar:** macOS (Gatekeeper) y Windows (SmartScreen) mostrarán avisos
  al abrirlo; firmarlo (certificado de pago, p. ej. Apple ~99 $/año) queda
  pendiente de decidir.
- **Siguen necesitando internet** para traducir y para la voz. El ejecutable
  no es offline.

## 6. Requisito de funcionamiento sin conexión

La traducción deberá probarse con la conexión desactivada.

Si una función necesita internet —por ejemplo, descargar inicialmente un modelo o comprobar actualizaciones—, debe indicarse. No se debe describir como offline un flujo que necesite conectarse a un servicio de traducción para producir resultados.

### 6.1. Offline beta (texto ES↔EN)
- Motor local Bergamot (WASM) con modelos de Mozilla, integrado en la app.
- Los modelos (49 MB: ES→EN + EN→ES) viajan en el paquete (`models/`, misma
  origin): sin CORS ni dependencias externas; cada sentido se guarda en la
  caché del navegador la primera vez que se pulsa «Descargar modelo».
- v1 limitada a ES↔EN (par verificado). La voz (dictado) sigue necesitando
  internet.
- VERIFICADO 2026-10-14 en navegador (servidor apagado a propósito): la app
  recarga sin red, traduce ES→EN correctamente con el distintivo
  «Offline · es→en» y reproduce la voz con el motor local («natural»).
  Procedimiento: descargar modelo+voz una vez, cortar la red y traducir.
- Dictado offline (Whisper tiny q8, Apache-2.0, ~42 MB, ES+EN con una sola
  descarga): verificado en navegador 2026-10-15 (audio real ES transcrito
  bien en ~3 s). Con red se usa el dictado del navegador (más rápido).
- Voz offline robótica (eSpeak vía meSpeak, GPL-3.0) incluida para ES/EN
  desde la instalación, sin descarga adicional. Si el modo worker falla
  (p. ej. abriendo por `file://`), la app reintenta en modo simple
  automáticamente. El resto de idiomas usa la
  voz del sistema (puede necesitar red según el dispositivo).
- Voz natural offline (Piper + sherpa-onnx, ES/EN): las voces (~22/19 MB)
  se descargan una vez y el navegador las guarda; después hablan sin red.
  VERIFICADA 2026-10-14 en navegador con el servidor apagado: el motor
  local genera y reproduce (testigo «natural», sin errores).

## 7. Pruebas

Existe `tests/test_traductor.py` (solo biblioteca estándar de Python, sin
dependencias). Se ejecuta con `python3 tests/test_traductor.py` y comprueba:
ids usados desde JS, `onclick` definidos, coherencia de los 4 selectores de
idioma, cobertura en `CODES`/`LOCALES`/`NAMES`/`FLAGS`, imágenes existentes,
logo y fondo tenue, seguridad (CSP, escapado HTML en `innerHTML`, sin
`eval`/`document.write`, almacenamiento local validado, `spellcheck`
desactivado, `noopener` en enlaces externos) y traducción real contra
MyMemory (requiere internet;
sin conexión esos casos se omiten en vez de fallar).

El plan de pruebas deberá considerar, según la plataforma y las funciones aprobadas:

- instalación limpia;
- primer uso y disponibilidad de los modelos;
- traducción con conexión desactivada;
- idioma o modelo no disponible;
- almacenamiento insuficiente;
- descarga interrumpida, si aplica;
- actualización de la aplicación o de los modelos, si aplica;
- pruebas de interfaz y accesibilidad.

## 8. Licencias y atribuciones

Antes de distribuir código, bibliotecas, modelos o datos, se documentarán sus licencias, condiciones de redistribución y atribuciones requeridas.

### 8.1. Componentes incluidos (revisados 2026-10-12)
- **@browsermt/bergamot-translator 0.4.9** (motor offline, `vendor/bergamot/`,
  copias sin modificar): MPL-2.0. Origen: https://github.com/browsermt/bergamot-translator
- **Modelos Firefox Translations de Mozilla** (Marian NMT, ES↔EN en `models/`,
  con registro local): licencia del repositorio MPL-2.0.
  Origen: https://github.com/mozilla/firefox-translations-models
- **meSpeak.js 2.0.7 + voces ES/EN** (voz offline, `vendor/mespeak/`,
  copias sin modificar): GNU GPL-3.0 (copyleft fuerte, heredado de eSpeak).
  Origen: https://www.masswerk.at/mespeak/
  Consecuencia: lo distribuido con esta carpeta debe cumplir la GPL-3.0;
  la licencia del proyecto sigue pendiente y deberá ser compatible.
- **sherpa-onnx v1.13.8 (build WASM) + voces Piper** (voz natural,
  `vendor/sherpa/` y `voices/`, con un parche mínimo documentado en su NOTICE):
  Apache-2.0 (sherpa) y MIT (repositorio de voces Piper).
  Orígenes: https://github.com/k2-fsa/sherpa-onnx y
  https://huggingface.co/rhasspy/piper-voices
  Datos de voz sharvard: CC-BY 3.0 (atribución incluida).
- **@huggingface/transformers + onnxruntime-web** (dictado offline,
  `vendor/stt/`, con parche de ruta local documentado): Apache-2.0 y MIT.
  El bundle `transformers.min.js` y el `.wasm` de ONNX NO viajan en git
  (el detector de secretos de GitHub los bloquea): los sirve el Service
  Worker desde el CDN oficial en la primera carga y quedan en caché.
- **Modelo Xenova/whisper-tiny q8** (~42 MB, se descarga una vez, no viaja
  en el ZIP): Apache-2.0. Origen: https://huggingface.co/Xenova/whisper-tiny
- **nginx:alpine** (imagen Docker, solo para servir en local): BSD-2-Clause.
- Atribución completa en `vendor/bergamot/NOTICE.txt`,
  `vendor/mespeak/NOTICE.txt` y `vendor/sherpa/NOTICE.txt`.

## 9. Decisiones pendientes

Consultar `MEMORY.md` para ver el registro actualizado de decisiones y preguntas pendientes.
