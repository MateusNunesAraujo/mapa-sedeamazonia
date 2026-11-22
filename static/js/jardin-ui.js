/**
 * Interfaz 2D de "Mi jardín": monedas, barra de herramientas (tienda, árboles, pala, regadera)
 * y los paneles de la tienda y de la lista de árboles. La escena 3D está en jardin.js y el
 * progreso guardado en jardin-estado.js.
 */
import {
  parcelaDe, parcelasLibres, celdasParaAmpliar, abrirSobre, comprarEspacioRegadera, puedeAmpliarRegadera,
  desbloquearAccesorioQR, accesorioCanjeadoQR, cargarEstado, accesorioEn, ponerAccesorio, quitarAccesorio,
  elegirPregunta, responderPregunta, PREGUNTA, abrirCaja, idCopia,
} from './jardin-estado.js?v=17';

// Preguntas del botón "?": data/preguntas-jardin.json
const RUTA_PREGUNTAS = '/data/preguntas-jardin.json';
let preguntasCargadas = null;

/** Lee las preguntas una sola vez y descarta (con aviso en consola) las mal escritas */
function cargarPreguntas() {
  if (!preguntasCargadas) {
    preguntasCargadas = fetch(RUTA_PREGUNTAS)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((datos) => (Array.isArray(datos.preguntas) ? datos.preguntas : []).filter((p, i) => {
        const valida = p && typeof p.id === 'string' && typeof p.pregunta === 'string'
          && Array.isArray(p.opciones) && p.opciones.length === 4 && p.opciones.every((o) => typeof o === 'string')
          && Number.isInteger(p.respuesta) && p.respuesta >= 0 && p.respuesta < 4;
        if (!valida) console.warn(`preguntas-jardin.json: se ignora la pregunta ${i + 1} (mal escrita)`);
        return valida;
      }))
      .catch((err) => {
        preguntasCargadas = null;
        throw err;
      });
  }
  return preguntasCargadas;
}

// Catálogo de la tienda: data/tienda-jardin.json (formato en static/img/accesorios/README.md)
const RUTA_CATALOGO = '/data/tienda-jardin.json';
const CARPETA_ACCESORIOS = '/static/img/accesorios/';
let catalogoCargado = null;

const precioValido = (p) => p && (p.moneda === 'plata' || p.moneda === 'oro') && Number.isInteger(p.valor) && p.valor > 0;

// Rarezas de los accesorios (misma clave que `rareza` en tienda-jardin.json), de menor a mayor
const RAREZA = { comun: 'Común', rara: 'Raro', epica: 'Épico', legendaria: 'Legendario', exclusiva: 'Exclusivo' };
const CARPETA_SOBRES = '/static/iconos/sobres/';
// Súbelo cada vez que cambies una imagen o animación de los sobres sin cambiarle el nombre
const VERSION_SOBRES = 2;
const rutaSobre = (archivo) => `${CARPETA_SOBRES}${encodeURIComponent(archivo)}?v=${VERSION_SOBRES}`;
const probabilidad = (v) => (Number(v) >= 0 && Number(v) <= 1 ? Number(v) : 0);

/** Lee la sección `sobres` del catálogo: { tipos: [...], duracionMs, enfriamiento } */
function leerSobres(datos) {
  const tipos = (Array.isArray(datos?.tipos) ? datos.tipos : []).filter((s, i) => {
    const problema = !s || typeof s.id !== 'string' || !s.id.trim() ? 'sin id'
      : typeof s.nombre !== 'string' ? `"${s.id}" sin nombre`
        : !precioValido(s.precio) ? `"${s.id}" con precio inválido`
          : !s.probabilidades || typeof s.probabilidades !== 'object' ? `"${s.id}" sin probabilidades`
            : null;
    if (problema) console.warn(`tienda-jardin.json: se ignora el sobre ${i + 1} (${problema})`);
    return !problema;
  }).map((s) => ({
    ...s,
    probabilidades: Object.fromEntries(Object.keys(RAREZA).map((r) => [r, Math.max(0, Number(s.probabilidades[r]) || 0)])),
    arbol: { probabilidad: probabilidad(s.arbol?.probabilidad), nuevo: probabilidad(s.arbol?.nuevo) },
  }));
  const enfriamiento = Number.isInteger(datos?.arboles?.enfriamiento_sobres) ? Math.max(0, datos.arboles.enfriamiento_sobres) : 25;
  return {
    tipos,
    duracionMs: Number(datos?.duracion_animacion_ms) > 0 ? Number(datos.duracion_animacion_ms) : 2600,
    enfriamiento,
  };
}

/** Lee el catálogo una sola vez y descarta (con aviso en consola) las entradas mal escritas */
export function cargarCatalogo() {
  if (!catalogoCargado) {
    catalogoCargado = fetch(RUTA_CATALOGO)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((datos) => {
        const ids = new Set();
        const accesorios = (Array.isArray(datos.accesorios) ? datos.accesorios : []).filter((a, i) => {
          // Los accesorios no se compran: salen en los sobres (según su rareza) o con su código QR
          const problema = !a || typeof a.id !== 'string' || !a.id.trim() ? 'sin id'
            : ids.has(a.id) ? `id repetido "${a.id}"`
              : typeof a.nombre !== 'string' || !a.nombre.trim() ? `"${a.id}" sin nombre`
                : !(a.rareza in RAREZA) ? `"${a.id}" con rareza inválida`
                  : null;
          if (problema) {
            console.warn(`tienda-jardin.json: se ignora el accesorio ${i + 1} (${problema})`);
            return false;
          }
          ids.add(a.id);
          return true;
        });
        const sobres = leerSobres(datos.sobres);
        const precioParcela = precioValido(datos.parcela?.precio) ? datos.parcela.precio : null;
        if (!precioParcela) console.warn('tienda-jardin.json: falta o es inválido parcela.precio');
        const precioRegadera = precioValido(datos.regadera?.precio) ? datos.regadera.precio : null;
        if (!precioRegadera) console.warn('tienda-jardin.json: falta o es inválido regadera.precio');
        // Monedas con las que empieza cada jugador nuevo (enteros >= 0)
        const entero = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
        const monedasIniciales = { plata: entero(datos.monedas_iniciales?.plata), oro: entero(datos.monedas_iniciales?.oro) };
        return { accesorios, sobres, precioParcela, precioRegadera, monedasIniciales };
      })
      .catch((err) => {
        catalogoCargado = null; // permitir reintentar al volver a abrir la tienda
        throw err;
      });
  }
  return catalogoCargado;
}

// Caja sorpresa: data/caja-sorpresa.json (formato en su campo "nota")
const RUTA_CAJA = '/data/caja-sorpresa.json';
const CARPETA_ARBOLES = '/static/modelos/3d-arboles/';
let cajaCargada = null;

/**
 * Lee la caja una sola vez: { intervaloMs, idPrimera, exclusivos: Map(codigoQR -> árbol), premios }.
 * Descarta (con aviso en consola) los premios mal escritos o que apuntan a algo que no existe.
 */
export function cargarCaja() {
  if (!cajaCargada) {
    cajaCargada = Promise.all([
      fetch(RUTA_CAJA).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      }),
      cargarCatalogo().catch(() => ({ accesorios: [] })),
    ])
      .then(([datos, catalogo]) => {
        const exclusivos = new Map();
        for (const a of Array.isArray(datos.arboles_exclusivos) ? datos.arboles_exclusivos : []) {
          if (!a || typeof a.codigoQR !== 'string' || !a.codigoQR.trim() || typeof a.nombre !== 'string') {
            console.warn('caja-sorpresa.json: se ignora un árbol exclusivo sin codigoQR o nombre');
            continue;
          }
          const ruta = typeof a.modelo3d === 'string' && a.modelo3d.trim() ? a.modelo3d.trim() : null;
          exclusivos.set(a.codigoQR, {
            codigoQR: a.codigoQR,
            nombre: a.nombre,
            especie: a.especie || '',
            exclusivo: true,
            info_juego: a.info_juego && typeof a.info_juego === 'object' ? a.info_juego : null,
            rutaModelo: ruta ? (/^(\/|https?:)/i.test(ruta) ? ruta : `${CARPETA_ARBOLES}${encodeURIComponent(ruta)}`) : null,
          });
        }
        const accesorios = new Map(catalogo.accesorios.map((a) => [a.id, a]));
        const ids = new Set();
        const premios = (Array.isArray(datos.premios) ? datos.premios : []).filter((p, i) => {
          if (p?.activo === false) return false;
          const problema = !p || typeof p.id !== 'string' || !p.id.trim() ? 'sin id'
            : ids.has(p.id) ? `id repetido "${p.id}"`
              : !Number.isInteger(p.cantidad) || p.cantidad < 1 ? `"${p.id}" con cantidad inválida`
                : !(Number(p.peso) > 0) ? `"${p.id}" con peso inválido`
                  : p.tipo === 'monedas' ? (p.objeto === 'plata' || p.objeto === 'oro' ? null : `"${p.id}": moneda desconocida`)
                    : p.tipo === 'accesorio' ? (accesorios.has(p.objeto) ? null : `"${p.id}": accesorio "${p.objeto}" no está en la tienda`)
                      : p.tipo === 'arbol' ? (exclusivos.has(p.objeto) ? null : `"${p.id}": árbol "${p.objeto}" no está en arboles_exclusivos`)
                        : `"${p.id}": tipo desconocido`;
          if (problema) {
            console.warn(`caja-sorpresa.json: se ignora el premio ${i + 1} (${problema})`);
            return false;
          }
          ids.add(p.id);
          return true;
        }).map((p) => ({
          ...p,
          peso: Number(p.peso),
          cantidad: p.tipo === 'arbol' ? 1 : p.cantidad,
          accesorio: p.tipo === 'accesorio' ? accesorios.get(p.objeto) : null,
          arbol: p.tipo === 'arbol' ? exclusivos.get(p.objeto) : null,
        }));
        const horas = Number(datos.intervalo_horas) > 0 ? Number(datos.intervalo_horas) : 24;
        return { intervaloMs: horas * 60 * 60 * 1000, idPrimera: datos.primera_caja || null, exclusivos, premios };
      })
      .catch((err) => {
        cajaCargada = null;
        throw err;
      });
  }
  return cajaCargada;
}

/**
 * Canjea un código QR escaneado si es el `id` de un accesorio con "desbloqueo_qr": true.
 * Lo usa qr-handler.js. Devuelve { nombre, nuevo } o null si el código no es de un accesorio.
 */
window.desbloquearAccesorioQR = async function (codigo) {
  let catalogo;
  try {
    catalogo = await cargarCatalogo();
  } catch (err) {
    console.warn('No se pudo leer el catálogo para canjear el QR:', err);
    return null;
  }
  const accesorio = catalogo.accesorios.find((a) => a.desbloqueo_qr === true && a.id === codigo);
  if (!accesorio) return null;
  const estado = cargarEstado();
  const resultado = desbloquearAccesorioQR(estado, accesorio);
  return { nombre: accesorio.nombre, nuevo: resultado === 'nuevo' };
};

// Los textos vienen de los JSON: se escapan antes de ponerlos en el HTML
const escapar = (texto) => String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Monedas del usuario; al montar la interfaz apunta a las del progreso guardado (jardin-estado.js)
let monedas = { plata: 0, oro: 0 };

const NOMBRE_MONEDA = { plata: 'monedas de plata', oro: 'monedas de oro' };

const ICONOS = {
  tienda: '<svg viewBox="0 0 24 24"><path d="M4.5 9L6 4h12l1.5 5" /><path d="M4 9h16v1.5a2.7 2.7 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0 2.7 2.7 0 0 1-5.3 0z" /><path d="M5.5 13v7h13v-7" /><path d="M10 20v-4h4v4" /></svg>',
  arboles: '<svg viewBox="0 0 24 24"><path d="M12 21v-6" /><path d="M12 15c-4 0-6.5-2.3-6.5-5.3 0-2.4 1.7-4.1 3.5-4.5C9.7 3.5 10.8 2.5 12 2.5s2.3 1 3 2.7c1.8.4 3.5 2.1 3.5 4.5 0 3-2.5 5.3-6.5 5.3z" /><path d="M8.5 21h7" /></svg>',
  pala: '<svg viewBox="0 0 24 24"><path d="M15 9l5.5-5.5" /><path d="M18.5 2l3.5 3.5" /><path d="M14.6 8.6l-1.2-1.2a1.4 1.4 0 0 0-2 0L4.9 13.9c-1.7 1.7-2.2 4.3-1.6 6 1.7.6 4.3.1 6-1.6l6.5-6.5a1.4 1.4 0 0 0 0-2z" /></svg>',
  regadera: '<svg viewBox="0 0 24 24"><path d="M4.5 9.5h9.5v8.5a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2z" /><path d="M14 12l5.5-4.5" /><path d="M18 6.2l3 2.6" /><path d="M7 9.5V8a2.25 2.25 0 0 1 4.5 0v1.5" /><path d="M20 12.5v.01M21.5 15v.01M19 16v.01" /></svg>',
  parcela: '<svg viewBox="0 0 48 48"><path d="M6 30l18-9 18 9-18 9z" fill="#7b4a2a" stroke="#5a3519" /><path d="M12 30l12-6M18 33l12-6M24 36l12-6" stroke="#5a3519" /><path d="M6 30v-7M24 21v-7M42 30v-7M24 39v-7M6 25l18-9 18 9M6 28l18-9 18 9" stroke="#8a5a2e" stroke-width="1.8" fill="none" /></svg>',
  imagen: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M20.5 16l-5-5-8.5 8.5" /></svg>',
  mas: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>',
  pregunta: '<svg viewBox="0 0 24 24"><path d="M9 9.5a3 3 0 1 1 4.2 2.75c-.8.4-1.2 1-1.2 1.85v.4" /><path d="M12 18v.01" /></svg>',
  caja: '<svg viewBox="0 0 24 24"><rect x="3.5" y="9" width="17" height="11.5" rx="1.5" /><path d="M2.5 6.5h19V9h-19z" /><path d="M12 6.5v14" /><path d="M12 6.5C10 3 7 3 7.2 5c.2 1.3 2.6 1.5 4.8 1.5zM12 6.5c2-3.5 5-3.5 4.8-1.5-.2 1.3-2.6 1.5-4.8 1.5z" /></svg>',
};
ICONOS.plantar = ICONOS.arboles;
// Grupito de personas (panel "Actividad": likes recibidos y buscar jardines)
ICONOS.actividad = '<svg viewBox="0 0 24 24"><circle cx="12" cy="7.5" r="3" /><path d="M6.5 19.5v-1a5.5 5.5 0 0 1 11 0v1" /><circle cx="5.2" cy="10" r="2.2" /><path d="M1.8 18.5v-.6a3.6 3.6 0 0 1 4.6-3.4" /><circle cx="18.8" cy="10" r="2.2" /><path d="M22.2 18.5v-.6a3.6 3.6 0 0 0-4.6-3.4" /></svg>';
ICONOS.mano = '<svg viewBox="0 0 24 24"><path d="M9 11.5V5a1.5 1.5 0 0 1 3 0v5.5" /><path d="M12 10V8.5a1.5 1.5 0 0 1 3 0V11" /><path d="M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.6a6 6 0 0 1-4.6-2.2l-2.6-3.3a1.6 1.6 0 0 1 2.3-2.2L9 15" /></svg>';
ICONOS.candado ='<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /><path d="M12 14.5v2.5" /></svg>';

/** Moneda en SVG; la de oro es dorada y la de plata gris claro, con una hoja grabada */
function moneda(tipo, clase = '') {
  const [claro, oscuro, borde] = tipo === 'oro'
    ? ['#ffe58a', '#f2b01e', '#c98a0b']
    : ['#f7f8f9', '#b8bec4', '#8a9197'];
  const id = `moneda-${tipo}`;
  return `<svg class="jardin-moneda ${clase}" viewBox="0 0 24 24" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${claro}" /><stop offset="1" stop-color="${oscuro}" />
    </linearGradient></defs>
    <circle cx="12" cy="12" r="10.5" fill="url(#${id})" stroke="${borde}" stroke-width="1.2" />
    <circle cx="12" cy="12" r="7.6" fill="none" stroke="${borde}" stroke-width="0.9" opacity="0.7" />
    <path d="M12 16.5c-2.6-1-3.6-3-3.3-5.8 2.6.2 4.3 1.6 4.6 4.1M12 16.5c.1-3.2 1.5-5.6 4-6.6.4 2.7-1.1 5.5-4 6.6z" fill="${borde}" opacity="0.75" />
  </svg>`;
}

function chipMonedas(clase = '') {
  return `<div class="jardin-monedas ${clase}" aria-label="Tus monedas">
    <span class="jardin-moneda-chip" title="Monedas de plata">${moneda('plata')}<strong data-moneda="plata">${monedas.plata}</strong></span>
    <span class="jardin-moneda-chip" title="Monedas de oro">${moneda('oro')}<strong data-moneda="oro">${monedas.oro}</strong></span>
  </div>`;
}

function botonPrecio({ moneda: tipo, valor }, sobre = null, espacio = null) {
  const alcanza = monedas[tipo] >= valor;
  const etiqueta = `${valor} ${NOMBRE_MONEDA[tipo]}`;
  return `<button type="button" class="tienda-comprar" data-moneda="${tipo}" data-valor="${valor}" ${sobre ? `data-sobre="${escapar(sobre)}"` : ''}
    ${espacio ? `data-espacio="${espacio}"` : ''}
    ${alcanza ? '' : 'disabled'} aria-label="Comprar por ${etiqueta}" title="${alcanza ? `Comprar por ${etiqueta}` : `Te faltan ${NOMBRE_MONEDA[tipo]}`}">
    ${moneda(tipo)}<span>${valor}</span>
  </button>`;
}

const IMAGEN_PENDIENTE = `${ICONOS.imagen}<span>Imagen pendiente</span>`;

const ORDEN_RAREZA = Object.keys(RAREZA);

/** Probabilidad (texto "12 %") de cada rareza en un sobre, sin contar las que no tienen accesorios */
function probabilidadesSobre(sobre, accesorios) {
  const rarezas = ORDEN_RAREZA.filter((r) => sobre.probabilidades[r] > 0 && accesorios.some((a) => a.rareza === r));
  const total = rarezas.reduce((s, r) => s + sobre.probabilidades[r], 0);
  return rarezas.map((r) => {
    const pct = (sobre.probabilidades[r] / total) * 100 * (1 - sobre.arbol.probabilidad);
    return [r, `${pct < 1 ? pct.toFixed(1) : Math.round(pct)} %`];
  });
}

/**
 * Revelación del premio en la escena del sobre (`arbol` es la planta o el exclusivo cuando el premio
 * es un árbol). El brillo y el color de la tarjeta dependen de la rareza.
 */
function htmlRevelacion(sobre, premio, arbol, copias = 1) {
  let imagen, nombre, detalle, rareza, etiqueta = '';
  if (premio.tipo === 'accesorio') {
    imagen = imagenAccesorio(premio.accesorio);
    nombre = premio.accesorio.nombre;
    rareza = premio.rareza;
    detalle = 'Ya está en tu inventario: toca la copa, el rostro o el cuello de un árbol para ponérselo.';
  } else {
    imagen = ICONOS.arboles;
    nombre = arbol?.nombre || premio.codigo;
    rareza = arbol?.info_juego?.rareza in RAREZA ? arbol.info_juego.rareza : arbol?.exclusivo ? 'exclusiva' : 'comun';
    etiqueta = premio.nuevo ? '¡Árbol nuevo!' : `Copia · tienes ${copias}`;
    detalle = premio.nuevo
      ? 'Desbloqueado: búscalo en "Árboles" para plantarlo.'
      : 'Búscalo en "Árboles" para plantarlo otra vez.';
  }
  return `
    <div class="sobre-revelacion sobre-revelacion--${rareza}${premio.nuevo ? ' sobre-revelacion--nuevo' : ''}" aria-live="polite">
      <div class="sobre-rayos" aria-hidden="true"></div>
      <div class="sobre-tarjeta">
        <span class="sobre-tarjeta-tipo">${premio.tipo === 'arbol' ? 'Árbol' : 'Accesorio'}</span>
        <span class="sobre-tarjeta-imagen sobre-tarjeta-imagen--${premio.tipo}" aria-hidden="true">${imagen}</span>
        <span class="caja-rareza caja-rareza--${rareza}">${RAREZA[rareza]}</span>
        <strong class="sobre-tarjeta-nombre" id="sobreEscenaTitulo">${escapar(nombre)}</strong>
        ${etiqueta ? `<span class="sobre-tarjeta-etiqueta">${escapar(etiqueta)}</span>` : ''}
        <p class="sobre-tarjeta-detalle">${escapar(detalle)}</p>
      </div>
      <div class="sobre-acciones">
        <button type="button" class="sobre-listo">Listo</button>
        <span class="sobre-otro">Abrir otro ${botonPrecio(sobre.precio, sobre.id)}</span>
      </div>
    </div>`;
}

function htmlTienda(catalogo, estado, pestana = 'sobres') {
  // Conseguido: lo tiene en el inventario, puesto en algún árbol o ya lo canjeó con su QR
  const puestos = new Set(Object.values(estado.accesorios).flatMap((zonas) => Object.values(zonas)));
  const conseguido = (a) => (estado.inventario[a.id] || 0) > 0 || puestos.has(a.id) || accesorioCanjeadoQR(estado, a.id);
  const tarjetas = !catalogo
    ? '<p class="tienda-error">No se pudo cargar el catálogo de la tienda. Inténtalo de nuevo más tarde.</p>'
    : catalogo.accesorios.length === 0
      ? '<p class="tienda-error">Aún no hay accesorios en la tienda.</p>'
      : [...catalogo.accesorios].sort((a, b) => ORDEN_RAREZA.indexOf(a.rareza) - ORDEN_RAREZA.indexOf(b.rareza)).map((a) => {
        const unidades = estado.inventario[a.id] || 0;
        return `
    <article class="tienda-item tienda-item--${a.rareza}${conseguido(a) ? '' : ' tienda-item--falta'}">
      <div class="tienda-item-imagen">
        ${!conseguido(a) ? `${ICONOS.candado}<span>Bloqueado</span>`
          : a.imagen ? `<img src="${CARPETA_ACCESORIOS}${encodeURIComponent(a.imagen)}" alt="" data-pendiente>`
            : IMAGEN_PENDIENTE}
      </div>
      <span class="caja-rareza caja-rareza--${a.rareza}">${RAREZA[a.rareza]}</span>
      <h4 class="tienda-item-nombre">${escapar(a.nombre)}</h4>
      ${a.desbloqueo_qr === true
        ? (accesorioCanjeadoQR(estado, a.id)
          ? '<p class="tienda-item-qr tienda-item-qr--listo">Canjeado con QR</p>'
          : '<p class="tienda-item-qr">Escanea su código QR</p>')
        : ''}
      <p class="tienda-item-unidades">${unidades > 0 ? `Tienes ${unidades}` : conseguido(a) ? 'Puesto en un árbol' : 'Aún no lo tienes'}</p>
    </article>`;
      }).join('');
  const sobres = catalogo?.sobres.tipos || [];
  const tarjetasSobres = !catalogo
    ? '<p class="tienda-error">No se pudo cargar el catálogo de la tienda. Inténtalo de nuevo más tarde.</p>'
    : sobres.length === 0
      ? '<p class="tienda-error">Aún no hay sobres en la tienda.</p>'
      : sobres.map((s) => `
    <article class="tienda-sobre tienda-sobre--${escapar(s.id)}">
      <div class="tienda-sobre-imagen">
        ${s.imagen ? `<img src="${rutaSobre(s.imagen)}" alt="" data-pendiente>` : IMAGEN_PENDIENTE}
      </div>
      <h4 class="tienda-item-nombre">${escapar(s.nombre)}</h4>
      <ul class="tienda-sobre-probabilidades">
        ${probabilidadesSobre(s, catalogo.accesorios).map(([r, pct]) => `
        <li><span class="caja-rareza caja-rareza--${r}">${RAREZA[r]}</span><span>${pct}</span></li>`).join('')}
      </ul>
      ${botonPrecio(s.precio, s.id)}
    </article>`).join('');
  const precioParcela = catalogo?.precioParcela;
  const puedeAmpliar = celdasParaAmpliar(estado).length > 0;
  const precioRegadera = catalogo?.precioRegadera;
  const capacidad = estado.regadera.capacidad;
  const regaderaAmpliable = puedeAmpliarRegadera(estado);

  return `
    <header class="jardin-hoja-cabecera">
      <div>
        <span class="jardin-hoja-subtitulo">Mi jardín</span>
        <h3 class="jardin-hoja-titulo" id="jardinTiendaTitulo">Tienda</h3>
      </div>
      <button type="button" class="jardin-hoja-cerrar" aria-label="Cerrar tienda">&times;</button>
    </header>
    <div class="jardin-hoja-saldo">
      <span>Tus monedas</span>
      ${chipMonedas('jardin-monedas--claro')}
    </div>
    <div class="jardin-pestanas" role="tablist" aria-label="Secciones de la tienda">
      <button type="button" role="tab" class="jardin-pestana" aria-selected="${pestana === 'sobres'}" data-pestana="sobres">Sobres</button>
      <button type="button" role="tab" class="jardin-pestana" aria-selected="${pestana === 'accesorios'}" data-pestana="accesorios">Colección</button>
      <button type="button" role="tab" class="jardin-pestana" aria-selected="${pestana === 'espacios'}" data-pestana="espacios">Espacios</button>
    </div>
    <div class="jardin-hoja-cuerpo">
      <div class="tienda-sobres" data-contenido="sobres" role="tabpanel" ${pestana === 'sobres' ? '' : 'hidden'}>
        ${tarjetasSobres}
        <p class="tienda-nota">Cada sobre trae un solo premio: un accesorio o, a veces, una copia de uno de tus árboles para plantarlo otra vez. Muy rara vez desbloquea un árbol nuevo: ¡recorre el sendero y escanea sus QR!</p>
      </div>
      <div class="tienda-grilla" data-contenido="accesorios" role="tabpanel" ${pestana === 'accesorios' ? '' : 'hidden'}>${tarjetas}</div>
      <div class="tienda-espacios" data-contenido="espacios" role="tabpanel" ${pestana === 'espacios' ? '' : 'hidden'}>
        <article class="tienda-espacio">
          <div class="tienda-espacio-icono">${ICONOS.parcela}</div>
          <div class="tienda-espacio-texto">
            <h4>Nueva parcela</h4>
            <p>${puedeAmpliar
              ? `Amplía tu jardín para plantar más árboles. Tienes <strong>${estado.parcelas}</strong> parcelas.`
              : `Tu jardín ya tiene el tamaño máximo: <strong>${estado.parcelas}</strong> parcelas.`}</p>
          </div>
          ${precioParcela && puedeAmpliar ? botonPrecio(precioParcela, null, 'parcela') : ''}
        </article>
        <p class="tienda-nota">Al comprar una parcela, tú eliges en qué lugar libre, pegado al jardín, se coloca. Los árboles que desbloquees y no quepan se guardan para plantarlos después.</p>
        <article class="tienda-espacio">
          <div class="tienda-espacio-icono">${ICONOS.regadera}</div>
          <div class="tienda-espacio-texto">
            <h4>Espacio de 1 L</h4>
            <p>${regaderaAmpliable
              ? `Una ranura más en la regadera para guardar otro riego. Hoy guarda <strong>${capacidad}</strong> L.`
              : `Tu regadera ya tiene el tamaño máximo: <strong>${capacidad}</strong> L.`}</p>
          </div>
          ${precioRegadera && regaderaAmpliable ? botonPrecio(precioRegadera, null, 'regadera') : ''}
        </article>
        <p class="tienda-nota">Cada litro guarda un riego y se recarga solo cada 15 minutos. El espacio nuevo llega vacío y empieza a llenarse enseguida.</p>
      </div>
    </div>`;
}

function htmlListaArboles(arboles, { estado, parcelaDestino }) {
  const libres = parcelasLibres(estado, estado.parcelas);
  const plantado = (p) => parcelaDe(estado, p.codigoQR) !== null;
  const cantidadPlantados = arboles.filter(plantado).length;
  // Una fila por especie: el original y sus copias de los sobres juntos, con un contador
  const grupos = new Map();
  for (const p of arboles) {
    const base = p.copiaDe || p.codigoQR;
    if (!grupos.has(base)) grupos.set(base, []);
    grupos.get(base).push(p);
  }
  const filasDatos = [...grupos.values()].map((copias) => ({
    arbol: copias[0],
    total: copias.length,
    plantadas: copias.filter(plantado),
    guardada: copias.find((p) => !plantado(p)) || null,
  }));
  // Primero las especies con algún árbol guardado (los que se pueden plantar) y después las ya plantadas
  filasDatos.sort((a, b) => !a.guardada - !b.guardada);

  const filas = filasDatos.length
    ? filasDatos.map(({ arbol: p, total, plantadas, guardada }) => {
      const guardadas = total - plantadas.length;
      // Con una sola copia, la etiqueta de siempre; con varias, el contador debajo de los botones
      const estadoTexto = plantadas.length ? `Parcela ${parcelaDe(estado, plantadas[0].codigoQR) + 1}` : 'Guardado';
      const contador = [plantadas.length && `${plantadas.length} plantado${plantadas.length > 1 ? 's' : ''}`,
        guardadas && `${guardadas} guardado${guardadas > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
      const accion = `
        <div class="lista-arbol-acciones">
          <div class="lista-arbol-botones">
            ${total === 1 ? `<span class="lista-arbol-estado${guardada ? '' : ' lista-arbol-estado--plantado'}">${estadoTexto}</span>` : ''}
            ${guardada ? `<button type="button" class="lista-arbol-plantar" data-codigo="${escapar(guardada.codigoQR)}"
                 ${libres ? '' : 'disabled title="No hay parcelas libres: compra una en la tienda"'}>Plantar</button>` : ''}
          </div>
          ${total > 1 ? `<span class="lista-arbol-contador"><strong>×${total}</strong> ${contador}</span>` : ''}
        </div>`;
      return `
      <li class="lista-arbol">
        <span class="lista-arbol-icono" aria-hidden="true">${ICONOS.arboles}</span>
        <span class="lista-arbol-texto">
          <strong>${escapar(p.nombre)}</strong>
          <em>${escapar(p.especie || p.nombre_cientifico || '')}${p.exclusivo ? ' · <span class="lista-arbol-exclusivo">Exclusivo</span>' : ''}</em>
        </span>
        ${accion}
      </li>`;
    }).join('')
    : '<li class="lista-vacia">Aún no tienes árboles. Escanea los códigos QR del campus para conseguirlos.</li>';

  const subtitulo = parcelaDestino !== null && parcelaDestino !== undefined
    ? `Elige un árbol para la parcela ${parcelaDestino + 1}`
    : 'Mi jardín';

  return `
    <header class="jardin-hoja-cabecera">
      <div>
        <span class="jardin-hoja-subtitulo">${subtitulo}</span>
        <h3 class="jardin-hoja-titulo" id="jardinArbolesTitulo">Mis árboles</h3>
      </div>
      <button type="button" class="jardin-hoja-cerrar" aria-label="Cerrar lista de árboles">&times;</button>
    </header>
    <p class="lista-resumen">
      <strong>${grupos.size}</strong> desbloqueados · <strong>${cantidadPlantados}</strong> plantados ·
      <strong>${libres}</strong> parcelas libres
    </p>
    <div class="jardin-hoja-cuerpo"><ul class="lista-arboles">${filas}</ul></div>`;
}

// Zonas del árbol donde van los accesorios (misma clave que `zona` en tienda-jardin.json)
const ZONAS = { cabeza: 'Copa', rostro: 'Rostro', cuello: 'Cuello' };

const imagenAccesorio = (a) => (a.imagen
  ? `<img src="${CARPETA_ACCESORIOS}${encodeURIComponent(a.imagen)}" alt="">`
  : ICONOS.imagen);

/** Accesorios comprados para una zona de un árbol (y el que ya lleva puesto, para quitarlo) */
function htmlElegirAccesorio(zona, nombreArbol, opciones, puestoId, estado) {
  const filas = opciones.length
    ? opciones.map((a) => {
      const puesto = a.id === puestoId;
      return `
      <li class="lista-arbol">
        <span class="lista-arbol-icono" aria-hidden="true">${imagenAccesorio(a)}</span>
        <span class="lista-arbol-texto">
          <strong>${escapar(a.nombre)}</strong>
          <em>${puesto ? 'Puesto en este árbol' : `Tienes ${estado.inventario[a.id] || 0}`}</em>
        </span>
        ${puesto
          ? `<button type="button" class="colocar-arbol-quitar" data-id="${escapar(a.id)}">Quitar</button>`
          : `<button type="button" class="colocar-arbol-boton" data-id="${escapar(a.id)}">Poner</button>`}
      </li>`;
    }).join('')
    : `<li class="lista-vacia">No tienes accesorios para esta zona.
         <button type="button" class="lista-ir-tienda">Ir a la tienda</button></li>`;

  return `
    <header class="jardin-hoja-cabecera">
      <div>
        <span class="jardin-hoja-subtitulo">${escapar(nombreArbol)}</span>
        <h3 class="jardin-hoja-titulo" id="jardinAccesorioTitulo">${ZONAS[zona]}</h3>
      </div>
      <button type="button" class="jardin-hoja-cerrar" aria-label="Cerrar">&times;</button>
    </header>
    <div class="jardin-hoja-cuerpo"><ul class="lista-arboles">${filas}</ul></div>`;
}

function htmlPregunta(pregunta) {
  const letras = ['A', 'B', 'C', 'D'];
  return `
    <header class="jardin-hoja-cabecera">
      <div>
        <span class="jardin-hoja-subtitulo">Acierta y gana ${PREGUNTA.premio.oro} de oro y ${PREGUNTA.premio.plata} de plata</span>
        <h3 class="jardin-hoja-titulo" id="jardinPreguntaTitulo">Pregunta del jardín</h3>
      </div>
      <button type="button" class="jardin-hoja-cerrar" aria-label="Cerrar pregunta">&times;</button>
    </header>
    <div class="jardin-hoja-cuerpo">
      <p class="pregunta-texto">${escapar(pregunta.pregunta)}</p>
      <div class="pregunta-opciones">
        ${pregunta.opciones.map((o, i) => `
        <button type="button" class="pregunta-opcion" data-opcion="${i}">
          <span class="pregunta-letra">${letras[i]}</span><span>${escapar(o)}</span>
        </button>`).join('')}
      </div>
      <p class="pregunta-resultado" hidden aria-live="polite"></p>
    </div>`;
}

/** Caja cerrada (toca para abrir) o el premio que salió */
function htmlCaja(premio = null) {
  let cuerpo;
  if (!premio) {
    cuerpo = `
      <button type="button" class="caja-sorpresa" aria-label="Abrir la caja sorpresa">
        <img src="/static/iconos/caja-sorpresa.gif" alt="">
      </button>
      <p class="caja-texto">Toca la caja para abrirla</p>`;
  } else {
    const imagen = premio.tipo === 'monedas' ? moneda(premio.objeto, 'caja-premio-moneda')
      : premio.tipo === 'accesorio' ? imagenAccesorio(premio.accesorio)
        : ICONOS.arboles;
    const nombre = premio.tipo === 'monedas' ? `${premio.cantidad} ${NOMBRE_MONEDA[premio.objeto]}`
      : premio.tipo === 'accesorio' ? `${premio.cantidad > 1 ? `${premio.cantidad} × ` : ''}${premio.accesorio.nombre}`
        : premio.arbol.nombre;
    const detalle = premio.tipo === 'monedas' ? 'Ya están en tu monedero'
      : premio.tipo === 'accesorio' ? 'Ya está en tu inventario: tócale la copa, el rostro o el cuello a un árbol para ponérselo'
        : `Árbol exclusivo · ${premio.arbol.especie}. Búscalo en "Árboles" para plantarlo`;
    const rareza = RAREZA[premio.rareza] ? `<span class="caja-rareza caja-rareza--${escapar(premio.rareza)}">${RAREZA[premio.rareza]}</span>` : '';
    cuerpo = `
      <div class="caja-premio caja-premio--${premio.tipo}">
        <span class="caja-premio-imagen" aria-hidden="true">${imagen}</span>
        ${rareza}
        <strong class="caja-premio-nombre">${escapar(nombre)}</strong>
        <p class="caja-texto">${escapar(detalle)}</p>
      </div>
      <button type="button" class="caja-aceptar">¡Genial!</button>`;
  }
  return `
    <header class="jardin-hoja-cabecera">
      <div>
        <span class="jardin-hoja-subtitulo">${premio ? '¡Ganaste!' : 'Árboles exclusivos, monedas y accesorios'}</span>
        <h3 class="jardin-hoja-titulo" id="jardinCajaTitulo">Caja sorpresa</h3>
      </div>
      <button type="button" class="jardin-hoja-cerrar" aria-label="Cerrar caja sorpresa">&times;</button>
    </header>
    <div class="jardin-hoja-cuerpo caja-cuerpo" aria-live="polite">${cuerpo}</div>`;
}

/** Copia `n` (2, 3...) de un árbol: la misma especie con su propio id (ver idCopia en jardin-estado.js) */
export const copiaDeArbol = (arbol, n) => ({ ...arbol, codigoQR: idCopia(arbol.codigoQR, n), copiaDe: arbol.codigoQR });

/**
 * Árboles que el usuario ya tiene: los desbloqueados (mismo criterio que el álbum), los exclusivos de la
 * caja y una entrada más por cada copia ganada en los sobres (con `copiaDe` = codigoQR del original)
 */
export async function arbolesDelUsuario() {
  if (!window.plantsHandler) return [];
  const plantas = window.plantsHandler.plantas.length ? window.plantsHandler.plantas : await window.plantsHandler.loadPlants();
  const desbloqueados = plantas.filter((p) => !p.bloqueado || (window.unlocker && window.unlocker.isUnlocked(p.codigoQR)));
  const estado = cargarEstado();
  let exclusivos = [];
  try {
    const caja = await cargarCaja();
    exclusivos = estado.exclusivos.map((c) => caja.exclusivos.get(c)).filter(Boolean);
  } catch (err) {
    console.warn('No se pudieron leer los árboles exclusivos de la caja:', err);
  }
  return [...desbloqueados, ...exclusivos].flatMap((p) => [
    p, ...Array.from({ length: estado.copias[p.codigoQR] || 0 }, (_, i) => copiaDeArbol(p, i + 2)),
  ]);
}

/**
 * Agrega la interfaz 2D al jardín.
 * @param {object} opciones
 *   estado: progreso guardado (jardin-estado.js);
 *   alCambiarModo(modo): al tomar o soltar una herramienta ('pala', 'regadera', 'plantar', 'parcela' o null);
 *   alElegirArbol(codigoQR, parcela): al elegir un árbol para una parcela concreta;
 *   alComprarParcela(precio): al pulsar "Nueva parcela" en la tienda, antes de entrar al modo 'parcela';
 *   alAmpliarRegadera(): tras comprar un espacio de 1 L para la regadera (para refrescar su contador)
 *   (jardin.js muestra los lugares libres y cobra al confirmar).
 */
export function montarInterfazJuego(raiz, {
  estado, alCambiarModo, alElegirArbol, alCambiarAccesorios, alObservarArbol, alComprarParcela, alAmpliarRegadera, alGanarArbol,
  alVisitarJardin, alLeerLikes,
}) {
  monedas = estado.monedas;

  // Monedas en la barra superior, junto al botón de salir
  raiz.querySelector('.jardin-barra-derecha').insertAdjacentHTML('afterbegin', chipMonedas());

  raiz.insertAdjacentHTML('beforeend', `
    <div class="jardin-modo" hidden></div>
    <nav class="jardin-herramientas" aria-label="Herramientas del jardín">
      <button type="button" class="jardin-herramienta" data-accion="tienda">
        <span class="jardin-herramienta-icono">${ICONOS.tienda}</span><span>Tienda</span>
      </button>
      <button type="button" class="jardin-herramienta" data-accion="arboles">
        <span class="jardin-herramienta-icono">${ICONOS.arboles}</span><span>Árboles</span>
      </button>
      <button type="button" class="jardin-herramienta" data-accion="pala" aria-pressed="false">
        <span class="jardin-herramienta-icono">${ICONOS.pala}</span><span>Pala</span>
      </button>
      <button type="button" class="jardin-herramienta" data-accion="regadera" aria-pressed="false">
        <span class="jardin-herramienta-icono">${ICONOS.regadera}
          <span class="jardin-herramienta-contador" aria-hidden="true"></span>
        </span><span>Regadera</span>
      </button>
      <button type="button" class="jardin-herramienta" data-accion="actividad">
        <span class="jardin-herramienta-icono">${ICONOS.actividad}</span><span>Actividad</span>
      </button>
    </nav>
    <div class="jardin-zonas" hidden></div>
    <div class="jardin-panel" hidden>
      <div class="jardin-panel-fondo"></div>
      <section class="jardin-hoja" role="dialog" aria-modal="true"></section>
    </div>`);

  const panel = raiz.querySelector('.jardin-panel');
  const hoja = panel.querySelector('.jardin-hoja');
  const avisoModo = raiz.querySelector('.jardin-modo');
  let modoActual = null;     // 'pala', 'regadera', 'plantar' o null
  let arbolPendiente = null; // en modo 'plantar': { codigoQR, nombre }
  let avisoRegadera = null;  // texto del aviso con los riegos disponibles (lo calcula jardin.js)

  const textoModo = () => ({
    pala: 'Pala: toca un árbol para cambiarlo de lugar',
    regadera: escapar(avisoRegadera || 'Regadera: toca un árbol para regarlo'),
    plantar: `Toca una parcela vacía para plantar ${escapar(arbolPendiente?.nombre || '')}`,
    parcela: 'Toca un lugar marcado con + para poner la nueva parcela',
  }[modoActual]);

  function ponerModo(nuevo, arbol = null) {
    modoActual = nuevo;
    arbolPendiente = nuevo === 'plantar' ? arbol : null;
    raiz.querySelectorAll('.jardin-herramienta[aria-pressed]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.accion === modoActual));
    });
    avisoModo.hidden = !modoActual;
    if (modoActual) {
      avisoModo.innerHTML = `<span class="jardin-modo-icono">${ICONOS[modoActual]}</span><span class="jardin-modo-texto">${textoModo()}</span>
        <button type="button" class="jardin-modo-cancelar" aria-label="Soltar herramienta">&times;</button>`;
      avisoModo.querySelector('.jardin-modo-cancelar').addEventListener('click', () => ponerModo(null));
    }
    alCambiarModo?.(modoActual);
  }

  let alCerrarPanel = null; // se llama una vez cuando el panel actual se cierra o se reemplaza

  function soltarAlCerrar() {
    const fn = alCerrarPanel;
    alCerrarPanel = null;
    fn?.();
  }

  function cerrarPanel() {
    panel.hidden = true;
    hoja.innerHTML = '';
    soltarAlCerrar();
  }

  function abrirPanel(html, idTitulo, alCerrar = null) {
    if (modoActual) ponerModo(null); // al abrir un panel se suelta la herramienta
    soltarAlCerrar();
    alCerrarPanel = alCerrar;
    hoja.innerHTML = html;
    hoja.setAttribute('aria-labelledby', idTitulo);
    panel.hidden = false;
    hoja.querySelector('.jardin-hoja-cerrar').addEventListener('click', cerrarPanel);
    hoja.querySelector('.jardin-hoja-cerrar').focus();
  }

  /**
   * Compra y abre un sobre: se cobra y se sortea al momento (si se cierra el panel durante la
   * animación, el premio ya quedó guardado), se muestra el GIF de apertura y luego el premio.
   */
  let comprandoSobre = false; // evita cobrar dos veces con un doble toque
  async function comprarSobre(catalogo, sobre) {
    if (comprandoSobre || monedas[sobre.precio.moneda] < sobre.precio.valor) return;
    comprandoSobre = true;
    try {
      await abrirSobreComprado(catalogo, sobre);
    } finally {
      comprandoSobre = false;
    }
  }

  async function abrirSobreComprado(catalogo, sobre) {
    const { duracionMs, enfriamiento } = catalogo.sobres;
    const mios = (await arbolesDelUsuario()).filter((p) => !p.copiaDe); // una vez por especie
    const plantas = window.plantsHandler?.plantas || [];
    const bloqueadas = window.unlocker
      ? plantas.filter((p) => p.bloqueado && !window.unlocker.isUnlocked(p.codigoQR))
      : [];
    const premio = abrirSobre(estado, sobre, {
      accesorios: catalogo.accesorios,
      // Rareza de cada árbol (plantas.json → info_juego.rareza); sin ella, exclusivo si viene de la caja y si no común
      conocidos: mios.map((p) => ({
        codigo: p.codigoQR,
        rareza: p.info_juego?.rareza in RAREZA ? p.info_juego.rareza : p.exclusivo ? 'exclusiva' : 'comun',
      })),
      nuevos: bloqueadas.map((p) => p.codigoQR),
      enfriamiento,
    });
    if (!premio) return;
    let arbol = null;
    if (premio.tipo === 'arbol') {
      arbol = (premio.nuevo ? bloqueadas : mios).find((p) => p.codigoQR === premio.codigo) || null;
      if (premio.nuevo) window.unlocker.unlockPlant(premio.codigo);
      // Nuevo o repetido, queda guardado para plantarlo (el repetido como una copia más)
      if (arbol) alGanarArbol?.(premio.nuevo ? arbol : { ...arbol, codigoQR: premio.id, copiaDe: arbol.codigoQR });
    }
    api.actualizarMonedas(sobre.precio.moneda);

    mostrarEscenaSobre(catalogo, sobre, premio, arbol, duracionMs);
  }

  // Gesto de rasgar: se empieza en la franja de arriba del sobre y se desliza de lado
  const RASGAR = {
    franja: 0.34,    // alto de la franja de arriba donde empieza el gesto (fracción del sobre)
    tolerancia: 0.5, // si el dedo baja más de esto (fracción del sobre), el corte se cancela
    recorrido: 0.6,  // cuánto hay que deslizar de lado (fracción del ancho) para abrirlo
  };

  /**
   * Escena del sobre: fondo oscuro sobre todo el jardín y el sobre cerrado en el centro, con una mano
   * que enseña a rasgar la parte de arriba. Al rasgarlo arranca el GIF de apertura (tocarlo lo salta) y
   * luego se revela el premio. "Listo" vuelve a la tienda; "Abrir otro" compra otro igual.
   * El premio ya se entregó al comprar: aquí solo se muestra.
   */
  function mostrarEscenaSobre(catalogo, sobre, premio, arbol, duracionMs) {
    if (modoActual) ponerModo(null);
    cerrarPanel();
    raiz.querySelector('.sobre-escena')?.remove();
    raiz.insertAdjacentHTML('beforeend', `
      <div class="sobre-escena sobre-escena--${escapar(sobre.id)}" role="dialog" aria-modal="true" aria-label="${escapar(sobre.nombre)}">
        <div class="sobre-escena-contenido">
          <span class="sobre-escena-titulo">${escapar(sobre.nombre)}</span>
          <div class="sobre-rasgar" tabindex="0" role="button" aria-label="Rasgar el sobre para abrirlo">
            <img class="sobre-rasgar-imagen" src="${rutaSobre(sobre.imagen || sobre.animacion)}" alt="" draggable="false">
            <div class="sobre-corte" aria-hidden="true"><span class="sobre-corte-progreso"></span></div>
            <div class="sobre-guia" aria-hidden="true">
              <span class="sobre-guia-estela"></span>
              <span class="sobre-guia-mano">${ICONOS.mano}</span>
            </div>
          </div>
          <p class="sobre-escena-ayuda">Desliza el dedo por la parte de arriba para rasgarlo</p>
        </div>
      </div>`);
    const escena = raiz.querySelector('.sobre-escena');
    const contenido = escena.querySelector('.sobre-escena-contenido');
    const zona = escena.querySelector('.sobre-rasgar');
    const progreso = escena.querySelector('.sobre-corte-progreso');
    let gesto = null; // { id, x0, y0 } mientras el dedo está rasgando
    let abierto = false;
    let espera = null;

    // La línea de corte va del 8 % al 92 % del ancho del sobre (ver .sobre-corte en index.css)
    const enLinea = (x) => Math.max(0, Math.min(1, (x - 0.08) / 0.84));
    const pintarCorte = (desde, hasta) => {
      const [a, b] = [enLinea(desde), enLinea(hasta)];
      progreso.style.left = `${Math.min(a, b) * 100}%`;
      progreso.style.width = `${Math.abs(b - a) * 100}%`;
    };
    const cancelarGesto = () => {
      gesto = null;
      zona.classList.remove('rasgando');
      pintarCorte(0, 0);
    };

    // Rasgado completo: el sobre cerrado se cambia por el GIF de apertura (un <img> nuevo para que empiece desde el principio)
    const abrir = () => {
      if (abierto || !escena.isConnected) return;
      abierto = true;
      gesto = null;
      zona.outerHTML = `
        <button type="button" class="sobre-abriendo" aria-label="Saltar animación">
          <img src="${rutaSobre(sobre.animacion || sobre.imagen)}" alt="">
        </button>`;
      contenido.querySelector('.sobre-escena-ayuda').textContent = '¡Abriendo!';
      const animacion = contenido.querySelector('.sobre-abriendo');
      animacion.addEventListener('click', revelar);
      animacion.focus();
      espera = setTimeout(revelar, duracionMs);
    };

    zona.addEventListener('pointerdown', (e) => {
      if (abierto) return;
      const caja = zona.getBoundingClientRect();
      const y = (e.clientY - caja.top) / caja.height;
      if (y > RASGAR.franja) return; // hay que empezar por la parte de arriba
      gesto = { id: e.pointerId, x0: (e.clientX - caja.left) / caja.width, y0: y };
      zona.setPointerCapture(e.pointerId);
      zona.classList.add('rasgando');
      e.preventDefault();
    });
    zona.addEventListener('pointermove', (e) => {
      if (!gesto || e.pointerId !== gesto.id) return;
      const caja = zona.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - caja.left) / caja.width));
      const y = (e.clientY - caja.top) / caja.height;
      if (y > RASGAR.tolerancia) { cancelarGesto(); return; } // se fue hacia abajo: no cuenta
      pintarCorte(gesto.x0, x);
      if (Math.abs(x - gesto.x0) >= RASGAR.recorrido) abrir();
    });
    zona.addEventListener('pointerup', cancelarGesto);
    zona.addEventListener('pointercancel', cancelarGesto);
    // Con teclado (Enter o espacio) también se puede abrir
    zona.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); }
    });

    let revelado = false;
    const revelar = () => {
      if (revelado || !escena.isConnected) return;
      revelado = true;
      clearTimeout(espera);
      contenido.innerHTML = htmlRevelacion(sobre, premio, arbol, 1 + (estado.copias[premio.codigo] || 0));
      escena.setAttribute('aria-labelledby', 'sobreEscenaTitulo');
      contenido.querySelectorAll('.sobre-tarjeta-imagen img').forEach((img) => {
        img.addEventListener('error', () => { img.replaceWith(document.createRange().createContextualFragment(ICONOS.imagen)); }, { once: true });
      });
      contenido.querySelector('.sobre-listo').addEventListener('click', () => { escena.remove(); abrirTienda('sobres'); });
      contenido.querySelector('.tienda-comprar[data-sobre]').addEventListener('click', () => comprarSobre(catalogo, sobre));
      contenido.querySelector('.sobre-listo').focus();
    };
    zona.focus();
  }

  async function abrirTienda(pestanaInicial = 'sobres') {
    let catalogo = null;
    try {
      catalogo = await cargarCatalogo();
    } catch (err) {
      console.error('No se pudo cargar la tienda:', err);
    }
    abrirPanel(htmlTienda(catalogo, estado, pestanaInicial), 'jardinTiendaTitulo');
    // Si la imagen de un accesorio no existe, se muestra el recuadro de "Imagen pendiente"
    hoja.querySelectorAll('img[data-pendiente]').forEach((img) => {
      img.addEventListener('error', () => { img.parentElement.innerHTML = IMAGEN_PENDIENTE; }, { once: true });
    });
    hoja.querySelectorAll('.jardin-pestana').forEach((pestana) => {
      pestana.addEventListener('click', () => {
        hoja.querySelectorAll('.jardin-pestana').forEach((p) => p.setAttribute('aria-selected', String(p === pestana)));
        hoja.querySelectorAll('[data-contenido]').forEach((c) => { c.hidden = c.dataset.contenido !== pestana.dataset.pestana; });
      });
    });
    // Precarga las animaciones para que el GIF arranque al instante al comprar
    catalogo?.sobres.tipos.forEach((s) => { if (s.animacion) new Image().src = rutaSobre(s.animacion); });
    hoja.querySelectorAll('.tienda-comprar[data-sobre]').forEach((boton) => {
      boton.addEventListener('click', () => {
        const sobre = catalogo?.sobres.tipos.find((s) => s.id === boton.dataset.sobre);
        if (sobre) comprarSobre(catalogo, sobre);
      });
    });
    hoja.querySelector('.tienda-comprar[data-espacio="parcela"]')?.addEventListener('click', () => {
      // Nueva parcela: se cierra la tienda y se elige en el jardín dónde ponerla; se cobra al confirmar allí
      if (!catalogo?.precioParcela) return;
      cerrarPanel();
      alComprarParcela?.(catalogo.precioParcela);
      ponerModo('parcela');
    });
    hoja.querySelector('.tienda-comprar[data-espacio="regadera"]')?.addEventListener('click', () => {
      // Espacio de 1 L: se cobra al momento y la regadera gana una ranura
      if (!catalogo?.precioRegadera || !comprarEspacioRegadera(estado, catalogo.precioRegadera)) return;
      api.actualizarMonedas(catalogo.precioRegadera.moneda);
      alAmpliarRegadera?.();
      abrirTienda('espacios');
    });
  }

  // --- Pregunta: botón "?" que aparece al azar arriba; al tocarlo, una pregunta con 4 opciones ---
  function quitarBotonPregunta() {
    raiz.querySelector('.jardin-pregunta-boton')?.remove();
  }

  async function mostrarBotonPregunta() {
    let preguntas = [];
    try {
      preguntas = await cargarPreguntas();
    } catch (err) {
      console.error('No se pudieron cargar las preguntas del jardín:', err);
      return;
    }
    const pregunta = elegirPregunta(estado, preguntas);
    if (!pregunta || raiz.querySelector('.jardin-pregunta-boton')) return;
    raiz.insertAdjacentHTML('beforeend', `
      <button type="button" class="jardin-pregunta-boton" aria-label="Responder una pregunta y ganar monedas">
        <span class="jardin-pregunta-icono">${ICONOS.pregunta}</span><span>Pregunta</span>
      </button>`);
    raiz.querySelector('.jardin-pregunta-boton').addEventListener('click', () => abrirPregunta(pregunta, preguntas.length));
  }

  function abrirPregunta(pregunta, totalPreguntas) {
    abrirPanel(htmlPregunta(pregunta), 'jardinPreguntaTitulo');
    const opciones = hoja.querySelectorAll('.pregunta-opcion');
    opciones.forEach((boton) => {
      boton.addEventListener('click', () => {
        const elegida = Number(boton.dataset.opcion);
        const acierto = responderPregunta(estado, pregunta, elegida, totalPreguntas);
        quitarBotonPregunta();
        opciones.forEach((b) => {
          b.disabled = true;
          const i = Number(b.dataset.opcion);
          if (i === pregunta.respuesta) b.classList.add('correcta');
          else if (i === elegida) b.classList.add('incorrecta');
        });
        const resultado = hoja.querySelector('.pregunta-resultado');
        resultado.classList.toggle('acierto', acierto);
        resultado.innerHTML = `<strong>${acierto
          ? `¡Correcto! Ganaste ${PREGUNTA.premio.oro} monedas de oro y ${PREGUNTA.premio.plata} de plata.`
          : 'Esta vez no fue. ¡Sigue explorando el campus!'}</strong>
          ${pregunta.explicacion ? `<span>${escapar(pregunta.explicacion)}</span>` : ''}`;
        resultado.hidden = false;
        if (acierto) api.actualizarMonedas('oro');
      });
    });
  }

  // --- Caja sorpresa: se abre sola al entrar si toca; si se cierra sin abrirla queda un botón para volver ---
  function quitarBotonCaja() {
    raiz.querySelector('.jardin-caja-boton')?.remove();
  }

  /** Abre el panel de la caja. Devuelve una promesa que se cumple al cerrar el panel */
  function mostrarCaja(caja) {
    if (!raiz.querySelector('.jardin-caja-boton')) {
      raiz.insertAdjacentHTML('beforeend', `
        <button type="button" class="jardin-caja-boton" aria-label="Abrir la caja sorpresa">
          <span class="jardin-pregunta-icono">${ICONOS.caja}</span><span>Caja sorpresa</span>
        </button>`);
      raiz.querySelector('.jardin-caja-boton').addEventListener('click', () => mostrarCaja(caja));
    }
    return new Promise((resolver) => {
      let ganado = null;
      // Al cerrar el panel se avisa del premio (logros.js), para que el logro no tape la revelación
      abrirPanel(htmlCaja(), 'jardinCajaTitulo', () => {
        if (ganado) document.dispatchEvent(new CustomEvent('cajaPremio', { detail: { id: ganado.id, tipo: ganado.tipo, rareza: ganado.rareza } }));
        resolver();
      });
      const boton = hoja.querySelector('.caja-sorpresa');
      boton.addEventListener('click', () => {
        if (boton.classList.contains('abriendo')) return;
        boton.classList.add('abriendo');
        setTimeout(() => {
          if (!hoja.contains(boton)) return; // se cerró mientras se sacudía: sigue sin abrir
          const premio = abrirCaja(estado, caja.premios, { idPrimera: caja.idPrimera });
          quitarBotonCaja();
          if (!premio) { cerrarPanel(); return; }
          ganado = premio;
          hoja.innerHTML = htmlCaja(premio); // mismo panel: el aviso de cierre (resolver) se mantiene
          hoja.querySelector('.jardin-hoja-cerrar').addEventListener('click', cerrarPanel);
          hoja.querySelector('.caja-aceptar').addEventListener('click', cerrarPanel);
          hoja.querySelector('.caja-aceptar').focus();
          hoja.querySelectorAll('.caja-premio-imagen img').forEach((img) => {
            img.addEventListener('error', () => { img.replaceWith(document.createRange().createContextualFragment(ICONOS.imagen)); }, { once: true });
          });
          if (premio.tipo === 'monedas') api.actualizarMonedas(premio.objeto);
          if (premio.tipo === 'arbol') alGanarArbol?.(premio.arbol);
        }, 900);
      });
    });
  }

  // --- Zonas del árbol elegido: un botón redondo por zona (copa, rostro, cuello) sobre el árbol ---
  const zonasCapa = raiz.querySelector('.jardin-zonas');
  let zonasArbol = null;   // { codigoQR, nombre, posiciones: { cabeza: {x, y}, rostro, cuello } }
  let catalogoZonas = null;

  function pintarZonas() {
    if (!zonasArbol) return;
    const { codigoQR, posiciones } = zonasArbol;
    zonasCapa.innerHTML = Object.entries(ZONAS).map(([zona, etiqueta]) => {
      const pos = posiciones[zona];
      if (!pos) return '';
      const id = accesorioEn(estado, codigoQR, zona);
      const puesto = id ? catalogoZonas?.accesorios.find((a) => a.id === id) : null;
      return `
      <div class="jardin-zona" data-zona="${zona}" style="left:${pos.x}px;top:${pos.y}px">
        <button type="button" class="jardin-zona-boton${puesto ? ' con-accesorio' : ''}"
          aria-label="${etiqueta}: ${puesto ? `cambiar ${escapar(puesto.nombre)}` : 'agregar accesorio'}">
          ${puesto ? imagenAccesorio(puesto) : ICONOS.mas}
        </button>
        ${puesto ? `<button type="button" class="jardin-zona-quitar" aria-label="Quitar ${escapar(puesto.nombre)}">&times;</button>` : ''}
        <span class="jardin-zona-nombre">${etiqueta}</span>
      </div>`;
    }).join('');
    zonasCapa.hidden = false;
    zonasCapa.querySelectorAll('.jardin-zona-boton').forEach((boton) => {
      boton.addEventListener('click', () => abrirElegirAccesorio(boton.parentElement.dataset.zona));
    });
    zonasCapa.querySelectorAll('.jardin-zona-quitar').forEach((boton) => {
      boton.addEventListener('click', () => {
        if (!quitarAccesorio(estado, codigoQR, boton.parentElement.dataset.zona)) return;
        alCambiarAccesorios?.(codigoQR);
        pintarZonas();
      });
    });
  }

  async function mostrarZonas({ codigoQR, nombre, posiciones }) {
    zonasArbol = { codigoQR, nombre, posiciones };
    if (!catalogoZonas) {
      try {
        catalogoZonas = await cargarCatalogo();
      } catch (err) {
        console.error('No se pudo cargar el catálogo de accesorios:', err);
      }
      if (zonasArbol?.codigoQR !== codigoQR) return; // se eligió otra cosa mientras cargaba
    }
    pintarZonas();
  }

  function reubicarZonas(posiciones) {
    if (!zonasArbol) return;
    zonasArbol.posiciones = posiciones;
    zonasCapa.querySelectorAll('.jardin-zona').forEach((el) => {
      const pos = posiciones[el.dataset.zona];
      if (pos) { el.style.left = `${pos.x}px`; el.style.top = `${pos.y}px`; }
    });
  }

  function ocultarZonas() {
    zonasArbol = null;
    zonasCapa.hidden = true;
    zonasCapa.innerHTML = '';
  }

  /** Accesorios comprados para una zona del árbol elegido: poner uno o quitar el que lleva */
  async function abrirElegirAccesorio(zona) {
    if (!zonasArbol) return;
    const { codigoQR, nombre } = zonasArbol;
    let catalogo = null;
    try {
      catalogo = await cargarCatalogo();
    } catch (err) {
      console.error('No se pudo cargar el catálogo de accesorios:', err);
    }
    const puestoId = accesorioEn(estado, codigoQR, zona);
    const opciones = (catalogo?.accesorios || []).filter((a) => a.zona === zona && ((estado.inventario[a.id] || 0) > 0 || a.id === puestoId));
    abrirPanel(htmlElegirAccesorio(zona, nombre, opciones, puestoId, estado), 'jardinAccesorioTitulo');
    hoja.querySelectorAll('.colocar-arbol-boton').forEach((boton) => {
      boton.addEventListener('click', () => {
        const accesorio = opciones.find((a) => a.id === boton.dataset.id);
        if (!accesorio || !ponerAccesorio(estado, codigoQR, accesorio)) return;
        alCambiarAccesorios?.(codigoQR);
        cerrarPanel();
        pintarZonas();
      });
    });
    hoja.querySelector('.colocar-arbol-quitar')?.addEventListener('click', () => {
      if (!quitarAccesorio(estado, codigoQR, zona)) return;
      alCambiarAccesorios?.(codigoQR);
      cerrarPanel();
      pintarZonas();
    });
    hoja.querySelector('.lista-ir-tienda')?.addEventListener('click', () => abrirTienda('sobres'));
  }

  /** Lista de árboles. Con `parcelaDestino`, el árbol elegido se planta directamente en esa parcela */
  async function abrirArboles(parcelaDestino = null) {
    const arboles = await arbolesDelUsuario();
    abrirPanel(htmlListaArboles(arboles, { estado, parcelaDestino }), 'jardinArbolesTitulo');
    hoja.querySelectorAll('.lista-arbol-plantar').forEach((boton) => {
      boton.addEventListener('click', () => {
        const arbol = arboles.find((p) => p.codigoQR === boton.dataset.codigo);
        if (!arbol) return;
        cerrarPanel();
        if (parcelaDestino !== null) alElegirArbol?.(arbol.codigoQR, parcelaDestino);
        else ponerModo('plantar', { codigoQR: arbol.codigoQR, nombre: arbol.nombre });
      });
    });
  }

  /**
   * Panel "Actividad": quiénes le dieron like al jardín y buscador de jardines por @username
   * (jardin-publico.js). Necesita cuenta e internet; desde cada fila se visita ese jardín.
   */
  function abrirActividad() {
    const jp = window.jardinPublico;
    const yo = window.cuenta?.perfil?.() || null;
    abrirPanel(`
      <header class="jardin-hoja-cabecera">
        <div>
          <span class="jardin-hoja-subtitulo">Mi jardín</span>
          <h3 class="jardin-hoja-titulo" id="jardinActividadTitulo">Actividad</h3>
        </div>
        <button type="button" class="jardin-hoja-cerrar" aria-label="Cerrar actividad">&times;</button>
      </header>
      <div class="jardin-hoja-cuerpo actividad-cuerpo">
        <label class="actividad-buscar">
          <span class="actividad-buscar-icono" aria-hidden="true">🔍</span>
          <input type="search" placeholder="Buscar por @usuario" aria-label="Buscar jardines por nombre de usuario"
                 autocomplete="off" autocapitalize="none"
                 spellcheck="false" maxlength="21" enterkeyhint="search">
        </label>
        <div class="actividad-resultados" hidden>
          <h4 class="actividad-subtitulo">Resultados</h4>
          <ul class="actividad-lista" data-lista="busqueda"></ul>
        </div>
        <h4 class="actividad-subtitulo">❤️ Les gustó tu jardín <span class="actividad-total"></span></h4>
        <ul class="actividad-lista" data-lista="likes"></ul>
      </div>`, 'jardinActividadTitulo');

    const listaLikes = hoja.querySelector('[data-lista="likes"]');
    const listaBusqueda = hoja.querySelector('[data-lista="busqueda"]');
    const resultados = hoja.querySelector('.actividad-resultados');
    const total = hoja.querySelector('.actividad-total');
    const entrada = hoja.querySelector('.actividad-buscar input');
    const abierto = () => !panel.hidden && hoja.contains(entrada);

    const nota = (lista, texto) => {
      lista.replaceChildren(Object.assign(document.createElement('li'), { className: 'lista-vacia', textContent: texto }));
    };

    /** Fila con avatar, @username y "Ver jardín" (la propia, sin botón) */
    function fila(u) {
      const li = document.createElement('li');
      li.className = 'actividad-usuario';
      const avatar = document.createElement('span');
      avatar.className = 'actividad-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      const inicial = () => { avatar.textContent = u.username.charAt(0).toUpperCase(); };
      if (u.fotoURL) {
        const img = document.createElement('img');
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        img.onerror = () => { img.remove(); inicial(); };
        img.src = u.fotoURL;
        avatar.appendChild(img);
      } else inicial();
      const nombre = document.createElement('strong');
      nombre.className = 'actividad-nombre';
      nombre.textContent = '@' + u.username;
      li.append(avatar, nombre);
      if (u.uid === yo?.uid) {
        li.appendChild(Object.assign(document.createElement('span'), { className: 'lista-arbol-estado lista-arbol-estado--plantado', textContent: 'Tú' }));
      } else {
        const ver = document.createElement('button');
        ver.type = 'button';
        ver.className = 'lista-arbol-plantar';
        ver.textContent = 'Ver jardín';
        ver.setAttribute('aria-label', `Ver el jardín de @${u.username}`);
        ver.addEventListener('click', () => {
          if (navigator.onLine === false) { nota(listaBusqueda, 'Necesitas conexión para visitar jardines'); resultados.hidden = false; return; }
          cerrarPanel();
          alVisitarJardin?.(u.uid);
        });
        li.appendChild(ver);
      }
      return li;
    }

    if (!yo || !jp) {
      entrada.disabled = true;
      nota(listaLikes, 'Crea una cuenta en "Mi cuenta" para ver quién le dio me gusta a tu jardín y visitar otros jardines.');
      return;
    }
    if (navigator.onLine === false) {
      entrada.disabled = true;
      const n = jp.likesGuardados();
      if (n !== null) total.textContent = `(${n})`;
      nota(listaLikes, 'Necesitas conexión para ver la actividad y buscar jardines.');
      return;
    }

    // --- Likes recibidos: 1 lectura del jardín y luego los perfiles de a 30 ---
    const POR_PAGINA = 30;
    let uids = [];
    let mostrados = 0;
    async function cargarMasLikes() {
      const tramo = uids.slice(mostrados, mostrados + POR_PAGINA);
      mostrados += tramo.length;
      const usuarios = await jp.perfilesDe(tramo);
      if (!abierto()) return;
      listaLikes.querySelector('.actividad-ver-mas')?.remove();
      if (listaLikes.querySelector('.lista-vacia')) listaLikes.replaceChildren();
      usuarios.forEach((u) => listaLikes.appendChild(fila(u)));
      if (!listaLikes.children.length) nota(listaLikes, 'No se pudieron cargar los perfiles. Inténtalo de nuevo.');
      if (mostrados < uids.length) {
        const li = document.createElement('li');
        li.className = 'actividad-ver-mas';
        const b = Object.assign(document.createElement('button'), { type: 'button', className: 'lista-ir-tienda', textContent: 'Ver más' });
        b.addEventListener('click', () => { b.disabled = true; b.textContent = 'Cargando…'; cargarMasLikes(); });
        li.appendChild(b);
        listaLikes.appendChild(li);
      }
    }
    nota(listaLikes, 'Cargando…');
    jp.likesRecibidos().then((r) => {
      if (!abierto()) return;
      if (r.estado !== 'ok') {
        nota(listaLikes, r.estado === 'sinRed' ? 'Necesitas conexión para ver la actividad.' : 'No se pudo cargar la actividad. Inténtalo de nuevo en un momento.');
        return;
      }
      uids = r.uids;
      total.textContent = `(${uids.length})`;
      alLeerLikes?.(uids.length);
      if (!uids.length) { nota(listaLikes, 'Aún nadie le ha dado me gusta a tu jardín. ¡Planta y decóralo para que lo visiten! 🌱'); return; }
      cargarMasLikes();
    });

    // --- Buscador: espera a que se deje de escribir (cada búsqueda cobra lecturas) ---
    let espera = null;
    let ultima = '';
    entrada.addEventListener('input', () => {
      clearTimeout(espera);
      const q = entrada.value.trim().toLowerCase().replace(/^@/, '');
      if (q.length < 2) { resultados.hidden = true; ultima = ''; return; }
      espera = setTimeout(async () => {
        if (q === ultima) return;
        ultima = q;
        resultados.hidden = false;
        if (!/^[a-z0-9_.]+$/.test(q)) { nota(listaBusqueda, 'Los nombres de usuario solo tienen letras, números, punto y guion bajo.'); return; }
        nota(listaBusqueda, 'Buscando…');
        const r = await jp.buscarUsuarios(q);
        if (!abierto() || ultima !== q) return;
        if (r.estado === 'sinRed') { nota(listaBusqueda, 'Necesitas conexión para buscar jardines.'); return; }
        if (r.estado !== 'ok') { nota(listaBusqueda, 'No se pudo buscar. Inténtalo de nuevo.'); return; }
        if (!r.usuarios.length) { nota(listaBusqueda, `No hay exploradores que empiecen por "@${q}".`); return; }
        listaBusqueda.replaceChildren(...r.usuarios.map(fila));
      }, 450);
    });
    entrada.addEventListener('keydown', (e) => { if (e.key === 'Enter') entrada.blur(); });
  }

  panel.querySelector('.jardin-panel-fondo').addEventListener('click', cerrarPanel);
  raiz.querySelectorAll('.jardin-herramienta').forEach((boton) => {
    boton.addEventListener('click', () => {
      const accion = boton.dataset.accion;
      if (accion === 'tienda') abrirTienda();
      else if (accion === 'arboles') abrirArboles();
      else if (accion === 'actividad') abrirActividad();
      else ponerModo(modoActual === accion ? null : accion);
    });
  });

  const api = {
    modo: () => modoActual,
    arbolPorPlantar: () => arbolPendiente,
    soltarModo: () => ponerModo(null),
    abrirArboles,
    /**
     * Muestra los riegos disponibles en el botón de la regadera y guarda el texto de su aviso
     * (se ve al tomar la regadera; si ya está tomada, se actualiza al momento).
     */
    actualizarRegadera({ cargas, max, aviso }) {
      const contador = raiz.querySelector('.jardin-herramienta-contador');
      const boton = raiz.querySelector('[data-accion="regadera"]');
      contador.textContent = cargas;
      contador.classList.toggle('vacia', cargas === 0);
      boton.setAttribute('aria-label', `Regadera: ${cargas} de ${max} litros`);
      avisoRegadera = aviso;
      if (modoActual === 'regadera') {
        const span = avisoModo.querySelector('.jardin-modo-texto');
        if (span) span.textContent = aviso;
      }
    },
    /** Cambia el texto del aviso de la herramienta activa (texto plano), o vuelve al de siempre con null */
    cambiarAviso(texto = null) {
      const span = avisoModo.querySelector('.jardin-modo-texto');
      if (!span) return;
      if (texto === null) span.innerHTML = textoModo();
      else span.textContent = texto;
    },
    /**
     * Vuelve a pintar las monedas (cuando cambien al regar, responder o comprar).
     * Con `ganada` ('plata' u 'oro') el contador de esa moneda da un pequeño salto.
     */
    actualizarMonedas(ganada = null) {
      raiz.querySelectorAll('strong[data-moneda]').forEach((el) => { el.textContent = monedas[el.dataset.moneda]; });
      if (!ganada) return;
      raiz.querySelectorAll(`.jardin-barra strong[data-moneda="${ganada}"]`).forEach((el) => {
        const chip = el.closest('.jardin-moneda-chip');
        chip.classList.remove('ganada');
        void chip.offsetWidth; // reinicia la animación si se gana otra moneda seguida
        chip.classList.add('ganada');
      });
    },
    cerrarCapa() {
      if (!panel.hidden) { cerrarPanel(); return true; }
      if (modoActual) { ponerModo(null); return true; }
      return false;
    },
    /** Botones de las zonas (copa, rostro, cuello) sobre el árbol elegido, en px de pantalla */
    mostrarZonas,
    reubicarZonas,
    ocultarZonas,
    /** Muestra el botón "?" con una pregunta pendiente (si hay) */
    mostrarBotonPregunta,
    /** Abre la caja sorpresa (datos de cargarCaja); se cumple al cerrar el panel */
    mostrarCaja,
  };
  return api;
}
