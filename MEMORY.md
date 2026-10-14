# Memoria del proyecto

Este archivo registra decisiones confirmadas, contexto útil y asuntos pendientes. No debe usarse para convertir suposiciones en requisitos.

## Objetivo confirmado
- Crear un traductor gratuito y descargable.
- La finalidad principal es que pueda utilizarse sin conexión.
- Crear una web sencilla y profesional desde la que se pueda descargar el programa.
- El propietario del proyecto está empezando y necesita documentación clara sobre cómo se crea y distribuye una aplicación descargable.

## Decisiones confirmadas

### 2026-10-12 — Plataforma inicial: web
- **Decisión:** La primera versión será una aplicación web (HTML/CSS/JS), ejecutable desde el navegador sin instalación.
- **Motivo:** Permite iterar rápido, validar la interfaz y la experiencia antes de afrontar el empaquetado como app descargable.
- **Alternativas consideradas:** App de escritorio nativa (Electron/Tauri), PWA instalable.
- **Consecuencias:** No habrá acceso a modelos locales del sistema operativo en esta fase. El modo offline se implementará en una fase posterior.
- **Aprobada por:** propietario del proyecto (sesión 2026-10-12).

### 2026-10-12 — Modo offline: objetivo a largo plazo
- **Decisión:** El objetivo final es traducción 100% offline (modelos en el dispositivo). La primera versión web puede usar una API online como puente provisional.
- **Motivo:** Implementar offline correctamente requiere elegir motor, plataforma y gestión de modelos, que son decisiones aún por concretar.
- **Consecuencias:** La versión web actual NO puede declararse offline. Debe indicar claramente que requiere conexión.
- **Aprobada por:** propietario del proyecto (sesión 2026-10-12).

### 2026-10-12 — Idiomas de la primera versión
- **Decisión:** Empezar con los 10 idiomas más comunes. Ampliar en versiones posteriores.
- **Idiomas iniciales (pendiente de confirmar lista exacta):** Español, Inglés, Francés, Alemán, Italiano, Portugués, Chino, Japonés, Árabe, Ruso.
- **Aprobada por:** propietario del proyecto (sesión 2026-10-12).

### 2026-10-12 — Ampliación de idiomas: nórdicos y bálticos
- **Decisión:** Añadir 8 idiomas a los 10 iniciales: sueco (sv), noruego (no), danés (da), finés (fi), islandés (is), estonio (et), letón (letón, lv) y lituano (lt). Total: 18 idiomas en traductor y modo conversación.
- **Motivo:** Petición del propietario; todos verificados contra MyMemory (`responseStatus: 200` con traducciones correctas).
- **Alternativas consideradas:** Feroés y groenlandés (sin soporte del motor, descartados).
- **Consecuencias:** La voz (dictado y lectura) usa los locales correspondientes (p. ej. `nb-NO` para noruego); en navegadores sin voz para algún locale, esa parte puede no sonar.
### 2026-10-12 — Segunda ampliación: 10 idiomas muy hablados
- **Decisión:** Añadir hindi (hi), bengalí (bn), indonesio (id), coreano (ko), vietnamita (vi), turco (tr), tailandés (th), persa (fa), polaco (pl) y ucraniano (uk). Total: 28 idiomas.
- **Motivo:** Petición del propietario; verificados contra MyMemory con frases reales (`responseStatus: 200`, traducciones correctas; con palabras sueltas el banco de memoria a veces devuelve ruido).
- **Consecuencias:** Igual que la ampliación anterior (locales de voz añadidos).
- **Aprobada por:** propietario del proyecto (sesión 2026-10-12).

### 2026-10-12 — Tercera ampliación: otros 10 idiomas
- **Decisión:** Añadir holandés (nl), griego (el), rumano (ro), húngaro (hu), checo (cs), malayo (ms), urdu (ur), tamil (ta), hebreo (he) y suajili (sw). Total: 38 idiomas.
- **Motivo:** Petición del propietario; verificados contra MyMemory con frases reales (`responseStatus: 200`, traducciones correctas).
- **Consecuencias:** Igual que ampliaciones anteriores (locales de voz añadidos).
- **Aprobada por:** propietario del proyecto (sesión 2026-10-12).

### 2026-10-12 — Formato descargable: PWA instalable
- **Decisión:** La primera versión descargable/instalable será una PWA (manifiesto + service worker + iconos), válida para móvil y escritorio desde el navegador. Nada de Electron ni tiendas por ahora.
- **Motivo:** Sin costes, sin firmas ni compilados por sistema; el propietario la instalará para probar. La PWA exige HTTPS al publicarla (`localhost` vale para pruebas).
- **Alternativas consideradas:** HTML suelto descargable (se queda como opción de reserva), app Electron (descartada por peso 50-150 MB, compilación por SO y coste de firmas).
- **Consecuencias:** Hay que publicar la carpeta en un hosting con HTTPS. El aviso «requiere conexión a internet» es obligatorio en la descarga: la PWA no aporta traducción offline.
- **Aprobada por:** propietario del proyecto (sesión 2026-10-12).

### 2026-10-12 — Ejecutables de escritorio con Electron
- **Decisión:** Envolver la misma web con Electron y generar instalables para macOS (DMG x64+arm64) y Windows (NSIS x64). Revisa y deja atrás la limitación «nada de Electron por ahora»: el propietario pidió un ejecutable real.
- **Motivo:** Petición del propietario; Electron reutiliza el HTML tal cual y compila ambos sistemas desde este Mac.
- **Alternativas consideradas:** Tauri (descartado: ejecutable menor pero exige Rust y más trabajo).
- **Consecuencias:** Instalables de ~115-135 MB sin firmar → avisos de Gatekeeper/SmartScreen; la firma queda pendiente (con coste). Siguen necesitando internet: el ejecutable NO es offline.
- **Aprobada por:** propietario del proyecto (sesión 2026-10-12).

### 2026-10-12 — Motor offline: Bergamot, v1 ES↔EN
- **Decisión:** Integrar Bergamot (WASM, motor de Firefox Translations) como motor offline. v1 limitada al par ES↔EN (verificado con inferencia real). Modelos bajo demanda (~27 MB por sentido), guardados en caché del navegador. Licencias revisadas: código y modelos MPL-2.0 (atribución en `vendor/bergamot/NOTICE.txt` y Documentación §8).
- **Motivo:** El propietario delegó la elección del modelo y pidió probar offline ya. Bergamot funciona en PWA y Electron sin cambiar de arquitectura; la voz sigue online (el dictado de Chrome necesita red).
- **Alternativas consideradas:** Transformers.js/Opus-MT (más idiomas potenciales, más peso y trabajo), ML Kit (solo apps nativas, obligaría a reescribir), Argos (pesado para web).
- **Consecuencias:** Ampliar pares exige verificar modelo por modelo (algunos usan vocabularios separados). Electron con `file://` y workers WASM queda pendiente de probar en ventana real. Los modelos ES↔EN (49 MB) se empaquetan en `models/` con registro local: el bucket de Mozilla solo admite CORS desde `localhost`, así que descargar de allí fallaría en la web publicada.
- **Aprobada por:** propietario del proyecto, con elección del modelo delegada al agente (sesión 2026-10-12).

### 2026-10-13 — Voz offline: eSpeak (meSpeak), v1 ES/EN
- **Decisión:** Integrar meSpeak.js 2.0.7 (eSpeak robótico) como voz offline para ES/EN, incluido en el paquete (sin descarga adicional). El resto de idiomas sigue con la voz del sistema; el dictado sigue online.
- **Motivo:** Petición del propietario (acepta voz robótica con tal de que sea offline). eSpeak es diminuto (~1,6 MB) y 100% local.
- **Alternativas consideradas:** Flite (licencia permisiva pero sin voz española), Pico TTS (sin build WASM mantenido), voces del sistema (no garantizan offline).
- **Consecuencias:** meSpeak es GPL-3.0 (copyleft fuerte): lo distribuido debe cumplirla y la licencia del proyecto —aún pendiente— deberá ser compatible. Registrado en Documentación §8.1 y `vendor/mespeak/NOTICE.txt`. Workers en `file://` (Electron) pendientes de probar en ventana real.
- **Aprobada por:** propietario del proyecto, con elección de biblioteca delegada al agente (sesión 2026-10-13).

### 2026-10-13 — Voz natural offline: Kokoro q8 (beta sin verificar)
- **Decisión:** Integrar Kokoro-82M q8 (Apache-2.0, voces ef_dora ES / af_heart EN) como opción «natural», con descarga única de ~95 MB y caché. La robótica eSpeak se mantiene como opción divertida y verificada.
- **Motivo:** Petición del propietario (mejor voz descargable y legal; la robótica le hace gracia pero quiere calidad).
- **Estado:** NO verificado de extremo a extremo. En el navegador de pruebas la sesión ONNX no llega a crearse (cuelgue silencioso, CPU parada). Posibles causas: WASM con hilos sin COOP/COEP en el hosting, o desajuste de versiones ORT. No afirmar que funciona hasta probarlo en Chrome real.
- **Consecuencias:** El hosting de la web deberá enviar `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: credentialless` para la voz natural. Parche documentado en `vendor/kokoro/NOTICE.txt` (wasmPaths local).
- **Aprobada por:** propietario del proyecto, con elección delegada al agente (sesión 2026-10-13).

### 2026-10-14 — Voz natural offline: Piper + sherpa-onnx (sustituye a Kokoro)
- **Decisión:** Sustituir Kokoro (nunca verificado: la sesión ONNX se cuelga en el navegador de pruebas) por Piper VITS + motor sherpa-onnx WASM: es_ES-sharvard-medium-int8 (22 MB) y en_US-amy-low-int8 (19 MB), con fonemización espeak-ng en el hilo principal y síntesis en worker. La robótica eSpeak se mantiene como opción divertida.
- **Motivo:** Piper verificado en Node (ES 1,1s, EN 0,8s, audio real); motor oficial precompilado; licencias MIT (voces) + Apache-2.0 (sherpa); sin COOP/COEP obligatorios (build simd monohilo). Petición del propietario: voz humana, gratis y entendible, sin exigir la mejor.
- **Estado:** Integración completa. VERIFICADO 2026-10-14 en navegador con
  el servidor apagado: traduce ES→EN («Offline · es→en») y reproduce la voz
  local («natural»); la app recarga sin red. Procedimiento registrado en
  Documentación §6.1.
- **Consecuencias:** Se elimina Kokoro (código, voces en nube y token HF) para no mantener dos vías sin verificar. Atribuciones en `vendor/sherpa/NOTICE.txt` y Documentación §8.
- **Aprobada por:** propietario del proyecto (sesión 2026-10-14).

### 2026-10-14 — Distribución local con Docker
- **Decisión:** Añadir `Dockerfile` (nginx:alpine), `nginx.conf`, `docker-compose.yml` y `.dockerignore` para probar la app igual en Windows, macOS y Linux con `docker compose up --build` (puerto 8901).
- **Motivo:** Propuesta del propietario: descargar/ejecutar fácil en varios sistemas. Además nginx ya envía las cabeceras COOP/COEP que exige la voz natural.
- **Consecuencias:** Requiere Docker Desktop instalado. NO arregla por sí solo la voz natural (beta) ni el permiso de micro (lo pide el navegador). Imagen sin compilar aquí (sin Docker en este equipo): pendiente de probar.
- **Aprobada por:** propietario del proyecto (sesión 2026-10-14).

### 2026-10-14 — Voz en nube (prioridad online) — ANULADA
- **Estado:** Anulada al sustituir Kokoro por Piper+sherpa (se elimina el código de nube y el token). Se conserva el registro histórico.
- **Decisión:** Añadir opción «Voz: ☁️ nube» que sintetiza con Kokoro vía API de Hugging Face (mismo modelo, sin descargas ni WASM). Requiere token gratuito del usuario (se guarda en su navegador) e internet.
- **Motivo:** La prioridad del propietario es usar la voz natural online ya; la vía local sigue atascada sin verificar.
- **Consecuencias:** El texto traducido sale del dispositivo (privacidad: solo bajo elección explícita, jamás en automático). La voz española del servidor puede variar; pendiente de verificar con token real. Sin token verificado aquí: solo se probó el camino sin-token (aviso correcto, sin errores).
- **Aprobada por:** propietario del proyecto (prioridad online expresada 2026-10-14).

### 2026-10-14 — Renombre a Freeduck-Translator
- **Decisión:** La marca pasa a «Freeduck-Translator» en título, cabecera, manifiesto, pie, Electron (nombre, appId `com.freeducktranslator.app`, acceso directo) y ZIP (`freeduck-translator-pwa-v0.1.zip`). Los ejecutables `electron/dist/` conservan el nombre viejo hasta recompilar.
- **Motivo:** Petición del propietario.
- **Aprobada por:** propietario del proyecto (sesión 2026-10-14).

## Pendiente de decidir
- Plataformas iniciales: ordenador, móvil o ambas; sistemas operativos concretos.
- Si la primera versión será una PWA, una aplicación instalable o ambas.
- Tecnología y lenguaje de programación.
- Motor de traducción y modelos.
- Idiomas y direcciones de traducción de la primera versión.
- Si los modelos vendrán incluidos o se descargarán por separado.
- Tamaño máximo aceptable de descarga.
- Diseño visual, nombre, dominio y contenidos de la web.
- Licencia del proyecto y política de contribuciones.
- Forma de publicar actualizaciones y verificar las descargas.

## Supuestos que no deben tratarse como decisiones
- Que una única descarga servirá para todos los dispositivos.
- Que todos los modelos de traducción podrán redistribuirse libremente.
- Que cada modelo funcionará en cualquier móvil u ordenador.
- Que la aplicación podrá traducir sin conexión antes de instalar o descargar los recursos necesarios.

## Registro de decisiones
Añadir cada decisión aprobada con este formato:

### AAAA-MM-DD — Título de la decisión
- **Decisión:**
- **Motivo:**
- **Alternativas consideradas:**
- **Consecuencias:**
- **Aprobada por:**
