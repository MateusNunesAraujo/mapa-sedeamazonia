# Bitácora del proyecto: Mapa Sede Amazonia

**Última revisión:** 2026-11-08, sobre `main` en el commit `d0e8570` (igual a `origin/main`), más las correcciones del mismo día anotadas en la sección 7.

## Cómo se verificó esta información

- Se leyó todo el código propio y se validaron los tres JSON con scripts.
- Se ejecutó la app con `uvicorn` y se probó en Chrome headless, llamando a las funciones reales de la página.
- **No se probó** en un celular, en la APK ni con una cámara real. Lo que depende de eso aparece como "por verificar".

| Estado | Significado |
|---|---|
| ✅ Funciona | Probado en el navegador sin errores |
| ⚠️ A medias | Existe, pero está incompleto o desactivado |
| ❌ Con error | Falla; el error se reprodujo |
| ❓ Por verificar | No se pudo comprobar con los medios disponibles |

## Problemas urgentes

| Problema | Efecto | Ubicación |
|---|---|---|
| Las 56 plantas tienen `bloqueado: false` | El desbloqueo por QR no tiene efecto: el álbum siempre marca 56 de 56 (100 %). Antes de cambiarlo, confirmar que existen los códigos QR físicos | `data/plantas.json` |

**Corregidos el 2026-11-08** (detalle en la sección 7): tarjeta de edificios (`esPlanta` sin definir), botón "Ver en 3D" y worker del lector QR.

Esas correcciones ya están en `www/` y en el proyecto Android (`npm run sync-app` del 2026-11-10).

---

## 1. Resumen

Es un mapa interactivo del campus de la Universidad Nacional de Colombia, Sede Amazonia, pensado para funcionar sin internet y empaquetarse como APK de Android. Permite:

- Consultar 58 edificios (41 terminados y 17 planeados) sobre un plano del campus.
- Explorar un catálogo de 56 árboles con mecánica de colección: QR, herbario, favoritos y fotos propias.
- Ver el sendero ecológico con sus 14 estaciones.
- Recorrer los 41 lugares existentes modelados en 3D, a pie o en vista aérea (24 de ellos solo por fuera).

| Capa | Tecnología | Versión | Nota |
|---|---|---|---|
| Interfaz | HTML, CSS y JS sin framework ni empaquetador | — | Scripts clásicos y algunos módulos ES |
| Mapa | Leaflet con `L.CRS.Simple` | 1.9.4 | Coordenadas sobre una imagen de 1000×1000, no geográficas |
| Dibujo de polígonos | Leaflet-Geoman Free | 2.20.0 en `node_modules`; la copia de `static/` por verificar | Herramienta de desarrollo |
| Alertas | SweetAlert2 | 11.26.25 | Local |
| Lectura QR | qr-scanner | 1.4.2 | Copia manual en `static/js/`, idéntica a la de `node_modules` |
| Visor 3D y AR | model-viewer | Por verificar | Se carga al abrir el visor |
| Recorrido 3D | three.js | r160 | Se carga al abrir el recorrido |
| Servidor de desarrollo | Python, FastAPI, Jinja2, uvicorn | FastAPI 0.162.0; `.venv` con Python 3.13.14 | No se usa en la APK |
| App móvil | Capacitor | 5.7.8 | Solo Android; no existe `ios/` |
| Modelos 3D | Scripts Python propios | — | Solo biblioteca estándar; generan `.glb` |

## 2. Estructura de carpetas y archivos principales

```
mapa-sedeamazonia/
├── main.py                  Servidor FastAPI: sirve index.html, /static y /data
├── build.js                 Automatiza Capacitor; `sync-app` copia todo a www/ y ejecuta cap sync
├── package.json             Scripts npm y dependencias de Capacitor y librerías
├── package-lock.json        Versiones exactas de npm
├── requirements.txt         Dependencias de Python
├── capacitor.config.json    Identificador de la app, webDir `www` y opciones de Android/iOS
├── .env.example             Variables de ejemplo; ningún código las lee
├── .gitattributes           Normalización de finales de línea
├── .gitignore               Exclusiones de Git
├── README.md                Introducción y flujo de desarrollo
├── SETUP.md                 Instalación en otro equipo y compilación de la APK
├── BITACORA.md              Este archivo
├── assets/                  Íconos fuente para @capacitor/assets
├── data/
│   ├── edifcios.json        Edificios: polígono, textos, foto y modelo 3D
│   ├── plantas.json         Árboles: taxonomía, ubicación, ficha, usos y QR
│   └── sendero.json         Trazado del sendero ecológico y sus estaciones
├── templates/
│   └── index.html           Página única con todos los modales y paneles
├── static/
│   ├── Mapa U.png           Plano del campus usado como fondo (7,2 MB)
│   ├── css/index.css        Todos los estilos (3009 líneas)
│   ├── js/
│   │   ├── index.js             Mapa, capas, buscador, tarjeta de edificio, filtros y menú lateral
│   │   ├── plants-handler.js    Carga de plantas, marcadores y popups
│   │   ├── unlock-system.js     Registro de plantas desbloqueadas
│   │   ├── qr-handler.js        Modal y lectura de códigos QR
│   │   ├── album-handler.js     Herbario: cuadrícula, filtros, ficha y foto ampliada
│   │   ├── favorites.js         Árboles favoritos
│   │   ├── photo-storage.js     Captura, compresión y guardado de fotos
│   │   ├── ar-prueba.js         Visor 3D y AR; su nombre ya no refleja su función
│   │   ├── recorrido.js         Recorrido en primera persona y vista aérea
│   │   ├── model-viewer.min.js  Librería del visor 3D
│   │   ├── qr-scanner.min.js    Librería QR
│   │   ├── qr-scanner-worker.min.js  Motor de decodificación que usa la librería QR
│   │   ├── sweetalert2.min.js   Librería de alertas
│   │   └── three/               three.js y sus complementos
│   ├── leaflet/             Librería Leaflet local
│   ├── geoman/              Librería Geoman local; `dist/` está ignorada por Git
│   ├── fotos-edificios/     30 fotos de edificios (71 MB) y referencias-3d/ con fotos interiores del auditorio y de la biblioteca (2,7 MB)
│   ├── fotos-arboles/       Fotos por defecto de los árboles; hoy solo pomarosa.jpeg
│   ├── iconos/              Íconos de la interfaz y 14 SVG de estaciones
│   ├── img/                 Logo de la pantalla de carga
│   └── modelos/             38 modelos .glb (17 MB en total)
├── scripts/modelos/
│   ├── comun.py             Clase Escena, geometría, escritura de GLB y posición de edificios
│   ├── muebles.py           Muebles reutilizables
│   ├── gen_recorrido.py     Une todos los edificios en recorrido.glb
│   ├── gen_complementarios.py  Las 24 estructuras más sencillas (19 .glb)
│   └── gen_*.py             Un generador por modelo (17 archivos más)
├── www/                     Generada por `npm run sync-app`; no está en Git
├── android/                 Proyecto Android generado; no está en Git
├── node_modules/            Dependencias npm; no está en Git
└── .venv/                   Entorno de Python; no está en Git
```

## 3. Funcionalidades

| Funcionalidad | Estado | Detalle |
|---|---|---|
| Mapa base, zoom y pantalla de carga | ✅ Funciona | Carga 58 polígonos sin excepciones |
| Tarjeta de detalle de edificio | ✅ Funciona | Abre con y sin modelo 3D; los botones 3D solo aparecen si hay modelo |
| Buscador de lugares | ✅ Funciona | Filtra y abre la tarjeta del resultado |
| Enfocar un lugar en el mapa | ✅ Funciona | Probado con clic e `irALugar` |
| Panel deslizante de filtros | ✅ Funciona | |
| Menú lateral (☰) | ✅ Funciona | Agrupa herbario, mapa 3D y notificaciones. Se despliega desde el borde derecho; se cierra con ✕, el fondo, Escape o al elegir una opción. Un punto rojo en ☰ avisa si hay novedades dentro. En la barra superior quedan el buscador y el QR; ☰ está en la esquina superior derecha, tanto en celular como en escritorio |
| Mi jardín, Bibliografía, Configuraciones y Acerca del aplicativo | ⚠️ A medias | Solo existe la opción en el menú; al tocarla aparece un aviso de "Próximamente" con lo que tendrá. Pendiente: modelos 3D caricaturizados de cada árbol (jardín); referencias y documentos Word/PDF solo de los árboles (bibliografía); definir qué preferencias incluir (configuraciones); propósito y agradecimientos (acerca de) |
| Filtro de edificios futuros | ✅ Funciona | Muestra 17 polígonos |
| Filtro de sendero ecológico | ✅ Funciona | 2 líneas superpuestas (borde y relleno) y 14 estaciones |
| Modo plantas | ✅ Funciona | 56 marcadores y su popup |
| Bloqueo y desbloqueo de plantas | ⚠️ A medias | La lógica existe, pero ningún dato la activa (ver problemas urgentes) |
| Lectura de QR | ❓ Por verificar | El motor de decodificación ya carga en Chrome de escritorio. El escaneo con cámara real y en la APK no se probó |
| Ir a la planta tras escanear | ✅ Funciona | Probado llamando directamente a `enfocarPlantaQR` |
| Validación de QR | ⚠️ A medias | Rechaza textos sin el prefijo `PLANTA_`, pero acepta y guarda códigos inexistentes como `PLANTA_NO_EXISTE` |
| Herbario: lista, progreso y filtros | ✅ Funciona | 56 tarjetas |
| Ficha ampliada desde el mapa | ✅ Funciona | |
| Favoritos | ✅ Funciona | Persisten y funcionan con el filtro del álbum |
| Guardado de foto propia | ✅ Funciona | Probado guardando en IndexedDB |
| Captura con cámara | ❓ Por verificar | Requiere dispositivo |
| Visor 3D | ✅ Funciona | "Ver en 3D" abre y carga el modelo; probado con Auditorio |
| Realidad aumentada | ❓ Por verificar | Requiere dispositivo. El propio código advierte de dudas con modelos locales |
| Recorrido a pie | ✅ Funciona | Carga en modo caminar y el botón "Caminar" aparece en la tarjeta. Controles táctiles por verificar |
| Vista aérea (botón 🏙️) | ✅ Funciona | Carga con 41 etiquetas. Controles táctiles por verificar |
| Novedades | ⚠️ A medias | Cuatro mensajes de ejemplo fijos en el HTML; el indicador rojo nunca se activa |
| Historias de los lugares | ⚠️ A medias | HTML comentado y ningún dato `historia` en el JSON; la lógica sigue en `index.js` |
| Barra de dibujo Geoman | ⚠️ A medias | Marcada "solo desarrollo", pero también se activa para el usuario final |
| APK de Android | ❓ Por verificar | `www/` y los assets de Android están sincronizados con el código al 2026-11-10. No se compiló ni instaló |

## 4. Datos

### `data/edifcios.json`

**Registros:** 58 (lista). **Estado:** 41 `terminado` y 17 `planeado`.

| Campo | Presencia | Observación |
|---|---|---|
| `nombre` | 58 | Sin duplicados; también es la clave interna del polígono |
| `puntos` | 58 | Todos dentro de 0–1000 y con al menos 3 vértices |
| `estado` | 58 | Solo los dos valores indicados |
| `descripcion` | 58 | **24 vacíos** |
| `horario` | 58 | **48 vacíos** |
| `reglas` | 58 | **52 vacíos** |
| `novedades` | 58 | **57 vacíos** |
| `foto` | 33 | Faltan 25 edificios |
| `modelo3d` | 41 | Todos los lugares `terminado`. Todos los archivos existen y tienen punto de inicio en `recorrido.glb`. Varios lugares de una misma hilera comparten archivo (`fila_admision.glb`, `fila_oficinas.glb`) |

**Inconsistencias:**

- Tres fotos apuntan a archivos inexistentes: `Cancha` → `cancha.png`, `Parqueadero` → `parqueadero.png` y `Sala de sistemas 2` → `sistemas2.png`.
- El archivo se llama `edifcios.json` (falta una "i"). El error está también en el código y la documentación, así que renombrarlo exige actualizar todas las referencias.
- Errores en nombres: `Cnchas`; sin tilde `Laboratorio de biologia`, `Aula de fisica` y `Laboratorio de quimica`.
- Formato desigual: `Salones 3A,B y C` frente a `Salones 4A, B y C`.
- Por verificar: si `UGÍ - Unidad de Gestión e Integral` está bien escrito, y si los polígonos coinciden con la realidad.

### `data/plantas.json`

**Registros:** 56 (lista). **Familias:** 27. **UTF-8 válido:** sí.

| Campo | Presencia | Observación |
|---|---|---|
| `nombre`, `familia` | 56 | Familias siempre en mayúsculas |
| `nombre_cientifico`, `especie` | 56 | Idénticos en los 56 registros: uno sobra |
| `placa` | 56 | Texto; sin duplicados |
| `zona` | 56 | Texto. Zona 1: 8; zona 2: 6; zona 3: 7; zona 6: 35. No hay zonas 4 ni 5 (por verificar si es correcto) |
| `punto` | 56 | Dentro de 0–1000; sin repetidos. Exactitud en terreno por verificar |
| `codigoQR` | 56 | Sin duplicados; todos con prefijo `PLANTA_` |
| `bloqueado` | 56 | **Todos `false`** |
| `descripcion` | 56 | 4 vacíos |
| `usos` | 56 | Siempre objeto; 4 vacíos |
| `nombres_comunes` | 52 | Faltan 4 |
| `ficha` | 52 | Subcampos: `nombres_comunes`, `descripcion_botanica`, `distribucion_ecologia`, `usos`; ninguno vacío |
| `nota_usos` | 4 | LACRE, LLORÓN, CAFETILLO, PALO DE GALLINAZO |
| `foto_defecto` | 1 | Solo POMARROSO: **55 árboles sin foto** |

**Inconsistencias:**

- **Registros incompletos:** UCUUBA, ELAEIS GUINEENSIS, PARKIA CF. VAUPESIANA y LIVISTONA SP. 1 no tienen descripción, usos, nombres comunes ni ficha. Las tres últimas usan el nombre científico como `nombre`.
- **Clave de uso mal formada:** en CHICLE (placa 382) el texto quedó dentro de la clave, `"Alimento humano El fruto dulce y ácido..."`, con valor vacío. Ese uso no aparece en la ficha y añade una opción larguísima al filtro de usos.
- **Categorías que deberían unificarse:** `Tóxico` (1) y `Tóxicos` (2). Por verificar si `Alimenticio` (1) equivale a `Alimento humano` (21).
- **Posible duplicado:** PALO DE ARCO aparece dos veces con la misma especie (placas 137 y 1004). Uno de sus códigos es `PLANTA_137_GUAYACAN`. Por verificar si son dos árboles distintos.
- **Nombres repetidos con especie distinta:** LAUREL (`Nectandra membranacea` y `N. acutifolia`) y ALMENDRO (`Andira inermis` y `Terminalia catappa`). No es un error, pero se ven iguales en la lista.
- Por verificar: si existen códigos QR físicos para los 56 árboles.

### `data/sendero.json`

**Estructura:** objeto con `nombre`, `tramos` y `estaciones`.

| Elemento | Cantidad | Observación |
|---|---|---|
| `tramos` | 5 líneas, 72 puntos (45, 5, 12, 4 y 6) | Todos dentro de 0–1000 |
| `estaciones` | 14, numeradas del 1 al 14 | Campos: `numero`, `nombre`, `icono`, `punto` |

**Consistencia:**

- Los 14 íconos existen y no sobra ninguno.
- Cada estación está a 0,1 unidades o menos del trazado.
- Todos los extremos de los tramos tocan otro tramo; los más separados están a 1 unidad.
- El tramo 3 empieza y termina en el mismo punto (bucle). Por verificar si es intencional.
- El campo `nombre` no se usa en el código.
- Las estaciones solo tienen nombre, sin texto descriptivo.

### Modelos y fotos

- `hoja-trifoliada.glb` solo se usa en el menú de prueba, hoy inaccesible.
- Todas las fotos de `static/fotos-edificios/` y `static/fotos-arboles/` están en uso, salvo las de `referencias-3d/` (interior del auditorio y 16 de la biblioteca), que son referencia de los generadores 3D y no las muestra la app.

## 5. Almacenamiento del usuario

No se usa `sessionStorage`. La librería `localforage` está instalada, pero no se usa.

### localStorage

| Clave | Contenido | Archivo |
|---|---|---|
| `mapaSedAmazonia_unlockedPlants` | Objeto `{ codigoQR: { desbloqueado, fecha_desbloqueo, timestamp } }` | [unlock-system.js:9](static/js/unlock-system.js#L9) |
| `arbolesFavoritos` | Lista de `codigoQR` | [favorites.js:9](static/js/favorites.js#L9) |
| `mapaSedeAmazonia_treePhotos` | Objeto `{ codigoQR: dataUrl }`. Solo si IndexedDB no está disponible o lanza un error al guardar | [photo-storage.js:92](static/js/photo-storage.js#L92) |

La primera clave dice `SedAmazonia`, sin la "e". Si se corrige, hay que migrar los datos o los usuarios perderán su progreso.

### IndexedDB

| Base | Versión | Almacén | Clave | Registros |
|---|---|---|---|---|
| `MapaAmazoniaDB` | 1 | `treePhotos` | `codigoQR` | `{ codigoQR, dataUrl, updatedAt }` |

Las fotos se guardan como JPEG en base64, con un máximo de 1024 px y calidad 0,85. Al iniciar, todas se cargan en memoria.

## 6. Problemas, deuda técnica y TODOs

### Errores

Además del problema urgente de las plantas:

- **Salir del recorrido mientras carga:** el ciclo de dibujo sigue activo sin nada visible. Se midieron 91 cuadros en 1,5 s tras salir. Falta comprobar después de la carga si el usuario ya salió ([recorrido.js:349](static/js/recorrido.js#L349)).
- **Ícono de la pestaña roto (404):** apunta a `imagen_escudo_decorado.png`, pero el archivo es `escudo_decorado.png` ([index.html:12](templates/index.html#L12)).
- **Mensaje de éxito engañoso al guardar fotos:** si la escritura en IndexedDB falla de forma asíncrona (por ejemplo, sin espacio), el error no se captura y se avisa igualmente que la foto se guardó ([photo-storage.js:158-170](static/js/photo-storage.js#L158-L170)).
- **`deletePhoto` no limpia el respaldo** en localStorage. Hoy tampoco se llama desde ningún sitio.

### TODOs y código provisional

No hay comentarios `TODO` ni `FIXME` en el código propio. Estas marcas equivalen a lo mismo:

| Marca | Ubicación |
|---|---|
| `PRUEBA glosario AR (paso 1): quitar cuando exista el glosario` | [index.html:90](templates/index.html#L90), [index.html:534](templates/index.html#L534), `index.css:2701` |
| `SOLO EN ENTORNO DE DESARROLLO` (Geoman) | [index.js:11-29](static/js/index.js#L11-L29) |
| `Solo para entorno de prueba` (registro de clics) | [index.js:33-38](static/js/index.js#L33-L38) |
| Modelo de ejemplo en línea, que contradice el objetivo offline | [ar-prueba.js:30](static/js/ar-prueba.js#L30) |
| Funciones de prueba: `unlockForTesting`, `window.resetearDesbloqueos` | [unlock-system.js:135-155](static/js/unlock-system.js#L135-L155) |

### Código sin uso

- `main.py`: importaciones `FileResponse`, `Path` y `json`, y rutas comentadas.
- `index.js`: `image`, `plantasCargadas` (se asigna, nunca se lee) y un `if` vacío ([index.js:363-370](static/js/index.js#L363-L370)).
- `plants-handler.js`: `plantasLayer`, `plantasCargadas`, `refreshPlantMarkers`, `getUnlockedCount`.
- `unlock-system.js`: `getUnlockedCount`.
- `photo-storage.js`: `hasCustomPhoto`, `deletePhoto` y el evento `photoStorageReady`, que nadie escucha.
- `index.css`: estilos de la sección de historias, hoy desactivada.

### Calidad y mantenimiento

- `ar-prueba.js` ya es el visor real, pero conserva nombre, IDs y clases de prueba (`arTest*`).
- Quedan `console.log` activos, incluido uno por cada edificio al cargar y tres en cada enfoque.
- El versionado de caché es manual (`?v=` en `index.html` y `recorrido.js`), con riesgo de olvido.
- Los textos del JSON se insertan con `innerHTML` sin escapar. El riesgo es bajo mientras los datos sean locales y de confianza.
- Hay muchos estilos en línea en `index.html` y un único CSS de 3009 líneas.
- Las advertencias "Multiple instances of Three.js" aparecen al usar visor y recorrido en la misma sesión, porque `model-viewer` trae su propia copia.

### Compilación, tamaño y configuración

- **La APK lleva unos 102 MB de recursos.** Pesan sobre todo los PNG de 3–4 MB de `static/fotos-edificios/`.
- Se empaquetan archivos innecesarios: `static/geoman/dist/`, mapas de fuentes de Leaflet y `fotos-edificios/referencias-3d/`.
- `__pycache__/main.cpython-313.pyc` está en Git pese a estar en `.gitignore`.
- En `capacitor.config.json`, `webContentsDebuggingEnabled` y `allowMixedContent` están activos: conviene revisarlos para producción. Además, se configura el plugin `Filesystem`, que no está instalado.
- Dependencias sin uso o redundantes: `localforage` y `@capacitor/ios`. `leaflet`, Geoman y `qr-scanner` figuran en npm, pero se usan copias manuales en `static/`. Así se había perdido el worker del QR, y puede volver a pasar al actualizar librerías.
- `.env.example` no tiene efecto: ni `main.py` ni `build.js` leen variables de entorno.
- Por verificar: `npm run build` usa `cap build android`, mientras la documentación promete un `app-debug.apk`.

### Documentación desactualizada

- `README.md`: bloque de código roto en "Ejecutar en desarrollo", no menciona `sendero.json`, los modelos ni `scripts/`, y afirma "completamente offline" sin matizar la AR.
- `README.md` pide Java 11+ y `SETUP.md` pide JDK 17.
- `SETUP.md`: comando dañado `.venv\Scriptsctivate`, referencia a `static/campus.png` (no existe) y `npm run add ios` (no existe ese script).
- `build.js`: la ayuda no incluye `sync-app`.

### Ramas

`main` está sincronizada con `origin/main`. Las ramas `feature/album`, `feature/botones-filtros`, `feature/glosario-ar`, `feature/historias-estructuras` y `refactor/toma-de-fotos` no tienen commits pendientes de unir, así que se pueden borrar si ya no se van a usar.

---

## 7. Registro de cambios

Anotar aquí cada cambio significativo, con el más reciente primero. Las entradas anteriores a 2026-11-08 proceden del historial de Git.

| Fecha | Cambio | Commit |
|---|---|---|
| 2026-11-18 | **Auditorio y plazoleta según el plano:** en el plano, el techo del bloque 11 (Auditorio y Sala de sistemas 2; 12,62 x 29,54 m, 372 m² como dice su ficha) llega hasta lng 713,0, y ahí empieza el del bloque 13 (Admisión), que cubre el resto de la plazoleta. Antes, la plazoleta tenía un solo techo con el perfil del Auditorio hasta Admisión. Ahora: (1) el techo del Auditorio, con la estructura de madera a la vista, columnas, reflectores y bancas, cubre la plazoleta solo hasta 713,0; (2) desde ahí, el techo de teja gris de Admisión, más angosto, vuela sobre la plazoleta hasta su muro oeste, apoyado en cuatro columnas redondas de madera en la línea de sus muros (planta del bloque 13, pág. 80 del Anexo 1). Los muros del Auditorio, la fachada de entrada, el piso de baldosa, las mesas y el televisor no se movieron. `comun.py`: `PLAZOLETA_LNG` y la huella de Admisión desde 712,9; `gen_auditorio.py`: `plazoleta()` y `ancho_plazoleta()`; `gen_complementarios.py`: vuelo de Admisión. `recorrido.glb` 8,2 MB (`MUNDO` `v=18`). Revisado con vistas renderizadas; no se probó en el navegador. **Pendiente de verificar en el campus:** la posición exacta de las cuatro columnas del vuelo de Admisión | Sin commit |
| 2026-11-18 | **Bloques 12, 13, 14, 15 y 34 según el plano; planos movidos a `docs/planos/`:** los planos estaban en `static/planos/` (~130 MB), y `sync-app` los habría copiado a la APK; se movieron a `docs/planos/`, y el `Anexo 1 - Arquitectura (1).pdf` (67 MB) quedó en `.gitignore`. Modelos (`gen_complementarios.py`, medidas en `HUELLAS_PLANO` de `comun.py`): (12) la Dirección y la UGÍ quedan bajo un solo techo, con un paso cubierto sobre cuatro columnas entre las dos y cuatro aguas en la punta este. (13) Admisión y Secretaría toman el ancho del plano y la Secretaría termina donde acaba el techo; al este se agregó el Archivo (cuerpo B, 5,65 x 8,81 m, teja sándwich, salida de emergencia). (14) La fila de oficinas toma el borde exterior del plano, con cuatro aguas en los dos extremos. (15) Gestión de Bienes toma las medidas del plano, con techo a cuatro aguas y cobertizos de zinc sobre postes de madera a los dos lados; la ficha dice teja de asbesto cemento, pero se dejó la lámina verde de la foto. (34) La Cafetería pasa a 7,43 x 29,39 m, dos pisos, cubierta a una sola agua sin aleros, entrepiso y ventanas altas. La Biblioteca y el Laboratorio de Ecología (36) ya coincidían con el plano (a 0,3 y 0,5 m). `recorrido.glb` 8,3 MB (`MUNDO` `v=17`). Revisado con vistas renderizadas; no se probó en el navegador. **Pendiente:** (a) Auditorio y plazoleta: resuelto en la entrada siguiente. (b) La ficha 34 describe vestíbulo, gimnasio y oficinas, no una cafetería; hay que confirmar el uso. También faltan su escalera y sus baños anexos, y el lado hacia el que baja el agua es supuesto. (c) El bloque 16 sigue sin agregarse (uso desconocido). (d) Las ventanas del Archivo y la altura de los cobertizos de Gestión de Bienes son supuestas | Sin commit |
| 2026-11-18 | **Escala y medidas reales según los planos de la universidad:** se usaron los archivos nuevos de `docs/planos/`, en especial el plano vectorial de edificios existentes y las fichas del Plan Maestro 2021 (`Anexo 1 - Arquitectura (1).pdf`, págs. 2 y 12-75; el `.xlsx` de fichas 2025 repite las mismas fichas). (1) **Escala:** en el plano, las cubiertas de 100 m² de las fichas miden exactamente 10 x 10 m, y la Maloca 14,34 x 14,91 m (213,8 m², frente a 213,45 en su ficha). Ajustando 18 bloques del plano a sus polígonos del mapa, el error queda por debajo de 0,5 m (solo el baño de mujeres se desvía ~1 m) y no hay giro. La escala anterior (5,68 px/m, sacada de la cancha) agrandaba todo el mundo un 7-8 %. `comun.py`: `M_POR_LAT` 0,4928 → 0,4558 y `M_POR_LNG` 0,3551 → 0,3325. (2) **Medidas exactas:** nuevo `HUELLAS_PLANO` en `comun.py` con el techo medido en el plano de 19 lugares (Oficina de Asesoría, Salas de sistemas 1 y de posgrado, IMANI, APAPORIS, Arawana, Maloca, Bloque 13, Sala de profesores, tienda, los dos baños, Aula TIC 2, Salones 3, 4 y 5, MediaLab, Laboratorio de humedales y la torre M5 o "Cocina"); `huella()` lo usa antes que el polígono, que se dibujó a mano y suele quedar ~1 m más grande. (3) **Coordenadas fijas:** Gestión de Bienes, Alojamientos y Parqueadero tenían coordenadas en metros calculadas con la escala vieja; ahora salen de coordenadas del mapa (`rect_mapa()` en `gen_complementarios.py`). (4) **Estructura existente que faltaba: la Marquesina**, techo en anillo de lámina metálica sobre vigas y postes de madera alrededor de la plaza del tanque M5 (borde exterior de 25,62 m y patio de 16,41 m, según el plano; material según la foto `cocina.png`). Va solo en el mundo del recorrido (`marquesina()`), sin etiqueta ni polígono. Correspondencia hallada entre bloques del Plan Maestro y la app: 10 Biblioteca, 11 Auditorio + Sala de sistemas 2, 12 Dirección + UGÍ (una sola cubierta), 13 Admisión + Secretaría, 14 fila de Oficina 3 a Baños 2, 15 Gestión de Bienes, 20 Sala de profesores, 21 Oficina de Asesoría, 22 Bloque 13, 23 Sala de sistemas 1, 24 Sala de posgrado, 25 IMANI, 26 APAPORIS, 27 Maloca, 28 Arawana, 30 Aula TIC 2, 31-33 Salones 3, 4 y 5, 34 Cafetería (dos pisos), 35 MediaLab, 36 Laboratorio de Ecología, 37 Laboratorio de humedales, M1 tienda, M2 baño de mujeres, M3 baño de hombres, M5 la "Cocina" (torre del tanque elevado con cocineta) y 40A-C Alojamientos y Edificio apartado 1. Todos los `.glb` regenerados; `recorrido.glb` 8,2 MB (`MUNDO` `v=16`). Revisado con vistas renderizadas desde arriba; no se probó en el navegador. **Pendiente:** (a) Biblioteca, Sala de sistemas 2, Auditorio y Dirección (techos compartidos) y los bloques 12 a 15, 34 y 36 siguen el polígono del mapa; el plano trae sus medidas. (b) El bloque 12 es un solo techo sobre Dirección y UGÍ, con un paso cubierto entre los dos; en la app son dos modelos separados. (c) El bloque 16 (caseta de 21 m² con techo de zinc a una agua, al sureste de Gestión de Bienes) existe, pero no está en la app y la ficha no dice su uso. (d) El "Tanque de agua" de la app (estado planeado) es otro, del plan a futuro: el tanque que existe es M5. (e) Alturas de la Marquesina, por verificar | Sin commit |
| 2026-11-12 | **Casa hija más detallada y carrera más rápida:** según la foto `referencias-3d/casa hija.jpg`, `casa_hija()` en `gen_complementarios.py` reemplaza el muro macizo por tablas verticales de ~28 cm con rendijas y tonos alternos, zócalo bajo de concreto, solera alta, postes de esquina, puerta doble de listones separados con travesaños, marcas oscuras donde van los calados (rombos y lunas, aún cuadradas) y un sendero de tablas hacia la puerta. El techo de paja no cambia. `VELOCIDAD_CORRER` sube de 3,8 a 8 m/s. `recorrido.glb` regenerado (`MUNDO` `v=15`). Motivo: pedido del usuario con foto. **Pendiente:** abertura triangular en la punta del techo, letreros pintados de la puerta y forma real de los calados. No se probó en el navegador | Sin commit |
| 2026-11-12 | **Entrada del Auditorio y plazoleta cubierta:** según las fotos nuevas `referencias-3d/11.jpeg` a `14.jpeg`, la entrada del Auditorio está en su punta este y no en el costado norte. `gen_auditorio.py`: fachada este de muro mostaza que sobresale alrededor de un vano rehundido con seis puertas de madera y vidrio (el par del centro abierto) y claraboya, letrero, afiches, pendón, mesa larga de madera, banca, sillas, dispensador de agua sobre mesita, gel y cartelera verde; el costado norte cambia sus puertas de vidrio y la puerta amarilla por ventanas con celosía. Nueva plazoleta cubierta entre el Auditorio y Admisión (sin polígono en el mapa, por eso sin etiqueta): techo a dos aguas con tablas de madera a la vista, columnas redondas de madera, piso de baldosa con franjas de gravilla, bancas, mesas y sillas de aluminio, reflectores y un televisor en el muro de Admisión. La partida del recorrido del Auditorio (y la de por defecto) pasa a la plazoleta, frente a la entrada. `comun.py`: `Bloque.cubierta(hastiales=False)` y 3 materiales. `auditorio.glb` 0,82 → 1,19 MB; `recorrido.glb` 8,7 MB (`MUNDO` `v=14`, `recorrido.js` `v=13`). Motivo: pedido del usuario con fotos. Revisado con vistas renderizadas; no se probó en el navegador | Sin commit |
| 2026-11-11 | **Vista aérea despejada:** (1) las etiquetas ya no se amontonan: se dibujan primero las más cercanas a la cámara y se oculta la que se encimaría con otra o queda muy lejos (más de 2,2 veces la distancia de la cámara); son más pequeñas y los nombres largos se cortan con "…" (el completo queda en el `title`). (2) Árboles: antes iban en un anillo alrededor de todo el modelo y, con la Casa hija y los Alojamientos, caían sobre el parqueadero y la cancha o fuera del piso verde (fijo de 400 m en el origen). Ahora el piso se centra en el modelo y lo cubre, y 160 árboles se reparten solo sobre el pasto, a 4 m o más de todo lo construido y de los puntos de partida (cuadrícula de 2 m), dibujados con `InstancedMesh`. (3) La vista aérea arranca sobre el punto de partida a 90 m como máximo, en vez de alejarse para mostrar todo el mundo (`recorrido.js` `v=12`, `index.css` `v=23`). Motivo: reporte del usuario con captura. Comprobado: sintaxis con `node --check` y simulación en Python de la colocación de árboles sobre `recorrido.glb`; no se probó en el navegador | Sin commit |
| 2026-11-11 | **Interior de la Biblioteca según fotos reales:** `gen_biblioteca.py` usa las 16 fotos nuevas de `static/fotos-edificios/referencias-3d/` (`1.jpeg` a `10.jpeg` y las `WhatsApp Image 2026-11-05 ...`). Cambios: muros blancos por dentro con zócalo de madera (el mostaza queda solo por fuera), franja de ventanas altas, piso de baldosa blanca, techo de tablas de madera a la vista que sigue las aguas (también la del extremo a cuatro aguas) con cabios, limas, viga de cumbrera, tirantes y viga de amarre, lámparas fluorescentes colgantes, estanterías metálicas grises de doble cara con cartel de clasificación, mesas naranjas redondas y rectangulares con sillas azules y verdes, sala de computadores tras un cerramiento de vidrio con marcos de madera (ala sur), oficina con planera, televisor, armarios grises con franja azul y vitrina de películas (ala norte), tablero en caballete, dispensador de agua, aires acondicionados y, en el hall, ventanilla de préstamo con repisa, cartelera, revistero y antenas antirrobo. El exterior no cambia. `comun.py`: 6 materiales nuevos. `biblioteca.glb` pasa de 0,54 a 0,79 MB y `recorrido.glb` a 8,4 MB (`MUNDO` `v=13`, `recorrido.js` `v=11`). Motivo: pulir la biblioteca con las referencias del usuario. **Pendiente de verificar:** dónde va cada espacio dentro de las alas (las fotos no muestran la planta) y si la oficina y la sala de computadores están en el ala correcta. Revisado con vistas renderizadas del `.glb`; no se probó en el navegador | Sin commit |
| 2026-11-11 | **Modelos 3D de las 24 estructuras existentes que faltaban:** nuevo `scripts/modelos/gen_complementarios.py` genera 19 `.glb` (Admisión, Secretaría, UGÍ, Oficina 3, Sala 2 Videoconferencia, Laboratorio de Innovación, Adquisición, Baños 2, Gestión de Bienes, Bloque 13, Salones 3, 4 y 5, Laboratorio de Ecología, Cocina, Cafetería, MediaLab, Bienestar, Edificio apartado 1, Alojamientos, Piscina, Casa hija, Cancha y Parqueadero) y `gen_recorrido.py` los suma al mundo (`recorrido.glb` pasa de 6,1 a 8,1 MB; `MUNDO` `v=12`, `recorrido.js` `v=10`). Se agregó `modelo3d` a esos 24 lugares en `edifcios.json` (sin cambiar claves). `comun.py`: 14 materiales nuevos y `Escena.colocar` acepta un ángulo (la Casa hija está en diagonal). Motivo: que todos los lugares existentes tengan "Ver en 3D" y "Caminar". Son modelos de exterior: interiores vacíos. **Pendiente de verificar en el campus:** el aspecto de Secretaría, Oficina 3, Adquisición, Baños 2, Cafetería y Bienestar (sin foto, llevan el estilo de sus vecinos), Cancha y Parqueadero (sin foto, siguen el plano) y hacia dónde mira la fachada cuando la foto no lo muestra. Revisado con vistas renderizadas del `.glb`; no se probó en el navegador | Sin commit |
| 2026-11-10 | **`sync-app` limpia `www/`:** `build.js` borra `www/` antes de copiar `templates/`, `static/` y `data/`. Motivo: antes solo copiaba encima y dejaba archivos borrados o movidos (la antigua `static/fotos/` y un PDF de 3,7 MB), que también terminaban en la APK. Probado: la carpeta de recursos de Android bajó de 107 a 102 MB y coincide con `www/` | Sin commit |
| 2026-11-10 | **Fotos organizadas por tipo:** `static/fotos/` se dividió en `static/fotos-edificios/` (30 fotos y `referencias-3d/auditorio.png`) y `static/fotos-arboles/` (`pomarosa.jpeg`). Se eliminaron las fotos de árboles sin uso (`cacao.jpg`, `caucho.webp` y `R.jpg`, esta última de banco de imágenes con marca de agua) y la carpeta vacía `arboles/`. Motivo: ordenar los recursos antes de construir el jardín. Los JSON no cambian: guardan solo el nombre del archivo y la carpeta la pone el código (`index.js` `v=17` para edificios, `photo-storage.js` `v=3` para árboles). Se actualizaron las rutas en los comentarios de `scripts/modelos/`, README, SETUP y CLAUDE.md | Sin commit |
| 2026-11-10 | **Nuevas opciones en el menú:** Mi jardín, Bibliografía, Configuraciones y Acerca del aplicativo, separadas en principales y secundarias. Motivo: reservar el lugar de funciones planeadas. Por ahora muestran un aviso de "Próximamente" (atributo `data-proximamente`, manejado en `index.js`) (`index.css` `v=22`, `index.js` `v=16`) | Sin commit |
| 2026-11-10 | **Paleta verde:** el azul institucional (`#003366`) de la interfaz pasa a tonos verdes que combinan con el verde lima (`#9ec636`) de la pantalla de inicio. Hay nuevas variables en `:root` (`--verde-institucional` `#025928`, `--verde-hover` `#01260A`, `--verde-selva` `#027333`, `--verde-hoja` `#03A65A`, `--verde-menta` `#41F2A0`, `--verde-lima`), que reemplazan a `--azul-institucional` y `--azul-hover`. Afecta botones, títulos, encabezados, el menú lateral y el botón "Ir a la planta" del QR. Los polígonos de los edificios en el mapa siguen en azul (`index.js`) (`index.css` `v=21`, `qr-handler.js` `v=2`) | Sin commit |
| 2026-11-10 | **Menú lateral:** los botones de herbario, mapa 3D y notificaciones pasan a un menú que se abre con ☰ desde el borde derecho; ☰ ocupa el lugar de la campana. Motivo: despejar la barra superior, que solo conserva el buscador y el QR. Se mantuvieron los `id` de los botones, así que su lógica no cambió. También se ajustó el ancho de los resultados del buscador a la nueva barra. En escritorio (desde 768 px) ☰ va fijo en la esquina superior derecha, junto al borde por donde sale el menú (`index.html`, `index.css` `v=20`, `index.js` `v=15`) | Sin commit |
| 2026-11-08 | **Fix tarjeta de edificios:** se quitó `esPlanta`, que no existía tras unir `0003275` y `c3046ea` y lanzaba `ReferenceError` en `mostrarDetalle` (`index.js`, caché `v=14`) | Sin commit |
| 2026-11-08 | **Fix "Ver en 3D":** `ar-prueba.js` ya no depende del botón de prueba `arTestBtn`, hoy comentado (caché `v=6`) | Sin commit |
| 2026-11-08 | **Fix lector QR:** se añadió `static/js/qr-scanner-worker.min.js`, copiado de `node_modules` (v1.4.2) | Sin commit |
| 2026-11-08 | Creación de esta bitácora con el estado del proyecto | Sin commit |
| 2026-11-06 | Modelado 3D de edificios y nuevos filtros en `main` | `d0e8570` |
| 2026-11-06 | Botones de filtros: edificios futuros y sendero ecológico | `02fb82d` |
| 2026-11-06 | Modelos 3D: salas de sistemas 1 y posgrado, oficina de asesoría tecnológica | `e3e8237` |
| 2026-11-06 | Modelos 3D: Aula TIC 2, laboratorio de humedales, IMANI y APAPORIS | `fd31ac8` |
| 2026-11-05 | Modelos 3D: sala de profesores, Arawana, Maloca, baños y tienda | `cacbcba` |
| 2026-11-04 | Mapa 3D con recorrido a pie y vista aérea | `c3046ea` |
| 2026-11-04 | Limpieza de `package-lock.json` y retirada del sourcemap de Geoman | `7d67345` |
| 2026-11-03 | Comentarios en el código; retira `esPlanta` de `mostrarDetalle` | `0003275` |
| 2026-10-28 | Prueba de visor 3D y realidad aumentada | `0d64bd2` |
| 2026-10-27 | Actualización de `requirements.txt` | `d85d67d` |
| 2026-10-08 | Cambio de color de los puntos de los árboles | `9031090` |
| 2026-10-08 | Árboles favoritos, nuevo orden de la ficha y "Ver más información" | `412b467` |
| 2026-10-08 | Geoman sale de la carpeta `dist` ignorada por Git | `250cb10` |
| 2026-10-05 | Integración de nuevos árboles | `533a7e0` |
