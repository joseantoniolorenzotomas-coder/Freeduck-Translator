#!/usr/bin/env python3
"""Servidor local para probar Freeduck-Translator (solo biblioteca estándar).

Uso:  python3 servir.py [puerto]
Sirve la carpeta del proyecto en http://localhost:PUERTO con las cabeceras
COOP/COEP que exige el WASM con hilos de la voz natural (Kokoro).
Sin estas cabeceras, la voz natural no puede arrancar.
"""
import sys
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "credentialless")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8901
    srv = ThreadingHTTPServer(("127.0.0.1", puerto), Handler)
    print(f"Freeduck-Translator en http://localhost:{puerto}  (Ctrl+C para parar)")
    srv.serve_forever()
