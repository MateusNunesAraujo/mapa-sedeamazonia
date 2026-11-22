# Cómo enviar notificaciones a AVIAMAZ

Guía para quien envía avisos a la app desde la consola de Firebase. No hace falta saber programar.

Cada aviso aparece en el celular y queda guardado en el panel **Novedades del Campus** (menú ☰ → Notificaciones). El panel tiene dos pestañas:

- **General:** avisos del campus y de la app (biblioteca, senderos, actualizaciones…).
- **Social:** lo que hace la comunidad (alguien se une, planta un árbol, escanea un árbol, gana un logro…).

La pestaña donde cae el aviso y el ícono que lleva los decide el dato **`tipo`**.

## Enviar un aviso, paso a paso

1. Entra a la [consola de Firebase](https://console.firebase.google.com/), abre el proyecto de AVIAMAZ y ve a **Messaging**.
2. Pulsa **Nueva campaña** → **Notificaciones**.
3. Escribe el **Título** y el **Texto** de la notificación. Es lo que se ve en el celular.
4. Pulsa **Siguiente**. En **Segmentación**, elige la app Android (`com.universidadnacional.mapasedeamazonia`).
5. En **Programación**, elige **Ahora** o una fecha.
6. En **Opciones adicionales**:
   - **Canal de notificaciones de Android:** `aviamaz_general`.
   - **Datos personalizados:** agrega los pares clave / valor de la tabla de abajo. **Siempre** pon `tipo`.
7. Pulsa **Revisar** → **Publicar**.

Para probar antes en un solo celular, en el paso 3 usa **Enviar mensaje de prueba** y pega el token del dispositivo (ver [Pruebas](#pruebas)).

## Datos personalizados

| Clave | ¿Obligatoria? | Para qué sirve | Valores |
|---|---|---|---|
| `tipo` | Sí | Pestaña e ícono del aviso | Ver [Tipos](#tipos) |
| `titulo` | Recomendada | Copia del **Título**. Sin ella, si la persona toca la notificación con la app cerrada, el aviso no queda guardado en el panel (ver [Limitaciones](#limitaciones)) | El mismo texto del Título |
| `cuerpo` | Recomendada | Copia del **Texto**, por la misma razón | El mismo texto del Texto |
| `seccion` | No | Al tocar el aviso, abre esa parte de la app | `mapa`, `jardin`, `album` |
| `persona` | No | Quién lo hizo; se muestra como 👤 Nombre | Nombre de la persona |
| `logro` | Solo en `tipo = logro` | Nombre del logro; se muestra como 🏆 Logro | Nombre del logro |

Escribe las claves y los valores **en minúsculas y sin tildes** (`jardin`, `actualizacion`, `arbol`). Un `tipo` que no se reconozca se muestra como `general`.

## Tipos

### Pestaña General

| `tipo` | Ícono | Cuándo usarlo | Ejemplo |
|---|---|---|---|
| `general` | Ícono general de AVIAMAZ | Avisos que no encajan en otro tipo | "Bienvenidos al nuevo semestre" |
| `aviso` | 🚧 (tarjeta con borde rojo) | Algo importante o de precaución | "Sendero junto al río cerrado por mantenimiento" |
| `biblioteca` | 📚 | Biblioteca | "Horario extendido hasta las 8 p. m." |
| `evento` | 📢 | Conferencias, charlas, actividades | "Simposio de biodiversidad el viernes" |
| `sede` | 🌿 | Mensajes institucionales de la sede | "Bienvenida a estudiantes de intercambio" |
| `actualizacion` | 🔄 | Nueva versión de la app o mantenimiento | "Ya está disponible la versión 1.2" |

### Pestaña Social

| `tipo` | Ícono | Cuándo usarlo | Ejemplo |
|---|---|---|---|
| `social` | Ícono social | Novedades de la comunidad, por ejemplo alguien nuevo | "¡Ana se unió a AVIAMAZ!" |
| `juego` | Ícono social (provisional) | Mi jardín y otros juegos | "Luis plantó su primer árbol" |
| `arbol` | Hoja del álbum | Escaneo de un árbol del campus | "Sofía encontró un árbol nuevo" |
| `logro` | 🏆 (insignia dorada) | Logro desbloqueado | Ver ejemplo abajo |

## Ejemplos completos

**Sendero cerrado**

- Título: `Sendero cerrado` · Texto: `Mantenimiento junto al río hasta el viernes.`
- Datos: `tipo = aviso`, `titulo = Sendero cerrado`, `cuerpo = Mantenimiento junto al río hasta el viernes.`, `seccion = mapa`

**Nueva versión de la app**

- Título: `Nueva versión` · Texto: `Actualiza AVIAMAZ para ver los árboles nuevos.`
- Datos: `tipo = actualizacion`, `titulo = Nueva versión`, `cuerpo = Actualiza AVIAMAZ para ver los árboles nuevos.`

**Primer árbol plantado**

- Título: `Primer árbol plantado` · Texto: `Luis plantó su primer árbol en Mi jardín.`
- Datos: `tipo = juego`, `persona = Luis`, `seccion = jardin`, más `titulo` y `cuerpo`

**Árbol escaneado**

- Título: `Árbol escaneado` · Texto: `Sofía encontró un árbol nuevo del campus.`
- Datos: `tipo = arbol`, `persona = Sofía`, `seccion = album`, más `titulo` y `cuerpo`

**Logro**

- Título: `¡Nuevo logro!` · Texto: `Carlos ganó "Explorador del campus".`
- Datos: `tipo = logro`, `logro = Explorador del campus`, `persona = Carlos`, más `titulo` y `cuerpo`
- En el panel sale la insignia 🏆 Explorador del campus · Carlos.

## Qué ve la persona según el estado de la app

| Estado de la app | Qué pasa | ¿Queda en el panel? |
|---|---|---|
| Abierta | Sale un aviso verde arriba, dentro de la app | Sí, con tipo, ícono e insignias |
| En segundo plano o cerrada, y la persona **toca** la notificación | Se abre la app (y la sección, si hay `seccion`) | Sí, si el mensaje trae `titulo` o `cuerpo` en los datos |
| En segundo plano o cerrada, y la notificación **sigue** en la barra cuando se abre la app | — | Sí, pero como `general` y sin persona ni logro |
| Cerrada y la persona **descarta** la notificación sin abrir la app | — | No |

## Limitaciones

- **Ícono de la barra del sistema:** con la app cerrada o en segundo plano, Android dibuja la notificación sin pasar por la app. Siempre usa el ícono general, sin importar el `tipo`. Para otro ícono, el mensaje tiene que enviarse por la API de FCM con `android.notification.icon` (por ejemplo `ic_stat_aviamaz_social`), porque la consola no tiene ese campo.
- **Las novedades se guardan solo en cada celular.** Quien instala la app hoy no ve los avisos de ayer, y lo que se descarta sin abrir la app no se guarda. Se resolverá más adelante guardando las novedades en Firestore.
- **Persona y logro se escriben a mano.** Todavía no hay cuentas de usuario ni sistema de logros. Cuando existan, estos avisos los podrá enviar la app sola.
- Si la persona dijo que no quería avisos, no recibe nada. Puede activarlos después en los ajustes de Android.

## Pruebas

1. Instala la APK en un celular y abre la app. Acepta los avisos.
2. Conecta el celular por USB, abre `chrome://inspect` en Chrome del computador, inspecciona la app y busca en la consola `Push: token FCM = …`. El token también queda en `localStorage` con la clave `aviamaz_fcmToken`.
3. En Firebase usa **Enviar mensaje de prueba** con ese token.
4. Prueba con la app abierta, en segundo plano y cerrada.

## Para desarrolladores

- Código: `static/js/notificaciones.js` (recibe los avisos) y `static/js/novedades.js` (panel; los tipos están en la constante `TIPOS`). Para agregar un tipo, súmalo a `TIPOS` con su `grupo` y su ícono, y agrégalo a esta guía.
- Almacenamiento: `localStorage` → `aviamaz_novedades` (máximo 50), `aviamaz_fcmToken`, `aviamaz_pushRechazado`.
- Canal de Android: `aviamaz_general`. Íconos de la barra: `ic_stat_aviamaz_general` (por defecto) e `ic_stat_aviamaz_social`.
- Historial de cambios: `BITACORA.md`.
