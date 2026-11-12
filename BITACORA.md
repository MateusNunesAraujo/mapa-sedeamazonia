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
