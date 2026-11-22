/**
 * Notificaciones push con Firebase Cloud Messaging (@capacitor/push-notifications).
 *
 * Solo corre en la app Android; en el navegador (FastAPI o Netlify) no hace nada.
 * Es opcional por diseño: todo va en try/catch y nada se espera con await en el arranque, así que
 * sin internet, sin Google Play Services o si Firebase falla, la app funciona igual que antes.
 * No toca las claves existentes de localStorage; solo usa estas dos nuevas:
 *  - aviamaz_fcmToken: token del dispositivo (para enviar mensajes de prueba desde la consola).
 *  - aviamaz_pushRechazado: '1' si el usuario dijo que no; entonces no se vuelve a preguntar.
 *
 * Si el mensaje trae data.seccion = 'mapa' | 'jardin' | 'album', al tocarlo se abre esa sección.
 * Cada aviso se guarda en el panel "Novedades del Campus" (novedades.js, clave aviamaz_novedades).
 */
(function () {
  const CANAL = 'aviamaz_general';
  const CLAVE_TOKEN = 'aviamaz_fcmToken';
  const CLAVE_RECHAZO = 'aviamaz_pushRechazado';
  const ESPERA_PREGUNTA_MS = 4000; // deja que la app termine de abrir antes de preguntar
  const ID_AVISO_JARDIN = 7101;    // notificación local "Tus árboles tienen sed" (jardin-notificaciones.js)
  const ID_AVISOS_LIKE = [7200, 7299]; // notificaciones locales de "me gusta" (jardin-publico.js)

  function plugin() {
    const cap = window.Capacitor;
    if (!cap?.isNativePlatform?.()) return null;
    return cap.Plugins?.PushNotifications || null;
  }

  // localStorage puede fallar (almacenamiento lleno o bloqueado); eso no debe afectar la app
  function leer(clave) {
    try { return localStorage.getItem(clave); } catch { return null; }
  }
  function guardar(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento: se ignora */ }
  }

  /** Aviso flotante dentro de la app (Android no muestra la notificación en primer plano) */
  function mostrarToast(titulo, cuerpo, alTocar) {
    if (!document.getElementById('pushToastEstilos')) {
      const estilos = document.createElement('style');
      estilos.id = 'pushToastEstilos';
      estilos.textContent = `
        .push-toast { position: fixed; left: 50%; top: calc(12px + env(safe-area-inset-top, 0px));
          transform: translate(-50%, -150%); z-index: 100000; width: min(92vw, 420px);
          background: #025928; color: #fff; border-radius: 12px; padding: 12px 16px;
          box-shadow: 0 6px 20px rgba(0,0,0,.3); font-family: inherit; cursor: pointer;
          transition: transform .3s ease; }
        .push-toast.visible { transform: translate(-50%, 0); }
        .push-toast strong { display: block; font-size: 15px; margin-bottom: 2px; }
        .push-toast span { display: block; font-size: 14px; opacity: .92; }`;
      document.head.appendChild(estilos);
    }
    document.querySelector('.push-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'push-toast';
    toast.setAttribute('role', 'status');
    const t = document.createElement('strong');
    t.textContent = titulo || 'AVIAMAZ';
    toast.appendChild(t);
    if (cuerpo) {
      const c = document.createElement('span');
      c.textContent = cuerpo;
      toast.appendChild(c);
    }
    const cerrar = () => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 350);
    };
    toast.addEventListener('click', () => { cerrar(); alTocar?.(); });
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(cerrar, 6000);
  }

  /** Abre la sección indicada en data.seccion (la lógica está en novedades.js) */
  function abrirSeccion(seccion) {
    window.novedades?.abrirSeccion(seccion);
  }

  /**
   * Guarda un aviso en el panel "Novedades del Campus" (novedades.js).
   * El título y el cuerpo pueden venir también en data.titulo / data.cuerpo: al tocar una
   * notificación que llegó con la app en segundo plano, Android solo entrega el id y los datos.
   */
  function guardarNovedad(n, idAlterno) {
    try {
      const data = n?.data || {};
      let titulo = n?.title || data.titulo;
      const cuerpo = n?.body || data.cuerpo;
      // Al tocar una notificación con la app cerrada o en segundo plano, Firebase no le pasa a la app el
      // título ni el texto (solo los datos personalizados). Sin data.titulo / data.cuerpo se guarda igual,
      // con un título genérico, para que el aviso no se pierda.
      if (!titulo && !cuerpo && !data.logro) {
        console.warn('Push: el aviso llegó sin titulo ni cuerpo en los datos personalizados; se guarda con un título genérico');
        titulo = 'Nuevo aviso de AVIAMAZ';
      }
      window.novedades?.agregar({
        id: n?.id || data['google.message_id'] || idAlterno,
        titulo,
        cuerpo,
        tipo: data.tipo,
        seccion: data.seccion,
        logro: data.logro,
        persona: data.persona,
      });
    } catch (err) {
      console.warn('Push: no se pudo guardar la novedad', err);
    }
  }

  /**
   * Guarda los avisos que siguen en la barra del sistema (llegaron con la app cerrada o en
   * segundo plano y no se tocaron). Se salta el aviso de sed del jardín (notificación local con id
   * ID_AVISO_JARDIN) y los resúmenes de grupo. No se exige que la etiqueta empiece por
   * "FCM-Notification" porque en algunos celulares puede venir distinta. Android no entrega aquí el
   * id del mensaje ni sus datos (tipo, seccion), así que se usa la etiqueta (o el id) como id.
   */
  async function revisarBandeja(push) {
    try {
      const { notifications = [] } = await push.getDeliveredNotifications();
      if (notifications.length) console.info('Push: avisos en la barra', notifications.map((n) => ({ id: n.id, tag: n.tag, title: n.title })));
      for (const n of notifications) {
        if (Number(n.id) === ID_AVISO_JARDIN || n.groupSummary) continue;
        // Avisos locales de "me gusta" en tu jardín (jardin-publico.js): no van a Novedades ni a Social
        if (Number(n.id) >= ID_AVISOS_LIKE[0] && Number(n.id) <= ID_AVISOS_LIKE[1]) continue;
        if (!n.title && !n.body) continue;
        guardarNovedad({ title: n.title, body: n.body }, `bandeja:${n.tag || n.id}`);
      }
    } catch (err) {
      console.warn('Push: no se pudo leer la barra de notificaciones', err);
    }
  }

  /** Vuelve a revisar la barra cada vez que la app pasa a primer plano */
  function alVolver(push) {
    const app = window.Capacitor?.Plugins?.App;
    if (app?.addListener) {
      app.addListener('appStateChange', ({ isActive }) => { if (isActive) revisarBandeja(push); })
        ?.catch?.((err) => console.warn('Push: sin appStateChange', err));
    } else {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') revisarBandeja(push);
      });
    }
  }

  /** Mensaje propio antes del permiso del sistema; devuelve true si el usuario acepta */
  async function preguntarAntes() {
    if (typeof Swal === 'undefined') return true; // sin SweetAlert se pasa directo al permiso
    // Si ya hay otra ventana abierta no se interrumpe; se pregunta en otro arranque
    if (Swal.isVisible()) return null;
    const r = await Swal.fire({
      title: 'Avisos',
      text: '¿Quieres recibir avisos de eventos y árboles nuevos?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, avisarme',
      cancelButtonText: 'No, gracias',
      confirmButtonColor: '#025928',
    });
    return r.isConfirmed;
  }

  async function iniciar() {
    const push = plugin();
    if (!push) return;

    // Los listeners van primero: si la app se abrió tocando una notificación, el evento
    // pushNotificationActionPerformed queda guardado hasta que alguien lo escuche
    await push.addListener('registration', (token) => {
      guardar(CLAVE_TOKEN, token.value);
      console.log('Push: token FCM =', token.value);
    });
    await push.addListener('registrationError', (err) => {
      console.warn('Push: error de registro', err);
    });
    await push.addListener('pushNotificationReceived', (n) => {
      guardarNovedad(n);
      mostrarToast(n.title, n.body, () => abrirSeccion(n.data?.seccion));
    });
    await push.addListener('pushNotificationActionPerformed', (accion) => {
      guardarNovedad(accion.notification);
      abrirSeccion(accion.notification?.data?.seccion);
    });

    // Avisos que llegaron con la app cerrada y siguen en la barra; y lo mismo al volver a la app
    revisarBandeja(push);
    alVolver(push);

    try {
      await push.createChannel({ id: CANAL, name: 'Avisos AVIAMAZ', importance: 4 });
    } catch (err) {
      console.warn('Push: no se pudo crear el canal', err); // Android < 8 no usa canales
    }

    let { receive } = await push.checkPermissions();
    if (receive === 'prompt' || receive === 'prompt-with-rationale') {
      if (leer(CLAVE_RECHAZO) === '1') return;
      await new Promise((ok) => setTimeout(ok, ESPERA_PREGUNTA_MS));
      // Si está abierta la pantalla de cuenta (cuenta.js), se pregunta cuando se cierre
      try { await window.cuenta?.esperarCierre?.(); } catch { /* sin cuentas: se sigue */ }
      const acepta = await preguntarAntes();
      if (acepta === null) return;
      if (!acepta) { guardar(CLAVE_RECHAZO, '1'); return; }
      ({ receive } = await push.requestPermissions());
      if (receive !== 'granted') { guardar(CLAVE_RECHAZO, '1'); return; }
    }
    if (receive !== 'granted') return;

    // Sin internet el registro falla en silencio (registrationError) y se reintenta al siguiente arranque
    await push.register();
  }

  // Después de que cargue todo y sin bloquear el arranque
  window.addEventListener('load', () => {
    iniciar().catch((err) => console.warn('Push: desactivadas en este arranque', err));
  });
})();
