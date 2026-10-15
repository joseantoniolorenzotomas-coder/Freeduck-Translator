# Freeduck-Translator — imagen de distribución local
# Sirve la app con las cabeceras COOP/COEP que exige el WASM con hilos
# de la voz natural (Kokoro). Sin ellas, esa voz no puede arrancar.
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY index.html manifest.webmanifest sw.js offline.js voice-kokoro.js /usr/share/nginx/html/
COPY models/ /usr/share/nginx/html/models/
COPY vendor/ /usr/share/nginx/html/vendor/
COPY img/ /usr/share/nginx/html/img/

EXPOSE 80
