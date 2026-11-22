/**
 * Respaldo del progreso en la nube: un solo documento por usuario, progreso/{uid}, en Firestore.
 *
 * localStorage sigue siendo la fuente principal: el juego lee y escribe en local como siempre y nada
 * espera a Firestore. Este módulo solo sube y baja una copia cuando hay sesión e internet:
 *  - Sin sesión (modo sin cuenta) no se sincroniza nada.
 *  - Sin listeners en tiempo real: solo lecturas puntuales (una al abrir la app o iniciar sesión, y una
 *    antes de cada subida para no pisar lo que subió otro celular).
 *
 * Quién llama a quién:
 *  - unlock-system.js, favorites.js, logros.js y jardin-estado.js (guardarEstado) → marcarCambio()
 *  - cuenta.js → activar(uid) al tener sesión con perfil, antesDeCerrarSesion(), desactivar(), borrarNube()
 *
 * Claves nuevas de localStorage (propias del celular, no se suben):
 *  - aviamaz_progresoActualizado: ms del último cambio de progreso en este celular
 *  - aviamaz_syncPendiente: 'true' si hay cambios sin subir
 *  - aviamaz_progresoUid: uid dueño del progreso local ('' = progreso de modo sin cuenta)
 *  - aviamaz_progresoBase: actualizadoLocal de la versión de la nube que este celular vio por última vez
 *    (sirve para saber si la nube cambió desde otro celular)
 *  - aviamaz_progresoSubido: ms de la última sincronización correcta (para "Guardado en la nube · hace 2 min")
 *  - aviamaz_progresoCombinar: 'true' mientras el progreso de modo sin cuenta espera combinarse con la cuenta
 *
 * Cómo se decide al sincronizar (lectura de la nube primero):
 *  - No hay documento → se sube lo local.
 *  - La nube no cambió desde la última vez (actualizadoLocal = base) → si hay pendientes, se sube lo local.
 *  - La nube cambió y aquí no hay pendientes → se baja la nube tal cual.
 *  - Cambiaron los dos → combinar(): unión de lo que se gana; lo demás, la versión más reciente;
 *    los accesorios colocados vuelven al inventario (decisión del usuario).
 *
 * Al final de cada pasada se llama a jardinPublico.publicar() (jardin-publico.js): la copia pública
 * jardines/{uid} se actualiza con el mismo debounce, solo si cambió algo de lo público.
 *
 * Firestore no acepta listas dentro de listas: jardin.celdas ([[col, fila]]) se guarda como ["col,fila"].
 * El plugin 5.4.1 no trae serverTimestamp: `actualizado` es la fecha ISO del celular al subir.
 */
(function () {
  const C = {
    unlocked: 'mapaSedAmazonia_unlockedPlants',
    favoritos: 'arbolesFavoritos',
    logros: 'aviamaz_logros',
    jardin: 'jardinEstado',
    actualizado: 'aviamaz_progresoActualizado',
    pendiente: 'aviamaz_syncPendiente',
    uid: 'aviamaz_progresoUid',
    base: 'aviamaz_progresoBase',
    subido: 'aviamaz_progresoSubido',
    combinar: 'aviamaz_progresoCombinar', // temporal: progreso de modo sin cuenta por combinar con la cuenta
  };
  const ESQUEMA = 1;
  const RETRASO_MS = 10000;      // subida con retraso tras el último cambio
  const RETRASO_INMEDIATO_MS = 800; // "inmediato": se espera un instante para juntar cambios seguidos (árbol + logro)
  const ESPERA_RED_MS = 15000;
  const REINTENTO_JARDIN_MS = 30000; // si el jardín está abierto no se aplica nada de la nube (lo pisaría al guardar)
  const TAMANO_AVISO = 100 * 1024;
  const TAMANO_MAX = 900 * 1024;  // Firestore admite 1 MiB por documento

  const cap = window.Capacitor;
  const nativo = !!cap?.isNativePlatform?.();
  const Store = nativo ? cap.Plugins?.FirebaseFirestore : null;

  let uid = null;              // sesión activa con perfil (null = sin sincronización)
  let temporizador = null;
  let enCurso = null;          // promesa de la sincronización en marcha
  let repetir = false;         // hubo otra petición mientras se sincronizaba
  let estadoActual = 'sin-sesion';
  let ultimoError = '';
  let pausado = false;          // mientras se elimina la cuenta no se sube nada

  // ---------- Utilidades ----------
  function leer(clave) { try { return localStorage.getItem(clave); } catch { return null; } }
  function guardar(clave, valor) { try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ } }
  function borrar(clave) { try { localStorage.removeItem(clave); } catch { /* nada */ } }
  function leerJSON(clave, defecto) {
    try { const v = JSON.parse(leer(clave) || 'null'); return v ?? defecto; } catch { return defecto; }
  }
  const entero = (n) => (Number.isInteger(n) && n >= 0 ? n : 0);
  const hayInternet = () => navigator.onLine !== false;
  const conTiempo = (p, ms = ESPERA_RED_MS) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
  const copia = (o) => JSON.parse(JSON.stringify(o));
  const union = (a, b) => [...new Set([...(a || []), ...(b || [])])];
  // El jardín de otro jugador (modo visita) no usa el progreso local: no bloquea la sincronización
  const jardinAbierto = () => !!document.querySelector('.jardin:not(.jardin--visita)');

  function avisarEstado(nuevo, error = '') {
    estadoActual = nuevo;
    ultimoError = error;
    document.dispatchEvent(new CustomEvent('sincronizacionEstado', { detail: estado() }));
  }

  // ---------- Leer y escribir el progreso local ----------
  /** Arma el objeto de progreso con lo que hay en localStorage (formato de la nube) */
  function recolectarProgreso() {
    const unlocked = leerJSON(C.unlocked, {});
    const arboles = [];
    const fechasArboles = {};
    for (const [codigo, info] of Object.entries(unlocked || {})) {
      if (!info?.desbloqueado) continue;
      arboles.push(codigo);
      const ms = Number(info.timestamp) || Date.parse(info.fecha_desbloqueo) || 0;
      if (ms) fechasArboles[codigo] = ms;
    }
    const favoritos = leerJSON(C.favoritos, []);
    const logrosLocal = leerJSON(C.logros, {});
    const jardinLocal = leerJSON(C.jardin, null);
    let jardin = null;
    let monedas = { plata: 0, oro: 0 };
    if (jardinLocal && typeof jardinLocal === 'object') {
      const { monedas: m, avisos, ...resto } = jardinLocal; // avisos = notificación programada en ESTE celular
      monedas = { plata: entero(m?.plata), oro: entero(m?.oro) };
      jardin = resto;
      if (Array.isArray(jardin.celdas)) jardin.celdas = jardin.celdas.map((c) => `${c[0]},${c[1]}`);
    }
    return {
      esquema: ESQUEMA,
      actualizadoLocal: Number(leer(C.actualizado)) || 0,
      arboles,
      fechasArboles,
      favoritos: Array.isArray(favoritos) ? favoritos.filter((f) => typeof f === 'string') : [],
      logros: {
        desbloqueados: logrosLocal?.desbloqueados && typeof logrosLocal.desbloqueados === 'object' ? logrosLocal.desbloqueados : {},
        porCobrar: { plata: entero(logrosLocal?.porCobrar?.plata), oro: entero(logrosLocal?.porCobrar?.oro) },
      },
      monedas,
      jardin,
    };
  }

  function tieneProgreso(p) {
    return !!(p && (p.arboles?.length || p.favoritos?.length || Object.keys(p.logros?.desbloqueados || {}).length
      || p.jardin || p.monedas?.plata || p.monedas?.oro));
  }

  /** Escribe el progreso en las claves de localStorage y refresca lo que depende de ellas */
  function aplicarProgreso(p) {
    const unlocked = {};
    for (const codigo of p.arboles || []) {
      const ms = Number(p.fechasArboles?.[codigo]) || Date.now();
      unlocked[codigo] = { desbloqueado: true, fecha_desbloqueo: new Date(ms).toISOString(), timestamp: ms };
    }
    guardar(C.unlocked, JSON.stringify(unlocked));
    guardar(C.favoritos, JSON.stringify(p.favoritos || []));
    guardar(C.logros, JSON.stringify(p.logros || { desbloqueados: {}, porCobrar: { plata: 0, oro: 0 } }));
    if (p.jardin) {
      const avisosLocales = leerJSON(C.jardin, null)?.avisos; // se conserva el aviso de este celular
      const jardin = copia(p.jardin);
      if (Array.isArray(jardin.celdas)) {
        jardin.celdas = jardin.celdas.map((c) => (typeof c === 'string' ? c.split(',').map(Number) : c));
      }
      jardin.monedas = { plata: entero(p.monedas?.plata), oro: entero(p.monedas?.oro) };
      if (avisosLocales) jardin.avisos = avisosLocales;
      guardar(C.jardin, JSON.stringify(jardin));
    } else {
      borrar(C.jardin);
    }
    guardar(C.actualizado, String(Number(p.actualizadoLocal) || 0));
    refrescarInterfaz();
  }

  /** Recarga en memoria lo que leen otros scripts y redibuja mapa y álbum */
  function refrescarInterfaz() {
    try { window.unlocker?.loadUnlocked?.(); } catch (e) { console.warn('Sync: unlocker', e); }
    try {
      if (window.favorites) {
        window.favorites.favoritos = new Set(window.favorites.load());
        document.dispatchEvent(new CustomEvent('favoritesUpdated', { detail: {} }));
      }
    } catch (e) { console.warn('Sync: favoritos', e); }
    try { window.actualizarPlantas?.(); } catch (e) { console.warn('Sync: mapa', e); }
    try {
      const album = window.albumHandler;
      if (album?.plantas?.length) { album.updateProgressCounter(); album.applyFilters(); }
    } catch (e) { console.warn('Sync: álbum', e); }
    document.dispatchEvent(new CustomEvent('progresoSincronizado'));
  }

  /** Deja el progreso local como el de un usuario nuevo (al cerrar sesión). No toca las fotos */
  function limpiarProgresoLocal() {
    [C.unlocked, C.favoritos, C.logros, C.jardin, C.actualizado, C.pendiente, C.base, C.subido].forEach(borrar);
    guardar(C.uid, '');
    refrescarInterfaz();
  }

  // ---------- Combinar ----------
  let monedasIniciales = null; // de data/tienda-jardin.json, para no regalarlas dos veces al combinar
  fetch('/data/tienda-jardin.json')
    .then((r) => r.json())
    .then((d) => { monedasIniciales = { plata: entero(d?.monedas_iniciales?.plata), oro: entero(d?.monedas_iniciales?.oro) }; })
    .catch(() => { /* sin catálogo: no se descuenta nada */ });

  /** Cuántas unidades se tienen de cada accesorio (sin colocar + colocadas) */
  function accesoriosPoseidos(jardin) {
    const total = {};
    for (const [id, n] of Object.entries(jardin?.inventario || {})) total[id] = (total[id] || 0) + entero(n);
    for (const zonas of Object.values(jardin?.accesorios || {})) {
      for (const id of Object.values(zonas || {})) if (typeof id === 'string' && id) total[id] = (total[id] || 0) + 1;
    }
    return total;
  }

  /**
   * Combina dos versiones que cambiaron por separado.
   *  - Unión (nunca se pierde): árboles desbloqueados, logros, exclusivos, accesorios canjeados por QR,
   *    preguntas respondidas, copias de árboles (la mayor), accesorios poseídos (la mayor cantidad).
   *  - La versión más reciente (actualizadoLocal): monedas, regadera, riegos, sed, parcelas y árboles plantados,
   *    favoritos y tiempos (lluvia, caja, sobres, preguntas).
   *  - Accesorios: todos los colocados vuelven al inventario.
   *  - Primer inicio de sesión desde modo sin cuenta (`sinCuenta`): las monedas se suman, menos las de
   *    bienvenida si las recibieron los dos (para no regalarlas dos veces).
   */
  function combinar(local, nube, { sinCuenta = false } = {}) {
    const reciente = (Number(local.actualizadoLocal) || 0) >= (Number(nube.actualizadoLocal) || 0) ? local : nube;
    const antiguo = reciente === local ? nube : local;
    const r = copia(reciente);
    r.esquema = ESQUEMA;

    // Árboles: unión, con la fecha más antigua
    r.arboles = union(local.arboles, nube.arboles);
    r.fechasArboles = {};
    for (const codigo of r.arboles) {
      const fechas = [local.fechasArboles?.[codigo], nube.fechasArboles?.[codigo]].map(Number).filter((n) => n > 0);
      if (fechas.length) r.fechasArboles[codigo] = Math.min(...fechas);
    }

    // Logros: unión, con la fecha más antigua; las monedas por cobrar, de la versión más reciente
    const desbloqueados = { ...(antiguo.logros?.desbloqueados || {}), ...(reciente.logros?.desbloqueados || {}) };
    for (const [id, fecha] of Object.entries(antiguo.logros?.desbloqueados || {})) {
      if (reciente.logros?.desbloqueados?.[id] && String(fecha) < String(reciente.logros.desbloqueados[id])) desbloqueados[id] = fecha;
    }
    r.logros = { desbloqueados, porCobrar: { ...(reciente.logros?.porCobrar || { plata: 0, oro: 0 }) } };

    // Monedas
    if (sinCuenta) {
      const dobles = local.jardin?.iniciales && nube.jardin?.iniciales && monedasIniciales;
      r.monedas = {
        plata: Math.max(0, entero(local.monedas?.plata) + entero(nube.monedas?.plata) - (dobles ? monedasIniciales.plata : 0)),
        oro: Math.max(0, entero(local.monedas?.oro) + entero(nube.monedas?.oro) - (dobles ? monedasIniciales.oro : 0)),
      };
    } else {
      r.monedas = { plata: entero(reciente.monedas?.plata), oro: entero(reciente.monedas?.oro) };
    }

    // Jardín
    const jr = reciente.jardin;
    const ja = antiguo.jardin;
    if (jr || ja) {
      const j = copia(jr || ja);
      const otro = jr ? ja : null;
      if (otro) {
        j.iniciales = !!(jr?.iniciales || ja?.iniciales);
        j.exclusivos = union(jr?.exclusivos, ja?.exclusivos);
        j.desbloqueosQR = union(jr?.desbloqueosQR, ja?.desbloqueosQR);
        j.preguntas = { ...(j.preguntas || {}), respondidas: union(jr?.preguntas?.respondidas, ja?.preguntas?.respondidas) };
        j.copias = { ...(ja?.copias || {}) };
        for (const [c, n] of Object.entries(jr?.copias || {})) j.copias[c] = Math.max(entero(n), entero(j.copias[c]));
        // Parcelas compradas: si la versión antigua tiene más y empieza igual, se conservan (los índices de
        // plantados siguen valiendo); si difieren, manda la más reciente
        const cr = jr?.celdas || [];
        const ca = ja?.celdas || [];
        if (ca.length > cr.length && cr.every((c, i) => c === ca[i])) { j.celdas = [...ca]; j.parcelas = ca.length; }
        // Capacidad de la regadera: se compra, así que gana la mayor
        if (ja?.regadera?.capacidad > (j.regadera?.capacidad || 0)) j.regadera = { ...j.regadera, capacidad: ja.regadera.capacidad };
        // Accesorios: lo colocado vuelve al inventario y de cada uno queda la mayor cantidad poseída
        const pr = accesoriosPoseidos(jr);
        const pa = accesoriosPoseidos(ja);
        j.inventario = {};
        for (const id of union(Object.keys(pr), Object.keys(pa))) j.inventario[id] = Math.max(pr[id] || 0, pa[id] || 0);
        j.accesorios = {};
      }
      r.jardin = j;
    }
    r.actualizadoLocal = Date.now();
    return r;
  }

  // ---------- Nube ----------
  async function bajar() {
    const { snapshot } = await conTiempo(Store.getDocument({ reference: `progreso/${uid}` }));
    return snapshot?.data || null;
  }

  async function subir(progreso) {
    const datos = { ...progreso, esquema: ESQUEMA, actualizado: new Date().toISOString() };
    const tamano = JSON.stringify(datos).length;
    if (tamano > TAMANO_MAX) throw new Error(`El progreso pesa ${Math.round(tamano / 1024)} KB: demasiado para un documento`);
    if (tamano > TAMANO_AVISO) console.warn(`Sync: el progreso pesa ${Math.round(tamano / 1024)} KB (más de 100 KB)`);
    await conTiempo(Store.setDocument({ reference: `progreso/${uid}`, data: datos }));
  }

  function marcarSubido(actualizadoLocal, marcaAntes) {
    guardar(C.base, String(actualizadoLocal));
    guardar(C.subido, String(Date.now()));
    // Si hubo cambios mientras se subía, siguen pendientes
    if (leer(C.actualizado) === marcaAntes) guardar(C.pendiente, 'false');
  }

  /** Una pasada de sincronización (una lectura y, si hace falta, una escritura) */
  async function pasada() {
    if (!uid || !Store) return;
    if (!hayInternet()) { avisarEstado(pendiente() ? 'sin-red' : 'guardado'); return; }
    avisarEstado('sincronizando');
    const nube = await bajar();
    const marca = leer(C.actualizado);
    const local = recolectarProgreso();
    const base = Number(leer(C.base)) || 0;
    const hayPendiente = pendiente();
    const sinCuenta = leer(C.combinar) === 'true';

    if (!nube) {
      if (tieneProgreso(local)) {
        if (!local.actualizadoLocal) local.actualizadoLocal = Date.now();
        await subir(local);
        guardar(C.actualizado, String(local.actualizadoLocal));
        marcarSubido(local.actualizadoLocal, String(local.actualizadoLocal));
      } else {
        guardar(C.pendiente, 'false');
      }
    } else if (Number(nube.actualizadoLocal) === base && !sinCuenta) {
      // La nube no cambió desde la última vez: solo se suben los cambios de aquí
      if (hayPendiente) {
        await subir(local);
        marcarSubido(local.actualizadoLocal, marca);
      }
    } else if (!hayPendiente || !tieneProgreso(local)) {
      // Cambió la nube (otro celular o cuenta recién iniciada) y aquí no hay nada nuevo: se baja tal cual
      if (jardinAbierto()) { programar(REINTENTO_JARDIN_MS); avisarEstado('pendiente'); return; }
      aplicarProgreso(nube);
      guardar(C.base, String(Number(nube.actualizadoLocal) || 0));
      guardar(C.subido, String(Date.now()));
      guardar(C.pendiente, 'false');
    } else {
      // Cambiaron los dos: se combinan, se aplica aquí y se sube el resultado
      if (jardinAbierto()) { programar(REINTENTO_JARDIN_MS); avisarEstado('pendiente'); return; }
      const resultado = combinar(local, nube, { sinCuenta });
      if (leer(C.actualizado) !== marca) { repetir = true; return; } // cambió algo mientras tanto: otra pasada
      aplicarProgreso(resultado);
      await subir(resultado);
      marcarSubido(resultado.actualizadoLocal, String(resultado.actualizadoLocal));
    }
    borrar(C.combinar);
    avisarEstado(pendiente() ? 'pendiente' : 'guardado');
    // Copia pública del jardín (jardines/{uid}): mismo debounce; solo escribe si cambió algo de lo público
    window.jardinPublico?.publicar?.();
  }

  /** Sincroniza ya (sin bloquear a nadie). Devuelve true si terminó sin errores */
  function sincronizar() {
    clearTimeout(temporizador);
    temporizador = null;
    venceInmediato = 0;
    if (!uid || !Store || pausado) return Promise.resolve(false);
    if (enCurso) { repetir = true; return enCurso; }
    enCurso = (async () => {
      let ok = true;
      do {
        repetir = false;
        try {
          await pasada();
        } catch (e) {
          ok = false;
          const sinRed = !hayInternet() || /timeout|network|UNAVAILABLE|offline/i.test(String(e?.message));
          if (!sinRed) console.warn('Sync: error', e);
          avisarEstado(sinRed ? 'sin-red' : 'error', sinRed ? '' : String(e?.message || e));
        }
      } while (repetir && ok);
      enCurso = null;
      return ok;
    })();
    return enCurso;
  }

  /**
   * Programa la próxima subida. Un cambio normal reinicia la espera de 10 s (debounce), pero nunca atrasa
   * una subida inmediata ya programada (p. ej. al desbloquear un árbol, logros.js guarda justo después).
   */
  let venceInmediato = 0;
  function programar(ms, inmediato = false) {
    if (!uid) return;
    if (!inmediato && temporizador && venceInmediato > Date.now()) return;
    clearTimeout(temporizador);
    venceInmediato = inmediato ? Date.now() + ms : 0;
    temporizador = setTimeout(() => { temporizador = null; venceInmediato = 0; sincronizar(); }, ms);
  }

  const pendiente = () => leer(C.pendiente) === 'true';

  // ---------- API ----------
  /** Lo llaman los módulos que guardan progreso. `inmediato`: desbloqueo de árbol o compra */
  function marcarCambio({ inmediato = false } = {}) {
    guardar(C.actualizado, String(Date.now()));
    guardar(C.pendiente, 'true');
    if (!uid) return; // modo sin cuenta: se combina al iniciar sesión
    if (estadoActual !== 'sincronizando') avisarEstado(hayInternet() ? 'pendiente' : 'sin-red');
    programar(inmediato ? RETRASO_INMEDIATO_MS : RETRASO_MS, inmediato);
  }

  /**
   * Hay sesión con perfil completo. Decide qué hacer con el progreso local según su dueño:
   *  - del mismo uid → sincronización normal;
   *  - de modo sin cuenta → se combina con la cuenta (no se pierde lo jugado sin cuenta);
   *  - de OTRA cuenta → se reemplaza por el de la nube de esta cuenta (o queda en blanco).
   */
  function activar(nuevoUid) {
    if (!Store || !nuevoUid || uid === nuevoUid) return;
    const dueno = leer(C.uid) || '';
    if (dueno && dueno !== nuevoUid) {
      limpiarProgresoLocal();
    } else if (!dueno) {
      const local = recolectarProgreso();
      if (tieneProgreso(local)) {
        guardar(C.combinar, 'true'); // marca temporal hasta la primera sincronización
        guardar(C.pendiente, 'true');
        if (!local.actualizadoLocal) guardar(C.actualizado, String(Date.now()));
      }
      borrar(C.base);
    }
    guardar(C.uid, nuevoUid);
    uid = nuevoUid;
    avisarEstado(pendiente() ? 'pendiente' : 'guardado');
    sincronizar();
  }

  /** Antes de cerrar sesión: intenta subir lo pendiente. true si no queda nada sin subir */
  async function antesDeCerrarSesion() {
    if (!uid) return true;
    if (!pendiente() && !leer(C.combinar)) return true;
    if (!hayInternet()) return false;
    await sincronizar();
    return !pendiente();
  }

  /** Al cerrar sesión (limpiar = true) o al eliminar la cuenta (el progreso queda como de modo sin cuenta) */
  function desactivar({ limpiar = false } = {}) {
    clearTimeout(temporizador);
    uid = null;
    pausado = false;
    if (limpiar) {
      limpiarProgresoLocal();
    } else {
      guardar(C.uid, '');
      [C.base, C.subido].forEach(borrar);
      if (tieneProgreso(recolectarProgreso())) guardar(C.pendiente, 'true');
    }
    avisarEstado('sin-sesion');
  }

  async function leerNube(id) {
    const { snapshot } = await conTiempo(Store.getDocument({ reference: `progreso/${id}` }));
    return snapshot?.data || null;
  }
  async function borrarNube(id) { await conTiempo(Store.deleteDocument({ reference: `progreso/${id}` })); }
  async function restaurarNube(id, datos) { if (datos) await Store.setDocument({ reference: `progreso/${id}`, data: datos }); }

  /** Estado para la interfaz de "Mi cuenta" */
  function estado() {
    const subido = Number(leer(C.subido)) || 0;
    let tipo = estadoActual;
    if (uid && tipo !== 'sincronizando' && tipo !== 'error') {
      if (!hayInternet()) tipo = pendiente() ? 'sin-red' : (subido ? 'guardado' : 'sin-red');
      else if (pendiente()) tipo = 'pendiente';
      else if (subido) tipo = 'guardado';
    }
    return { tipo, subido, error: ultimoError, pendiente: pendiente() };
  }

  // Reintentos: al volver a primer plano, al recuperar la conexión y al pasar a segundo plano
  window.addEventListener('online', () => { if (uid) sincronizar(); });
  window.addEventListener('offline', () => { if (uid) avisarEstado(pendiente() ? 'sin-red' : estadoActual); });
  const app = cap?.Plugins?.App;
  if (nativo && app?.addListener) {
    try {
      app.addListener('appStateChange', ({ isActive }) => {
        if (!uid) return;
        if (!isActive && pendiente()) sincronizar();       // se va a segundo plano: subir ya
        else if (isActive && pendiente()) sincronizar();   // vuelve: reintentar lo pendiente
      })?.catch?.(() => {});
    } catch { /* sin plugin App */ }
  } else {
    document.addEventListener('visibilitychange', () => { if (uid && pendiente()) sincronizar(); });
  }

  window.sincronizacion = {
    recolectarProgreso, aplicarProgreso, combinar, marcarCambio, sincronizar,
    activar, desactivar, antesDeCerrarSesion, estado,
    leerNube, borrarNube, restaurarNube,
    activa: () => !!uid,
    pausar: () => { pausado = true; clearTimeout(temporizador); return enCurso || Promise.resolve(); },
    reanudar: () => { pausado = false; },
  };
})();
