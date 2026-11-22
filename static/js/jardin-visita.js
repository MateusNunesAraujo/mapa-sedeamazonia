/**
 * Interfaz del modo visita de "Mi jardín" (jardin.js → visitarJardin): el jardín de otro jugador,
 * solo para mirar.
 *  - Chip arriba a la derecha con la foto (o la inicial) y el @username; al tocarlo se abre la tarjeta
 *    de perfil: fecha de unión, árboles en el jardín y en el álbum, likes y logros.
 *  - Corazón abajo a la derecha con el total de "me gusta": alterna dar y quitar el propio
 *    (jardin-publico.js). La pantalla cambia al momento y vuelve atrás si falla.
 * Los datos vienen de otro usuario: todo se pinta con textContent y las insignias salen del catálogo
 * local de logros (logros.js), nunca de rutas guardadas en la nube.
 */

function avisar(mensaje, icono = 'info') {
  if (!window.Swal) return;
  window.Swal.fire({
    toast: true, position: 'bottom', icon: icono, title: mensaje, showConfirmButton: false, timer: 2600,
    customClass: { container: 'cuenta-swal' }, // por encima del jardín (z-index 4000)
  });
}

function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

/** Foto de perfil o círculo con la inicial */
function pintarAvatar(el, { fotoURL, username }) {
  el.textContent = '';
  const inicial = () => {
    el.textContent = '';
    el.appendChild(crear('span', 'cuenta-inicial', (username || '?').charAt(0).toUpperCase()));
  };
  if (fotoURL) {
    const img = document.createElement('img');
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    img.onerror = inicial;
    img.src = fotoURL;
    el.appendChild(img);
  } else {
    inicial();
  }
}

/** "Se unió en noviembre de 2026" (o '' si no hay fecha) */
function textoUnion(unido) {
  const ms = Date.parse(unido || '');
  if (!ms) return '';
  try {
    return `Se unió en ${new Date(ms).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}`;
  } catch { return ''; }
}

/**
 * Monta la interfaz de visita en el jardín.
 * @param {HTMLElement} raiz elemento .jardin
 * @param {object} datos jardín visitado (jardinPublico.leerParaVisita → datos)
 */
export function montarVisita(raiz, datos) {
  const jp = window.jardinPublico;
  const yo = () => window.cuenta?.perfil?.() || null;
  const likes = datos.likes; // se modifica en el lugar al dar o quitar el like
  const propio = yo()?.uid === datos.uid;

  // --- Chip de perfil (arriba a la derecha) ---
  const chip = crear('button', 'jardin-visita-perfil');
  chip.type = 'button';
  chip.setAttribute('aria-label', `Ver el perfil de @${datos.username}`);
  const avatarChip = crear('span', 'jardin-visita-avatar');
  avatarChip.setAttribute('aria-hidden', 'true');
  pintarAvatar(avatarChip, datos);
  chip.append(avatarChip, crear('span', 'jardin-visita-usuario', `@${datos.username}`));
  raiz.querySelector('.jardin-barra-derecha').appendChild(chip);

  // --- Corazón (abajo a la derecha) ---
  const corazon = crear('button', 'jardin-like');
  corazon.type = 'button';
  const iconoCorazon = crear('span', 'jardin-like-icono');
  iconoCorazon.setAttribute('aria-hidden', 'true');
  const numero = crear('span', 'jardin-like-numero');
  corazon.append(iconoCorazon, numero);
  raiz.appendChild(corazon);

  const total = () => Object.keys(likes).length;
  function pintarCorazon(mio, n) {
    iconoCorazon.textContent = mio ? '❤️' : '🤍';
    numero.textContent = String(n);
    corazon.classList.toggle('dado', mio);
    corazon.setAttribute('aria-pressed', String(mio));
    corazon.setAttribute('aria-label', propio
      ? `Tu jardín tiene ${n} me gusta`
      : `${mio ? 'Quitar me gusta' : 'Me gusta este jardín'} (${n})`);
  }
  const mioAhora = () => !!(yo() && likes[yo().uid]);
  pintarCorazon(mioAhora(), total());

  function animarCorazon() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    corazon.classList.remove('latido');
    void corazon.offsetWidth; // reinicia la animación
    corazon.classList.add('latido');
    for (let i = 0; i < 3; i++) {
      const c = crear('span', 'jardin-like-flotante', '❤️');
      c.setAttribute('aria-hidden', 'true');
      c.style.setProperty('--dx', `${(i - 1) * 18}px`);
      c.style.animationDelay = `${i * 90}ms`;
      corazon.appendChild(c);
      c.addEventListener('animationend', () => c.remove());
    }
  }

  let guardando = false;
  corazon.addEventListener('click', async () => {
    const p = yo();
    if (!p) { avisar('Inicia sesión para dar me gusta'); return; }
    if (p.uid === datos.uid) { avisar('No puedes darle me gusta a tu propio jardín'); return; }
    if (navigator.onLine === false) { avisar('Necesitas conexión'); return; }
    if (guardando || !jp) return;
    guardando = true;
    const antes = !!likes[p.uid];
    const n = total();
    // Primero en pantalla; si falla, se revierte
    pintarCorazon(!antes, n + (antes ? -1 : 1));
    if (!antes) animarCorazon();
    const r = await jp.alternarLike(datos.uid, likes);
    guardando = false;
    if (!raiz.isConnected) return;
    pintarCorazon(mioAhora(), total());
    if (!r.ok) {
      const textos = {
        sinRed: 'Necesitas conexión',
        privado: 'Este jardín ahora es privado 🔒',
        sinCuenta: 'Inicia sesión para dar me gusta',
        propio: 'No puedes darle me gusta a tu propio jardín',
      };
      avisar(textos[r.motivo] || 'No se pudo guardar tu me gusta. Inténtalo de nuevo.', 'warning');
    }
  });

  // --- Tarjeta de perfil (modal) ---
  const capa = crear('div', 'jardin-perfil');
  capa.hidden = true;
  capa.innerHTML = `
    <div class="jardin-perfil-fondo"></div>
    <section class="jardin-perfil-tarjeta" role="dialog" aria-modal="true" aria-labelledby="jardinPerfilUsuario">
      <button type="button" class="jardin-hoja-cerrar jardin-perfil-cerrar" aria-label="Cerrar perfil">&times;</button>
      <div class="cuenta-perfil">
        <span class="cuenta-avatar cuenta-avatar--grande jardin-perfil-avatar" aria-hidden="true"></span>
        <strong id="jardinPerfilUsuario" class="jardin-perfil-usuario"></strong>
        <span class="cuenta-perfil-desde jardin-perfil-desde" hidden></span>
      </div>
      <ul class="jardin-perfil-stats">
        <li><span aria-hidden="true">🌳</span><strong data-stat="jardin"></strong><small>Árboles en su jardín</small></li>
        <li><span aria-hidden="true">📖</span><strong data-stat="album"></strong><small>Árboles en su álbum</small></li>
        <li><span aria-hidden="true">❤️</span><strong data-stat="likes"></strong><small>Likes de su jardín</small></li>
      </ul>
      <div class="cuenta-logros">
        <div class="cuenta-logros-cabecera">
          <span class="cuenta-logros-titulo">🏆 Logros obtenidos</span>
          <span class="cuenta-logros-contador jardin-perfil-contador">0</span>
        </div>
        <ul class="cuenta-logros-lista jardin-perfil-logros"></ul>
        <p class="jardin-perfil-sin-logros" hidden>Aún no ha ganado logros</p>
      </div>
    </section>`;
  raiz.appendChild(capa);
  pintarAvatar(capa.querySelector('.jardin-perfil-avatar'), datos);
  capa.querySelector('.jardin-perfil-usuario').textContent = `@${datos.username}`;
  const desde = capa.querySelector('.jardin-perfil-desde');
  desde.textContent = textoUnion(datos.unido);
  desde.hidden = !desde.textContent;
  capa.querySelector('[data-stat="jardin"]').textContent = String(datos.stats.arbolesJardin);
  capa.querySelector('[data-stat="album"]').textContent = String(datos.stats.arbolesAlbum);

  let logrosPintados = false;
  async function pintarLogros() {
    if (logrosPintados) return;
    logrosPintados = true;
    let catalogo = [];
    try { catalogo = (await window.logros?.todos?.()) || []; } catch (e) { console.warn('Visita: logros', e); }
    const porId = new Map(catalogo.map((l) => [l.id, l]));
    const ganados = datos.logros.map((id) => porId.get(id)).filter(Boolean);
    const ul = capa.querySelector('.jardin-perfil-logros');
    ul.textContent = '';
    for (const logro of ganados) {
      const li = crear('li', 'cuenta-logro');
      const sinImagen = () => crear('span', 'cuenta-logro-sin-imagen', '🏆');
      if (logro.imagen) {
        const img = document.createElement('img');
        img.alt = '';
        img.src = logro.imagen;
        img.onerror = () => img.replaceWith(sinImagen());
        li.appendChild(img);
      } else {
        li.appendChild(sinImagen());
      }
      li.appendChild(crear('span', 'cuenta-logro-nombre', logro.nombre || 'Logro'));
      ul.appendChild(li);
    }
    capa.querySelector('.jardin-perfil-contador').textContent = String(ganados.length);
    ul.hidden = !ganados.length;
    capa.querySelector('.jardin-perfil-sin-logros').hidden = !!ganados.length;
  }

  function abrirPerfil() {
    capa.querySelector('[data-stat="likes"]').textContent = String(total());
    pintarLogros();
    capa.hidden = false;
    capa.querySelector('.jardin-perfil-cerrar').focus();
  }
  function cerrarPerfil() {
    if (capa.hidden) return false;
    capa.hidden = true;
    chip.focus();
    return true;
  }
  chip.addEventListener('click', abrirPerfil);
  capa.querySelector('.jardin-perfil-cerrar').addEventListener('click', cerrarPerfil);
  capa.querySelector('.jardin-perfil-fondo').addEventListener('click', cerrarPerfil);

  // Escape cierra primero la tarjeta (jardin.js lo pregunta antes de salir del jardín)
  return { cerrarCapa: cerrarPerfil };
}
