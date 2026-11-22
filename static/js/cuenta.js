/**
 * Cuentas de usuario con los plugins nativos de Capawesome (Capacitor 5):
 * @capacitor-firebase/authentication 5.4.1 (Google y correo/contraseña) y @capacitor-firebase/firestore 5.4.1.
 *
 * La cuenta es OPCIONAL. Reglas de diseño:
 *  - La app nunca espera a Firebase para abrirse: todo va en try/catch y con tiempo máximo.
 *  - Sin internet se puede seguir "sin cuenta"; con una sesión guardada se entra normal y se muestra
 *    la copia local del perfil (aviamaz_perfil).
 *  - Esta tarea es solo autenticación y perfil: NO sube ni borra el progreso (árboles, jardín).
 *  - En el navegador (FastAPI o Netlify) los plugins no existen: no se muestra la bienvenida y
 *    "Mi cuenta" avisa que las cuentas solo están en la app Android.
 *
 * Claves nuevas de localStorage (no se tocan las existentes):
 *  - aviamaz_perfil: { uid, nombreCompleto, username, email, fotoURL } — solo cuando el perfil está completo.
 *  - aviamaz_modoSinCuenta: 'true' si el usuario eligió "Continuar sin cuenta" (no se vuelve a mostrar la bienvenida).
 *
 * Firestore:
 *  - users/{uid}: { nombreCompleto, username, email, proveedor ('google' | 'password'), fotoURL?, creado }
 *  - usernames/{username}: { uid } — garantiza que el username sea único (ver firestore.rules).
 *  La versión 5.4.1 del plugin no trae writeBatch ni serverTimestamp (llegaron en la 6, que pide
 *  Capacitor 6). Por eso: primero se reserva usernames/{username} (si ya existe, las reglas rechazan la
 *  escritura), luego se crea users/{uid} y, si eso falla, se libera la reserva. `creado` es la fecha del
 *  celular en ISO 8601.
 */
(function () {
  const CLAVE_PERFIL = 'aviamaz_perfil';
  const CLAVE_SIN_CUENTA = 'aviamaz_modoSinCuenta';
  const ESPERA_RED_MS = 15000;           // tiempo máximo de cada llamada a Firebase
  const REAUTENTICAR_TRAS_MS = 5 * 60 * 1000; // Firebase pide un inicio de sesión reciente para borrar la cuenta
  const RE_USERNAME = /^[a-z0-9_.]{3,20}$/;
  const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const SIN_RED = 'No hay conexión a internet. Revisa tu conexión e inténtalo de nuevo.';
  const USERNAME_OCUPADO = 'Ese nombre de usuario ya está en uso';

  const cap = window.Capacitor;
  const nativo = !!cap?.isNativePlatform?.();
  const Auth = nativo ? cap.Plugins?.FirebaseAuthentication : null;
  const Store = nativo ? cap.Plugins?.FirebaseFirestore : null;
  const disponible = !!(Auth && Store);

  let usuario = null;               // usuario de Firebase Auth o null
  let perfil = leerPerfil();        // copia local del perfil completo o null
  let vistaActual = null;
  let historial = [];               // vistas anteriores, para "Volver"
  let primeraVez = false;           // la bienvenida salió sola al abrir la app
  let enviarVerificacion = false;   // cuenta de correo recién creada que aún no tiene perfil
  const esperandoCierre = [];       // promesas de esperarCierre()

  // ---------- Almacenamiento local (puede fallar; nunca debe romper la app) ----------
  function leer(clave) {
    try { return localStorage.getItem(clave); } catch { return null; }
  }
  function guardar(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento: se ignora */ }
  }
  function borrar(clave) {
    try { localStorage.removeItem(clave); } catch { /* se ignora */ }
  }
  function leerPerfil() {
    try {
      const p = JSON.parse(leer(CLAVE_PERFIL) || 'null');
      return p && p.uid && p.username ? p : null;
    } catch { return null; }
  }

  // ---------- Utilidades ----------
  const hayInternet = () => navigator.onLine !== false;

  function conTiempo(promesa, ms = ESPERA_RED_MS) {
    return Promise.race([
      promesa,
      new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms)),
    ]);
  }

  function esCancelacion(err) {
    return /cancel|12501|aborted/i.test(String(err?.message || err || ''));
  }

  function esPermisoDenegado(err) {
    return /PERMISSION_DENIED|insufficient permissions/i.test(String(err?.message || err || ''));
  }

  /** Traduce los errores de Firebase a mensajes en español para la persona */
  function traducirError(err) {
    if (err?.mensajeListo) return err.message; // ya viene en español
    const code = String(err?.code || '').toLowerCase();
    const msg = String(err?.message || err || '');
    const mapa = {
      'email-already-in-use': 'Ese correo ya está registrado. Prueba con "Ya tengo cuenta".',
      'invalid-email': 'El correo no tiene un formato válido.',
      'weak-password': 'La contraseña es muy débil. Usa al menos 8 caracteres y mezcla letras y números.',
      'wrong-password': 'El correo o la contraseña no coinciden.',
      'user-not-found': 'El correo o la contraseña no coinciden.',
      'invalid-credential': 'El correo o la contraseña no coinciden.',
      'invalid-login-credentials': 'El correo o la contraseña no coinciden.',
      'user-disabled': 'Esta cuenta está desactivada.',
      'too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
      'requires-recent-login': 'Por seguridad, vuelve a iniciar sesión e inténtalo de nuevo.',
      'operation-not-allowed': 'Este método de inicio de sesión no está activado.',
      'account-exists-with-different-credential': 'Ya hay una cuenta con ese correo. Entra con el método que usaste la primera vez.',
      'network-request-failed': SIN_RED,
    };
    if (mapa[code]) return mapa[code];
    if (!hayInternet() || msg === 'timeout' || /network|UNAVAILABLE|unreachable|timed? ?out|offline|internet/i.test(msg)) {
      return SIN_RED;
    }
    if (esPermisoDenegado(err)) return 'No tienes permiso para hacer esto. Inténtalo de nuevo.';
    if (/password is invalid|INVALID_PASSWORD|credential is incorrect/i.test(msg)) return mapa['wrong-password'];
    if (/already in use/i.test(msg)) return mapa['email-already-in-use'];
    console.warn('Cuenta: error sin traducir', err);
    return 'Algo salió mal. Inténtalo de nuevo en un momento.';
  }

  function proveedorDe(u) {
    const ids = (u?.providerData || []).map((p) => p.providerId);
    return ids.includes('google.com') ? 'google' : 'password';
  }

  // ---------- Firestore ----------
  async function leerDoc(referencia) {
    const { snapshot } = await conTiempo(Store.getDocument({ reference: referencia }));
    return snapshot?.data || null;
  }

  /** ¿El username está libre (o ya es de este uid)? */
  async function usernameLibre(nombre, uid) {
    const dueno = await leerDoc(`usernames/${nombre}`);
    return !dueno || (uid && dueno.uid === uid);
  }

  function errorUsername() {
    const e = new Error(USERNAME_OCUPADO);
    e.usernameOcupado = true;
    return e;
  }

  /** Reserva el username y crea users/{uid} (sin writeBatch en la 5.4.1: ver el comentario de arriba) */
  async function guardarPerfilNube({ uid, nombreCompleto, username, email, proveedor, fotoURL }) {
    const refNombre = `usernames/${username}`;
    const dueno = await leerDoc(refNombre);
    if (dueno && dueno.uid !== uid) throw errorUsername();
    const reservadoAhora = !dueno;
    if (reservadoAhora) {
      try {
        await conTiempo(Store.setDocument({ reference: refNombre, data: { uid } }));
      } catch (e) {
        throw esPermisoDenegado(e) ? errorUsername() : e; // otro lo tomó justo antes
      }
    }
    const datos = { nombreCompleto, username, email: email || '', proveedor, creado: new Date().toISOString() };
    if (fotoURL) datos.fotoURL = fotoURL;
    try {
      await conTiempo(Store.setDocument({ reference: `users/${uid}`, data: datos }));
    } catch (e) {
      if (reservadoAhora) Store.deleteDocument({ reference: refNombre }).catch(() => {});
      throw e;
    }
  }

  function marcarPerfilListo(datos) {
    perfil = {
      uid: datos.uid,
      nombreCompleto: datos.nombreCompleto,
      username: datos.username,
      email: datos.email || '',
      fotoURL: datos.fotoURL || null,
    };
    guardar(CLAVE_PERFIL, JSON.stringify(perfil));
    actualizarMenu();
    window.sincronizacion?.activar?.(perfil.uid); // respaldo del progreso en la nube (sincronizacion.js)
  }

  /** Tras iniciar sesión: si ya hay perfil en Firestore se marca listo; si no, se pide completarlo */
  async function trasIniciarSesion() {
    actualizarMenu(); // ya hay sesión, aunque falle la lectura del perfil
    let datos;
    try {
      datos = await leerDoc(`users/${usuario.uid}`);
    } catch (e) {
      // El inicio de sesión salió bien; lo que falló fue leer el perfil (sin red, o reglas de Firestore
      // sin publicar → PERMISSION_DENIED). Se dice así, para no parecer que la cuenta no existe.
      console.warn('Cuenta: no se pudo leer users/' + usuario.uid, e);
      const causa = esPermisoDenegado(e)
        ? 'El servidor rechazó la lectura del perfil (revisa las reglas de Firestore).'
        : traducirError(e);
      const err = new Error(`Iniciaste sesión, pero no pudimos cargar tu perfil. ${causa} Toca de nuevo para reintentar; también puedes hacerlo desde Menú → Mi cuenta.`);
      err.mensajeListo = true;
      throw err;
    }
    if (datos?.username) {
      marcarPerfilListo({ ...datos, uid: usuario.uid, email: datos.email || usuario.email });
      cerrar();
      saludar(`¡Hola, ${perfil.nombreCompleto.split(' ')[0]}!`);
    } else {
      abrirCompletar();
    }
  }

  // ---------- Interfaz ----------
  const $ = (id) => document.getElementById(id);
  const pantalla = $('cuentaPantalla');
  if (!pantalla) return;
  const titulo = $('cuentaTitulo');
  const sinRed = $('cuentaSinRed');
  const cargando = $('cuentaCargando');
  const botonCerrar = $('cuentaCerrar');
  const vistas = {};
  pantalla.querySelectorAll('.cuenta-vista').forEach((v) => { vistas[v.dataset.vista] = v; });
  const forms = {
    registro: $('cuentaFormRegistro'),
    ingreso: $('cuentaFormIngreso'),
    completar: $('cuentaFormCompletar'),
  };

  const VISTAS_CON_RED = ['bienvenida', 'registro', 'ingreso', 'completar'];

  function mostrarVista(nombre, { guardarHistorial = true } = {}) {
    if (vistaActual && guardarHistorial && vistaActual !== nombre) historial.push(vistaActual);
    vistaActual = nombre;
    for (const [n, v] of Object.entries(vistas)) v.hidden = n !== nombre;
    titulo.textContent = vistas[nombre]?.dataset.titulo || 'Mi cuenta';
    // En "Completa tu perfil" no hay X: se guarda o se cancela (cierra sesión)
    botonCerrar.hidden = nombre === 'completar';
    limpiarMensajes(vistas[nombre]);
    actualizarRed();
    pantalla.querySelector('.cuenta-tarjeta').scrollTop = 0;
  }

  function abrir(nombre, opciones = {}) {
    primeraVez = !!opciones.primeraVez;
    historial = [];
    vistaActual = null;
    pantalla.hidden = false;
    document.body.classList.add('cuenta-abierta');
    mostrarVista(nombre);
    // El foco va al primer control de la vista (accesibilidad)
    setTimeout(() => vistas[nombre]?.querySelector('input, button')?.focus({ preventScroll: true }), 50);
  }

  function cerrar() {
    if (pantalla.hidden) return;
    pantalla.hidden = true;
    document.body.classList.remove('cuenta-abierta');
    vistaActual = null;
    ocupado(false);
    esperandoCierre.splice(0).forEach((ok) => ok());
  }

  function volver() {
    const anterior = historial.pop();
    if (anterior) mostrarVista(anterior, { guardarHistorial: false });
    else cerrar();
  }

  function ocupado(si) {
    cargando.hidden = !si;
    pantalla.classList.toggle('cuenta-ocupada', si);
  }

  function limpiarMensajes(contenedor) {
    if (!contenedor) return;
    contenedor.querySelectorAll('.cuenta-error, .cuenta-aviso').forEach((p) => { p.hidden = true; p.textContent = ''; });
    contenedor.querySelectorAll('.cuenta-campo-error').forEach((s) => { s.textContent = ''; });
    contenedor.querySelectorAll('.cuenta-campo--error').forEach((c) => c.classList.remove('cuenta-campo--error'));
  }

  function mensaje(vista, texto, clase = 'cuenta-error') {
    const p = vistas[vista]?.querySelector('.' + clase);
    if (!p) return;
    p.textContent = texto;
    p.hidden = !texto;
  }

  function errorCampo(form, nombre, texto) {
    const campo = form.elements[nombre];
    const caja = nombre === 'acepto'
      ? form.querySelector('[data-error="acepto"]')
      : campo?.closest('.cuenta-campo')?.querySelector('.cuenta-campo-error');
    if (caja) caja.textContent = texto;
    campo?.closest('.cuenta-campo')?.classList.add('cuenta-campo--error');
  }

  /** Aviso "Necesitas internet" y botones que requieren red */
  function actualizarRed() {
    const conRed = hayInternet();
    sinRed.hidden = conRed || !VISTAS_CON_RED.includes(vistaActual);
    pantalla.querySelectorAll('[data-necesita-red]').forEach((b) => { b.disabled = !conRed; });
  }
  window.addEventListener('online', actualizarRed);
  window.addEventListener('offline', actualizarRed);

  /** Avatar: la foto de Google si carga; si no (o sin internet), la inicial del nombre */
  function pintarAvatar(el, datos) {
    el.textContent = '';
    const inicial = (datos?.nombreCompleto || datos?.username || '?').trim().charAt(0).toUpperCase() || '?';
    const ponerInicial = () => {
      el.textContent = '';
      const s = document.createElement('span');
      s.className = 'cuenta-inicial';
      s.textContent = inicial;
      el.appendChild(s);
    };
    if (datos?.fotoURL) {
      const img = document.createElement('img');
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.onerror = ponerInicial;
      img.src = datos.fotoURL;
      el.appendChild(img);
    } else {
      ponerInicial();
    }
  }

  const iconoMenuOriginal = $('menuCuentaAvatar')?.innerHTML || '';

  function actualizarMenu() {
    const avatar = $('menuCuentaAvatar');
    const tituloMenu = $('menuCuentaTitulo');
    const sub = $('menuCuentaSub');
    if (!avatar || !tituloMenu || !sub) return;
    if (usuario && perfil) {
      pintarAvatar(avatar, perfil);
      avatar.classList.add('cuenta-avatar--lleno');
      tituloMenu.textContent = perfil.nombreCompleto;
      sub.textContent = '@' + perfil.username;
    } else {
      avatar.innerHTML = iconoMenuOriginal;
      avatar.classList.remove('cuenta-avatar--lleno');
      tituloMenu.textContent = 'Mi cuenta';
      sub.textContent = usuario ? 'Completa tu perfil' : 'Iniciar sesión o crear cuenta';
    }
  }

  function pintarPerfil() {
    if (!perfil) return;
    pintarAvatar($('cuentaPerfilAvatar'), perfil);
    $('cuentaPerfilNombre').textContent = perfil.nombreCompleto;
    $('cuentaPerfilUsuario').textContent = '@' + perfil.username;
    $('cuentaPerfilCorreo').textContent = perfil.email || usuario?.email || '';
    $('cuentaVerificar').hidden = !(usuario && proveedorDe(usuario) === 'password' && !usuario.emailVerified);
    pintarDesde();
    pintarEstadisticas();
    pintarLogros();
    pintarSync();
  }

  /** "hace 2 min", "hace 3 h", "hace 2 días" o la fecha */
  function haceCuanto(ms) {
    const seg = Math.max(0, (Date.now() - ms) / 1000);
    if (seg < 60) return 'hace un momento';
    if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
    if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`;
    if (seg < 7 * 86400) { const d = Math.floor(seg / 86400); return `hace ${d} ${d === 1 ? 'día' : 'días'}`; }
    return 'el ' + new Date(ms).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  }

  /** Estado del respaldo en la nube (sincronizacion.js) */
  function pintarSync() {
    const caja = $('cuentaSync');
    const sync = window.sincronizacion;
    if (!caja || !sync?.activa?.()) { if (caja) caja.hidden = true; return; }
    const e = sync.estado();
    const textos = {
      sincronizando: ['🔄', 'Sincronizando…'],
      guardado: ['☁️', e.subido ? `Guardado en la nube · ${haceCuanto(e.subido)}` : 'Guardado en la nube'],
      pendiente: ['⏳', 'Cambios pendientes de subir'],
      'sin-red': ['📡', e.pendiente ? 'Sin conexión · cambios pendientes de subir' : 'Sin conexión'],
      error: ['⚠️', 'No se pudo sincronizar. Inténtalo de nuevo.'],
    };
    const [icono, texto] = textos[e.tipo] || textos.pendiente;
    $('cuentaSyncIcono').textContent = icono;
    $('cuentaSyncTexto').textContent = texto;
    caja.dataset.estado = e.tipo;
    caja.hidden = false;
    caja.querySelector('[data-accion="sincronizar"]').disabled = e.tipo === 'sincronizando' || !hayInternet();
  }
  document.addEventListener('sincronizacionEstado', () => { if (vistaActual === 'perfil') pintarSync(); });
  // Si bajó progreso de la nube, se actualizan las cantidades del perfil
  document.addEventListener('progresoSincronizado', () => {
    if (vistaActual === 'perfil') { pintarEstadisticas(); pintarLogros(); }
  });

  /** "Miembro desde el 22 de noviembre de 2026": fecha de creación de la cuenta que guarda Firebase Auth */
  function pintarDesde() {
    const el = $('cuentaPerfilDesde');
    const ms = Number(usuario?.metadata?.creationTime);
    if (!ms) { el.hidden = true; return; }
    try {
      const fecha = new Date(ms).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
      el.textContent = `🌱 Miembro desde el ${fecha}`;
      el.hidden = false;
    } catch { el.hidden = true; }
  }

  /** Cantidades guardadas en el celular. Solo se LEEN: no se toca jardinEstado ni los desbloqueos */
  async function pintarEstadisticas() {
    // Jardín: árboles plantados en sus parcelas (jardinEstado.plantados)
    let enJardin = 0;
    try {
      const jardin = JSON.parse(leer('jardinEstado') || 'null');
      enJardin = Object.values(jardin?.plantados || {}).filter(Boolean).length;
    } catch { /* sin jardín todavía */ }
    $('cuentaStatJardin').textContent = enJardin;

    // Álbum: mismo cálculo que el contador del herbario (album-handler.js): sin `bloqueado` o desbloqueado por QR
    try {
      const plantas = (await window.plantsHandler?.loadPlants?.()) || [];
      if (!plantas.length) throw new Error('sin catálogo');
      const enAlbum = plantas.filter((p) => !p.bloqueado || window.unlocker?.isUnlocked?.(p.codigoQR)).length;
      const numero = $('cuentaStatAlbum');
      numero.textContent = enAlbum;
      numero.appendChild(Object.assign(document.createElement('small'), { textContent: `/${plantas.length}` }));
    } catch {
      $('cuentaStatAlbum').textContent = window.unlocker?.getUnlockedCount?.() ?? 0;
    }
  }

  /**
   * Logros. Aún no existe el sistema: cuando exista, basta con que defina
   *   window.logros = { desbloqueados: () => [{ id, nombre, imagen }] }   // imagen = ruta, p. ej. /static/...
   * (puede devolver una promesa) y este apartado los mostrará con su imagen y su nombre.
   */
  async function pintarLogros() {
    let lista = [];
    try { lista = (await window.logros?.desbloqueados?.()) || []; } catch (e) { console.warn('Cuenta: logros', e); }
    const ul = $('cuentaLogrosLista');
    ul.textContent = '';
    for (const logro of lista) {
      const li = document.createElement('li');
      li.className = 'cuenta-logro';
      if (logro.imagen) {
        const img = document.createElement('img');
        img.src = logro.imagen;
        img.alt = '';
        img.onerror = () => img.replaceWith(Object.assign(document.createElement('span'), { className: 'cuenta-logro-sin-imagen', textContent: '🏆' }));
        li.appendChild(img);
      } else {
        li.appendChild(Object.assign(document.createElement('span'), { className: 'cuenta-logro-sin-imagen', textContent: '🏆' }));
      }
      li.appendChild(Object.assign(document.createElement('span'), { className: 'cuenta-logro-nombre', textContent: logro.nombre || 'Logro' }));
      ul.appendChild(li);
    }
    $('cuentaLogrosContador').textContent = lista.length;
    ul.hidden = !lista.length;
    $('cuentaLogrosVacio').hidden = !!lista.length;
  }

  async function abrirPerfil() {
    pintarPerfil();
    abrir('perfil');
    // Si hay red, se refresca si el correo ya se verificó (sin bloquear)
    if (hayInternet() && proveedorDe(usuario) === 'password' && !usuario.emailVerified) {
      try {
        await conTiempo(Auth.reload(), 8000);
        const r = await Auth.getCurrentUser();
        if (r.user) { usuario = r.user; pintarPerfil(); }
      } catch { /* se queda como estaba */ }
    }
  }

  function abrirCompletar() {
    const f = forms.completar;
    f.reset();
    f.elements.nombre.value = (usuario?.displayName || '').slice(0, 60);
    if (pantalla.hidden) abrir('completar');
    else mostrarVista('completar');
    historial = []; // desde aquí no se "vuelve": se guarda o se cancela
  }

  function saludar(texto) {
    if (typeof Swal === 'undefined') return;
    // Con la clase cuenta-swal el aviso queda encima de la barra de búsqueda (z-index 1100), no detrás
    Swal.fire({ toast: true, position: 'top', icon: 'success', title: texto, showConfirmButton: false, timer: 2500,
      customClass: { container: 'cuenta-swal' } });
  }

  /** Cierra una ventana de "cargando" sin dejar el estado de carga en la siguiente */
  function cerrarCarga() {
    if (Swal.isLoading?.()) Swal.hideLoading();
    Swal.close();
  }

  /** SweetAlert por encima de la pantalla de cuenta */
  function alerta(opciones) {
    // SweetAlert reutiliza la ventana: si la anterior estaba "cargando", la nueva saldría sin botones
    if (Swal.isLoading?.()) Swal.hideLoading();
    return Swal.fire({
      confirmButtonColor: '#025928',
      cancelButtonColor: '#5f6368',
      customClass: { container: 'cuenta-swal' },
      ...opciones,
    });
  }

  // ---------- Validaciones ----------
  function validarNombre(form) {
    const v = form.elements.nombre.value.trim().replace(/\s+/g, ' ');
    form.elements.nombre.value = v;
    if (v.length < 3 || v.length > 60) { errorCampo(form, 'nombre', 'Escribe tu nombre completo (de 3 a 60 caracteres).'); return null; }
    return v;
  }
  function validarUsername(form) {
    const v = form.elements.username.value.trim().toLowerCase();
    form.elements.username.value = v;
    if (!RE_USERNAME.test(v)) {
      errorCampo(form, 'username', 'Usa de 3 a 20 caracteres: letras minúsculas, números, _ o . (sin espacios).');
      return null;
    }
    return v;
  }
  function validarCorreo(form) {
    const v = form.elements.correo.value.trim();
    form.elements.correo.value = v;
    if (!RE_CORREO.test(v)) { errorCampo(form, 'correo', 'Escribe un correo válido, por ejemplo nombre@correo.com.'); return null; }
    return v;
  }
  function validarAcepto(form) {
    if (!form.elements.acepto.checked) { errorCampo(form, 'acepto', 'Debes aceptar el tratamiento de datos para crear la cuenta.'); return false; }
    return true;
  }

  // El username se escribe siempre en minúsculas y sin espacios
  pantalla.querySelectorAll('input[name="username"]').forEach((input) => {
    input.addEventListener('input', () => {
      const limpio = input.value.toLowerCase().replace(/\s+/g, '');
      if (limpio !== input.value) input.value = limpio;
    });
  });

  // ---------- Acciones ----------
  async function iniciarConGoogle() {
    if (!hayInternet()) return mensaje('bienvenida', SIN_RED);
    ocupado(true);
    try {
      const r = await Auth.signInWithGoogle();
      usuario = r.user;
      await trasIniciarSesion();
    } catch (e) {
      if (!esCancelacion(e)) mensaje(vistaActual || 'bienvenida', traducirError(e));
    } finally {
      ocupado(false);
    }
  }

  async function registrar(ev) {
    ev.preventDefault();
    const f = forms.registro;
    limpiarMensajes(vistas.registro);
    const nombre = validarNombre(f);
    const username = validarUsername(f);
    const correo = validarCorreo(f);
    const clave = f.elements.clave.value;
    let ok = !!(nombre && username && correo);
    if (clave.length < 8) { errorCampo(f, 'clave', 'La contraseña debe tener al menos 8 caracteres.'); ok = false; }
    if (f.elements.clave2.value !== clave) { errorCampo(f, 'clave2', 'Las contraseñas no coinciden.'); ok = false; }
    if (!validarAcepto(f)) ok = false;
    if (!ok) return;
    if (!hayInternet()) return mensaje('registro', SIN_RED);

    ocupado(true);
    try {
      // 1. ¿Username libre?
      if (!(await usernameLibre(username))) { errorCampo(f, 'username', USERNAME_OCUPADO); return; }
      // 2. Crear la cuenta en Firebase Auth
      const r = await conTiempo(Auth.createUserWithEmailAndPassword({ email: correo, password: clave }));
      usuario = r.user;
      enviarVerificacion = true;
      // 3. Nombre visible en Auth (si falla no importa: el perfil de Firestore manda)
      try { await conTiempo(Auth.updateProfile({ displayName: nombre })); } catch (e) { console.warn('Cuenta: updateProfile', e); }
      // 4. Reservar username y crear el perfil; si falla, se pide el username de nuevo
      try {
        await guardarPerfilNube({ uid: usuario.uid, nombreCompleto: nombre, username, email: correo, proveedor: 'password' });
      } catch (e) {
        abrirCompletar();
        forms.completar.elements.nombre.value = nombre;
        forms.completar.elements.acepto.checked = true;
        if (e.usernameOcupado) errorCampo(forms.completar, 'username', USERNAME_OCUPADO + '. Elige otro.');
        else mensaje('completar', 'Tu cuenta se creó, pero no pudimos guardar tu perfil. ' + traducirError(e));
        return;
      }
      marcarPerfilListo({ uid: usuario.uid, nombreCompleto: nombre, username, email: correo });
      // 5. Correo de verificación: se avisa, pero no se bloquea el uso de la app
      await terminarRegistro(correo);
    } catch (e) {
      const texto = traducirError(e);
      if (String(e?.code) === 'email-already-in-use' || /already in use/i.test(e?.message)) errorCampo(f, 'correo', texto);
      else if (String(e?.code) === 'weak-password') errorCampo(f, 'clave', texto);
      else mensaje('registro', texto);
    } finally {
      ocupado(false);
    }
  }

  async function terminarRegistro(correo) {
    let enviado = false;
    if (enviarVerificacion) {
      try { await conTiempo(Auth.sendEmailVerification()); enviado = true; } catch (e) { console.warn('Cuenta: verificación', e); }
      enviarVerificacion = false;
    }
    $('cuentaListoTexto').textContent = enviado
      ? `Te enviamos un correo a ${correo} para verificar tu dirección. Puedes seguir usando la app mientras tanto.`
      : 'Ya tienes tu cuenta. Puedes verificar tu correo más tarde desde Menú → Mi cuenta.';
    mostrarVista('listo');
    historial = [];
  }

  async function ingresar(ev) {
    ev.preventDefault();
    const f = forms.ingreso;
    limpiarMensajes(vistas.ingreso);
    const correo = validarCorreo(f);
    const clave = f.elements.clave.value;
    if (!clave) errorCampo(f, 'clave', 'Escribe tu contraseña.');
    if (!correo || !clave) return;
    if (!hayInternet()) return mensaje('ingreso', SIN_RED);
    ocupado(true);
    try {
      const r = await conTiempo(Auth.signInWithEmailAndPassword({ email: correo, password: clave }));
      usuario = r.user;
      await trasIniciarSesion();
    } catch (e) {
      mensaje('ingreso', traducirError(e));
    } finally {
      ocupado(false);
    }
  }

  async function olvideClave() {
    const f = forms.ingreso;
    limpiarMensajes(vistas.ingreso);
    const correo = validarCorreo(f);
    if (!correo) return;
    if (!hayInternet()) return mensaje('ingreso', SIN_RED);
    ocupado(true);
    try {
      await conTiempo(Auth.sendPasswordResetEmail({ email: correo }));
      mensaje('ingreso', `Si hay una cuenta con ${correo}, te llegará un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.`, 'cuenta-aviso');
    } catch (e) {
      mensaje('ingreso', traducirError(e));
    } finally {
      ocupado(false);
    }
  }

  async function completarPerfil(ev) {
    ev.preventDefault();
    const f = forms.completar;
    limpiarMensajes(vistas.completar);
    const nombre = validarNombre(f);
    const username = validarUsername(f);
    const acepta = validarAcepto(f);
    if (!nombre || !username || !acepta) return;
    if (!usuario) { mostrarVista('bienvenida'); return; }
    if (!hayInternet()) return mensaje('completar', SIN_RED);
    ocupado(true);
    try {
      if (!(await usernameLibre(username, usuario.uid))) { errorCampo(f, 'username', USERNAME_OCUPADO); return; }
      if (nombre !== usuario.displayName) {
        try { await conTiempo(Auth.updateProfile({ displayName: nombre })); } catch (e) { console.warn('Cuenta: updateProfile', e); }
      }
      const proveedor = proveedorDe(usuario);
      const datos = {
        uid: usuario.uid, nombreCompleto: nombre, username, email: usuario.email || '',
        proveedor, fotoURL: proveedor === 'google' ? usuario.photoUrl : null,
      };
      await guardarPerfilNube(datos);
      marcarPerfilListo(datos);
      if (enviarVerificacion) await terminarRegistro(datos.email);
      else { cerrar(); saludar(`¡Bienvenido, ${nombre.split(' ')[0]}!`); }
    } catch (e) {
      if (e.usernameOcupado) errorCampo(f, 'username', USERNAME_OCUPADO);
      else mensaje('completar', traducirError(e));
    } finally {
      ocupado(false);
    }
  }

  /** Salir de "Completa tu perfil" sin terminar: se cierra la sesión para no dejar una cuenta a medias activa */
  async function cancelarCompletar() {
    try { await Auth.signOut(); } catch (e) { console.warn('Cuenta: signOut', e); }
    usuario = null;
    enviarVerificacion = false;
    actualizarMenu();
    historial = [];
    mostrarVista('bienvenida', { guardarHistorial: false });
  }

  async function reenviarVerificacion() {
    if (!hayInternet()) return mensaje('perfil', SIN_RED);
    ocupado(true);
    try {
      await conTiempo(Auth.sendEmailVerification());
      mensaje('perfil', `Te enviamos el correo de verificación a ${perfil?.email || usuario?.email}.`, 'cuenta-aviso');
    } catch (e) {
      mensaje('perfil', traducirError(e));
    } finally {
      ocupado(false);
    }
  }

  async function cerrarSesion() {
    const r = await alerta({
      title: '¿Cerrar sesión?',
      html: 'Tu progreso queda guardado en tu cuenta y vuelve cuando inicies sesión. Este celular quedará como nuevo, en modo sin cuenta.'
        + '<br><br>📷 Tus fotos de árboles no se guardan en la cuenta: se quedan en este celular.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Cerrar sesión',
      cancelButtonText: 'Cancelar',
    });
    if (!r.isConfirmed) return;
    // Antes de salir se suben los avances pendientes; si no se puede (sin internet), se avisa
    const sync = window.sincronizacion;
    if (sync?.activa?.()) {
      const conRed = hayInternet(); // sin red no hay nada que esperar: se avisa directo
      if (conRed) alerta({ title: 'Guardando tu progreso…', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
      let subido = false;
      try { subido = await sync.antesDeCerrarSesion(); } catch (e) { console.warn('Cuenta: subir antes de salir', e); }
      if (conRed) cerrarCarga();
      if (!subido) {
        const r2 = await alerta({
          icon: 'warning',
          title: 'Avances sin guardar',
          text: 'Tienes avances sin guardar en tu cuenta. Conéctate a internet antes de cerrar sesión.',
          showCancelButton: true,
          confirmButtonText: 'Cerrar sesión igual',
          cancelButtonText: 'Cancelar',
          confirmButtonColor: '#c62828',
          focusCancel: true,
        });
        if (!r2.isConfirmed) return;
      }
    }
    try { await Auth.signOut(); } catch (e) { console.warn('Cuenta: signOut', e); }
    usuario = null;
    perfil = null;
    borrar(CLAVE_PERFIL);
    // El progreso local queda en blanco (está a salvo en la nube); las fotos no se tocan
    sync?.desactivar?.({ limpiar: true });
    actualizarMenu();
    cerrar();
    saludar('Sesión cerrada');
  }

  /**
   * Vuelve a pedir el inicio de sesión de la MISMA cuenta (Firebase lo exige para borrarla).
   * Devuelve true si se pudo.
   */
  async function reautenticar() {
    const uid = usuario.uid;
    if (proveedorDe(usuario) === 'google') {
      const r = await alerta({
        title: 'Confirma que eres tú',
        text: 'Por seguridad, vuelve a elegir tu cuenta de Google.',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cancelar',
      });
      if (!r.isConfirmed) return false;
      try {
        const res = await Auth.signInWithGoogle();
        if (res.user?.uid !== uid) {
          // Eligió otra cuenta: no se borra nada y la app queda con la cuenta elegida
          usuario = res.user;
          perfil = null;
          borrar(CLAVE_PERFIL);
          actualizarMenu();
          await alerta({ icon: 'warning', title: 'Elegiste otra cuenta', text: 'No se eliminó nada. Ahora estás con la cuenta que elegiste.' });
          try { await trasIniciarSesion(); } catch { cerrar(); }
          return false;
        }
        usuario = res.user;
        return true;
      } catch (e) {
        if (!esCancelacion(e)) await alerta({ icon: 'error', title: 'No se pudo confirmar', text: traducirError(e) });
        return false;
      }
    }
    // Correo y contraseña
    const email = usuario.email || perfil?.email;
    const r = await alerta({
      title: 'Confirma que eres tú',
      text: `Escribe la contraseña de ${email}.`,
      input: 'password',
      inputAttributes: { autocomplete: 'current-password', 'aria-label': 'Contraseña' },
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async (clave) => {
        if (!clave) { Swal.showValidationMessage('Escribe tu contraseña.'); return false; }
        try {
          const res = await conTiempo(Auth.signInWithEmailAndPassword({ email, password: clave }));
          usuario = res.user;
          return true;
        } catch (e) {
          Swal.showValidationMessage(traducirError(e));
          return false;
        }
      },
    });
    return !!r.isConfirmed;
  }

  async function eliminarCuenta() {
    if (!hayInternet()) {
      await alerta({ icon: 'info', title: 'Sin conexión', text: 'Necesitas internet para eliminar tu cuenta.' });
      return;
    }
    const conf = await alerta({
      title: '¿Eliminar tu cuenta?',
      html: 'Se borrarán tu cuenta, tu perfil (nombre, @usuario y correo) y tu progreso guardado en la nube. <b>No se puede deshacer.</b><br><br>Tus árboles y tu jardín se quedan en este celular.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#c62828',
      focusCancel: true,
    });
    if (!conf.isConfirmed) return;

    try {
      // Si el último inicio de sesión no es reciente, Firebase rechazaría el borrado: se pide antes
      const actual = (await Auth.getCurrentUser()).user;
      if (!actual) throw new Error('Sin sesión');
      usuario = actual;
      const ultimo = Number(actual.metadata?.lastSignInTime) || 0;
      if (Date.now() - ultimo > REAUTENTICAR_TRAS_MS && !(await reautenticar())) return;

      // Mientras se borra, ninguna subida programada debe volver a crear progreso/{uid}
      const sync = window.sincronizacion;
      await sync?.pausar?.();
      for (let intento = 0; intento < 2; intento++) {
        const uid = usuario.uid;
        const username = perfil?.username || (await leerDoc(`users/${uid}`).catch(() => null))?.username;
        const copia = await leerDoc(`users/${uid}`).catch(() => null);
        const copiaProgreso = sync ? await sync.leerNube(uid).catch(() => null) : null;

        alerta({ title: 'Eliminando cuenta…', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
        if (sync) await sync.borrarNube(uid);
        await conTiempo(Store.deleteDocument({ reference: `users/${uid}` }));
        if (username) await conTiempo(Store.deleteDocument({ reference: `usernames/${username}` }));
        // En la 5.4.1, deleteUser() responde "bien" aunque falle: se comprueba si la sesión sigue
        await conTiempo(Auth.deleteUser());
        const sigue = (await Auth.getCurrentUser()).user;
        if (!sigue) break;

        // Falló (casi siempre por inicio de sesión no reciente): se restaura el perfil y se reintenta una vez
        if (copia) {
          if (username) await Store.setDocument({ reference: `usernames/${username}`, data: { uid } }).catch(() => {});
          await Store.setDocument({ reference: `users/${uid}`, data: copia }).catch(() => {});
        }
        await sync?.restaurarNube(uid, copiaProgreso).catch(() => {});
        cerrarCarga();
        if (intento === 1 || !(await reautenticar())) {
          sync?.reanudar?.();
          await alerta({ icon: 'error', title: 'No se pudo eliminar', text: 'Vuelve a iniciar sesión e inténtalo de nuevo.' });
          return;
        }
      }

      try { await Auth.signOut(); } catch { /* ya no hay sesión */ }
      usuario = null;
      perfil = null;
      borrar(CLAVE_PERFIL);
      // El progreso del celular se conserva y pasa a ser de modo sin cuenta (se combina con la próxima cuenta)
      sync?.desactivar?.({ limpiar: false });
      actualizarMenu();
      cerrar();
      await alerta({ icon: 'success', title: 'Cuenta eliminada', text: 'Tu cuenta y tu perfil se borraron. Puedes seguir usando la app sin cuenta.' });
    } catch (e) {
      cerrarCarga();
      window.sincronizacion?.reanudar?.();
      await alerta({ icon: 'error', title: 'No se pudo eliminar', text: traducirError(e) });
    }
  }

  function continuarSinCuenta() {
    guardar(CLAVE_SIN_CUENTA, 'true');
    cerrar();
  }

  /** Botón "Mi cuenta" del menú */
  async function alTocarMenu() {
    if (!disponible) {
      Swal.fire({
        title: 'Mi cuenta',
        text: 'Las cuentas de usuario solo están disponibles en la app de Android.',
        icon: 'info',
        iconColor: '#03A65A',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#025928',
      });
      return;
    }
    if (usuario && perfil) return abrirPerfil();
    if (usuario) {
      // Sesión sin perfil completo: se revisa en Firestore
      if (!hayInternet()) {
        Swal.fire({ icon: 'info', title: 'Sin conexión', text: 'Necesitas internet para terminar tu perfil.', confirmButtonColor: '#025928' });
        return;
      }
      abrir('bienvenida');
      ocupado(true);
      try { await trasIniciarSesion(); }
      catch (e) { mensaje('bienvenida', traducirError(e)); }
      finally { ocupado(false); }
      return;
    }
    abrir('bienvenida');
  }

  // ---------- Eventos ----------
  pantalla.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-accion]');
    if (!b || b.disabled) return;
    switch (b.dataset.accion) {
      case 'google': iniciarConGoogle(); break;
      case 'ir-registro': mostrarVista('registro'); break;
      case 'ir-ingreso': mostrarVista('ingreso'); break;
      case 'sin-cuenta': continuarSinCuenta(); break;
      case 'volver': volver(); break;
      case 'cerrar': cerrar(); break;
      case 'olvide': olvideClave(); break;
      case 'ver-privacidad': mostrarVista('privacidad'); break;
      case 'cancelar-completar': cancelarCompletar(); break;
      case 'reenviar-verificacion': reenviarVerificacion(); break;
      case 'cerrar-sesion': cerrarSesion(); break;
      case 'eliminar-cuenta': eliminarCuenta(); break;
      case 'sincronizar': window.sincronizacion?.sincronizar?.().then(pintarSync); pintarSync(); break;
      case 'ver-clave': {
        const form = b.closest('form');
        const mostrar = b.getAttribute('aria-pressed') !== 'true';
        form.querySelectorAll('input[name="clave"], input[name="clave2"]').forEach((i) => { i.type = mostrar ? 'text' : 'password'; });
        b.setAttribute('aria-pressed', String(mostrar));
        b.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
        break;
      }
    }
  });

  // La X en la bienvenida que salió sola equivale a "Continuar sin cuenta"
  botonCerrar.addEventListener('click', () => (primeraVez && vistaActual === 'bienvenida' ? continuarSinCuenta() : cerrar()));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || pantalla.hidden || vistaActual === 'completar' || window.Swal?.isVisible?.()) return;
    botonCerrar.click();
  });

  forms.registro.addEventListener('submit', registrar);
  forms.ingreso.addEventListener('submit', ingresar);
  forms.completar.addEventListener('submit', completarPerfil);
  $('menuCuentaBtn')?.addEventListener('click', alTocarMenu);

  // ---------- Arranque (sin bloquear la app) ----------
  async function iniciar() {
    actualizarMenu();
    if (!disponible) return;

    try { usuario = (await conTiempo(Auth.getCurrentUser(), 5000)).user || null; } catch { usuario = null; }

    if (usuario) {
      if (perfil && perfil.uid !== usuario.uid) { perfil = null; borrar(CLAVE_PERFIL); }
      actualizarMenu();
      if (perfil) window.sincronizacion?.activar?.(usuario.uid); // sin red solo queda lista para cuando vuelva
      if (!hayInternet()) return; // sin red: se usa la copia local tal como está
      try {
        const datos = await leerDoc(`users/${usuario.uid}`);
        if (datos?.username) marcarPerfilListo({ ...datos, uid: usuario.uid, email: datos.email || usuario.email });
        else if (!perfil) abrirCompletar(); // sesión sin perfil (p. ej. se cerró la app en "Completa tu perfil")
      } catch (e) {
        console.warn('Cuenta: no se pudo refrescar el perfil', e);
      }
      return;
    }

    // Sin sesión: la copia local ya no sirve
    if (perfil) { perfil = null; borrar(CLAVE_PERFIL); actualizarMenu(); }
    if (leer(CLAVE_SIN_CUENTA) === 'true') return;
    abrir('bienvenida', { primeraVez: true }); // queda debajo del splash y aparece cuando este se desvanece
  }

  // API mínima para otros scripts
  window.cuenta = {
    /** Perfil local ({ uid, nombreCompleto, username, email, fotoURL }) o null */
    perfil: () => (usuario && perfil ? { ...perfil } : null),
    pantallaAbierta: () => !pantalla.hidden,
    /** Promesa que se cumple cuando la pantalla de cuenta está cerrada (la usa notificaciones.js) */
    esperarCierre: () => (pantalla.hidden ? Promise.resolve() : new Promise((ok) => esperandoCierre.push(ok))),
    abrir: alTocarMenu,
  };

  iniciar().catch((e) => console.warn('Cuenta: desactivada en este arranque', e));
})();
