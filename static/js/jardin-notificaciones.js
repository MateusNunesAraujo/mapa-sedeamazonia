/**
 * Aviso de "tus árboles tienen sed" con @capacitor/local-notifications (solo en la app Android;
 * en el navegador no hace nada).
 *
 * Para no saturar, nunca hay más de UN aviso pendiente y se programa al salir del jardín:
 *  - se dispara cuando al menos la mitad de los árboles plantados ya pide agua (mínimo uno),
 *  - nunca antes de AVISO.minSilencioMs desde que se salió del jardín,
 *  - nunca antes de AVISO.entreAvisosMs desde el último aviso que llegó,
 *  - si cae de noche (AVISO.nocheDesde a AVISO.nocheHasta) se pasa a la mañana siguiente.
 * Al volver a entrar al jardín se cancela el pendiente, así que entre visita y visita llega como
 * mucho uno. Se guarda en estado.avisos: { programado: ms | 0, ultimo: ms }.
 */

const ID_AVISO = 7101;
const ICONO_PEQUENO = 'ic_notificacion_jardin'; // res/drawable-*dpi (blanco sobre transparente)
const ICONO_GRANDE = 'ic_jardin_grande';        // res/drawable-xxhdpi (a color)

export const AVISO = {
  minSilencioMs: 2 * 60 * 60 * 1000,
  entreAvisosMs: 8 * 60 * 60 * 1000,
  nocheDesde: 21, // hora local (0-23) desde la que no se avisa...
  nocheHasta: 8,  // ...hasta esta hora de la mañana
};

function plugin() {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.LocalNotifications || null;
}

/** Si una hora cae de noche, la pasa a las AVISO.nocheHasta de la mañana siguiente */
function evitarNoche(ms) {
  const fecha = new Date(ms);
  const hora = fecha.getHours();
  if (hora < AVISO.nocheHasta) {
    fecha.setHours(AVISO.nocheHasta, 0, 0, 0);
  } else if (hora >= AVISO.nocheDesde) {
    fecha.setDate(fecha.getDate() + 1);
    fecha.setHours(AVISO.nocheHasta, 0, 0, 0);
  }
  return fecha.getTime();
}

/**
 * Calcula cuándo avisar (ms) según las reglas de arriba, o null si no hay árboles plantados.
 * Es pura (no toca el estado) para poder probarla.
 */
export function calcularAvisoSed(estado, ahora = Date.now()) {
  const horas = Object.values(estado.plantados)
    .map((codigo) => estado.sed[codigo])
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!horas.length) return null;
  const mitad = horas[Math.ceil(horas.length / 2) - 1]; // cuando la mitad ya pide agua
  const ultimo = estado.avisos?.ultimo || 0;
  const cuando = Math.max(mitad, ahora + AVISO.minSilencioMs, ultimo + AVISO.entreAvisosMs);
  return evitarNoche(cuando);
}

/** Pide permiso de notificaciones la primera vez (Android 13+); devuelve true si está concedido */
export async function pedirPermisoAvisos() {
  const ln = plugin();
  if (!ln) return false;
  try {
    let { display } = await ln.checkPermissions();
    if (display === 'prompt' || display === 'prompt-with-rationale') ({ display } = await ln.requestPermissions());
    return display === 'granted';
  } catch (err) {
    console.warn('Notificaciones: no se pudo pedir permiso', err);
    return false;
  }
}

/**
 * Al entrar al jardín: cancela el aviso pendiente. Si ya había pasado su hora, se da por entregado
 * (cuenta para el espacio entre avisos). Devuelve true si cambió el estado (hay que guardarlo).
 */
export async function cancelarAvisoSed(estado, ahora = Date.now()) {
  const avisos = estado.avisos || (estado.avisos = { programado: 0, ultimo: 0 });
  let cambio = false;
  if (avisos.programado) {
    if (avisos.programado <= ahora) { avisos.ultimo = avisos.programado; }
    avisos.programado = 0;
    cambio = true;
  }
  const ln = plugin();
  if (ln) {
    try { await ln.cancel({ notifications: [{ id: ID_AVISO }] }); } catch (err) { console.warn('Notificaciones: no se pudo cancelar', err); }
  }
  return cambio;
}

/**
 * Al salir del jardín: programa el único aviso de sed. Devuelve la hora programada (ms) o null.
 * Deja estado.avisos.programado actualizado (el que llama guarda el estado).
 */
export async function programarAvisoSed(estado, ahora = Date.now()) {
  const ln = plugin();
  const avisos = estado.avisos || (estado.avisos = { programado: 0, ultimo: 0 });
  const cuando = calcularAvisoSed(estado, ahora);
  avisos.programado = 0;
  if (!ln || !cuando) return null;
  try {
    const { display } = await ln.checkPermissions();
    if (display !== 'granted') return null;
    const total = Object.keys(estado.plantados).length;
    await ln.cancel({ notifications: [{ id: ID_AVISO }] });
    await ln.schedule({
      notifications: [{
        id: ID_AVISO,
        title: 'Tus árboles tienen sed 💧',
        body: total === 1
          ? 'Tu árbol está pidiendo agua. ¡Entra al jardín a regarlo!'
          : 'Varios árboles de tu jardín están pidiendo agua. ¡Entra a regarlos!',
        schedule: { at: new Date(cuando), allowWhileIdle: true },
        smallIcon: ICONO_PEQUENO,
        largeIcon: ICONO_GRANDE,
        extra: { abrir: 'jardin' },
      }],
    });
    avisos.programado = cuando;
    return cuando;
  } catch (err) {
    console.warn('Notificaciones: no se pudo programar el aviso', err);
    return null;
  }
}

/** Llama a `fn` cuando el usuario toca el aviso (para abrir el jardín directamente) */
export function alTocarAviso(fn) {
  const ln = plugin();
  if (!ln) return;
  try {
    ln.addListener('localNotificationActionPerformed', (evento) => {
      if (evento?.notification?.extra?.abrir === 'jardin') fn();
    });
  } catch (err) {
    console.warn('Notificaciones: no se pudo escuchar el toque', err);
  }
}
