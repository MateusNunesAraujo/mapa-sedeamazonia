/**
 * Panel "Novedades del Campus": guarda en el celular los avisos push que llegan (notificaciones.js)
 * y los muestra en #notificationSidebar, con el contador de no leídas en #notificationBadge.
 *
 * Todo es local: clave de localStorage aviamaz_novedades, arreglo de
 * { id, titulo, cuerpo, tipo, seccion, fecha (ISO), leida }, de la más nueva a la más vieja,
 * con un máximo de MAX entradas. Si el almacenamiento falla, el panel abre vacío.
 *
 * Funciona también en el navegador (ahí no llegan avisos, así que queda vacío).
 * Expone window.novedades = { agregar, lista, abrirSeccion, alAbrirPanel, render }.
 */
(function () {
  const CLAVE = 'aviamaz_novedades';
  const MAX = 50;

  // Dato opcional "tipo" del mensaje: pestaña (grupo), ícono (imagen a color o emoji) y si va con
  // borde rojo (clase .important del panel). Un tipo desconocido cuenta como "general".
  const ICONOS = '/static/iconos/iconos_notificaciones/fuente/';
  const TIPOS = {
    // Pestaña General: avisos del campus y de la app
    general: { grupo: 'general', imagen: ICONOS + 'general_color.svg' },
    aviso: { grupo: 'general', emoji: '🚧', importante: true },   // ej. sendero cerrado
    evento: { grupo: 'general', emoji: '📢' },
    biblioteca: { grupo: 'general', emoji: '📚' },
    sede: { grupo: 'general', emoji: '🌿' },
    actualizacion: { grupo: 'general', emoji: '🔄' },             // nueva versión de la app
    // Pestaña Social: lo que hace la comunidad
    social: { grupo: 'social', imagen: ICONOS + 'social_color.svg' }, // ej. alguien se unió
    juego: { grupo: 'social', imagen: ICONOS + 'social_color.svg' },  // Mi jardín (ícono provisional)
    arbol: { grupo: 'social', imagen: ICONOS + 'album_color.svg' },   // escaneo de un árbol
    logro: { grupo: 'social', emoji: '🏆' },                          // logro desbloqueado
  };
  const SECCIONES = ['mapa', 'jardin', 'album'];

  // Pestaña activa del panel (se mantiene mientras la app sigue abierta)
  let filtro = 'general';
  const grupo = (n) => (TIPOS[n.tipo] || TIPOS.general).grupo;
  const VACIO = {
    general: 'Aún no hay novedades. Aquí aparecerán los avisos del campus 🌿',
    social: 'Aún no hay novedades sociales. Aquí aparecerán los logros, árboles y juegos de la comunidad 🌿',
  };

  // Datos opcionales de texto (logro, persona): se recortan y limitan para que no rompan la tarjeta
  const textoCorto = (v, max = 80) => String(v || '').trim().slice(0, max);
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  function lista() {
    try {
      const datos = JSON.parse(localStorage.getItem(CLAVE) || '[]');
      return Array.isArray(datos) ? datos.filter((n) => n && typeof n === 'object' && n.id) : [];
    } catch {
      return [];
    }
  }

  function escribir(datos) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(datos));
    } catch (err) {
      console.warn('Novedades: no se pudo guardar', err);
    }
  }

  const panelAbierto = () =>
    document.getElementById('notificationSidebar')?.classList.contains('active') || false;

  /**
   * Guarda una novedad si no estaba. Devuelve true si se agregó.
   * Sin id, el id es titulo + cuerpo + fecha redondeada al minuto.
   */
  function agregar({ id, titulo, cuerpo, tipo, seccion, fecha, logro, persona } = {}) {
    titulo = String(titulo || '').trim();
    cuerpo = String(cuerpo || '').trim();
    logro = textoCorto(logro);
    persona = textoCorto(persona, 40);
    if (!titulo && !cuerpo && !logro) return false; // un aviso sin texto no se puede mostrar

    const f = new Date(fecha || Date.now());
    const fechaIso = isNaN(f) ? new Date().toISOString() : f.toISOString();
    if (!id) {
      const minuto = new Date(fechaIso);
      minuto.setSeconds(0, 0);
      id = `${titulo}|${cuerpo}|${minuto.toISOString()}`;
    }
    id = String(id);

    const datos = lista();
    if (datos.some((n) => n.id === id)) return false;

    tipo = String(tipo || '').toLowerCase();
    seccion = String(seccion || '').toLowerCase();
    datos.push({
      id,
      titulo,
      cuerpo,
      tipo: TIPOS[tipo] ? tipo : 'general',
      seccion: SECCIONES.includes(seccion) ? seccion : null,
      logro: logro || null,     // nombre del logro (tipo logro)
      persona: persona || null, // quién lo hizo (logro, árbol, juego, social)
      fecha: fechaIso,
      leida: panelAbierto(), // si el panel está a la vista, ya se está leyendo
    });
    datos.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    escribir(datos.slice(0, MAX));
    render();
    return true;
  }

  /** "Ahora", "Hace 10 min", "Hoy, 8:30 AM", "Ayer" o "12 Jun 2026" */
  function formatoFecha(iso) {
    const f = new Date(iso);
    if (isNaN(f)) return '';
    const ahora = new Date();
    const min = Math.floor((ahora - f) / 60000);
    if (min < 1) return 'Ahora';
    if (min < 60) return `Hace ${min} min`;
    const dia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dias = Math.round((dia(ahora) - dia(f)) / 86400000);
    if (dias === 0) {
      const h = f.getHours();
      const mm = String(f.getMinutes()).padStart(2, '0');
      return `Hoy, ${h % 12 || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
    }
    if (dias === 1) return 'Ayer';
    return `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`;
  }

  /** Abre la sección de un aviso (data.seccion); si no se reconoce, no hace nada */
  function abrirSeccion(seccion) {
    try {
      switch (String(seccion || '').toLowerCase()) {
        case 'jardin':
          window.albumHandler?.closeAlbum?.();
          window.abrirJardin?.();
          break;
        case 'album':
          window.albumHandler?.openAlbum?.();
          break;
        case 'mapa':
          window.albumHandler?.closeAlbum?.();
          break;
      }
    } catch (err) {
      console.warn('Novedades: no se pudo abrir la sección', seccion, err);
    }
  }

  /** Contador de no leídas sobre la campanita del menú y punto del botón ☰ */
  function actualizarContador(datos) {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    const n = datos.filter((x) => !x.leida).length;
    badge.textContent = n ? (n > 9 ? '9+' : String(n)) : '';
    badge.classList.toggle('con-numero', n > 0);
    badge.style.display = n ? 'flex' : 'none';
    // Con el menú abierto el punto de ☰ se oculta solo; index.js lo recalcula al cerrarlo
    const menuAbierto = document.getElementById('menuLateral')?.classList.contains('activo');
    if (!menuAbierto && typeof window.actualizarPuntoMenu === 'function') window.actualizarPuntoMenu();
  }

  function render() {
    try {
      const datos = lista();
      actualizarContador(datos);
      const cont = document.querySelector('#notificationSidebar .sidebar-content');
      if (!cont) return;
      cont.replaceChildren();

      const visibles = datos.filter((n) => grupo(n) === filtro);
      if (!visibles.length) {
        const vacio = document.createElement('p');
        vacio.className = 'notif-vacio';
        vacio.textContent = VACIO[filtro];
        cont.appendChild(vacio);
        return;
      }

      for (const n of visibles) {
        const tipo = TIPOS[n.tipo] || TIPOS.general;
        const item = document.createElement('div');
        item.className = 'notif-item' + (tipo.importante ? ' important' : '');

        // Ícono del tipo a la izquierda: imagen a color (general, social) o emoji en un recuadro
        const icono = document.createElement('span');
        icono.className = 'notif-icono' + (n.tipo === 'logro' ? ' logro' : '');
        icono.setAttribute('aria-hidden', 'true');
        if (tipo.imagen) {
          const img = document.createElement('img');
          img.src = tipo.imagen;
          img.alt = '';
          icono.appendChild(img);
        } else {
          icono.textContent = tipo.emoji;
        }

        const texto = document.createElement('p');
        texto.className = 'notif-text';
        // Un logro sin título se presenta con el nombre de quien lo ganó
        const tituloTexto =
          n.titulo ||
          (n.tipo === 'logro' ? (n.persona ? `¡${n.persona} desbloqueó un logro!` : '¡Logro desbloqueado!') : '');
        if (tituloTexto) {
          const titulo = document.createElement('strong');
          titulo.textContent = tituloTexto;
          texto.appendChild(titulo);
        }
        if (n.cuerpo) {
          const cuerpo = document.createElement('span');
          cuerpo.className = 'notif-cuerpo';
          cuerpo.textContent = n.cuerpo;
          texto.appendChild(cuerpo);
        }

        const hora = document.createElement('span');
        hora.className = 'notif-time';
        hora.textContent = formatoFecha(n.fecha);

        const contenido = document.createElement('div');
        contenido.className = 'notif-contenido';
        contenido.appendChild(texto);

        // Insignia: el logro y quién lo ganó, o solo la persona en los demás avisos sociales
        if (n.logro || n.persona) {
          const insignia = document.createElement('span');
          insignia.className = 'notif-insignia' + (n.logro ? ' logro' : '');
          if (n.logro) {
            // Si el título ya se armó con el nombre, la insignia no lo repite
            const nombreEnTitulo = !n.titulo && n.persona;
            insignia.textContent = `🏆 ${n.logro}` + (n.persona && !nombreEnTitulo ? ` · ${n.persona}` : '');
          } else {
            insignia.textContent = `👤 ${n.persona}`;
          }
          contenido.appendChild(insignia);
        }
        contenido.appendChild(hora);

        item.append(icono, contenido);

        if (n.seccion) {
          item.classList.add('con-seccion');
          item.setAttribute('role', 'button');
          item.tabIndex = 0;
          const ir = () => {
            document.getElementById('notificationSidebar')?.classList.remove('active');
            abrirSeccion(n.seccion);
          };
          item.addEventListener('click', ir);
          item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(); }
          });
        }
        cont.appendChild(item);
      }
    } catch (err) {
      console.warn('Novedades: no se pudo mostrar el panel', err);
    }
  }

  /** Al abrir el panel: todas quedan leídas y se refrescan las horas ("Hace 10 min") */
  function alAbrirPanel() {
    const datos = lista();
    if (datos.some((n) => !n.leida)) escribir(datos.map((n) => ({ ...n, leida: true })));
    render();
  }

  /** Pestañas General / Social */
  function iniciarFiltros() {
    const botones = document.querySelectorAll('#notificationSidebar .notif-filtro');
    botones.forEach((boton) => {
      boton.addEventListener('click', () => {
        filtro = boton.dataset.filtro === 'social' ? 'social' : 'general';
        botones.forEach((b) => {
          const activo = b === boton;
          b.classList.toggle('activo', activo);
          b.setAttribute('aria-selected', String(activo));
        });
        render();
      });
    });
  }

  window.novedades = { agregar, lista, abrirSeccion, alAbrirPanel, render };
  try { iniciarFiltros(); } catch (err) { console.warn('Novedades: sin pestañas', err); }
  render();
})();
