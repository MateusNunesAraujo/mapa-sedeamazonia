# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

AVIAMAZ es el aula viva interactiva del campus de la sede Amazonía de la UNAL: mapa 2D de edificios y árboles, apartado 3D de interiores y árboles que el usuario desbloquea y guarda en su álbum. En el código la app aún se llama "Mapa Sede Amazonia". El estado detallado está en `BITACORA.md`.

## Stack y carpetas

HTML/CSS/JS sin framework ni empaquetador, Leaflet 1.9.4 (`L.CRS.Simple`), Geoman, qr-scanner, SweetAlert2, model-viewer, three.js r160, FastAPI + uvicorn (solo desarrollo) y Capacitor 5 (Android).

- `data/`: JSON de edificios (`edifcios.json`, así escrito), plantas y sendero.
- `templates/index.html`: página única. Se copia tal cual a la APK, así que no puede usar sintaxis Jinja.
- `static/`: JS, CSS, modelos `.glb` y copias manuales de las librerías (la app no usa las de `node_modules`). Las fotos están en `fotos-edificios/` (campo `foto` de `edifcios.json`) y `fotos-arboles/` (campo `foto_defecto` de `plantas.json`); los JSON guardan solo el nombre del archivo.
- `scripts/modelos/`: generadores Python (solo biblioteca estándar) de los `.glb`.
- `www/` y `android/`: generadas y fuera de Git. Nunca editar `www/` a mano.

## Comandos

No hay tests ni linter configurados.

```powershell
npm install; python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt
npm run dev                # activar .venv antes; http://localhost:8000
npx cap add android        # solo si no existe android/
npm run sync-app           # regenera www/ y ejecuta cap sync (`npm run sync` no actualiza www/)
npm run build              # APK; que genere app-debug.apk está por verificar
npx cap open android       # abrir en Android Studio
python scripts/modelos/gen_recorrido.py static/modelos/recorrido.glb   # regenerar el mundo 3D
```

## Arquitectura

- **Sin backend real:** `main.py` solo sirve archivos en desarrollo; la APK usa `www/` estático. Toda la lógica va en el cliente, con rutas absolutas (`/static/...`, `/data/...`).
- **Scripts globales:** el orden de `<script>` en `index.html` importa. Se comunican con globales (`map`, `unlocker`, `plantsHandler`, `window.*`) y eventos de `document` (`plantUnlocked`, `treePhotoUpdated`, `favoritesUpdated`).
- **Identificadores:** `codigoQR` enlaza `plantas.json` con los desbloqueos y favoritos (localStorage) y las fotos (IndexedDB). El `nombre` de un edificio es la clave de su polígono y de los nodos `inicio_<nombre>` y `centro_<nombre>` de `recorrido.glb`.
- **Coordenadas:** `[y, x]` sobre la imagen `Mapa U.png`, de 0 a 1000; no son geográficas.
- **Caché manual:** al cambiar un JS o CSS, subir su `?v=` en `index.html`. Al regenerar el mundo 3D, subir `MUNDO` en `recorrido.js`.
- **Android distingue mayúsculas** en las rutas de fotos y modelos, aunque Windows no.

## Reglas de trabajo

- Responde y escribe comentarios en español.
- Después de cada cambio significativo (nueva funcionalidad, cambio en la estructura de datos, corrección importante), agrega una entrada en "Registro de cambios" de `BITACORA.md` con fecha, qué se cambió y por qué. Si afecta el estado descrito en la bitácora, actualízalo también.
- Antes de renombrar archivos de datos o cambiar claves que identifiquen registros (`codigoQR`, ids), avisa y explica el impacto: pueden romper favoritos, árboles desbloqueados o fotos ya guardadas.
- No inventes datos botánicos ni información de edificios; si falta algo, márcalo como pendiente.
- Haz cambios pequeños y explica qué modificaste al terminar.
