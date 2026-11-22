/**
 * Jardín público: copia reducida del jardín de cada jugador en jardines/{uid} (Firestore), para que otros
 * lo visiten en modo solo lectura (jardin.js → visitarJardin) y le den "me gusta".
 *
 * progreso/{uid} sigue siendo privado: aquí solo va lo necesario para dibujar el jardín y el perfil.
 *   jardines/{uid} = {
 *     uid, username, fotoURL?, unido? (users/{uid}.creado, ISO),
 *     publico: true | false,                       // interruptor "Jardín visible para otros" (Mi cuenta)
 *     jardin: { celdas: ["col,fila"], plantados: { "<índice>": "<codigoQR>" }, accesorios: { "<codigoQR>": { "<zona>": "<id>" } } },
 *     stats: { arbolesJardin, arbolesAlbum },
 *     logros: [ids],                               // nombre e ícono salen del catálogo local (logros.js)
 *     actualizado: ISO del celular (el plugin 5.4.1 no trae serverTimestamp),
 *     likes: { <uid>: true }                       // solo lo escriben los visitantes; el dueño nunca lo toca
 *   }
 * Nunca se publican monedas, inventario sin colocar, regadera, riegos, sed ni nada más del progreso.
 * Firestore no acepta listas dentro de listas: celdas va como "col,fila" (igual que en progreso/{uid}).
 *
 * Cuándo se escribe: al final de cada pasada de sincronizacion.js (mismo debounce) y solo si cambió algo de
 * lo público (se compara una firma). El dueño usa updateDocument con sus campos (sin `likes`); si el
 * documento no existe, lo crea con likes: {}.
 *
 * Lecturas: 1 al visitar un jardín; con sesión, UN listener sobre jardines/{miUid} para ver los likes en
 * tiempo real y avisar de los nuevos con una notificación del sistema (1 lectura al empezar y 1 por cada
 * cambio del documento; ver "Likes del jardín propio en tiempo real"); 1 la primera vez que este celular publica (para saber si ya existe y su visibilidad) y 1 al quitar
 * un like solo si alguien más reaccionó entre la visita y el toque. Panel "Actividad" de Mi jardín: 1 lectura
 * de jardines/{miUid}, 1 de users/{uid} por cada persona que dio like (hasta 30 por vez, se recuerdan en
 * memoria) y 1 por resultado en cada búsqueda por @username (máximo 10).
 *
 * Claves de localStorage:
 *  - aviamaz_jardinPublico: { uid, firma, existe, publico, publicoSinSubir } estado de la copia de este celular
 *  - aviamaz_likesJardin: número de likes del jardín propio (para verlo sin conexión)
 *  - aviamaz_likesConocidos: { uid, uids } likes de los que ya se avisó (no se repite el aviso)
 *  - aviamaz_likesAvisoId: contador 0-99 para el id de la notificación (7200 + n)
 *
 * Expone window.jardinPublico (lo usan sincronizacion.js, cuenta.js, actividad.js y jardin.js).
 */
(function () {
  const C = {
    estado: 'aviamaz_jardinPublico',
    likes: 'aviamaz_likesJardin',
    conocidos: 'aviamaz_likesConocidos', // { uid, uids }: likes de los que ya se avisó (o que había al empezar)
    idAviso: 'aviamaz_likesAvisoId',     // 0-99: rota el id de la notificación (7200 + n)
  };
  const ESPERA_RED_MS = 15000;
  const PRIVADO_MS = 10 * 60 * 1000; // cuánto se recuerda que un jardín es privado antes de volver a probar
  const MAX_CELDAS = 36;              // PARCELAS_MAX de jardin-estado.js
  const ZONAS = ['cabeza', 'rostro', 'cuello'];

  const cap = window.Capacitor;
  const nativo = !!cap?.isNativePlatform?.();
  const Store = nativo ? cap.Plugins?.FirebaseFirestore : null;

  let enCurso = null;
  let repetir = false;
  let pausado = false;               // mientras se elimina la cuenta no se publica nada
  const privados = new Map();        // uid -> ms en que se vio privado

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
  const noExiste = (e) => /NOT_FOUND|No document to update|not found/i.test(String(e?.message || e || ''));
  const esErrorDeRed = (e) => !hayInternet() || /timeout|network|UNAVAILABLE|offline|unreachable/i.test(String(e?.message || e || ''));
  const perfil = () => window.cuenta?.perfil?.() || null;
  const contarLikes = (likes) => (likes && typeof likes === 'object' ? Object.values(likes).filter((v) => v === true).length : 0);
  const repintarSocial = () => { try { window.novedades?.render?.(); } catch { /* nada */ } };

  // ---------- Estado local de la copia ----------
  function leerLocal(uid) {
    const v = leerJSON(C.estado, null);
    if (v && v.uid === uid) return v;
    // Sin datos de esta cuenta en el celular: aún no se sabe si existe ni su visibilidad
    return { uid, firma: '', existe: null, publico: true, publicoSinSubir: false };
  }
  const guardarLocal = (v) => guardar(C.estado, JSON.stringify(v));

  /** Adopta lo que dice la nube (existencia, visibilidad y likes) sin pisar un cambio sin subir */
  function adoptarNube(uid, datos) {
    const local = leerLocal(uid);
    local.existe = !!datos;
    if (!datos) local.firma = '';
    if (datos && !local.publicoSinSubir) local.publico = datos.publico !== false;
    guardarLocal(local);
    if (datos) guardar(C.likes, String(contarLikes(datos.likes)));
    return local;
  }

  // ---------- Copia pública ----------
  async function arbolesEnAlbum() {
    // Mismo cálculo que el álbum y Mi cuenta: sin `bloqueado` o desbloqueado por QR
    try {
      const ph = window.plantsHandler;
      const plantas = ph?.plantas?.length ? ph.plantas : ((await ph?.loadPlants?.()) || []);
      if (plantas.length) return plantas.filter((p) => !p.bloqueado || window.unlocker?.isUnlocked?.(p.codigoQR)).length;
    } catch { /* sin catálogo */ }
    const unlocked = leerJSON('mapaSedAmazonia_unlockedPlants', {});
    return Object.values(unlocked || {}).filter((x) => x?.desbloqueado).length;
  }

  /** Arma la copia pública con lo que hay en el celular (sin `publico`, `likes` ni `actualizado`) */
  async function copiaPublica(p) {
    const local = leerJSON('jardinEstado', null) || {};
    const celdas = (Array.isArray(local.celdas) ? local.celdas : [])
      .filter((c) => Array.isArray(c) && c.length === 2 && c.every(Number.isInteger))
      .slice(0, MAX_CELDAS)
      .map((c) => `${c[0]},${c[1]}`);
    const plantados = {};
    const accesorios = {};
    for (const [indice, codigo] of Object.entries(local.plantados || {})) {
      const i = Number(indice);
      if (!Number.isInteger(i) || i < 0 || i >= celdas.length || typeof codigo !== 'string' || !codigo) continue;
      plantados[i] = codigo;
      const zonas = local.accesorios?.[codigo];
      if (!zonas || typeof zonas !== 'object') continue;
      const limpio = {};
      for (const z of ZONAS) if (typeof zonas[z] === 'string' && zonas[z]) limpio[z] = zonas[z];
      if (Object.keys(limpio).length) accesorios[codigo] = limpio;
    }
    const logros = Object.keys(leerJSON('aviamaz_logros', {})?.desbloqueados || {}).sort();
    const copia = {
      uid: p.uid,
      username: p.username,
      jardin: { celdas, plantados, accesorios },
      stats: { arbolesJardin: Object.keys(plantados).length, arbolesAlbum: await arbolesEnAlbum() },
      logros,
    };
    if (typeof p.fotoURL === 'string' && p.fotoURL) copia.fotoURL = p.fotoURL.slice(0, 500);
    if (typeof p.creado === 'string' && p.creado) copia.unido = p.creado;
    return copia;
  }

  async function leerDoc(uid) {
    const { snapshot } = await conTiempo(Store.getDocument({ reference: `jardines/${uid}` }));
    return snapshot?.data || null;
  }

  /** Una pasada: publica la copia si cambió algo de lo público */
  async function pasada() {
    const p = perfil();
    if (!p || !Store || pausado || !hayInternet()) return;
    let local = leerLocal(p.uid);
    if (local.existe === null) local = adoptarNube(p.uid, await leerDoc(p.uid)); // primera vez en este celular
    const copia = await copiaPublica(p);
    const firma = JSON.stringify(copia);
    if (local.existe && firma === local.firma && !local.publicoSinSubir) return;
    if (pausado || perfil()?.uid !== p.uid) return;

    const datos = { ...copia, actualizado: new Date().toISOString() };
    if (local.publicoSinSubir || !local.existe) datos.publico = local.publico !== false;
    const crear = () => conTiempo(Store.setDocument({
      reference: `jardines/${p.uid}`,
      data: { ...datos, publico: local.publico !== false, likes: {} },
    }));
    if (!local.existe) {
      await crear();
    } else {
      try {
        // update reemplaza cada campo de primer nivel (jardin, stats, logros...) y nunca toca `likes`
        await conTiempo(Store.updateDocument({ reference: `jardines/${p.uid}`, data: datos }));
      } catch (e) {
        if (!noExiste(e) && !esPermisoDenegado(e)) throw e;
        await crear(); // lo borraron (o nunca llegó a crearse): se crea con likes vacíos
      }
    }
    const despues = leerLocal(p.uid);
    guardarLocal({
      ...despues,
      firma,
      existe: true,
      // Si el interruptor cambió mientras se subía, queda pendiente para la próxima pasada
      publicoSinSubir: despues.publicoSinSubir && despues.publico !== local.publico,
    });
  }

  /** Publica la copia (sin bloquear a nadie). Devuelve true si quedó al día */
  function publicar() {
    if (enCurso) { repetir = true; return enCurso; }
    enCurso = (async () => {
      let ok = true;
      try {
        do {
          repetir = false;
          await pasada();
        } while (repetir);
      } catch (e) {
        ok = false;
        if (!esErrorDeRed(e)) console.warn('Jardín público: no se pudo publicar', e);
      } finally {
        enCurso = null;
      }
      const p = perfil();
      return ok && !!p && !leerLocal(p.uid).publicoSinSubir && leerLocal(p.uid).existe === true;
    })();
    return enCurso;
  }

  // ---------- Visibilidad (Mi cuenta → "Jardín visible para otros") ----------
  function visible() {
    const p = perfil();
    return p ? leerLocal(p.uid).publico !== false : true;
  }

  /** Cambia la visibilidad. Devuelve true si ya quedó guardada en la nube */
  async function cambiarVisible(valor) {
    const p = perfil();
    if (!p) return false;
    const local = leerLocal(p.uid);
    guardarLocal({ ...local, publico: !!valor, publicoSinSubir: true });
    if (!hayInternet() || !Store) return false;
    return publicar();
  }

  // ---------- Visitas ----------
  /** ¿Se sabe (desde hace poco) que el jardín de este uid es privado? */
  function esPrivado(uid) {
    const ms = privados.get(uid);
    if (ms && Date.now() - ms < PRIVADO_MS) return true;
    privados.delete(uid);
    return false;
  }

  function texto(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }

  /**
   * Lee jardines/{uid} para visitarlo. Una sola lectura.
   * Devuelve { estado: 'ok', datos } | { estado: 'privado' | 'noExiste' | 'sinRed' | 'sinCuenta' | 'error' }
   */
  async function leerParaVisita(uid) {
    const p = perfil();
    if (!p || !Store) return { estado: 'sinCuenta' };
    if (!hayInternet()) return { estado: 'sinRed' };
    try {
      const d = await leerDoc(uid);
      if (!d) return { estado: 'noExiste' };
      if (d.publico === false && uid !== p.uid) { privados.set(uid, Date.now()); repintarSocial(); return { estado: 'privado' }; }
      privados.delete(uid);
      const likes = {};
      if (d.likes && typeof d.likes === 'object') for (const [u, v] of Object.entries(d.likes)) if (v === true) likes[u] = true;
      return {
        estado: 'ok',
        datos: {
          uid,
          username: /^[a-z0-9_.]{1,20}$/.test(d.username || '') ? d.username : 'explorador',
          fotoURL: /^https:\/\//i.test(d.fotoURL || '') ? texto(d.fotoURL, 500) : '',
          unido: texto(d.unido, 40),
          jardin: d.jardin && typeof d.jardin === 'object' ? d.jardin : {},
          stats: {
            arbolesJardin: Number.isInteger(d.stats?.arbolesJardin) ? d.stats.arbolesJardin : 0,
            arbolesAlbum: Number.isInteger(d.stats?.arbolesAlbum) ? d.stats.arbolesAlbum : 0,
          },
          logros: Array.isArray(d.logros) ? d.logros.filter((x) => typeof x === 'string').slice(0, 200) : [],
          likes,
        },
      };
    } catch (e) {
      if (esPermisoDenegado(e)) { privados.set(uid, Date.now()); repintarSocial(); return { estado: 'privado' }; }
      if (esErrorDeRed(e)) return { estado: 'sinRed' };
      console.warn('Jardín público: no se pudo leer', uid, e);
      return { estado: 'error' };
    }
  }

  /**
   * Da o quita el like del usuario en el jardín `uid`. `likes` es el mapa que se está mostrando: se
   * actualiza en el lugar. Devuelve { ok, motivo?, likes }. Para quitar se escribe el mapa sin la clave
   * propia (el plugin 5.4.1 no trae deleteField); si alguien más reaccionó entretanto, las reglas lo
   * rechazan y se reintenta una vez con el mapa recién leído.
   */
  async function alternarLike(uid, likes) {
    const p = perfil();
    if (!p || !Store) return { ok: false, motivo: 'sinCuenta', likes };
    if (p.uid === uid) return { ok: false, motivo: 'propio', likes };
    if (!hayInternet()) return { ok: false, motivo: 'sinRed', likes };
    const ref = `jardines/${uid}`;
    try {
      if (!likes[p.uid]) {
        // La clave con punto actualiza solo likes.{uid}
        await conTiempo(Store.updateDocument({ reference: ref, data: { [`likes.${p.uid}`]: true } }));
        likes[p.uid] = true;
      } else {
        const sin = { ...likes };
        delete sin[p.uid];
        try {
          await conTiempo(Store.updateDocument({ reference: ref, data: { likes: sin } }));
          delete likes[p.uid];
        } catch (e) {
          if (!esPermisoDenegado(e)) throw e;
          const fresco = { ...((await leerDoc(uid))?.likes || {}) };
          if (fresco[p.uid]) {
            delete fresco[p.uid];
            await conTiempo(Store.updateDocument({ reference: ref, data: { likes: fresco } }));
          }
          for (const k of Object.keys(likes)) delete likes[k];
          for (const [k, v] of Object.entries(fresco)) if (v === true) likes[k] = true;
        }
      }
      return { ok: true, likes };
    } catch (e) {
      console.warn('Jardín público: no se pudo guardar el like', e);
      return { ok: false, motivo: esErrorDeRed(e) ? 'sinRed' : esPermisoDenegado(e) ? 'privado' : 'error', likes };
    }
  }

  // ---------- Likes del jardín propio ----------
  /** Último número guardado en el celular (null si nunca se leyó) */
  function likesGuardados() {
    const v = leer(C.likes);
    return v === null || v === '' ? null : Math.max(0, Number(v) || 0);
  }

  /** Lee una vez jardines/{miUid} y guarda el número de likes. Devuelve el número (o el guardado) */
  async function actualizarLikesPropios() {
    const p = perfil();
    if (!p || !Store || !hayInternet()) return likesGuardados();
    try {
      const d = await leerDoc(p.uid);
      adoptarNube(p.uid, d);
      if (!d) { guardar(C.likes, '0'); publicar(); } // aún no se había publicado: se publica ya
      return d ? contarLikes(d.likes) : 0;
    } catch (e) {
      if (!esErrorDeRed(e)) console.warn('Jardín público: no se pudieron leer los likes', e);
      return likesGuardados();
    }
  }

  // ---------- Likes del jardín propio en tiempo real y notificaciones ----------
  /*
   * UN listener para toda la app sobre jardines/{miUid} (el "vigía"), activo mientras haya sesión. No se
   * quita en segundo plano: un listener sin cambios no cobra lecturas y así se puede avisar de un like con
   * la app minimizada (mientras Android mantenga viva la app). Cuesta 1 lectura al empezar (o al reconectar
   * tras más de 30 min) y 1 por cada cambio del documento.
   *  - Mi jardín se suscribe con escucharLikesPropios() para el ❤️ en tiempo real.
   *  - Cada like NUEVO dispara una notificación local del sistema con el @username de quien lo dio
   *    (users/{uid}: 1 lectura por persona). No va a la pestaña Social ni a Novedades.
   * Sin servidor (plan gratuito, sin Cloud Functions) no hay push: con la app cerrada del todo no llega
   * nada en ese momento; al abrirla, el vigía compara con aviamaz_likesConocidos y avisa de los nuevos.
   */
  const ICONO_PEQUENO = 'ic_notificacion_jardin'; // los mismos del aviso de sed (jardin-notificaciones.js)
  const ICONO_GRANDE = 'ic_jardin_grande';
  const ID_AVISO_LIKE = 7200;                     // 7200-7299 (notificaciones.js no los pasa a Novedades)
  const MAX_NOMBRES = 3;
  const suscriptores = new Set();
  const vigia = { id: null, uid: null, primera: true, ultimo: null }; // id: callbackId | 'iniciando' | null

  function avisosLocales() { return nativo ? cap?.Plugins?.LocalNotifications || null : null; }

  /** Avisa en la barra del sistema de los likes nuevos (uno o un resumen si llegaron varios juntos) */
  async function notificarLikes(nuevos) {
    const ln = avisosLocales();
    if (!ln || !nuevos.length) return;
    try {
      let { display } = await ln.checkPermissions();
      if (display === 'prompt' || display === 'prompt-with-rationale') ({ display } = await ln.requestPermissions());
      if (display !== 'granted') return;
      const usuarios = await perfilesDe(nuevos.slice(0, MAX_NOMBRES));
      const nombres = usuarios.map((u) => '@' + u.username);
      const resto = nuevos.length - nombres.length;
      let title;
      let body;
      if (nuevos.length === 1) {
        title = `❤️ A ${nombres[0] || 'alguien'} le gustó tu jardín`;
        body = 'Entra a Mi jardín y toca Actividad para ver quién más le dio me gusta.';
      } else {
        title = `❤️ ${nuevos.length} nuevos me gusta en tu jardín`;
        const lista = nombres.length ? nombres.join(', ') + (resto > 0 ? ` y ${resto} más` : '') : `${nuevos.length} exploradores`;
        body = `${lista} le dieron me gusta a tu jardín.`;
      }
      const n = (Number(leer(C.idAviso)) + 1) % 100 || 0;
      guardar(C.idAviso, String(n));
      await ln.schedule({
        notifications: [{
          id: ID_AVISO_LIKE + n,
          title,
          body,
          smallIcon: ICONO_PEQUENO,
          largeIcon: ICONO_GRANDE,
          extra: { abrir: 'jardin' }, // tocarla abre Mi jardín (jardin-notificaciones.js → alTocarAviso)
        }],
      });
    } catch (e) {
      console.warn('Jardín público: no se pudo avisar del like', e);
    }
  }

  /**
   * Compara con los likes que este celular ya conoce. La primera vez de cada cuenta solo los guarda (no
   * avisa de los likes viejos). Si alguien quita y vuelve a dar like, no se repite el aviso.
   */
  function revisarNuevos(uid, uids) {
    const guardado = leerJSON(C.conocidos, null);
    if (!guardado || guardado.uid !== uid || !Array.isArray(guardado.uids)) {
      guardar(C.conocidos, JSON.stringify({ uid, uids }));
      return;
    }
    const conocidos = new Set(guardado.uids);
    const nuevos = uids.filter((u) => !conocidos.has(u));
    if (!nuevos.length) return;
    guardar(C.conocidos, JSON.stringify({ uid, uids: [...conocidos, ...nuevos].slice(-1000) }));
    notificarLikes(nuevos);
  }

  function alSnapshotVigia(uid, evento, error) {
    if (vigia.uid !== uid || perfil()?.uid !== uid) return;
    if (error) {
      if (!esErrorDeRed(error)) console.warn('Jardín público: listener de likes', error);
      detenerVigia(); // se vuelve a poner al recuperar la conexión o al volver a la app
      return;
    }
    const d = evento?.snapshot?.data || null;
    adoptarNube(uid, d);
    if (!d) guardar(C.likes, '0');
    const uids = Object.entries(d?.likes || {}).filter(([, v]) => v === true).map(([u]) => u);
    const inicial = vigia.primera;
    vigia.primera = false;
    vigia.ultimo = { n: uids.length, uids };
    suscriptores.forEach((fn) => { try { fn(uids.length, uids, inicial); } catch (e) { console.warn(e); } });
    revisarNuevos(uid, uids);
    if (!d && inicial) publicar(); // aún no se había publicado
  }

  async function iniciarVigia() {
    const p = perfil();
    if (!p || !Store?.addDocumentSnapshotListener || vigia.id || pausado || !hayInternet()) return;
    vigia.id = 'iniciando';
    vigia.uid = p.uid;
    vigia.primera = true;
    try {
      const id = await Store.addDocumentSnapshotListener({ reference: `jardines/${p.uid}` }, (e, err) => alSnapshotVigia(p.uid, e, err));
      if (vigia.id !== 'iniciando' || vigia.uid !== p.uid || perfil()?.uid !== p.uid) {
        Store.removeSnapshotListener({ callbackId: id }).catch(() => {}); // se pidió detener mientras arrancaba
        if (vigia.id === 'iniciando') vigia.id = null;
        return;
      }
      vigia.id = id;
    } catch (e) {
      vigia.id = null;
      console.warn('Jardín público: no se pudo escuchar los likes', e);
    }
  }

  function detenerVigia() {
    const id = vigia.id;
    vigia.id = null;
    vigia.ultimo = null;
    if (id && id !== 'iniciando') Store?.removeSnapshotListener?.({ callbackId: id })?.catch?.(() => {});
  }

  /**
   * Mi jardín: recibe el total de likes en tiempo real. `alCambiar(n, uids, inicial)`; `inicial` = primer
   * valor (sin animación). Sin red muestra el último número guardado. Devuelve la función para dejar de oír.
   */
  function escucharLikesPropios(alCambiar) {
    if (!perfil()) return () => {};
    if (!Store?.addDocumentSnapshotListener) {
      actualizarLikesPropios().then((n) => { if (n !== null) alCambiar(n, null, true); });
      return () => {};
    }
    suscriptores.add(alCambiar);
    if (vigia.ultimo) alCambiar(vigia.ultimo.n, vigia.ultimo.uids, true);
    else { const n = likesGuardados(); if (n !== null) alCambiar(n, null, true); }
    iniciarVigia();
    return () => suscriptores.delete(alCambiar);
  }

  // Arranca con la sesión y se reanuda al recuperar la conexión o al volver a la app (si se cayó)
  document.addEventListener('sesionCambiada', (e) => {
    if (vigia.uid && vigia.uid !== e.detail?.uid) detenerVigia();
    iniciarVigia();
  });
  // cuenta.js se carga después de este archivo: se espera a que exista su promesa `listo`
  window.addEventListener('load', () => { window.cuenta?.listo?.then?.(() => iniciarVigia()); });
  window.addEventListener('online', () => iniciarVigia());
  const appVigia = cap?.Plugins?.App;
  if (nativo && appVigia?.addListener) {
    try { appVigia.addListener('appStateChange', ({ isActive }) => { if (isActive) iniciarVigia(); })?.catch?.(() => {}); } catch { /* sin plugin App */ }
  }

  // ---------- Actividad del jardín propio (jardin-ui.js → panel "Actividad") ----------
  const perfiles = new Map(); // uid -> { uid, username, fotoURL } (solo en memoria, mientras la app está abierta)
  const RE_USERNAME = /^[a-z0-9_.]{1,20}$/;

  function perfilPublico(uid, d) {
    if (!d || !RE_USERNAME.test(d.username || '')) return null;
    const p = { uid, username: d.username, fotoURL: /^https:\/\//i.test(d.fotoURL || '') ? texto(d.fotoURL, 500) : '' };
    perfiles.set(uid, p);
    return p;
  }

  /**
   * Quiénes le dieron like al jardín propio: lee jardines/{miUid} (1 lectura) y devuelve
   * { estado: 'ok', uids } (el número también queda en aviamaz_likesJardin) o { estado: 'sinRed' | 'sinCuenta' | 'error' }.
   */
  async function likesRecibidos() {
    const p = perfil();
    if (!p || !Store) return { estado: 'sinCuenta' };
    if (!hayInternet()) return { estado: 'sinRed' };
    try {
      const d = await leerDoc(p.uid);
      adoptarNube(p.uid, d);
      if (!d) guardar(C.likes, '0');
      const uids = Object.entries(d?.likes || {}).filter(([, v]) => v === true).map(([u]) => u);
      return { estado: 'ok', uids };
    } catch (e) {
      if (esErrorDeRed(e)) return { estado: 'sinRed' };
      console.warn('Jardín público: no se pudieron leer los likes', e);
      return { estado: 'error' };
    }
  }

  /**
   * @username y foto de cada uid (users/{uid}: 1 lectura por cada uno que no esté ya en memoria).
   * Devuelve la lista en el mismo orden; los que no se pudieron leer (cuenta borrada) se omiten.
   */
  async function perfilesDe(uids) {
    const faltan = uids.filter((u) => !perfiles.has(u));
    for (let i = 0; i < faltan.length; i += 10) {
      await Promise.allSettled(faltan.slice(i, i + 10).map(async (u) => {
        const { snapshot } = await conTiempo(Store.getDocument({ reference: `users/${u}` }));
        perfilPublico(u, snapshot?.data);
      }));
    }
    return uids.map((u) => perfiles.get(u)).filter(Boolean);
  }

  /**
   * Busca usuarios cuyo @username empiece por `textoBuscado` (users ordenado por username, máximo
   * `limite`; se cobra 1 lectura por resultado, mínimo 1). Devuelve { estado, usuarios }.
   */
  async function buscarUsuarios(textoBuscado, limite = 10) {
    const p = perfil();
    if (!p || !Store) return { estado: 'sinCuenta', usuarios: [] };
    const q = String(textoBuscado || '').trim().toLowerCase().replace(/^@/, '');
    if (!RE_USERNAME.test(q)) return { estado: 'ok', usuarios: [] };
    if (!hayInternet()) return { estado: 'sinRed', usuarios: [] };
    try {
      const { snapshots = [] } = await conTiempo(Store.getCollection({
        reference: 'users',
        compositeFilter: {
          type: 'and',
          queryConstraints: [
            { type: 'where', fieldPath: 'username', opStr: '>=', value: q },
            { type: 'where', fieldPath: 'username', opStr: '<=', value: q + '' },
          ],
        },
        queryConstraints: [{ type: 'orderBy', fieldPath: 'username', directionStr: 'asc' }, { type: 'limit', limit: limite }],
      }));
      return { estado: 'ok', usuarios: snapshots.map((s) => perfilPublico(s.id, s.data)).filter(Boolean) };
    } catch (e) {
      if (esErrorDeRed(e)) return { estado: 'sinRed', usuarios: [] };
      console.warn('Jardín público: no se pudo buscar', e);
      return { estado: 'error', usuarios: [] };
    }
  }

  // ---------- Cuenta ----------
  /** Al eliminar la cuenta: borra su jardín público y, si se puede, sus likes en jardines públicos de otros */
  async function borrarDeUsuario(uid) {
    pausado = true;
    detenerVigia();
    if (!Store || !uid) return;
    await conTiempo(Store.deleteDocument({ reference: `jardines/${uid}` }));
    borrar(C.estado);
    try {
      // `publico == true` hace falta para que la consulta cumpla la regla de lectura
      const { snapshots = [] } = await conTiempo(Store.getCollection({
        reference: 'jardines',
        compositeFilter: {
          type: 'and',
          queryConstraints: [
            { type: 'where', fieldPath: `likes.${uid}`, opStr: '==', value: true },
            { type: 'where', fieldPath: 'publico', opStr: '==', value: true },
          ],
        },
        queryConstraints: [{ type: 'limit', limit: 200 }],
      }));
      for (let i = 0; i < snapshots.length; i += 10) {
        await Promise.allSettled(snapshots.slice(i, i + 10).map((s) => {
          const likes = { ...(s.data?.likes || {}) };
          delete likes[uid];
          return conTiempo(Store.updateDocument({ reference: `jardines/${s.id}`, data: { likes } }));
        }));
      }
    } catch (e) {
      console.warn('Jardín público: no se pudieron quitar los likes de la cuenta', e);
    }
  }

  /** Al cerrar sesión o tras eliminar la cuenta */
  function alCerrarSesion() {
    detenerVigia();
    vigia.uid = null;
    [C.estado, C.likes, C.conocidos, C.idAviso].forEach(borrar);
    privados.clear();
    perfiles.clear();
    pausado = false;
  }

  // Lo que quedó sin subir (p. ej. el interruptor cambiado sin conexión) se manda al volver la red
  window.addEventListener('online', () => { if (perfil()) publicar(); });

  window.jardinPublico = {
    publicar,
    visible,
    cambiarVisible,
    esPrivado,
    leerParaVisita,
    alternarLike,
    contarLikes,
    likesGuardados,
    actualizarLikesPropios,
    escucharLikesPropios,
    likesRecibidos,
    perfilesDe,
    buscarUsuarios,
    borrarDeUsuario,
    alCerrarSesion,
    reanudar: () => { pausado = false; iniciarVigia(); },
  };
})();
