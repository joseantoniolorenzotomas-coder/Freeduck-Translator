#!/usr/bin/env python3
"""Pruebas automáticas de Freeduck-Translator (sin dependencias externas).

Comprueba, sobre index.html:
  1. Que todos los id usados desde JS existen en el HTML.
  2. Que todos los manejadores onclick() corresponden a funciones definidas.
  3. Que los 4 selectores de idioma comparten el mismo conjunto de valores
     (origen = resto + 'auto') y sin duplicados.
  4. Que cada valor de idioma tiene entrada en CODES, LOCALES, NAMES y FLAGS.
  5. Que las imágenes referenciadas (logo, favicon, fondo) existen en img/.
  6. Que el fondo usa la opacidad tenue prevista y el logo es la imagen del pato.
  7. Traducción real contra MyMemory (requiere internet; si no hay, se omite).

Uso:  python3 tests/test_traductor.py
Sale con código 0 si todo pasa (o se omite por falta de red), 1 si algo falla.
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "index.html"

results = []  # (nombre, estado, detalle)  estado: PASS | FAIL | SKIP


def check(nombre, ok, detalle=""):
    results.append((nombre, "PASS" if ok else "FAIL", detalle))


def main():
    if not HTML.exists():
        print(f"FAIL: no existe {HTML}")
        return 1
    html = HTML.read_text(encoding="utf-8")
    bloques = re.findall(r"<script>(.*?)</script>", html, re.S)
    js = max(bloques, key=len) if bloques else ""

    # ---------- 1. ids referenciados existen ----------
    ids_en_html = set(re.findall(r'id="([^"]+)"', html))
    refs = set(re.findall(r"getElementById\(\s*['\"]([^'\"]+)['\"]\s*\)", js))
    faltan = sorted(refs - ids_en_html)
    check("ids-referenciados-existen", not faltan,
          "" if not faltan else f"faltan: {faltan}")

    # ---------- 2. onclick -> función definida ----------
    onclick = set(re.findall(r'onclick="([A-Za-z_]\w*)\s*\(', html))
    definidas = set(re.findall(r"function\s+([A-Za-z_]\w*)\s*\(", js))
    sin_definir = sorted(onclick - definidas)
    check("onclick-definidos", not sin_definir,
          "" if not sin_definir else f"sin definir: {sin_definir}")

    # ---------- 3. selectores coherentes ----------
    class SelParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.actual = None
            self.selects = {}

        def handle_starttag(self, tag, attrs):
            a = dict(attrs)
            if tag == "select" and "id" in a:
                self.actual = a["id"]
                self.selects[self.actual] = []
            elif tag == "option" and self.actual:
                self.selects[self.actual].append(a.get("value", ""))

        def handle_endtag(self, tag):
            if tag == "select":
                self.actual = None

    p = SelParser()
    p.feed(html)
    sels = p.selects
    esperados = {"srcLang", "tgtLang", "langA", "langB"}
    check("selectores-presentes", esperados <= set(sels),
          f"encontrados: {sorted(sels)}")
    if esperados <= set(sels):
        vals = {k: v for k, v in sels.items()}
        sin_dup = all(len(v) == len(set(v)) for v in vals.values())
        check("selectores-sin-duplicados", sin_dup)
        base = set(vals["tgtLang"])
        coherentes = (set(vals["langA"]) == base
                      and set(vals["langB"]) == base
                      and set(vals["srcLang"]) == base | {"auto"})
        check("selectores-coherentes", coherentes,
              "" if coherentes else {k: len(v) for k, v in vals.items()})
        n_idiomas = len(base)
    else:
        n_idiomas = 0
    print(f"  idiomas detectados (sin contar auto): {n_idiomas}")

    # ---------- 4. cobertura en CODES / LOCALES / NAMES / FLAGS ----------
    def claves(bloque):
        mm = re.search(r"const %s = \{(.*?)\};" % bloque, js, re.S)
        return set(re.findall(r"(\w+)\s*:", mm.group(1))) if mm else set()

    codes, locales, names, flags = (claves(b) for b in
                                    ("CODES", "LOCALES", "NAMES", "FLAGS"))
    if n_idiomas:
        ref = set(sels["tgtLang"])
        check("CODES-cubre-idiomas", ref | {"auto"} <= codes,
              f"faltan: {sorted((ref | {'auto'}) - codes)}")
        check("LOCALES-cubre-idiomas", ref <= locales,
              f"faltan: {sorted(ref - locales)}")
        check("NAMES-cubre-idiomas", ref | {"auto"} <= names,
              f"faltan: {sorted((ref | {'auto'}) - names)}")
        check("FLAGS-cubre-idiomas", ref <= flags,
              f"faltan: {sorted(ref - flags)}")
        check("LOCALES-sin-auto", "auto" not in locales,
              "el código gestiona 'auto' aparte (navigator.language)")

    # ---------- 5. imágenes referenciadas existen ----------
    refs_img = set(re.findall(r'(?:src|href)="img/([^"]+)"', html))
    refs_img |= set(re.findall(r"url\('img/([^']+)'\)", html))
    faltan_img = sorted(r for r in refs_img
                        if not (ROOT / "img" / urllib.parse.unquote(r)).exists())
    check("imagenes-existen", not faltan_img and bool(refs_img),
          "" if not faltan_img else f"faltan: {faltan_img}")
    print(f"  imágenes referenciadas: {sorted(refs_img)}")

    # ---------- 6. logo + fondo ----------
    check("logo-es-imagen-pato",
          bool(re.search(r'<img[^>]+class="logo-icon"[^>]+Pato%20DJ%20logo\.png',
                         html)))
    check("fondo-tenue",
          "fondopantalla1.jpg" in html
          and bool(re.search(r"opacity:\s*0\.07", html)))

    # ---------- 6b. seguridad ----------
    csp = re.search(
        r'<meta http-equiv="Content-Security-Policy" content="([^"]+)"', html)
    check("csp-presente", bool(csp))
    if csp:
        c = csp.group(1)
        mscript = re.search(r"script-src ([^;]+)", c)
        check("csp-wasm-unsafe-eval",
              bool(mscript) and "'wasm-unsafe-eval'" in mscript.group(1)
              and "'unsafe-eval'" not in mscript.group(1).replace("'wasm-unsafe-eval'", ""),
              mscript.group(1) if mscript else "sin script-src")
    if csp:
        c = csp.group(1)
        check("csp-sin-objects",
              "object-src 'none'" in c and "frame-ancestors" not in c,
              "frame-ancestors solo vale en cabecera HTTP, no en meta")
        mconn = re.search(r"connect-src ([^;]+)", c)
        check("csp-connect-limitado",
              bool(mconn) and "api.mymemory.translated.net" in mconn.group(1)
              and "'self'" in mconn.group(1)
              and not re.search(r"(?<![\w.])\*(?![\w.])", mconn.group(1).replace("*.hf.co", "")),
              mconn.group(1) if mconn else "sin connect-src")

    mesc = re.search(r"function esc\(s\) \{(.*?)\}", js, re.S)
    cuerpo_esc = mesc.group(1) if mesc else ""
    check("esc-completo", all(e in cuerpo_esc for e in
                              ("&amp;", "&lt;", "&gt;", "&quot;", "&#39;")))

    inseguros = []
    for mm in re.finditer(r"`(.*?)`", js, re.S):
        previo = js[max(0, mm.start() - 300):mm.start()]
        if "innerHTML" not in previo:
            continue
        for expr in re.findall(r"\$\{([^}]*)\}", mm.group(1)):
            e = expr.strip()
            if "esc(" not in e and e != "i":
                inseguros.append(e)
    check("innerhtml-escapado", not inseguros,
          "" if not inseguros else f"sin escapar: {inseguros}")

    check("sin-eval", "eval(" not in js)
    check("sin-document-write", "document.write" not in js)
    check("sin-new-function", "new Function(" not in js)
    check("storage-helpers",
          all("function " + f + "(" in js for f in
              ("recall", "store", "loadHist", "saveHist", "isLang")))
    js_sin_load = re.sub(r"function loadHist\(\) \{.*?\n\}", "", js,
                         flags=re.S)
    check("sin-jsonparse-directo", "JSON.parse(localStorage" not in js_sin_load)
    check("translateText-valida-idiomas",
          bool(re.search(r"isLang\(fromCode\)", js)))
    areas = re.findall(r"<textarea[^>]*>", html)
    check("textareas-sin-spellcheck",
          len(areas) > 0 and all('spellcheck="false"' in a for a in areas))
    blank = re.findall(r'<a[^>]+target="_blank"[^>]*>', html)
    check("links-blank-con-noopener",
          all('rel="noopener"' in a or "rel='noopener'" in a for a in blank))

    # ---------- 6c. PWA instalable ----------
    import struct
    man_path = ROOT / "manifest.webmanifest"
    check("manifest-existe", man_path.exists())
    man = {}
    if man_path.exists():
        try:
            man = json.loads(man_path.read_text(encoding="utf-8"))
            check("manifest-json-valido", True)
        except Exception as e:
            check("manifest-json-valido", False, str(e))
    if man:
        check("manifest-campos",
              man.get("display") == "standalone"
              and man.get("start_url") and man.get("short_name")
              and man.get("theme_color") and man.get("background_color"),
              f"display={man.get('display')}")
        iconos = man.get("icons", [])
        sizes = {i.get("sizes") for i in iconos}
        check("manifest-iconos-192-512",
              "192x192" in sizes and "512x512" in sizes, sorted(sizes))

        def png_size(path):
            with open(path, "rb") as f:
                head = f.read(26)
            if head[:8] != b"\x89PNG\r\n\x1a\n":
                return None
            return struct.unpack(">II", head[16:24])

        for i in iconos:
            src = urllib.parse.unquote(i.get("src", "").lstrip("./"))
            p = ROOT / src
            lado = int(i.get("sizes", "0x0").split("x")[0])
            ok = p.exists() and png_size(p) == (lado, lado)
            check(f"manifest-icono-{lado}", ok, i.get("src"))

    sw_path = ROOT / "sw.js"
    check("sw-existe", sw_path.exists())
    sw = sw_path.read_text(encoding="utf-8") if sw_path.exists() else ""
    check("sw-eventos",
          all(e in sw for e in ("addEventListener('install'",
                                "addEventListener('activate'",
                                "addEventListener('fetch'",
                                "skipWaiting")))
    faltan_sw = []
    for a in re.findall(r"'(\./[^']*)'", sw.split("const ASSETS")[1] if "const ASSETS" in sw else ""):
        f = ROOT / urllib.parse.unquote(a[2:] if a.startswith("./") else a)
        if f.is_dir():
            f = f / "index.html"
        if not f.exists():
            faltan_sw.append(a)
    check("sw-assets-existen", not faltan_sw,
          "" if not faltan_sw else f"faltan: {faltan_sw}")
    check("pwa-cableado",
          'rel="manifest"' in html
          and 'name="theme-color"' in html
          and 'rel="apple-touch-icon"' in html
          and ("serviceWorker.register('sw.js')" in html
               or 'serviceWorker.register("sw.js")' in html))
    check("pwa-aviso-internet",
          "Requiere conexi" in html or "requiere internet" in html)

    # ---------- 6d. sección de descargas ----------
    check("descargas-section", 'id="descargas"' in html)
    check("download-button",
          bool(re.search(r'<a[^>]+id="dlBtn"[^>]+href="#descargas"', html)))
    import zipfile
    zips = sorted((ROOT / "descargas").glob("*.zip")) if (ROOT / "descargas").exists() else []
    check("zip-existe", len(zips) > 0, str([z.name for z in zips]))
    if zips:
        z = zipfile.ZipFile(zips[0])
        nombres = z.namelist()
        check("zip-contenido",
              {"index.html", "manifest.webmanifest", "sw.js"} <= set(nombres)
              and any(n.startswith("img/") for n in nombres)
              and any(n.startswith("models/") and n.endswith(".gz") for n in nombres)
              and "models/registry.json" in nombres
              and not any("/." in n or n.startswith(".") for n in nombres),
              f"{len(nombres)} archivos")
        msize = re.search(r"([\d,]+)\s*MB", html)
        real_mb = zips[0].stat().st_size / (1024 * 1024)
        check("zip-size-visible",
              bool(msize) and abs(float(msize.group(1).replace(",", ".")) - real_mb) / real_mb < 0.2,
              f"real: {real_mb:.1f} MB")

    # ---------- 6e. ejecutable Electron ----------
    epkg_path = ROOT / "electron" / "package.json"
    check("electron-package", epkg_path.exists())
    emain_path = ROOT / "electron" / "main.js"
    check("electron-main", emain_path.exists())
    if epkg_path.exists():
        try:
            epkg = json.loads(epkg_path.read_text(encoding="utf-8"))
            b = epkg.get("build", {})
            check("electron-config",
                  epkg.get("main") == "main.js"
                  and "dist:mac" in epkg.get("scripts", {})
                  and "dist:win" in epkg.get("scripts", {})
                  and "mac" in b and "win" in b
                  and b.get("appId") == "com.freeducktranslator.app"
                  and b.get("productName") == "Freeduck-Translator")
            check("electron-files-filtrados",
                  any("img/**/*" in str(f) for f in b.get("files", []))
                  and any("vendor/**/*" in str(f) for f in b.get("files", []))
                  and any("models/**/*" in str(f) for f in b.get("files", []))
                  and not any("node_modules" in str(f) or "dist" in str(f)
                              for f in b.get("files", [])))
        except Exception as e:
            check("electron-config", False, str(e))
            check("electron-files-filtrados", False, str(e))
    if emain_path.exists():
        emain = emain_path.read_text(encoding="utf-8")
        check("electron-carga-index",
              "loadFile" in emain and "index.html" in emain)
        check("electron-enlaces-externos",
              "setWindowOpenHandler" in emain and "openExternal" in emain)
        check("electron-sin-node-integration",
              "nodeIntegration: false" in emain and "contextIsolation: true" in emain)
    for icono in ("icon.png", "icon.icns", "icon.ico"):
        check(f"electron-{icono}",
              (ROOT / "electron" / icono).exists())

    # ---------- 6f. motor offline ----------
    for vend in ("vendor/bergamot/translator.js",
                 "vendor/bergamot/worker/translator-worker.js",
                 "vendor/bergamot/worker/bergamot-translator-worker.js",
                 "vendor/bergamot/worker/bergamot-translator-worker.wasm",
                 "vendor/bergamot/NOTICE.txt",
                 "offline.js"):
        check("offline-%s" % vend.split("/")[-1], (ROOT / vend).exists())
    off = (ROOT / "offline.js").read_text(encoding="utf-8") if (ROOT / "offline.js").exists() else ""
    check("offline-usa-bergamot-vendor",
          "vendor/bergamot/translator.js" in off
          and "LatencyOptimisedTranslator" in off)
    check("offline-cache-modelos",
          "freeduck-models-v1" in off and "caches.open" in off
          and "DecompressionStream" in off)
    check("offline-solo-es-en",
          "OFFLINE_PAIRS" in off and "es" in off and "en" in off)
    check("offline-bar",
          all(x in html for x in ("offlineBar", "offlineStatus", "offlineBtn",
                                  "refreshOfflineBar", "offlineAction"))
          and 'type="module" src="offline.js"' in html)
    check("offline-en-traductor",
          "Offline.isReady" in js and "Offline.translate" in js
          and "viaOffline" in js)
    check("offline-timeouts",
          "withTimeout" in (ROOT / "offline.js").read_text(encoding="utf-8"))
    check("csp-permite-modelos",
          "storage.googleapis.com" not in (csp.group(1) if csp else "")
          and "models/registry.json" in off,
          "modelos en misma origin: sin CORS ni red externa")
    check("sw-precachea-vendor",
          "vendor/bergamot/translator.js" in sw and "offline.js" in sw)

    # ---------- 6g. voz offline (eSpeak) ----------
    for vend in ("vendor/mespeak/mespeak.js",
                 "vendor/mespeak/mespeak-core.js",
                 "vendor/mespeak/voices/es.json",
                 "vendor/mespeak/voices/en/en-us.json",
                 "vendor/mespeak/NOTICE.txt",
                 "vendor/sherpa/sherpa-worker.js",
                 "vendor/sherpa/sherpa-onnx-tts.js",
                 "vendor/sherpa/sherpa-onnx-wasm-main-tts.js",
                 "vendor/sherpa/sherpa-onnx-wasm-main-tts.wasm",
                 "vendor/sherpa/piper-setup.js",
                 "vendor/sherpa/piper-phonemize/piper-phonemize.js",
                 "vendor/sherpa/piper-phonemize/piper-phonemize-wasm-main.js",
                 "vendor/sherpa/piper-phonemize/piper-phonemize-wasm-main.wasm",
                 "vendor/sherpa/piper-phonemize/piper-phonemize-wasm-main.data",
                 "vendor/sherpa/NOTICE.txt",
                 "voice-sherpa.js"):
        check("voz-%s" % vend.split("/")[-1], (ROOT / vend).exists())
    check("voz-sin-kokoro",
          not (ROOT / "vendor/kokoro").exists()
          and not (ROOT / "voice-kokoro.js").exists()
          and "kokoro" not in sw.lower())
    check("voz-script-tag",
          'src="vendor/mespeak/mespeak.js"' in html)
    check("voz-offline-first",
          "OFFLINE_VOICE" in js and "meSpeak.isVoiceLoaded" in js
          and "meSpeak.speak" in js and "speechSynthesis" in js)
    check("voz-carga-es-en",
          "loadVoice('es'" in js and "loadVoice('en/en-us'" in js)
    check("sw-precachea-voces",
          "vendor/mespeak/mespeak.js" in sw
          and "vendor/mespeak/voices/es.json" in sw
          and "vendor/mespeak/voices/en/en-us.json" in sw)

    # ---------- 6i. selector y testigo de voz ----------
    _vp = re.search(r'id="voicePref".*?</select>', html, re.S)
    _vphtml = _vp.group(0) if _vp else ""
    check("voz-selector", 'id="voicePref"' in html
          and all(v in _vphtml for v in ('value="natural"', 'value="robot"', 'value="system"'))
          and 'value="auto"' not in _vphtml and 'value="cloud"' not in html and 'id="hfToken"' not in html
          and 'value="natural" selected' in _vphtml)
    check("voz-pref-natural",
          "return v === 'natural' || v === 'robot' || v === 'system' ? v : 'natural'" in js)
    check("voz-testigo", 'id="voiceEngine"' in html
          and 'id="voiceTestBtn"' in html)
    check("voz-funciones",
          all(("function " + f + "(") in js for f in
              ("voicePref", "voicePrefChange", "showVoiceEngine", "voiceTest")))
    check("voz-devuelve-motor",
          "resolve('offline')" not in js and "return 'natural'" in js
          and "return 'robot'" in js and "return 'system'" in js)
    check("voz-natural-estricta",
          "tryRobot" not in js
          and "if (pref === 'natural') return null" in js)
    check("voz-diagnostico",
          all(x in js for x in ("paintVoiceLoad", "__voiceLoad", "loadVoice('es',"))
          and 'id="voiceLoad"' in html
          and "pointerdown" in js and "volume: 0" in js)
    check("micro-test",
          'onclick="micTest()"' in html and "function micTest(" in js
          and "getUserMedia" in js and "isSecureContext" in js)
    check("aviso-file",
          "location.protocol === 'file:'" in js
          and 'content://' in js)
    check("leeme-primero",
          (ROOT / "LEEME_ABRIR_PRIMERO.txt").exists()
          and "pantalla de inicio" in (ROOT / "LEEME_ABRIR_PRIMERO.txt").read_text(encoding="utf-8"))
    check("voz-natural-cableada",
          'type="module" src="voice-sherpa.js"' in html
          and "window.SherpaVoice" in (ROOT / "voice-sherpa.js").read_text(encoding="utf-8")
          and "generateWithConfig" in (ROOT / "voice-sherpa.js").read_text(encoding="utf-8"))
    check("voz-sherpa-voces",
          all((ROOT / f).exists() for f in
              ("voices/es/es_ES-sharvard-medium.onnx", "voices/es/tokens.txt",
               "voices/en/en_US-amy-low.onnx", "voices/en/tokens.txt")))
    check("voz-kokoro-ui",
          all(x in html for x in ("kokoroStatus", "kokoroBtn", "refreshKokoro", "kokoroAction"))
          and 'value="natural"' in html)
    check("voz-sherpa-etapas",
          "Generando prueba" in js or "warmup" in js)
    check("servidor-local", (ROOT / "servir.py").exists()
          and "Cross-Origin-Embedder-Policy" in (ROOT / "servir.py").read_text(encoding="utf-8"))

    # ---------- 6k. Docker ----------
    check("docker-archivos",
          all((ROOT / f).exists() for f in
              ("Dockerfile", "nginx.conf", "docker-compose.yml", ".dockerignore")))
    dock = (ROOT / "Dockerfile").read_text(encoding="utf-8") if (ROOT / "Dockerfile").exists() else ""
    check("docker-base-nginx",
          "FROM nginx:alpine" in dock)
    copiados_ok = True
    for line in dock.splitlines():
        if not line.startswith("COPY "):
            continue
        src = line.split()[1]
        if src.startswith("/etc/"):
            continue
        p = ROOT / src.strip()
        if src.strip().endswith("/"):
            copiados_ok = copiados_ok and p.is_dir()
        else:
            copiados_ok = copiados_ok and p.exists()
    check("docker-copia-existente", copiados_ok)
    check("docker-sin-lastre",
          "electron/" in (ROOT / ".dockerignore").read_text(encoding="utf-8")
          and "tests/" in (ROOT / ".dockerignore").read_text(encoding="utf-8"))
    ng = (ROOT / "nginx.conf").read_text(encoding="utf-8") if (ROOT / "nginx.conf").exists() else ""
    check("nginx-cabeceras",
          "Cross-Origin-Opener-Policy" in ng and "Cross-Origin-Embedder-Policy" in ng)
    check("nginx-mimes", "application/wasm" in ng and "webmanifest" in ng)
    comp = (ROOT / "docker-compose.yml").read_text(encoding="utf-8") if (ROOT / "docker-compose.yml").exists() else ""
    check("compose-puerto", "8901:80" in comp and "build:" in comp)

    # ---------- Marca ----------
    check("marca-titulo",
          "<title>Freeduck-Translator" in html
          and '"name": "Freeduck-Translator"' in (ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
    check("marca-sin-freeduck-viejo",
          "FreeDuck" not in html and "FreeDuck" not in (ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
    check("sw-precachea-sherpa",
          "vendor/sherpa/sherpa-worker.js" in sw and "voice-sherpa.js" in sw
          and "kokoro" not in sw)
    import urllib.parse as _up
    faltan_sw = []
    for m in re.finditer(r"'(\./[^']+)'", sw.split("const ASSETS")[1].split("];")[0] if "const ASSETS" in sw else ""):
        p = ROOT / _up.unquote(m.group(1)[2:])
        if p.is_dir():
            continue
        if not p.exists():
            faltan_sw.append(m.group(1))
    check("sw-precache-todo-existe", not faltan_sw,
          "" if not faltan_sw else f"faltan: {faltan_sw}")
    check("sw-revalida-codigo",
          "cache: 'reload'" in sw and "caches.match(event.request)" in sw)
    check("sw-solo-cachea-ok",
          sw.count("if (!res.ok) throw") >= 2)
    check("csp-sin-hf",
          "huggingface.co" not in (csp.group(1) if csp else "")
          and "hf.co" not in (csp.group(1) if csp else ""))

    # ---------- 6j. regresión: estado antes de init (TDZ) ----------
    pos_init = js.find("(function init()")
    tdz_mal = [v for v in ("offlineMode", "offlineTries", "kokoroMode",
                           "kokoroTries", "hist", "lastText", "activeRec")
               if js.find("let " + v) == -1 or js.find("let " + v) > pos_init]
    check("estado-antes-de-init", not tdz_mal and pos_init != -1,
          "" if not tdz_mal else f"declarados tarde: {tdz_mal}")

    # ---------- 6h. modelos offline empaquetados ----------
    reg_path = ROOT / "models" / "registry.json"
    check("registro-local-existe", reg_path.exists())
    if reg_path.exists():
        try:
            reg = json.loads(reg_path.read_text(encoding="utf-8"))
            pares = set(reg.get("models", {}))
            check("registro-pares-es-en", pares == {"es-en", "en-es"}, sorted(pares))
            faltan_mod = []
            for arr in reg.get("models", {}).values():
                for f in arr[0].get("files", {}).values():
                    p = ROOT / "models" / f.get("path", "")
                    if not p.exists() or p.stat().st_size < 1000:
                        faltan_mod.append(f.get("path"))
            check("registro-archivos-existen", not faltan_mod,
                  "" if not faltan_mod else f"faltan: {faltan_mod}")
        except Exception as e:
            check("registro-pares-es-en", False, str(e))
            check("registro-archivos-existen", False, str(e))

    # ---------- 7. traducción real (requiere internet) ----------
    casos = [
        ("en", "es", "Hello", "hola"),
        ("autodetect", "es", "Hello how are you", "cómo estás"),
        ("es", "en", "¿Dónde está la estación de tren?", "station"),
        ("es", "fi", "¿Dónde está la estación de tren?", None),
        ("es", "ko", "¿Dónde está la estación de tren?", None),
        ("es", "he", "¿Dónde está la estación de tren?", None),
        ("es", "sw", "¿Dónde está la estación de tren?", None),
        ("es", "uk", "¿Dónde está la estación de tren?", None),
    ]
    for src, tgt, texto, pista in casos:
        nombre = f"api-{src}-{tgt}"
        try:
            qs = urllib.parse.urlencode({"q": texto, "langpair": f"{src}|{tgt}"})
            req = urllib.request.Request(
                f"https://api.mymemory.translated.net/get?{qs}",
                headers={"User-Agent": "Freeduck-Translator-tests/1.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                d = json.load(r)
            ok_status = d.get("responseStatus") == 200
            trad = (d.get("responseData") or {}).get("translatedText", "")
            ok_texto = bool(trad and not trad.upper().startswith("PLEASE SELECT")
                            and "INVALID" not in trad.upper())
            ok_pista = pista is None or pista.lower() in trad.lower()
            ok = ok_status and ok_texto and ok_pista
            check(nombre, ok, f"→ {trad[:60]}")
        except Exception as e:  # sin red u otro fallo: se omite, no se falla
            results.append((nombre, "SKIP", f"sin conexión o error: {e}"))

    # ---------- resumen ----------
    npass = sum(1 for _, e, _ in results if e == "PASS")
    nfail = sum(1 for _, e, _ in results if e == "FAIL")
    nskip = sum(1 for _, e, _ in results if e == "SKIP")
    print("\n==== resultados ====")
    for nombre, estado, detalle in results:
        extra = f"  ({detalle})" if detalle and estado != "PASS" else ""
        print(f"[{estado}] {nombre}{extra}")
    print(f"\n{npass} PASS · {nskip} SKIP · {nfail} FAIL")
    return 1 if nfail else 0


if __name__ == "__main__":
    sys.exit(main())
