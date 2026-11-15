# Reglas de Desarrollo: AVIAMAZ (Mapa Sede Amazonia)

**Stack:** Vanilla JS/HTML/CSS, Leaflet (`L.CRS.Simple`), Three.js, Capacitor. Servidor FastAPI solo para desarrollo local.

## ⚠️ REGLAS ESTRICTAS DE SALIDA (AHORRO DE TOKENS)
1. **Genera el código tú mismo:** Escribe y modifica el código por tu cuenta para resolver el problema, no des solo sugerencias o seudocódigo.
2. **Solo el fragmento modificado:** Devuelve ÚNICAMENTE la función, clase o bloque de código específico que hayas corregido. 
3. **Cero reescrituras:** Prohibido imprimir el archivo completo bajo cualquier circunstancia.
4. **Cero relleno:** No agregues explicaciones largas, introducciones ni conclusiones. Ve directo al código.
5. **No edites la bitácora:** El usuario actualizará `BITACORA.md` manualmente. No redactes registros de cambios.
6. Responde siempre en español.

## Arquitectura y Restricciones
- **Cliente estático:** La APK final usa `www/` estático. Prohibido sugerir código Jinja en `index.html` o depender del backend.
- **Rutas Case-Sensitive:** Android distingue mayúsculas y minúsculas. Respeta el formato exacto en rutas absolutas (`/static/`, `/data/`) y extensiones (`.glb`, `.png`).
- **Estado Global:** La lógica se comunica por variables globales (`window.*`, `plantsHandler`). 
- **Llaves primarias:** `codigoQR` enlaza localStorage (jardín, favoritos) y IndexedDB (fotos). `nombre` en `edifcios.json` enlaza los polígonos y los nodos del mundo 3D.
- **Caché manual:** Si sugieres cambiar un JS, CSS o regenerar el mundo 3D, recuérdale al usuario subir el parámetro `?v=` correspondiente.