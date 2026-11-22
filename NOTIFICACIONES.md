# Cómo enviar notificaciones a AVIAMAZ

Guía para quien envía avisos a la app desde la consola de Firebase. No hace falta saber programar.

Cada aviso aparece en el celular y queda guardado en el panel **Novedades del Campus** (menú ☰ → Notificaciones). El panel tiene dos pestañas:

- **General:** avisos del campus y de la app (biblioteca, senderos, actualizaciones…).
- **Social:** lo que hace la comunidad.

La pestaña donde cae el aviso y el ícono que lleva los decide el dato **`tipo`**.

> **La actividad social ya es automática.** La app publica sola en la pestaña Social cuando alguien con cuenta se une a AVIAMAZ, gana un logro o (a veces, al azar) planta un árbol en Mi jardín, y los demás pueden reaccionar con emojis. Esa actividad **no** llega como notificación del sistema: solo se ve dentro de la app (ver [Actividad automática](#actividad-automática-de-la-comunidad)). Por eso los tipos sociales enviados a mano (`social`, `juego`, `arbol`, `logro`) quedan **solo para pruebas**; para anunciar algo a todos, usa los tipos de la pestaña General.

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
| `titulo` | Recomendada | Copia del **Título**. Si la persona toca la notificación con la app cerrada o en segundo plano, Firebase no le pasa a la app el título ni el texto: sin esta copia, el aviso se guarda en el panel solo como "Nuevo aviso de AVIAMAZ" | El mismo texto del Título |
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

### Pestaña Social (solo para pruebas)

Estos avisos se siguen mostrando, mezclados por fecha con la actividad automática, pero ya no hace falta enviarlos: úsalos solo para probar cómo se ve el panel.

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
| En segundo plano o cerrada, y la persona **toca** la notificación | Se abre la app (y la sección, si hay `seccion`) | Sí. Con su texto solo si el mensaje trae `titulo` y `cuerpo` en los datos; si no, como "Nuevo aviso de AVIAMAZ" |
| En segundo plano o cerrada, y la notificación **sigue** en la barra cuando se abre la app | — | Sí, pero como `general` y sin persona ni logro |
| Cerrada y la persona **descarta** la notificación sin abrir la app | — | No |

## Limitaciones

- **Ícono de la barra del sistema:** con la app cerrada o en segundo plano, Android dibuja la notificación sin pasar por la app. Siempre usa el ícono general, sin importar el `tipo`. Para otro ícono, el mensaje tiene que enviarse por la API de FCM con `android.notification.icon` (por ejemplo `ic_stat_aviamaz_social`), porque la consola no tiene ese campo.
- **Las novedades se guardan solo en cada celular.** Quien instala la app hoy no ve los avisos de ayer, y lo que se descarta sin abrir la app no se guarda. Se resolverá más adelante guardando las novedades en Firestore.
- **Persona y logro se escriben a mano** en los avisos enviados desde la consola. La actividad real de la comunidad ya la publica la app sola (ver abajo).
- Si la persona dijo que no quería avisos, no recibe nada. Puede activarlos después en los ajustes de Android.

## Actividad automática de la comunidad

La pestaña Social muestra, además de los avisos push sociales, la actividad que la app publica sola en Firestore (colección `actividad`):

| Actividad | Cuándo se publica | Cómo se ve |
|---|---|---|
| Se unió a AVIAMAZ | Una sola vez, al crear el perfil (con correo o al completar el perfil de Google) | 🎉 **@ana** se unió a AVIAMAZ |
| Ganó un logro | Al desbloquear un logro. Si el logro vuelve a aparecer al sincronizar o reinstalar, no se repite | 🏆 **@carlos** ganó 🏆 Explorador del campus |
| Plantó un árbol | Al plantar en Mi jardín, solo a veces: 25 % de probabilidad y como máximo 1 al día por persona | 🌱 **@luis** plantó un árbol de Açaí en su jardín + botón "Visitar jardín" (aún no funciona: dice "Muy pronto…") |

- Solo se publica con cuenta y con **Mi cuenta → Mostrar mi actividad en la comunidad** encendido (viene encendido). Solo se muestra el @usuario, nunca el correo ni el nombre.
- Sin internet, lo que se va a publicar espera en el celular (máximo 20) y sale al volver la conexión o al abrir la app. Si la persona cierra sesión antes, se descarta.
- **Reacciones:** ❤️ 🌱 😮 👏. Una por persona y por actividad; tocar otro emoji la cambia y tocar el mismo la quita. No se puede reaccionar a lo propio. Hace falta conexión.
- **En tiempo real:** con la app abierta, las 30 actividades más recientes, sus reacciones y el contador se actualizan solos (un listener de Firestore que se apaga cuando la app pasa a segundo plano). **Ver más** carga otras 30. Se guarda una copia para verla sin conexión ("Sin conexión · mostrando lo último guardado"). Sin cuenta, invita a crear una.
- La campanita y la pestaña Social cuentan la actividad de otros que llegó desde la última vez que se abrió la pestaña (máximo 30).
- **No llega como notificación del sistema.** Las push sociales automáticas necesitan un servidor (Cloud Functions) y quedan para más adelante: la app nunca debe guardar credenciales de servidor de FCM.

## Pruebas

1. Instala la APK en un celular y abre la app. Acepta los avisos.
2. Conecta el celular por USB, abre `chrome://inspect` en Chrome del computador, inspecciona la app y busca en la consola `Push: token FCM = …`. El token también queda en `localStorage` con la clave `aviamaz_fcmToken`.
3. En Firebase usa **Enviar mensaje de prueba** con ese token.
4. Prueba con la app abierta, en segundo plano y cerrada.

## Para desarrolladores

- Código: `static/js/notificaciones.js` (recibe los avisos) y `static/js/novedades.js` (panel; los tipos están en la constante `TIPOS`). Para agregar un tipo, súmalo a `TIPOS` con su `grupo` y su ícono, y agrégalo a esta guía.
- Actividad automática: `static/js/actividad.js` (publicación, cola offline, carga de la pestaña Social y reacciones). La probabilidad y el máximo diario de plantaciones son las constantes `PROBABILIDAD_PLANTACION` y `MAX_PLANTACIONES_DIA`. Reglas de seguridad en `firestore.rules`.
- Almacenamiento: `localStorage` → `aviamaz_novedades` (máximo 50), `aviamaz_fcmToken`, `aviamaz_pushRechazado`, y para la actividad `aviamaz_actividadPendiente`, `aviamaz_ultimaPlantacionPublicada`, `aviamaz_social` y `aviamaz_socialVisto`.
- Avisos locales del jardín (no son push y no pasan por Novedades): "Tus árboles tienen sed" (id 7101, `jardin-notificaciones.js`) y "❤️ A @usuario le gustó tu jardín" (ids 7200–7299, `jardin-publico.js`; lo lanza el propio celular al detectar un like nuevo, así que con la app cerrada del todo llega al volver a abrirla). Los dos usan los íconos del árbol `ic_notificacion_jardin` y `ic_jardin_grande`, y al tocarlos se abre Mi jardín.
- Canal de Android: `aviamaz_general`. Íconos de la barra: `ic_stat_aviamaz_general` (por defecto) e `ic_stat_aviamaz_social`.
- Historial de cambios: `BITACORA.md`.
