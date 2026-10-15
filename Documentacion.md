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
- Requisitos para instalar: servir la carpeta por **HTTPS** (o `localhost`)
  y abrirla en un navegador compatible; el menú ofrece entonces «Instalar».
- Archivos implicados: `index.html`, `manifest.webmanifest`, `sw.js`,
  `img/icon-*.png` y `img/micro-azul-ondas.png`. No se debe publicar uno sin
  los otros.
- **Sin conexión:** traduce ES↔EN en los dos sentidos, transcribe el dictado
  y responde con voz natural, todo en el dispositivo. Para conseguirlo hay que
  pulsar **una vez** (con internet) el botón «⬇ Descarga para usar sin
  conexión». Ver §6.1.
- La app tiene **dos vistas**, con una barra de pestañas fuera de `<main>`
  para que se vea en las dos: «Traducir y conversar» y «Cómo funciona y
  contacto» (con el correo duckdev77@gmail.com). Recuerda cuál estabas
  usando (`localStorage fd_vista`).

### 5.3. Docker (probar igual en Windows, macOS y Linux)
- Requiere Docker Desktop instalado. En la carpeta: `docker compose up --build`.
- Abrir `http://localhost:8901` (`localhost` es contexto seguro: valen micro,
  PWA instalable y voces offline).
- La imagen (nginx:alpine) envía las cabeceras COOP/COEP que exige la voz
  natural. Con `python3 servir.py` se consigue lo mismo sin Docker.
- Con Docker **sí** se puede usar el micro y la voz natural (ya verificada,
  no está en beta). Lo único que no se ha podido comprobar aquí es que la
  imagen se construya (no hay Docker en este equipo).

### 5.2. Ejecutables de escritorio (Electron)
- Carpeta `electron/`: `main.js` carga el mismo `index.html` local en una
  ventana propia (sin integración Node, enlaces externos al navegador).
- Requisitos de compilación: Node 18+ y `npm install` dentro de `electron/`.
- Comandos: `npm run dist:mac` (DMG x64+arm64), `npm run dist:win`
  (instalador NSIS x64), o `npm run dist` para ambos. Salen en `electron/dist/`.
- **Sin firmar:** macOS (Gatekeeper) y Windows (SmartScreen) mostrarán avisos
  al abrirlo; firmarlo queda pendiente de decidir.
- Los ejecutables de `electron/dist/` están **obsoletos**: se compilaron antes
  del modo offline y con el nombre antiguo del proyecto. Hay que recompilarlos
  (`npm run dist`) para que lleven el nombre actual y el funcionamiento sin
  conexión.

## 6. Requisito de funcionamiento sin conexión

La traducción deberá probarse con la conexión desactivada.

Si una función necesita internet —por ejemplo, descargar inicialmente un modelo o comprobar actualizaciones—, debe indicarse. No se debe describir como offline un flujo que necesite conectarse a un servicio de traducción para producir resultados.

### 6.1. Offline (texto, voces y dictado ES/EN)
- **Qué va dentro del paquete (no necesita internet):**
  - Motor **Bergamot 0.4.9** (WASM) en `vendor/bergamot/`.
  - Los dos modelos ES↔EN de Mozilla en `models/` (**49 MB**, misma origin).
  - Las dos voces naturales **Piper** en `voices/` (**39 MB**) y el fonemizador
    de `vendor/sherpa/`.
  - La voz robótica (eSpeak vía meSpeak) en `vendor/mespeak/`.
- **Qué se baja al pulsar el botón (una sola vez, con internet):**
  - Modelo de dictado **Whisper tiny q8** (~42 MB, de Hugging Face).
  - Runtimes que no pueden ir en git porque GitHub los marca como secretos:
    `transformers.min.js` (~0,6 MB) y el `.wasm` de ONNX Runtime (~27 MB). Los
    trae el service worker del CDN oficial y los cachea como propios.
  - Los modelos y las voces que ya vienen en el paquete se copian a la caché
    del navegador: no se descargan de internet.
- El botón «⬇ Descarga para usar sin conexión» lo hace todo junto, con
  progreso global y sin pasos intermedios.
- Limitado a **ES↔EN** (pares verificados). El resto de idiomas sigue
  necesitando conexión para traducir.
- **Dictado:** se resuelve en el dispositivo; no sale audio ni texto a ningún
  servicio. Funciona sin internet; con internet se usa el del navegador
  salvo que falle, y entonces se reintenta solo con el local.
- **Voz natural:** funciona sin conexión. Si falta la voz del idioma de
  destino, se avisa con el idioma concreto (no se cae en silencio a otra voz:
  la preferencia es estricta).
- VERIFICADO 2026-10-15 en navegador (servidor apagado a propósito): la app
  recarga sin red, traduce ES→EN y EN→ES, transcribe audio ES real (~5 s) y
  genera voz natural ES y EN. La línea «Sin conexión listo» queda toda en ✓.
- **Red que no se fía de `navigator.onLine`:** en muchos móviles sigue en
  `true` con el modo avión. `hayInternet()` sonda un servicio exterior con
  espera corta y memoria de 15 s; así el dictado cae al local en vez de
  quedarse colgado en la nube.

## 7. Pruebas

`tests/test_traductor.py` (solo biblioteca estándar de Python, sin
dependencias). Se ejecuta con `python3 tests/test_traductor.py`.

Estado actual: **150 comprobaciones, 0 fallos**, 0 omitidas.

Comprueba, entre otras cosas:
- **Estructura:** ids usados desde JS, `onclick` con función definida,
  coherencia de los 4 selectores de idioma (42 idiomas + auto), cobertura en
  `CODES`/`LOCALES`/`NAMES`/`FLAGS`, imágenes existentes.
- **Seguridad:** CSP endurecida, `innerHTML` siempre escapado con `esc()`, sin
  `eval`/`document.write`, almacenamiento local validado, `noopener` en
  enlaces externos, y que el service worker **no** envíe una
  `Permissions-Policy` que niegue el micrófono.
- **Offline:** que el `activate` del service worker no borre las cachés de
  modelos y dictado al actualizarse, y que no sustituya un recurso que falta
  por `index.html` (provocaría «Unexpected token '<'»).
- **Traducción real** contra MyMemory (requiere internet; sin conexión esos
  casos se omiten en vez de fallar).

El plan de pruebas deberá considerar, según la plataforma y las funciones
aprobadas:

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

### 8.1. Componentes incluidos (revisados 2026-10-15)
- **@browsermt/bergamot-translator 0.4.9** (motor offline, `vendor/bergamot/`,
  copias sin modificar): MPL-2.0.
  Origen: https://github.com/browsermt/bergamot-translator
- **Modelos Firefox Translations de Mozilla** (Marian NMT, ES↔EN en `models/`,
  49 MB, con registro local `models/registry.json`): licencia del repositorio
  MPL-2.0. Origen: https://github.com/mozilla/firefox-translations-models
- **meSpeak.js 2.0.7 + voces ES/EN** (voz robótica, `vendor/mespeak/`,
  copias sin modificar): GNU GPL-3.0 (copyleft fuerte, heredado de eSpeak).
  Origen: https://www.masswerk.at/mespeak/
  **Consecuencia importante:** lo que se distribuya con esta carpeta debe
  cumplir la GPL-3.0. La licencia del proyecto sigue sin decidir y tendrá que
  ser compatible con GPL-3.0.
- **sherpa-onnx (build WASM) + voces Piper** (voz natural, `vendor/sherpa/` y
  `voices/`, 39 MB, con un parche mínimo documentado en su NOTICE):
  Apache-2.0 (sherpa) y MIT (repositorio de voces Piper). Datos de voz
  sharvard: CC-BY 3.0 (atribución incluida).
  Orígenes: https://github.com/k2-fsa/sherpa-onnx y
  https://huggingface.co/rhasspy/piper-voices
- **@huggingface/transformers + onnxruntime-web** (dictado offline,
  `vendor/stt/`): Apache-2.0 y MIT.
  `transformers.min.js` (~0,6 MB) y el `.wasm` de ONNX (~27 MB) **no viajan en
  git** (el detector de secretos de GitHub los bloquea): los sirve el service
  worker desde el CDN oficial en la primera carga y quedan en caché.
- **Modelo Xenova/whisper-tiny q8** (~42 MB, se descarga una vez): Apache-2.0.
  Origen: https://huggingface.co/Xenova/whisper-tiny
- **MyMemory** (traducción online, API HTTP): servicio externo gratuito, sin
  registro ni API key. https://mymemory.translated.net
- **Google Fonts (Inter)**: licencia de fuentes SIL Open Font License 1.1.
- **nginx:alpine** (imagen Docker, solo para servir en local): BSD-2-Clause.
- Atribuciones completas y archivo por archivo en:
  `vendor/bergamot/NOTICE.txt`, `vendor/mespeak/NOTICE.txt`,
  `vendor/sherpa/NOTICE.txt` y `vendor/stt/NOTICE.txt`.

## 9. Decisiones pendientes

Consultar `MEMORY.md` para ver el registro actualizado de decisiones y preguntas pendientes.
