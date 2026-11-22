/**
 * Actividad de la comunidad: lo que muestra la pestaña Social del panel "Novedades del Campus".
 *
 * La app publica sola tres tipos de actividad en Firestore (colección actividad/{id}):
 *  - 'union'      → al crear el perfil por primera vez (cuenta.js llama a publicarUnion()).
 *  - 'logro'      → al desbloquear un logro (evento `logroDesbloqueado` de logros.js).
 *  - 'plantacion' → al plantar en Mi jardín (evento `arbolPlantado` de jardin.js), solo a veces:
 *                   con probabilidad PROBABILIDAD_PLANTACION y como máximo MAX_PLANTACIONES_DIA al día.
 * Cualquier usuario con cuenta puede reaccionar con un emoji a la actividad de otros.
 *
 * Reglas de diseño:
 *  - Offline-first: nada del juego espera a Firestore. Lo que se va a publicar entra primero en una
 *    cola local (aviamaz_actividadPendiente) y se sube cuando hay internet (al momento, al recuperar la
 *    conexión, al volver a primer plano o al abrir la app).
 *  - Tiempo real con pocas lecturas: UN listener sobre las 30 actividades más recientes, solo con sesión y con
 *    la app en primer plano (cuesta ~30 lecturas al arrancar y 1 por cada actividad o reacción nueva entre
 *    esas 30). "Ver más" y el borrado de la cuenta son consultas puntuales con limit().
 *  - No se envían push del sistema: la actividad solo se ve dentro de la app.
 *  - Sin cuenta, o con "Mostrar mi actividad en la comunidad" apagado (users/{uid}.actividadPublica),
 *    no se publica nada.
 *  - Solo se muestra el @username; nunca el correo ni el nombre completo.
 *
 * IDs fijos para no duplicar: {uid}_union y {uid}_logro_{logroId}. Las reglas solo dejan CREAR al
 * autor, así que un segundo intento con el mismo ID falla con PERMISSION_DENIED y se toma como "ya
 * publicado". La plantación usa {uid}_plantacion_{ms}: el ID se fija al ponerla en la cola, porque si la
 * subida se corta por tiempo, el SDK de Firestore la puede entregar después igual y un ID automático
 * nuevo en el reintento la duplicaría.
 *
 * Limitaciones del plugin @capacitor-firebase/firestore 5.4.1 (no trae serverTimestamp ni deleteField):
 *  - `fecha` son los ms del celular al publicar; las reglas rechazan fechas más de 10 min en el futuro
 *    (para que nadie se ponga siempre arriba). `fechaEvento` son los ms de cuando ocurrió.
 *  - Para quitar una reacción se lee el documento y se escribe el mapa `reacciones` sin la clave propia
 *    (las reglas comprueban que solo cambie esa clave).
 *
 * Claves de localStorage:
 *  - aviamaz_actividadPendiente: arreglo de actividades por publicar (máximo MAX_PENDIENTES).
 *  - aviamaz_ultimaPlantacionPublicada: { fecha: 'AAAA-MM-DD', cuantas } de la última plantación publicada.
 *  - aviamaz_social: { uid, guardado, items } última actividad cargada, para verla sin conexión.
 *  - aviamaz_socialVisto: ms de la última vez que se abrió la pestaña Social (contador de no leídas).
 *
 * Expone window.actividad (lo usan novedades.js y cuenta.js).
 */
(function () {
  // ---------- Constantes fáciles de cambiar ----------
  const PROBABILIDAD_PLANTACION = 0.25; // 25 %. Para probar, subir temporalmente a 1 (100 %)
  const MAX_PLANTACIONES_DIA = 1;       // plantaciones publicadas por usuario y por día (en este celular)
  const MAX_PENDIENTES = 20;
  const PAGINA = 30;                    // documentos por consulta (pestaña, "Ver más" y contador)
  const MAX_GUARDADAS = 60;             // actividades que se guardan para verlas sin conexión
  const PRIMERA_VEZ_MS = 24 * 3600 * 1000; // sin aviamaz_socialVisto, se cuenta lo del último día
  const MAX_INTENTOS = 5;               // errores que no son de red ni de permisos antes de descartar
  const ESPERA_RED_MS = 15000;

  const C = {
    pendientes: 'aviamaz_actividadPendiente',
    ultimaPlantacion: 'aviamaz_ultimaPlantacionPublicada',
    social: 'aviamaz_social',
    visto: 'aviamaz_socialVisto',
  };
  const TIPOS = ['union', 'logro', 'plantacion'];
  // Claves sin tildes: son las que se guardan en Firestore (y las que aceptan las reglas)
  const REACCIONES = [
    { clave: 'corazon', emoji: '❤️', nombre: 'Me encanta' },
    { clave: 'planta', emoji: '🌱', nombre: 'Planta' },
    { clave: 'asombro', emoji: '😮', nombre: 'Asombro' },
    { clave: 'aplauso', emoji: '👏', nombre: 'Aplauso' },
  ];
  const CLAVES_REACCION = REACCIONES.map((r) => r.clave);
  const CARPETA_LOGROS = '/static/iconos/logros/';

  const cap = window.Capacitor;
  const nativo = !!cap?.isNativePlatform?.();
  const Store = nativo ? cap.Plugins?.FirebaseFirestore : null;

  // ---------- Utilidades ----------
  function leer(clave) { try { return localStorage.getItem(clave); } catch { return null; } }
  function guardar(clave, valor) { try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ } }
  function borrar(clave) { try { localStorage.removeItem(clave); } catch { /* nada */ } }
  function leerJSON(clave, defecto) {
    try { const v = JSON.parse(leer(clave) || 'null'); return v ?? defecto; } catch { return defecto; }
  }
  const hayInternet = () => navigator.onLine !== false;
  const conTiempo = (p, ms = ESPERA_RED_MS) =>
    Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
  const esPermisoDenegado = (e) => /PERMISSION_DENIED|insufficient permissions/i.test(String(e?.message || e || ''));
  const esErrorDeRed = (e) => !hayInternet() || /timeout|network|UNAVAILABLE|offline|unreachable/i.test(String(e?.message || e || ''));
  const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  const perfil = () => window.cuenta?.perfil?.() || null;
  const sesionLista = () => window.cuenta?.listo || Promise.resolve();
  const comparte = (p) => !!p && p.actividadPublica !== false;
  const repintar = () => { try { window.novedades?.render?.(); } catch (e) { console.warn('Actividad: repintar', e); } };

  function avisar(mensaje) {
    if (typeof Swal === 'undefined') return;
    Swal.fire({ toast: true, position: 'bottom', icon: 'info', title: mensaje, showConfirmButton: false, timer: 2600,
      customClass: { container: 'cuenta-swal' } });
  }

  // ---------- Cola de publicación (offline) ----------
  function leerPendientes() {
    const l = leerJSON(C.pendientes, []);
    return Array.isArray(l) ? l.filter((x) => x && typeof x.id === 'string' && TIPOS.includes(x.tipo)) : [];
  }
  function escribirPendientes(l) {
    if (l.length) guardar(C.pendientes, JSON.stringify(l.slice(-MAX_PENDIENTES)));
    else borrar(C.pendientes);
  }
  function quitarPendiente(id) { escribirPendientes(leerPendientes().filter((x) => x.id !== id)); }
  function sumarIntento(id) {
    const l = leerPendientes();
    const item = l.find((x) => x.id === id);
    if (!item) return;
    item.intentos = (item.intentos || 0) + 1;
    escribirPendientes(item.intentos >= MAX_INTENTOS ? l.filter((x) => x.id !== id) : l);
  }

  function encolar(item) {
    const lista = leerPendientes();
    if (lista.some((x) => x.id === item.id)) return;
    lista.push(item);
    escribirPendientes(lista);
    publicarPendientes();
  }

  /** Campos comunes de lo que se pone en la cola */
  function base(p, tipo) {
    const item = { tipo, uid: p.uid, username: p.username, fechaEvento: Date.now() };
    if (typeof p.fotoURL === 'string' && p.fotoURL) item.fotoURL = p.fotoURL.slice(0, 500);
    return item;
  }

  /** "Se unió a AVIAMAZ": cuenta.js la llama una vez, al crear el perfil (users/{uid}) */
  async function publicarUnion() {
    await sesionLista();
    const p = perfil();
    if (!comparte(p)) return;
    encolar({ ...base(p, 'union'), id: `${p.uid}_union` });
  }

  async function alGanarLogro(logro) {
    if (!logro?.id) return;
    await sesionLista();
    const p = perfil();
    if (!comparte(p)) return;
    const idLogro = String(logro.id).replace(/[/\s]/g, '-').slice(0, 60);
    encolar({
      ...base(p, 'logro'),
      id: `${p.uid}_logro_${idLogro}`,
      logro: { id: idLogro, nombre: String(logro.nombre || 'Logro').slice(0, 60), icono: typeof logro.imagen === 'string' ? logro.imagen : '' },
    });
  }

  function hoy() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function plantacionesHoy() {
    const v = leerJSON(C.ultimaPlantacion, null);
    if (typeof v === 'string') return v === hoy() ? 1 : 0;
    return v?.fecha === hoy() ? Math.max(1, Number(v.cuantas) || 1) : 0;
  }

  async function nombreArbol(detalle) {
    if (detalle?.nombre) return String(detalle.nombre).slice(0, 60);
    try {
      const plantas = window.plantsHandler?.plantas?.length ? window.plantsHandler.plantas : await window.plantsHandler?.loadPlants?.();
      return String((plantas || []).find((x) => x.codigoQR === detalle?.codigoQR)?.nombre || '').slice(0, 60);
    } catch { return ''; }
  }

  /** Plantación en Mi jardín: solo a veces (al azar) y como máximo MAX_PLANTACIONES_DIA al día */
  async function alPlantar(detalle) {
    await sesionLista();
    const p = perfil();
    if (!comparte(p)) return;
    const n = plantacionesHoy();
    if (n >= MAX_PLANTACIONES_DIA || Math.random() >= PROBABILIDAD_PLANTACION) return;
    guardar(C.ultimaPlantacion, JSON.stringify({ fecha: hoy(), cuantas: n + 1 }));
    const nombre = await nombreArbol(detalle);
    encolar({
      ...base(p, 'plantacion'),
      id: `${p.uid}_plantacion_${Date.now()}`,
      arbol: { id: String(detalle?.codigoQR || '').slice(0, 60), nombre },
    });
  }

  /** Documento tal como se crea en Firestore (las reglas exigen reacciones vacías y estos campos) */
  function documento(item) {
    const d = {
      tipo: item.tipo,
      uid: item.uid,
      username: item.username,
      fecha: Date.now(),
      fechaEvento: Number(item.fechaEvento) || Date.now(),
      reacciones: {},
    };
    if (item.fotoURL) d.fotoURL = item.fotoURL;
    if (item.tipo === 'logro') d.logro = item.logro;
    if (item.tipo === 'plantacion') d.arbol = item.arbol;
    return d;
  }

  let publicando = null;
  let repetir = false; // llegó algo a la cola mientras se subía: se hace otra pasada
  /** Sube la cola. Nunca la espera nadie del juego */
  function publicarPendientes() {
    if (publicando) { repetir = true; return publicando; }
    publicando = (async () => {
      try {
        await sesionLista();
        do {
          repetir = false;
          if (!(await unaPasada())) break;
        } while (repetir);
      } catch (e) {
        console.warn('Actividad: cola', e);
      } finally {
        publicando = null;
      }
    })();
    return publicando;
  }

  /** Recorre la cola una vez. Devuelve false si hay que dejar de intentar por ahora (sin red o sin sesión) */
  async function unaPasada() {
    if (!Store || !hayInternet()) return false;
    const p = perfil();
    if (!p) return false;
    // Si apagó "Mostrar mi actividad", lo que quedaba por publicar se descarta
    if (!comparte(p)) { borrar(C.pendientes); return false; }
    for (const item of leerPendientes()) {
      if (!hayInternet()) break;
      if (item.uid !== p.uid) { quitarPendiente(item.id); continue; } // de otra cuenta
      try {
        await conTiempo(Store.setDocument({ reference: `actividad/${item.id}`, data: documento(item) }));
        quitarPendiente(item.id);
      } catch (e) {
        if (esPermisoDenegado(e)) {
          // Con ID fijo: ya estaba publicada (las reglas no dejan sobrescribirla). También sale si las
          // reglas de actividad/ no están publicadas en la consola.
          console.info('Actividad: ya publicada o rechazada por las reglas', item.id);
          quitarPendiente(item.id);
        } else if (esErrorDeRed(e)) {
          return false; // se reintenta al recuperar la conexión o al volver a la app
        } else {
          console.warn('Actividad: no se pudo publicar', item.id, e);
          sumarIntento(item.id);
        }
      }
    }
    return true;
  }

  // ---------- Lectura en tiempo real (pestaña Social y contador) ----------
  // Un solo listener sobre las PAGINA actividades más recientes (orderBy fecha desc, limit). Da a la vez la
  // primera página de la pestaña y el contador de no leídas, y muestra en vivo las reacciones de otros.
  // Solo está activo con la app en primer plano y con sesión; "Ver más" sigue siendo una consulta puntual.
  let principal = [];      // últimas PAGINA (del listener o de la copia guardada)
  let anteriores = [];     // páginas cargadas con "Ver más"
  let lista = [];          // principal + anteriores, de la más nueva a la más vieja
  let listaDe = null;      // uid al que corresponde `lista`
  let hayMas = false;
  let cargando = false;
  let errorCarga = false;
  let escucha = null;      // callbackId del listener, 'iniciando' o null
  let recibido = false;    // ya llegó la primera respuesta del listener
  let inicioEscucha = 0;
  let idsConocidos = null; // ids del snapshot anterior, para detectar lo que llega en vivo
  const nuevasIds = new Set(); // llegaron en vivo (de otros) y aún no se ven

  function aMs(v) {
    if (typeof v === 'number' && isFinite(v) && v > 0) return v;
    if (typeof v === 'string') return Date.parse(v) || 0;
    if (v && typeof v === 'object' && Number(v.seconds)) return Number(v.seconds) * 1000; // Timestamp escrito a mano
    return 0;
  }

  /** Solo se aceptan rutas a las insignias de la app (los datos vienen de otros usuarios) */
  function iconoSeguro(v) {
    return typeof v === 'string' && v.startsWith(CARPETA_LOGROS) && !v.includes('..') && v.length < 200 ? v : '';
  }

  /** Limpia un documento de Firestore (o de la copia guardada) para mostrarlo */
  function normalizar(id, d) {
    if (!id || !d || !TIPOS.includes(d.tipo)) return null;
    const reacciones = {};
    if (d.reacciones && typeof d.reacciones === 'object') {
      for (const [u, c] of Object.entries(d.reacciones)) if (CLAVES_REACCION.includes(c)) reacciones[u] = c;
    }
    const a = {
      id: String(id),
      tipo: d.tipo,
      uid: String(d.uid || ''),
      username: typeof d.username === 'string' && /^[a-z0-9_.]{1,20}$/.test(d.username) ? d.username : '',
      fecha: aMs(d.fecha) || aMs(d.fechaEvento),
      reacciones,
    };
    if (a.tipo === 'logro') a.logro = { id: texto(d.logro?.id, 60), nombre: texto(d.logro?.nombre, 60) || 'Logro', icono: iconoSeguro(d.logro?.icono) };
    if (a.tipo === 'plantacion') a.arbol = { id: texto(d.arbol?.id, 60), nombre: texto(d.arbol?.nombre, 60) };
    return a;
  }

  function unirLista() {
    const ids = new Set(principal.map((a) => a.id));
    anteriores = anteriores.filter((a) => !ids.has(a.id));
    lista = principal.concat(anteriores);
  }

  /** Devuelve la lista de la sesión actual (o la guardada en el celular si aún no llegó nada) */
  function listaActual(p) {
    if (listaDe !== p.uid) {
      const copia = leerJSON(C.social, null);
      principal = copia?.uid === p.uid && Array.isArray(copia.items)
        ? copia.items.map((x) => normalizar(x?.id, x)).filter(Boolean)
        : [];
      anteriores = [];
      listaDe = p.uid;
      hayMas = false;
      nuevasIds.clear();
      unirLista();
    }
    return lista;
  }

  function guardarCopia(p) {
    if (listaDe !== p.uid) return;
    guardar(C.social, JSON.stringify({ uid: p.uid, guardado: Date.now(), items: lista.slice(0, MAX_GUARDADAS) }));
  }

  function visto() {
    let v = Number(leer(C.visto)) || 0;
    if (!v) { v = Date.now() - PRIMERA_VEZ_MS; guardar(C.visto, String(v)); } // primera vez: lo del último día
    return v;
  }

  /** La pestaña Social queda vista */
  function marcarVisto() {
    guardar(C.visto, String(Date.now()));
    nuevasIds.clear();
  }

  /** Actividad de otros que llegó desde la última vez que se vio la pestaña (máximo PAGINA) */
  function contarNoLeidas() {
    const p = perfil();
    if (!p || listaDe !== p.uid) return 0;
    const desde = visto();
    return principal.filter((a) => a.uid !== p.uid && (a.fecha > desde || nuevasIds.has(a.id))).length;
  }

  function alSnapshot(p, evento, error) {
    if (perfil()?.uid !== p.uid) return;
    if (error) {
      console.warn('Actividad: el listener se detuvo', error);
      detenerEscucha();
      errorCarga = !esErrorDeRed(error);
      repintar();
      return;
    }
    const docs = (evento?.snapshots || []).map((s) => normalizar(s.id, s.data)).filter(Boolean);
    listaActual(p);
    // Lo que aparece en vivo cuenta como nuevo aunque el reloj del otro celular vaya un poco atrasado.
    // Se ignoran documentos viejos que solo aparecen porque no estaban en la caché del primer snapshot.
    if (idsConocidos) {
      for (const a of docs) {
        if (!idsConocidos.has(a.id) && a.uid !== p.uid && a.fecha > inicioEscucha - 10 * 60 * 1000) nuevasIds.add(a.id);
      }
    }
    idsConocidos = new Set(docs.map((a) => a.id));
    principal = docs;
    if (!anteriores.length) hayMas = docs.length === PAGINA;
    unirLista();
    recibido = true;
    errorCarga = false;
    if (window.novedades?.socialVisible?.()) marcarVisto(); // se está viendo: no cuenta como sin leer
    guardarCopia(p);
    repintar();
  }

  /** Empieza a escuchar la actividad (al abrir la app, al iniciar sesión o al volver a primer plano) */
  async function iniciarEscucha() {
    await sesionLista();
    const p = perfil();
    if (!p || !Store?.addCollectionSnapshotListener || escucha || (!nativo && document.hidden)) return;
    listaActual(p);
    visto();
    escucha = 'iniciando';
    recibido = false;
    inicioEscucha = Date.now();
    idsConocidos = null;
    try {
      const id = await Store.addCollectionSnapshotListener(
        { reference: 'actividad', queryConstraints: [{ type: 'orderBy', fieldPath: 'fecha', directionStr: 'desc' }, { type: 'limit', limit: PAGINA }] },
        (evento, error) => alSnapshot(p, evento, error),
      );
      if (escucha !== 'iniciando' || perfil()?.uid !== p.uid) {
        // Se pidió detener mientras arrancaba
        Store.removeSnapshotListener({ callbackId: id }).catch(() => {});
        if (escucha === 'iniciando') escucha = null;
        return;
      }
      escucha = id;
      console.info('Actividad: escuchando en tiempo real');
    } catch (e) {
      escucha = null;
      console.warn('Actividad: no se pudo escuchar', e);
    }
  }

  function detenerEscucha() {
    const id = escucha;
    escucha = null;
    idsConocidos = null;
    if (id && id !== 'iniciando') Store?.removeSnapshotListener?.({ callbackId: id })?.catch?.(() => {});
  }

  /** "Ver más": consulta puntual de las PAGINA anteriores a la última que se ve (startAfter) */
  async function cargar({ mas = false } = {}) {
    const p = perfil();
    if (!p || !Store || cargando) return;
    listaActual(p);
    if (!hayInternet()) { repintar(); return; }
    cargando = true;
    errorCarga = false;
    repintar();
    try {
      const restricciones = [{ type: 'orderBy', fieldPath: 'fecha', directionStr: 'desc' }];
      if (mas && lista.length) restricciones.push({ type: 'startAfter', reference: `actividad/${lista[lista.length - 1].id}` });
      restricciones.push({ type: 'limit', limit: PAGINA });
      const { snapshots = [] } = await conTiempo(Store.getCollection({ reference: 'actividad', queryConstraints: restricciones }));
      if (perfil()?.uid !== p.uid) return; // cerró sesión mientras tanto
      const nuevas = snapshots.map((s) => normalizar(s.id, s.data)).filter(Boolean);
      if (mas) {
        const ids = new Set(lista.map((a) => a.id));
        anteriores = anteriores.concat(nuevas.filter((a) => !ids.has(a.id)));
      } else {
        principal = nuevas; // sin listener (no debería pasar en la APK): consulta puntual
      }
      unirLista();
      hayMas = snapshots.length === PAGINA;
      guardarCopia(p);
    } catch (e) {
      if (!esErrorDeRed(e)) { errorCarga = true; console.warn('Actividad: no se pudo cargar', e); }
    } finally {
      cargando = false;
      repintar();
    }
  }

  /** novedades.js la llama al mostrar la pestaña Social */
  function alAbrirSocial() {
    const p = perfil();
    if (!p) return;
    marcarVisto();
    listaActual(p);
    if (!escucha) {
      iniciarEscucha();
      if (!Store?.addCollectionSnapshotListener) cargar();
    }
  }

  // ---------- Reacciones ----------
  const reaccionando = new Set();

  async function quitarReaccion(id, uid) {
    let ultimoError = null;
    for (let intento = 0; intento < 2; intento++) {
      try {
        const { snapshot } = await conTiempo(Store.getDocument({ reference: `actividad/${id}` }));
        const actuales = { ...(snapshot?.data?.reacciones || {}) };
        if (!(uid in actuales)) return;
        delete actuales[uid];
        await conTiempo(Store.updateDocument({ reference: `actividad/${id}`, data: { reacciones: actuales } }));
        return;
      } catch (e) {
        ultimoError = e;
        if (!esPermisoDenegado(e)) break; // PERMISSION_DENIED aquí = otro reaccionó entre la lectura y la escritura
      }
    }
    throw ultimoError;
  }

  /** Tocar un emoji: lo pone, lo cambia o (si es el mismo) lo quita. Primero en pantalla, luego en la nube */
  async function reaccionar(a, clave, fila) {
    const p = perfil();
    if (!p || !Store || a.uid === p.uid) return;
    if (!hayInternet()) { avisar('Necesitas conexión para reaccionar'); return; }
    if (reaccionando.has(a.id)) return;
    reaccionando.add(a.id);
    const anterior = a.reacciones[p.uid] || null;
    const nueva = anterior === clave ? null : clave;
    const fijar = (v) => {
      if (v) a.reacciones[p.uid] = v; else delete a.reacciones[p.uid];
      pintarReacciones(fila, a, p);
    };
    fijar(nueva);
    try {
      if (nueva) {
        // La clave con punto actualiza solo reacciones.{uid} (update() de Firestore la toma como ruta)
        await conTiempo(Store.updateDocument({ reference: `actividad/${a.id}`, data: { [`reacciones.${p.uid}`]: nueva } }));
      } else {
        await quitarReaccion(a.id, p.uid);
      }
      guardarCopia(p);
    } catch (e) {
      console.warn('Actividad: no se pudo reaccionar', e);
      fijar(anterior);
      avisar(hayInternet() ? 'No se pudo guardar tu reacción. Inténtalo de nuevo.' : 'Necesitas conexión para reaccionar');
    } finally {
      reaccionando.delete(a.id);
    }
  }

  function pintarReacciones(fila, a, p) {
    fila.replaceChildren();
    const propia = a.uid === p.uid;
    const mia = a.reacciones[p.uid];
    const conteo = {};
    for (const c of Object.values(a.reacciones)) conteo[c] = (conteo[c] || 0) + 1;
    for (const r of REACCIONES) {
      const n = conteo[r.clave] || 0;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'notif-reaccion' + (mia === r.clave ? ' elegida' : '');
      b.setAttribute('aria-pressed', String(mia === r.clave));
      b.setAttribute('aria-label', `${r.nombre}: ${n}`);
      const emoji = document.createElement('span');
      emoji.className = 'notif-reaccion-emoji';
      emoji.setAttribute('aria-hidden', 'true');
      emoji.textContent = r.emoji;
      const numero = document.createElement('span');
      numero.className = 'notif-reaccion-numero';
      numero.textContent = String(n);
      b.append(emoji, numero);
      if (propia) {
        b.disabled = true;
        b.title = 'No puedes reaccionar a tu propia actividad';
      } else {
        b.addEventListener('click', (ev) => { ev.stopPropagation(); reaccionar(a, r.clave, fila); });
      }
      fila.appendChild(b);
    }
  }

  // ---------- Tarjetas ----------
  /** "CERCA VIVA" → "Cerca viva" (los nombres de plantas.json vienen en mayúsculas) */
  function nombreBonito(nombre) {
    const t = String(nombre || '').trim().toLocaleLowerCase('es');
    return t ? t.charAt(0).toLocaleUpperCase('es') + t.slice(1) : '';
  }

  function tarjeta(a, p, formatoFecha) {
    const propia = a.uid === p.uid;
    const item = document.createElement('div');
    item.className = `notif-item notif-actividad notif-actividad--${a.tipo}`;

    const icono = document.createElement('span');
    icono.className = 'notif-icono' + (a.tipo === 'logro' ? ' logro' : '');
    icono.setAttribute('aria-hidden', 'true');
    if (a.tipo === 'logro' && a.logro.icono) {
      const img = document.createElement('img');
      img.src = a.logro.icono;
      img.alt = '';
      img.onerror = () => { icono.textContent = '🏆'; };
      icono.appendChild(img);
    } else {
      icono.textContent = { union: '🎉', logro: '🏆', plantacion: '🌱' }[a.tipo];
    }

    const contenido = document.createElement('div');
    contenido.className = 'notif-contenido';
    const frase = document.createElement('p');
    frase.className = 'notif-text';
    const quien = document.createElement('strong');
    quien.className = 'notif-quien';
    quien.textContent = propia ? 'Tú' : '@' + (a.username || 'explorador');
    frase.appendChild(quien);
    if (a.tipo === 'union') {
      frase.append(propia ? ' te uniste a AVIAMAZ' : ' se unió a AVIAMAZ');
    } else if (a.tipo === 'logro') {
      frase.append(propia ? ' ganaste ' : ' ganó ');
      const insignia = document.createElement('span');
      insignia.className = 'notif-insignia logro';
      insignia.textContent = `🏆 ${a.logro.nombre}`;
      frase.appendChild(insignia);
    } else {
      const arbol = nombreBonito(a.arbol.nombre);
      const que = arbol ? `un árbol de ${arbol}` : 'un árbol';
      frase.append(propia ? ` plantaste ${que} en tu jardín` : ` plantó ${que} en su jardín`);
    }
    contenido.appendChild(frase);

    // Visitar jardín (jardin.js → visitarJardin): abre el jardín de esa persona en modo solo lectura.
    // Si ya se sabe que es privado (jardin-publico.js lo recuerda tras intentar visitarlo), se indica
    if (a.tipo === 'plantacion' && !propia && a.uid) {
      const privado = !!window.jardinPublico?.esPrivado?.(a.uid);
      const visitar = document.createElement('button');
      visitar.type = 'button';
      visitar.className = 'notif-visitar' + (privado ? ' privado' : '');
      visitar.dataset.uid = a.uid;
      visitar.textContent = privado ? 'Este jardín es privado 🔒' : '🌳 Visitar jardín';
      visitar.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (window.jardinPublico?.esPrivado?.(a.uid)) { avisar('Este jardín es privado 🔒'); return; }
        if (!hayInternet()) { avisar('Necesitas conexión para visitar jardines'); return; }
        if (!window.visitarJardin) { avisar('El jardín aún se está cargando. Inténtalo en un momento.'); return; }
        window.visitarJardin({ uid: a.uid });
      });
      contenido.appendChild(visitar);
    }

    const pie = document.createElement('div');
    pie.className = 'notif-pie';
    const fila = document.createElement('div');
    fila.className = 'notif-reacciones';
    fila.setAttribute('role', 'group');
    fila.setAttribute('aria-label', 'Reacciones');
    pintarReacciones(fila, a, p);
    const hora = document.createElement('span');
    hora.className = 'notif-time';
    hora.textContent = formatoFecha(a.fecha);
    pie.append(fila, hora);
    contenido.appendChild(pie);

    item.append(icono, contenido);
    return item;
  }

  function nota(textoNota, clase = '') {
    const p = document.createElement('p');
    p.className = 'notif-social-nota' + (clase ? ' ' + clase : '');
    p.setAttribute('role', 'status');
    p.textContent = textoNota;
    return p;
  }

  function invitacion() {
    const caja = document.createElement('div');
    caja.className = 'notif-invitacion';
    const t = document.createElement('p');
    t.textContent = 'Crea una cuenta para ver y celebrar lo que hacen otros exploradores 🌳';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'notif-invitacion-boton';
    b.textContent = 'Iniciar sesión o crear cuenta';
    b.addEventListener('click', () => {
      document.getElementById('notificationSidebar')?.classList.remove('active');
      window.cuenta?.abrir?.();
    });
    caja.append(t, b);
    return caja;
  }

  /**
   * Pinta la pestaña Social en `cont` (novedades.js): la actividad de Firestore mezclada por fecha con los
   * avisos sociales que llegaron por push (`avisos`, que dibuja `crearAviso` de novedades.js).
   */
  function pintar(cont, avisos, crearAviso, formatoFecha, textoVacio) {
    const p = perfil();
    if (!p) {
      cont.appendChild(invitacion());
      for (const n of avisos) cont.appendChild(crearAviso(n));
      return;
    }
    const actividades = listaActual(p);
    if (!hayInternet()) cont.appendChild(nota('📡 Sin conexión · mostrando lo último guardado', 'sin-red'));
    else if (errorCarga) cont.appendChild(nota('⚠️ No se pudo cargar la actividad. Inténtalo de nuevo en un momento.', 'error'));

    const mezcla = [
      ...avisos.map((n) => ({ ms: Date.parse(n.fecha) || 0, crear: () => crearAviso(n) })),
      ...actividades.map((a) => ({ ms: a.fecha, crear: () => tarjeta(a, p, formatoFecha) })),
    ].sort((x, y) => y.ms - x.ms);

    if (!mezcla.length) {
      const vacio = document.createElement('p');
      vacio.className = 'notif-vacio';
      vacio.textContent = cargando || (escucha && !recibido && hayInternet()) ? 'Cargando la actividad de la comunidad…' : textoVacio;
      cont.appendChild(vacio);
      return;
    }
    for (const m of mezcla) {
      try { cont.appendChild(m.crear()); } catch (e) { console.warn('Actividad: tarjeta', e); }
    }
    if (hayMas && hayInternet()) {
      const mas = document.createElement('button');
      mas.type = 'button';
      mas.className = 'notif-ver-mas';
      mas.disabled = cargando;
      mas.textContent = cargando ? 'Cargando…' : 'Ver más';
      mas.addEventListener('click', () => cargar({ mas: true }));
      cont.appendChild(mas);
    } else if (cargando) {
      cont.appendChild(nota('Cargando…'));
    }
  }

  // ---------- Cuenta ----------
  function limpiarMemoria() {
    principal = [];
    anteriores = [];
    lista = [];
    listaDe = null;
    hayMas = false;
    errorCarga = false;
    recibido = false;
    nuevasIds.clear();
  }

  /** Al cerrar sesión o eliminar la cuenta: se descarta lo que no alcanzó a publicarse */
  function alCerrarSesion() {
    detenerEscucha();
    [C.pendientes, C.social, C.visto, C.ultimaPlantacion].forEach(borrar);
    limpiarMemoria();
    repintar();
  }

  async function enGrupos(elementos, fn, tamano = 10) {
    for (let i = 0; i < elementos.length; i += tamano) await Promise.allSettled(elementos.slice(i, i + tamano).map(fn));
  }

  /** Al eliminar la cuenta: borra sus actividades y, si se puede, sus reacciones a las de otros */
  async function borrarDeUsuario(uid) {
    borrar(C.pendientes);
    if (!Store || !uid) return;
    const { snapshots = [] } = await conTiempo(Store.getCollection({
      reference: 'actividad',
      compositeFilter: { type: 'and', queryConstraints: [{ type: 'where', fieldPath: 'uid', opStr: '==', value: uid }] },
      queryConstraints: [{ type: 'limit', limit: 500 }],
    }));
    await enGrupos(snapshots, (s) => conTiempo(Store.deleteDocument({ reference: `actividad/${s.id}` })));
    try {
      const r = await conTiempo(Store.getCollection({
        reference: 'actividad',
        compositeFilter: { type: 'and', queryConstraints: [{ type: 'where', fieldPath: `reacciones.${uid}`, opStr: 'in', value: CLAVES_REACCION }] },
        queryConstraints: [{ type: 'limit', limit: 200 }],
      }));
      await enGrupos(r.snapshots || [], (s) => {
        const reacciones = { ...(s.data?.reacciones || {}) };
        delete reacciones[uid];
        return conTiempo(Store.updateDocument({ reference: `actividad/${s.id}`, data: { reacciones } }));
      });
    } catch (e) {
      console.warn('Actividad: no se pudieron quitar las reacciones de la cuenta', e);
    }
  }

  // ---------- Eventos ----------
  document.addEventListener('logroDesbloqueado', (e) => { alGanarLogro(e.detail?.logro).catch((err) => console.warn('Actividad: logro', err)); });
  document.addEventListener('arbolPlantado', (e) => { alPlantar(e.detail).catch((err) => console.warn('Actividad: plantación', err)); });
  // cuenta.js: hay sesión con perfil (al abrir la app o al iniciar sesión)
  document.addEventListener('sesionCambiada', (e) => {
    if (escucha && listaDe && listaDe !== e.detail?.uid) { detenerEscucha(); limpiarMemoria(); } // otra cuenta
    publicarPendientes();
    iniciarEscucha();
  });

  // El listener de Firestore se reconecta solo; aquí solo se arranca si no estaba y se redibuja la nota de red
  window.addEventListener('online', () => { publicarPendientes(); iniciarEscucha(); repintar(); });
  window.addEventListener('offline', repintar);
  // En segundo plano no se escucha (no gasta lecturas); al volver se reanuda
  const alCambiarPlano = (activa) => {
    if (activa) { publicarPendientes(); iniciarEscucha(); } else detenerEscucha();
  };
  const app = cap?.Plugins?.App;
  if (nativo && app?.addListener) {
    try {
      app.addListener('appStateChange', ({ isActive }) => alCambiarPlano(isActive))?.catch?.(() => {});
    } catch { /* sin plugin App */ }
  } else {
    document.addEventListener('visibilitychange', () => alCambiarPlano(!document.hidden));
  }

  sesionLista().then(() => { publicarPendientes(); iniciarEscucha(); });

  window.actividad = {
    pintar,
    alAbrirSocial,
    noLeidas: () => contarNoLeidas(),
    publicarUnion,
    publicarPendientes,
    descartarPendientes: () => borrar(C.pendientes),
    alCerrarSesion,
    borrarDeUsuario,
    REACCIONES,
    PROBABILIDAD_PLANTACION,
    MAX_PLANTACIONES_DIA,
  };
})();
