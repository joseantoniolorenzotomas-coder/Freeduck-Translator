# 🦆 Freeduck-Translator

Traductor gratuito con modo offline (texto y voz ES↔EN) y 38 idiomas online. PWA instalable en móvil y escritorio.

## 🚀 Uso rápido

```bash
# Opción A: servidor incluido (recomendado, con cabeceras para la voz natural)
python3 servir.py
# Opción B: Docker
docker compose up --build
# Opción C: cualquier servidor estático
python3 -m http.server 8901
```

Abre **http://localhost:8901** en Chrome o Edge (con `localhost`, no `127.0.0.1`, y recarga fuerte tras actualizar).

> Abrir `index.html` con doble clic (`file://`) limita funciones (voz, instalación). Úsalo solo como reserva.

## ✨ Características

- 🌍 **38 idiomas** online (motor MyMemory, sin registro) + **detectar idioma**.
- 📴 **Offline real ES↔EN**: texto (Bergamot/Mozilla) y voz natural (Piper/sherpa). Descarga el modelo y la voz una vez desde la propia app y corta la red para comprobarlo.
- 🗣️ **Conversación a dos voces**: cada persona pulsa su micro; traduce y reproduce solo con la voz elegida (natural principal, robótica divertida o sistema).
- 🤖 Voz robótica offline ES/EN incluida; 🔊 selector de voz con testigo de qué sonó.
- 📲 PWA instalable + sección de **Descargas** (ZIP con la app completa).
- 📝 Historial local (50), atajos de teclado, responsive.

## 🧪 Pruebas

```bash
python3 tests/test_traductor.py
```

Suite sin dependencias: estructura, idiomas, seguridad (CSP, XSS, almacenamiento), PWA, empaquetado, offline y marca. Ver `Documentacion.md` §7.

## 📁 Estructura

```
index.html            ← Web/app principal
manifest.webmanifest  ← PWA
sw.js                 ← Service Worker (caché offline)
offline.js            ← Motor de traducción offline (Bergamot)
voice-sherpa.js       ← Voz natural offline (Piper/sherpa)
models/               ← Modelos ES↔EN (~49 MB, MPL-2.0)
voices/               ← Voces ES/EN (~41 MB)
vendor/               ← bergamot, mespeak (GPL-3.0), sherpa (Apache-2.0), kokoro retirado
img/                  ← Logo, fondo e iconos PWA
electron/             ← Ejecutables de escritorio (npm run dist)
tests/                ← Suite de pruebas
Documentacion.md, MEMORY.md, AGENTS.md, constitution.md
```

## ⚠️ Licencias y avisos

- Voces y modelos con sus licencias en `vendor/*/NOTICE.txt` y `Documentacion.md` §8. **Ojo**: meSpeak es GPL-3.0 (copyleft); la licencia del proyecto sigue pendiente y deberá ser compatible.
- Esta versión necesita internet salvo texto/voz ES↔EN ya descargados. El dictado por micro siempre necesita red.
- Versión actual: 0.3-voz. Estado y decisiones en `MEMORY.md`.
