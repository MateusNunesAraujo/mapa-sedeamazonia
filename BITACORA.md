# Bitácora: Mapa Sede Amazonia (Offline APK)

**Stack:** FastAPI (desarrollo), HTML/CSS/JS (vanilla), Leaflet (mapa `L.CRS.Simple`), Three.js (Mi Jardín/Recorrido), Capacitor (Android).

## Archivos Críticos
- `data/edifcios.json`: 58 registros.
- `data/plantas.json`: 56 registros (solo 4 tienen modelo `.glb` asignado).
- `data/tienda-jardin.json`: Catálogo de accesorios para el jardín.
- Persistencia (localStorage): `mapaSedAmazonia_unlockedPlants`, `jardinEstado` (monedas, regadera, riegos).

## Problemas Urgentes
- Las 56 plantas tienen `bloqueado: false` en el JSON, anulando la mecánica del QR.
- Bug en `recorrido.js`: el ciclo de dibujo 3D sigue activo oculto al salir (91 FPS).

## Último Cambio (2026-11-12)
- Primeros accesorios reales en la tienda (`tienda-jardin.json`): Sombrero, Collar, Pinturas de achiote y huito.
- Campos nuevos: `zona`, `modelo`/`pintura`.
- Pendiente: Activar la lógica de compra y colocación en los árboles (`index.css` `v=30`).