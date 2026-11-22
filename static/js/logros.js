/**
 * Sistema de logros (data/logros.json).
 *
 * Cada logro se desbloquea una sola vez con un evento de la app:
 *   - 'arbol_escaneado' ← evento `plantUnlocked` (unlock-system.js, al escanear el QR de un árbol)
 *   - 'arbol_plantado'  ← evento `arbolPlantado` (jardin.js, al plantar en una parcela)
 *   - 'recorrido_3d'    ← evento `recorridoAbierto` (recorrido.js, al terminar de cargar el 3D)
 *   - 'caja_premio'     ← evento `cajaPremio` { rareza, tipo } (jardin-ui.js, al cerrar el premio de la caja)
 *
 * Al ganarlo se muestra en grande con el brillo de su rareza y sus monedas quedan "por cobrar":
 * este archivo NUNCA escribe el progreso del jardín (jardinEstado). El jardín las cobra con
 * window.logros.cobrarMonedas() al abrirse o, si ya está abierto, al oír `logroDesbloqueado`.
 *
 * Expone:
 *   window.logros = {
 *     desbloqueados(),   // [{ id, nombre, imagen, rareza, fecha }] (lo usa el perfil, cuenta.js)
 *     todos(),           // todos los logros activos con { desbloqueado, fecha }
 *     registrar(evento, datos), // desbloquea los logros que cumpla ese evento
 *     cobrarMonedas(),   // { plata, oro } por cobrar; las deja en cero
 *     probar(id),        // solo pruebas: muestra la ventana de un logro sin desbloquearlo
 *     reiniciar(),       // solo pruebas: borra los logros ganados y las monedas por cobrar
 *   }
 * y dispara en document `logroDesbloqueado` con detail { logro }.
 */
(function () {
  const RUTA = '/data/logros.json';
  const CLAVE = 'aviamaz_logros';
  const CARPETA_POR_DEFECTO = '/static/iconos/logros/';
  const RAREZAS = { comun: 'Común', rara: 'Raro', epica: 'Épico', legendaria: 'Legendario' };

  // --- Progreso guardado en el celular: { desbloqueados: { id: fechaISO }, porCobrar: { plata, oro } } ---
  const entero = (n) => (Number.isInteger(n) && n > 0 ? n : 0);

  function leerProgreso() {
    let datos = null;
    try { datos = JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch { /* guardado dañado */ }
    return {
      desbloqueados: datos?.desbloqueados && typeof datos.desbloqueados === 'object' ? datos.desbloqueados : {},
      porCobrar: { plata: entero(datos?.porCobrar?.plata), oro: entero(datos?.porCobrar?.oro) },
    };
  }

  function guardarProgreso(progreso) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(progreso));
      window.sincronizacion?.marcarCambio?.(); // respaldo en la nube (sincronizacion.js)
      return true;
    } catch (err) {
      console.warn('Logros: no se pudo guardar', err);
      return false;
    }
  }

  // --- Catálogo (data/logros.json) ---
  let catalogo = [];
  const listo = fetch(RUTA)
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((datos) => {
      const carpeta = typeof datos?.carpeta_imagenes === 'string' ? datos.carpeta_imagenes : CARPETA_POR_DEFECTO;
      catalogo = (Array.isArray(datos?.logros) ? datos.logros : [])
        .filter((l) => l && l.activo !== false && typeof l.id === 'string' && l.id && typeof l.evento === 'string')
        .map((l) => ({
          id: l.id,
          nombre: String(l.nombre || 'Logro'),
          descripcion: String(l.descripcion || ''),
          imagen: l.imagen ? carpeta + encodeURIComponent(l.imagen) : null,
          rareza: l.rareza in RAREZAS ? l.rareza : 'comun',
          recompensa: { plata: entero(l.recompensa?.plata), oro: entero(l.recompensa?.oro) },
          evento: l.evento,
          condicion: l.condicion && typeof l.condicion === 'object' ? l.condicion : null,
        }));
    })
    .catch((err) => { console.warn('Logros: no se pudo cargar', RUTA, err); });

  /** ¿Los datos del evento cumplen la condición del logro? (cada clave debe coincidir) */
  const cumple = (logro, datos) => !logro.condicion
    || Object.entries(logro.condicion).every(([clave, valor]) => datos?.[clave] === valor);

  /** Desbloquea los logros de ese evento que aún no se tienen. Devuelve los ganados ahora */
  async function registrar(evento, datos = {}) {
    await listo;
    const progreso = leerProgreso();
    const ganados = catalogo.filter((l) => l.evento === evento && !progreso.desbloqueados[l.id] && cumple(l, datos));
    if (!ganados.length) return [];
    for (const logro of ganados) {
      progreso.desbloqueados[logro.id] = new Date().toISOString();
      progreso.porCobrar.plata += logro.recompensa.plata;
      progreso.porCobrar.oro += logro.recompensa.oro;
    }
    guardarProgreso(progreso);
    for (const logro of ganados) {
      document.dispatchEvent(new CustomEvent('logroDesbloqueado', { detail: { logro } }));
      encolar(logro);
    }
    return ganados;
  }

  function cobrarMonedas() {
    const progreso = leerProgreso();
    const monedas = { ...progreso.porCobrar };
    if (!monedas.plata && !monedas.oro) return monedas;
    progreso.porCobrar = { plata: 0, oro: 0 };
    return guardarProgreso(progreso) ? monedas : { plata: 0, oro: 0 };
  }

  async function todos() {
    await listo;
    const { desbloqueados } = leerProgreso();
    return catalogo.map((l) => ({ ...l, desbloqueado: !!desbloqueados[l.id], fecha: desbloqueados[l.id] || null }));
  }

  /** Logros ganados, del más antiguo al más nuevo: { id, nombre, imagen, rareza, fecha } */
  async function desbloqueados() {
    return (await todos())
      .filter((l) => l.desbloqueado)
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
      .map(({ id, nombre, imagen, rareza, fecha }) => ({ id, nombre, imagen, rareza, fecha }));
  }

  // --- Ventana grande "¡Logro desbloqueado!" (una a la vez, en cola) ---
  const cola = [];
  let mostrando = false;

  function encolar(logro) {
    cola.push(logro);
    if (!mostrando) siguiente();
  }

  function siguiente() {
    const logro = cola.shift();
    if (!logro) { mostrando = false; return; }
    mostrando = true;
    // Si hay un aviso de SweetAlert abierto (p. ej. "¡Planta desbloqueada!" tras el QR), se espera a que se cierre
    const esperar = () => (window.Swal?.isVisible?.() ? setTimeout(esperar, 400) : mostrarVentana(logro, siguiente));
    setTimeout(esperar, 300);
  }

  function moneda(tipo) {
    const [claro, oscuro, borde] = tipo === 'oro' ? ['#ffe58a', '#f2b01e', '#c98a0b'] : ['#f7f8f9', '#b8bec4', '#8a9197'];
    return `<svg class="logro-moneda" viewBox="0 0 24 24" aria-hidden="true">
      <defs><linearGradient id="logro-moneda-${tipo}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${claro}" /><stop offset="1" stop-color="${oscuro}" /></linearGradient></defs>
      <circle cx="12" cy="12" r="10.5" fill="url(#logro-moneda-${tipo})" stroke="${borde}" stroke-width="1.2" />
      <circle cx="12" cy="12" r="7.6" fill="none" stroke="${borde}" stroke-width="0.9" opacity="0.7" />
      <path d="M12 16.5c-2.6-1-3.6-3-3.3-5.8 2.6.2 4.3 1.6 4.6 4.1M12 16.5c.1-3.2 1.5-5.6 4-6.6.4 2.7-1.1 5.5-4 6.6z" fill="${borde}" opacity="0.75" />
    </svg>`;
  }

  function mostrarVentana(logro, alCerrar) {
    const capa = document.createElement('div');
    capa.className = `logro-capa logro-capa--${logro.rareza}`;
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-modal', 'true');
    capa.setAttribute('aria-labelledby', 'logroVentanaNombre');
    const premios = ['plata', 'oro']
      .filter((t) => logro.recompensa[t])
      .map((t) => `<span class="logro-premio-chip">${moneda(t)}<strong>+${logro.recompensa[t]}</strong> ${t === 'oro' ? 'oro' : 'plata'}</span>`)
      .join('');
    const enJardin = !!document.querySelector('.jardin');
    capa.innerHTML = `
      <div class="logro-rayos" aria-hidden="true"></div>
      <div class="logro-tarjeta">
        <p class="logro-encabezado">¡Logro desbloqueado!</p>
        <div class="logro-insignia"><img alt="" /></div>
        <span class="logro-rareza"></span>
        <h2 class="logro-nombre" id="logroVentanaNombre"></h2>
        <p class="logro-desc"></p>
        ${premios ? `<div class="logro-premio">${premios}</div>
        <p class="logro-nota">${enJardin ? 'Ya están en tu jardín 🌱' : 'Te esperan en tu jardín 🌱'}</p>` : ''}
        <button type="button" class="logro-aceptar">¡Genial!</button>
      </div>`;
    // Textos con textContent: vienen del JSON y no se interpretan como HTML
    capa.querySelector('.logro-rareza').textContent = RAREZAS[logro.rareza];
    capa.querySelector('.logro-nombre').textContent = logro.nombre;
    capa.querySelector('.logro-desc').textContent = logro.descripcion;
    const img = capa.querySelector('.logro-insignia img');
    const sinImagen = () => img.replaceWith(Object.assign(document.createElement('span'), { className: 'logro-sin-imagen', textContent: '🏆' }));
    if (logro.imagen) { img.src = logro.imagen; img.onerror = sinImagen; } else sinImagen();

    const anterior = document.activeElement;
    let cerrada = false;
    const cerrar = () => {
      if (cerrada) return;
      cerrada = true;
      document.removeEventListener('keydown', teclas, true);
      capa.classList.add('logro-capa--saliendo');
      setTimeout(() => {
        capa.remove();
        anterior?.focus?.();
        alCerrar();
      }, 250);
    };
    const teclas = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); cerrar(); }
    };
    capa.querySelector('.logro-aceptar').addEventListener('click', cerrar);
    capa.addEventListener('click', (e) => { if (e.target === capa) cerrar(); });
    document.addEventListener('keydown', teclas, true);
    document.body.appendChild(capa);
    navigator.vibrate?.(logro.rareza === 'legendaria' ? [80, 60, 80, 60, 160] : [60, 40, 100]);
    setTimeout(() => capa.querySelector('.logro-aceptar')?.focus(), 50);
  }

  // --- Eventos de la app ---
  document.addEventListener('plantUnlocked', () => registrar('arbol_escaneado'));
  document.addEventListener('arbolPlantado', () => registrar('arbol_plantado'));
  document.addEventListener('recorridoAbierto', () => registrar('recorrido_3d'));
  document.addEventListener('cajaPremio', (e) => registrar('caja_premio', { rareza: e.detail?.rareza, tipo: e.detail?.tipo }));

  // Quien ya había jugado antes de existir los logros recibe los que se pueden comprobar en el celular
  // (solo se LEE el progreso; no se modifica el jardín ni el álbum)
  async function revisarProgresoAnterior() {
    if (window.unlocker?.getUnlockedCount?.() > 0) await registrar('arbol_escaneado');
    let jardin = null;
    try { jardin = JSON.parse(localStorage.getItem('jardinEstado') || 'null'); } catch { /* sin jardín */ }
    if (Object.values(jardin?.plantados || {}).some(Boolean)) await registrar('arbol_plantado');
    if (jardin?.caja?.abiertas > 0) await registrar('caja_premio', {});
    // Los árboles exclusivos solo salen como premio legendario de la caja
    if (Array.isArray(jardin?.exclusivos) && jardin.exclusivos.length) await registrar('caja_premio', { rareza: 'legendaria' });
  }
  listo.then(revisarProgresoAnterior);

  window.logros = {
    desbloqueados,
    todos,
    registrar,
    cobrarMonedas,
    probar: async (id) => { await listo; const l = catalogo.find((x) => x.id === id); if (l) encolar(l); return !!l; },
    reiniciar: () => { try { localStorage.removeItem(CLAVE); } catch { /* nada */ } },
  };
})();
