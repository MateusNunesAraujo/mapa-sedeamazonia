/**
 * Progreso de "Mi jardín" guardado en el dispositivo (localStorage, clave "jardinEstado").
 *
 * {
 *   version: 1,
 *   monedas: { plata, oro },          // enteros >= 0
 *   parcelas: 12,                     // cantidad de parcelas (= celdas.length)
 *   celdas: [[columna, fila], ...],   // dónde está cada parcela, en el orden de sus índices
 *   plantados: { "<índice de parcela>": "<codigoQR>" },
 *   regadera: { cargas, capacidad, desde: <ms> }, // riegos guardados, ranuras (litros) e inicio de la recarga en curso
 *   riegos: { "<codigoQR>": <fecha del último riego en ms> },  // solo para mostrar la tierra mojada
 *   sed: { "<codigoQR>": <ms> }        // desde cuándo cada árbol pide agua (burbuja); solo entonces se puede regar
 * }
 *
 * Los árboles se identifican por su codigoQR (el mismo de desbloqueos, favoritos y fotos).
 * Un árbol desbloqueado que no está en `plantados` está "guardado" para plantarlo después.
 * La regadera es una sola para todo el jardín: guarda hasta `capacidad` riegos (5 de inicio, se amplía
 * comprando ranuras de 1 L en la tienda) que se gastan en cualquier árbol.
 */

const CLAVE = 'jardinEstado';
const VERSION = 1;
export const PARCELAS_INICIALES = 12;
export const CUADRICULA_INICIAL = { filas: 3, columnas: 4 }; // las 12 parcelas de inicio
export const PARCELAS_MAX = 36;      // tope de parcelas (iniciales + compradas)

/** Celdas [columna, fila] de las parcelas iniciales, en el mismo orden que sus índices */
export function celdasIniciales() {
  const celdas = [];
  for (let f = 0; f < CUADRICULA_INICIAL.filas; f++) {
    for (let c = 0; c < CUADRICULA_INICIAL.columnas; c++) celdas.push([c, f]);
  }
  return celdas;
}
const celdaValida = (celda) => Array.isArray(celda) && celda.length === 2 && celda.every(Number.isInteger);
const claveCelda = ([c, f]) => `${c},${f}`;
const sonVecinas = ([c1, f1], [c2, f2]) => Math.abs(c1 - c2) + Math.abs(f1 - f2) === 1;

// Reglas de la regadera (ajustables)
export const RIEGO = {
  capacidadInicial: 5,          // ranuras (litros) con las que empieza la regadera
  capacidadMax: 50,             // tope de ranuras (iniciales + compradas)
  recargaMs: 15 * 60 * 1000,    // cada riego se recarga a los 15 min, siempre igual
  // Un árbol solo se puede regar cuando pide agua (burbuja). Tras regarlo o llover vuelve a pedir
  // entre 45 min y 2 h después; uno recién plantado (o sin dato) pide entre 2 y 10 min después
  sedMs: [45 * 60 * 1000, 120 * 60 * 1000],
  sedInicialMs: [2 * 60 * 1000, 10 * 60 * 1000],
  mojadaMs: 30 * 60 * 1000,     // la tierra se ve mojada 30 min después de regar
  probabilidadMoneda: 0.6,      // 60 % de los riegos dan moneda...
  probabilidadOro: 0.15,        // ...y de esas, el 15 % es de oro (el resto, de plata)
};

// Lluvia: al entrar al jardín puede llover (al azar) si ya pasó el tiempo mínimo desde la última vez
export const LLUVIA = {
  probabilidad: 0.3,
  enfriamientoMs: 3 * 60 * 60 * 1000,
};

// Pregunta: botón que aparece al azar al estar en el jardín (data/preguntas-jardin.json)
export const PREGUNTA = {
  probabilidad: 0.6,
  enfriamientoMs: 30 * 60 * 1000,
  esperaMs: [10 * 1000, 60 * 1000], // el botón aparece entre estos dos tiempos después de entrar
  premio: { oro: 2, plata: 2 },      // por acertar
};

function estadoInicial(ahora = Date.now()) {
  return {
    version: VERSION,
    monedas: { plata: 0, oro: 0 },
    parcelas: PARCELAS_INICIALES,
    celdas: celdasIniciales(),
    plantados: {},
    regadera: { cargas: RIEGO.capacidadInicial, capacidad: RIEGO.capacidadInicial, desde: ahora }, // empieza llena
    riegos: {},
    sed: {},          // cuándo empieza a pedir agua cada árbol plantado: { "<codigoQR>": ms }
    inventario: {},   // accesorios comprados sin colocar: { "<id>": cantidad }
    desbloqueosQR: [], // ids de accesorios ya canjeados con su código QR (cada QR da una sola unidad)
    accesorios: {},   // accesorios puestos en cada árbol: { "<codigoQR>": { "<zona>": "<id>" } }
    lluvia: { ultima: 0 }, // cuándo llovió por última vez (ms)
    avisos: { programado: 0, ultimo: 0 }, // notificación de sed pendiente y última entregada (ms)
    preguntas: { ultima: 0, respondidas: [] }, // última pregunta (ms) e ids ya respondidas
    caja: { ultima: 0, abiertas: 0 }, // última caja sorpresa abierta (ms) y cuántas se han abierto
    exclusivos: [],   // codigoQR de los árboles exclusivos ganados en la caja (data/caja-sorpresa.json)
    sobres: { abiertos: 0, ultimoArbolNuevo: -1 }, // sobres abiertos y en cuál salió el último árbol nuevo (-1: nunca)
    copias: {},       // copias extra de cada árbol ganadas en los sobres: { "<codigoQR>": cantidad } (ver idCopia)
    iniciales: false, // true cuando ya recibió las monedas iniciales (tienda-jardin.json → monedas_iniciales)
  };
}

const enteroPositivo = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);

/*
 * Copias de un mismo árbol: el original usa su codigoQR y cada copia extra (ganada en un sobre)
 * "<codigoQR>#2", "<codigoQR>#3"... Ese id es el que se guarda en plantados, sed, riegos y accesorios,
 * así cada copia se riega y se viste por separado. Para buscar la especie se usa codigoBase().
 */
const SEPARADOR_COPIA = '#';
export const codigoBase = (id) => String(id).split(SEPARADOR_COPIA)[0];
export const idCopia = (codigoQR, n) => (n <= 1 ? codigoQR : `${codigoQR}${SEPARADOR_COPIA}${n}`);

/** Ids de todas las copias que se tienen de un árbol (el original primero) */
export function idsDeCopias(estado, codigoQR) {
  const total = 1 + (estado.copias[codigoQR] || 0);
  return Array.from({ length: total }, (_, i) => idCopia(codigoQR, i + 1));
}

/** Lee el progreso; si falta o está dañado, empieza de cero sin romper la app */
export function cargarEstado() {
  const estado = estadoInicial();
  let datos = null;
  try {
    datos = JSON.parse(localStorage.getItem(CLAVE) || 'null');
  } catch (err) {
    console.warn('jardinEstado dañado, se empieza de cero:', err);
  }
  if (!datos || typeof datos !== 'object') return estado;

  // Los progresos guardados antes de existir las monedas iniciales ya habían empezado: no se les dan
  estado.iniciales = typeof datos.iniciales === 'boolean' ? datos.iniciales : true;
  estado.monedas.plata = enteroPositivo(datos.monedas?.plata);
  estado.monedas.oro = enteroPositivo(datos.monedas?.oro);
  // Parcelas compradas: celdas después de las iniciales, cada una libre y pegada a una anterior
  const ocupadas = new Set(estado.celdas.map(claveCelda));
  for (const celda of (Array.isArray(datos.celdas) ? datos.celdas : []).slice(PARCELAS_INICIALES)) {
    if (estado.celdas.length >= PARCELAS_MAX || !celdaValida(celda) || ocupadas.has(claveCelda(celda))) continue;
    if (!estado.celdas.some((otra) => sonVecinas(otra, celda))) continue;
    estado.celdas.push([celda[0], celda[1]]);
    ocupadas.add(claveCelda(celda));
  }
  estado.parcelas = estado.celdas.length;

  // Cada árbol en una sola parcela y cada parcela dentro de las desbloqueadas
  const usados = new Set();
  for (const [clave, codigo] of Object.entries(datos.plantados || {})) {
    const indice = Number(clave);
    if (Number.isInteger(indice) && indice >= 0 && indice < estado.parcelas && typeof codigo === 'string' && !usados.has(codigo)) {
      estado.plantados[indice] = codigo;
      usados.add(codigo);
    }
  }

  for (const [codigo, fecha] of Object.entries(datos.riegos || {})) {
    if (Number.isFinite(fecha) && fecha > 0) estado.riegos[codigo] = fecha;
  }
  for (const [codigo, fecha] of Object.entries(datos.sed || {})) {
    if (Number.isFinite(fecha) && fecha > 0 && usados.has(codigo)) estado.sed[codigo] = fecha;
  }

  for (const [id, cantidad] of Object.entries(datos.inventario || {})) {
    if (typeof id === 'string' && id.trim()) estado.inventario[id] = enteroPositivo(cantidad);
  }
  if (Array.isArray(datos.desbloqueosQR)) {
    estado.desbloqueosQR = [...new Set(datos.desbloqueosQR.filter((id) => typeof id === 'string' && id.trim()))];
  }

  for (const [codigo, zonas] of Object.entries(datos.accesorios || {})) {
    if (typeof codigo !== 'string' || !zonas || typeof zonas !== 'object') continue;
    const limpio = {};
    for (const [zona, id] of Object.entries(zonas)) {
      if (typeof zona === 'string' && typeof id === 'string' && id) limpio[zona] = id;
    }
    if (Object.keys(limpio).length) estado.accesorios[codigo] = limpio;
  }

  const programado = datos.avisos?.programado;
  if (Number.isFinite(programado) && programado > 0) estado.avisos.programado = programado;
  const ultimoAviso = datos.avisos?.ultimo;
  if (Number.isFinite(ultimoAviso) && ultimoAviso > 0) estado.avisos.ultimo = Math.min(ultimoAviso, Date.now());

  const ultimaLluvia = datos.lluvia?.ultima;
  if (Number.isFinite(ultimaLluvia) && ultimaLluvia > 0) estado.lluvia.ultima = Math.min(ultimaLluvia, Date.now());

  const ultimaPregunta = datos.preguntas?.ultima;
  if (Number.isFinite(ultimaPregunta) && ultimaPregunta > 0) estado.preguntas.ultima = Math.min(ultimaPregunta, Date.now());
  if (Array.isArray(datos.preguntas?.respondidas)) {
    estado.preguntas.respondidas = datos.preguntas.respondidas.filter((id) => typeof id === 'string');
  }

  const ultimaCaja = datos.caja?.ultima;
  if (Number.isFinite(ultimaCaja) && ultimaCaja > 0) estado.caja.ultima = Math.min(ultimaCaja, Date.now());
  estado.caja.abiertas = enteroPositivo(datos.caja?.abiertas);
  if (Array.isArray(datos.exclusivos)) {
    estado.exclusivos = [...new Set(datos.exclusivos.filter((c) => typeof c === 'string' && c.trim()))];
  }
  estado.sobres.abiertos = enteroPositivo(datos.sobres?.abiertos);
  const ultimoNuevo = datos.sobres?.ultimoArbolNuevo;
  if (Number.isInteger(ultimoNuevo) && ultimoNuevo >= 0 && ultimoNuevo < estado.sobres.abiertos) estado.sobres.ultimoArbolNuevo = ultimoNuevo;
  for (const [codigo, cantidad] of Object.entries(datos.copias || {})) {
    if (typeof codigo === 'string' && codigo.trim() && !codigo.includes(SEPARADOR_COPIA) && enteroPositivo(cantidad) > 0) {
      estado.copias[codigo] = enteroPositivo(cantidad);
    }
  }

  // Regadera: capacidad entre la inicial y el tope (los guardados viejos no la traen), cargas enteras
  // entre 0 y la capacidad; una fecha en el futuro (reloj cambiado) se corrige
  const capacidadGuardada = datos.regadera?.capacidad;
  const capacidad = Number.isInteger(capacidadGuardada)
    ? Math.min(Math.max(capacidadGuardada, RIEGO.capacidadInicial), RIEGO.capacidadMax)
    : RIEGO.capacidadInicial;
  const cargas = datos.regadera?.cargas;
  const desde = datos.regadera?.desde;
  if (Number.isInteger(cargas) && cargas >= 0 && Number.isFinite(desde)) {
    estado.regadera = { cargas: Math.min(cargas, capacidad), capacidad, desde: Math.min(desde, Date.now()) };
  }
  return estado;
}

export function guardarEstado(estado) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado));
    return true;
  } catch (err) {
    console.warn('No se pudo guardar el jardín:', err);
    return false;
  }
}

/**
 * Entrega una sola vez las monedas iniciales { plata, oro } a un jugador nuevo.
 * Devuelve true si se entregaron ahora.
 */
export function darMonedasIniciales(estado, monedas) {
  if (estado.iniciales) return false;
  estado.monedas.plata += enteroPositivo(monedas?.plata);
  estado.monedas.oro += enteroPositivo(monedas?.oro);
  estado.iniciales = true;
  guardarEstado(estado);
  return true;
}

export const arbolEn = (estado, indice) => estado.plantados[indice] || null;

export function parcelaDe(estado, codigoQR) {
  for (const [indice, codigo] of Object.entries(estado.plantados)) {
    if (codigo === codigoQR) return Number(indice);
  }
  return null;
}

/** Cantidad de parcelas libres entre las primeras `total` (las que existen en la escena) */
export function parcelasLibres(estado, total) {
  let libres = 0;
  for (let i = 0; i < Math.min(total, estado.parcelas); i++) if (!estado.plantados[i]) libres++;
  return libres;
}

/** Planta un árbol guardado en una parcela libre. Devuelve true si se pudo. */
export function plantar(estado, codigoQR, indice) {
  if (!Number.isInteger(indice) || indice < 0 || indice >= estado.parcelas) return false;
  if (estado.plantados[indice] || parcelaDe(estado, codigoQR) !== null) return false;
  estado.plantados[indice] = codigoQR;
  programarSed(estado, codigoQR, RIEGO.sedInicialMs);
  guardarEstado(estado);
  return true;
}

/**
 * Mueve el árbol de la parcela `origen` a `destino`. Si en el destino hay otro árbol, se intercambian.
 * Devuelve true si se movió.
 */
export function moverArbol(estado, origen, destino) {
  const enRango = (i) => Number.isInteger(i) && i >= 0 && i < estado.parcelas;
  if (!enRango(origen) || !enRango(destino) || origen === destino || !estado.plantados[origen]) return false;
  const movido = estado.plantados[origen];
  const desplazado = estado.plantados[destino];
  estado.plantados[destino] = movido;
  if (desplazado) estado.plantados[origen] = desplazado;
  else delete estado.plantados[origen];
  guardarEstado(estado);
  return true;
}

/** Celdas libres [columna, fila] pegadas a alguna parcela: los lugares donde puede ir la siguiente */
export function celdasParaAmpliar(estado) {
  if (estado.celdas.length >= PARCELAS_MAX) return [];
  const ocupadas = new Set(estado.celdas.map(claveCelda));
  const vistas = new Set();
  const libres = [];
  for (const [c, f] of estado.celdas) {
    for (const celda of [[c + 1, f], [c - 1, f], [c, f + 1], [c, f - 1]]) {
      const clave = claveCelda(celda);
      if (ocupadas.has(clave) || vistas.has(clave)) continue;
      vistas.add(clave);
      libres.push(celda);
    }
  }
  return libres;
}

/**
 * Compra una parcela nueva en `celda` (debe ser uno de los lugares de `celdasParaAmpliar`) y descuenta
 * su precio { moneda, valor }. Devuelve el índice de la parcela nueva, o -1 si no se pudo.
 */
export function comprarParcela(estado, celda, precio) {
  const { moneda, valor } = precio || {};
  if (!celdaValida(celda) || !celdasParaAmpliar(estado).some((c) => claveCelda(c) === claveCelda(celda))) return -1;
  if (!Number.isInteger(valor) || valor < 0 || !(moneda in estado.monedas) || estado.monedas[moneda] < valor) return -1;
  estado.monedas[moneda] -= valor;
  estado.celdas.push([celda[0], celda[1]]);
  estado.parcelas = estado.celdas.length;
  guardarEstado(estado);
  return estado.parcelas - 1;
}

/** Suma los riegos que se recargaron desde la última vez (uno cada RIEGO.recargaMs) */
function recargar(regadera, ahora) {
  while (regadera.cargas < regadera.capacidad) {
    if (ahora - regadera.desde < RIEGO.recargaMs) break;
    regadera.desde += RIEGO.recargaMs;
    regadera.cargas += 1;
  }
}

/** true si todavía se le pueden comprar ranuras a la regadera */
export function puedeAmpliarRegadera(estado) {
  return estado.regadera.capacidad < RIEGO.capacidadMax;
}

/**
 * Compra una ranura más (1 L) para la regadera y descuenta su precio { moneda, valor }.
 * La ranura nueva llega vacía y empieza a recargarse enseguida. Devuelve true si se pudo.
 */
export function comprarEspacioRegadera(estado, precio, ahora = Date.now()) {
  const { moneda, valor } = precio || {};
  if (!puedeAmpliarRegadera(estado)) return false;
  if (!Number.isInteger(valor) || valor < 0 || !(moneda in estado.monedas) || estado.monedas[moneda] < valor) return false;
  const regadera = estado.regadera;
  recargar(regadera, ahora);
  if (regadera.cargas >= regadera.capacidad) regadera.desde = ahora; // estaba llena: la recarga empieza ahora
  estado.monedas[moneda] -= valor;
  regadera.capacidad += 1;
  guardarEstado(estado);
  return true;
}

/**
 * Estado actual de la regadera:
 * { cargas, max, siguienteMs (falta para el próximo riego), llenaMs (falta para llenarla), progreso 0-1 }
 */
export function estadoRegadera(estado, ahora = Date.now()) {
  const regadera = estado.regadera;
  recargar(regadera, ahora);
  const max = regadera.capacidad;
  if (regadera.cargas >= max) {
    return { cargas: regadera.cargas, max, siguienteMs: 0, llenaMs: 0, progreso: 1 };
  }
  const transcurrido = ahora - regadera.desde;
  const siguienteMs = RIEGO.recargaMs - transcurrido;
  return {
    cargas: regadera.cargas,
    max,
    siguienteMs,
    llenaMs: siguienteMs + (max - regadera.cargas - 1) * RIEGO.recargaMs,
    progreso: transcurrido / RIEGO.recargaMs,
  };
}

/** Fija cuándo volverá a pedir agua el árbol: en un tiempo al azar dentro de `rango` [mín, máx] ms */
function programarSed(estado, codigoQR, rango, ahora = Date.now(), azar = Math.random) {
  const [min, max] = rango;
  estado.sed[codigoQR] = ahora + min + Math.floor(azar() * (max - min));
}

/** ¿Este árbol está pidiendo agua (muestra su burbuja)? Solo entonces se puede regar */
export function tieneSed(estado, codigoQR, ahora = Date.now()) {
  const desde = estado.sed[codigoQR];
  return Number.isFinite(desde) && ahora >= desde;
}

/**
 * Da a cada árbol plantado que aún no tiene hora de sed (guardados viejos) una dentro del rango
 * inicial, para que no pidan agua todos a la vez. Devuelve true si cambió algo.
 */
export function asegurarSed(estado, ahora = Date.now(), azar = Math.random) {
  let cambio = false;
  for (const codigo of Object.values(estado.plantados)) {
    if (Number.isFinite(estado.sed[codigo])) continue;
    programarSed(estado, codigo, RIEGO.sedInicialMs, ahora, azar);
    cambio = true;
  }
  if (cambio) guardarEstado(estado);
  return cambio;
}

/** ¿Se regó este árbol hace poco? (para mostrar su tierra mojada) */
export function estaMojado(estado, codigoQR, ahora = Date.now()) {
  const ultimo = estado.riegos[codigoQR];
  return !!ultimo && ahora - ultimo < RIEGO.mojadaMs;
}

/**
 * Riega un árbol que pide agua gastando un riego de la regadera y, al azar, entrega una moneda.
 * Devuelve { regado: false, motivo: 'sinSed' } si el árbol no está pidiendo agua,
 * { regado: false, motivo: 'vacia', siguienteMs } si la regadera está vacía,
 * o { regado: true, moneda: 'plata' | 'oro' | null, cargas } si se pudo regar.
 * El tiempo que ya llevaba la recarga en curso no se pierde al gastar un riego.
 */
export function regar(estado, codigoQR, ahora = Date.now(), azar = Math.random) {
  if (!tieneSed(estado, codigoQR, ahora)) return { regado: false, motivo: 'sinSed', moneda: null };
  const regadera = estado.regadera;
  recargar(regadera, ahora);
  if (regadera.cargas === 0) {
    return { regado: false, motivo: 'vacia', moneda: null, siguienteMs: RIEGO.recargaMs - (ahora - regadera.desde) };
  }
  if (regadera.cargas === regadera.capacidad) regadera.desde = ahora; // llena: la recarga empieza ahora
  regadera.cargas -= 1;
  estado.riegos[codigoQR] = ahora;
  programarSed(estado, codigoQR, RIEGO.sedMs, ahora, azar);
  let moneda = null;
  if (azar() < RIEGO.probabilidadMoneda) {
    moneda = azar() < RIEGO.probabilidadOro ? 'oro' : 'plata';
    estado.monedas[moneda] += 1;
  }
  guardarEstado(estado);
  return { regado: true, moneda, cargas: regadera.cargas };
}

/** ¿Toca llover al entrar? Al azar, y nunca antes del enfriamiento desde la última lluvia */
export function tocaLlover(estado, ahora = Date.now(), azar = Math.random) {
  return ahora - estado.lluvia.ultima >= LLUVIA.enfriamientoMs && azar() < LLUVIA.probabilidad;
}

/**
 * Llueve sobre los árboles dados: todos quedan regados y cada uno puede dar moneda con las mismas
 * probabilidades del riego, sin gastar la regadera.
 * Devuelve { porArbol: [{ codigo, moneda: 'plata' | 'oro' | null }], total: { plata, oro } }
 */
export function llover(estado, codigos, ahora = Date.now(), azar = Math.random) {
  const total = { plata: 0, oro: 0 };
  const porArbol = codigos.map((codigo) => {
    estado.riegos[codigo] = ahora;
    programarSed(estado, codigo, RIEGO.sedMs, ahora, azar); // la lluvia les quita la sed
    let moneda = null;
    if (azar() < RIEGO.probabilidadMoneda) {
      moneda = azar() < RIEGO.probabilidadOro ? 'oro' : 'plata';
      estado.monedas[moneda] += 1;
      total[moneda] += 1;
    }
    return { codigo, moneda };
  });
  estado.lluvia.ultima = ahora;
  guardarEstado(estado);
  return { porArbol, total };
}

/** ¿Toca mostrar el botón de pregunta en esta visita? Al azar y respetando el enfriamiento */
export function tocaPregunta(estado, ahora = Date.now(), azar = Math.random) {
  return ahora - estado.preguntas.ultima >= PREGUNTA.enfriamientoMs && azar() < PREGUNTA.probabilidad;
}

/** Una pregunta al azar entre las que no se han respondido (si ya se respondieron todas, cualquiera) */
export function elegirPregunta(estado, preguntas, azar = Math.random) {
  if (!preguntas.length) return null;
  const pendientes = preguntas.filter((p) => !estado.preguntas.respondidas.includes(p.id));
  const lista = pendientes.length ? pendientes : preguntas;
  return lista[Math.floor(azar() * lista.length)];
}

/**
 * Registra la respuesta y, si acertó, entrega el premio. Devuelve true si acertó.
 * Cuando ya se respondieron todas las preguntas, la lista de respondidas vuelve a empezar.
 */
export function responderPregunta(estado, pregunta, opcion, totalPreguntas, ahora = Date.now()) {
  const acierto = opcion === pregunta.respuesta;
  estado.preguntas.ultima = ahora;
  if (!estado.preguntas.respondidas.includes(pregunta.id)) estado.preguntas.respondidas.push(pregunta.id);
  if (estado.preguntas.respondidas.length >= totalPreguntas) estado.preguntas.respondidas = [];
  if (acierto) {
    estado.monedas.oro += PREGUNTA.premio.oro;
    estado.monedas.plata += PREGUNTA.premio.plata;
  }
  guardarEstado(estado);
  return acierto;
}

/** ¿Toca caja sorpresa? La primera vez siempre, y luego cuando pasan `intervaloMs` desde la última abierta */
export function tocaCaja(estado, intervaloMs, ahora = Date.now()) {
  return !estado.caja.ultima || ahora - estado.caja.ultima >= intervaloMs;
}

/** Tiempo que falta para la próxima caja (0 si ya está disponible) */
export function faltaParaCaja(estado, intervaloMs, ahora = Date.now()) {
  return tocaCaja(estado, intervaloMs, ahora) ? 0 : intervaloMs - (ahora - estado.caja.ultima);
}

/**
 * Abre la caja: sortea un premio por `peso` entre `premios` (ya validados) y lo entrega.
 * Los árboles exclusivos que ya se tienen no entran al sorteo. En la primera caja se entrega
 * `idPrimera` si sigue disponible. Devuelve el premio entregado o null si no hay ninguno.
 */
export function abrirCaja(estado, premios, { idPrimera = null, ahora = Date.now(), azar = Math.random } = {}) {
  const disponibles = premios.filter((p) => p.tipo !== 'arbol' || !estado.exclusivos.includes(p.objeto));
  if (!disponibles.length) return null;
  let premio = estado.caja.abiertas === 0 && idPrimera ? disponibles.find((p) => p.id === idPrimera) : null;
  if (!premio) {
    const total = disponibles.reduce((s, p) => s + p.peso, 0);
    let tiro = azar() * total;
    premio = disponibles.find((p) => (tiro -= p.peso) < 0) || disponibles[disponibles.length - 1];
  }
  if (premio.tipo === 'monedas') estado.monedas[premio.objeto] += premio.cantidad;
  else if (premio.tipo === 'accesorio') estado.inventario[premio.objeto] = (estado.inventario[premio.objeto] || 0) + premio.cantidad;
  else if (premio.tipo === 'arbol') estado.exclusivos.push(premio.objeto);
  estado.caja.ultima = ahora;
  estado.caja.abiertas += 1;
  guardarEstado(estado);
  return premio;
}

/** ¿Este accesorio ya se canjeó con su código QR? */
export function accesorioCanjeadoQR(estado, id) {
  return estado.desbloqueosQR.includes(id);
}

/**
 * Canjea un accesorio con su código QR (su `id`): suma una unidad al inventario, una sola vez.
 * Devuelve 'nuevo' si se desbloqueó, 'repetido' si ya se había canjeado o null si no se puede
 * (el accesorio no tiene `desbloqueo_qr`).
 */
export function desbloquearAccesorioQR(estado, accesorio) {
  if (!accesorio?.desbloqueo_qr) return null;
  if (accesorioCanjeadoQR(estado, accesorio.id)) return 'repetido';
  estado.desbloqueosQR.push(accesorio.id);
  estado.inventario[accesorio.id] = (estado.inventario[accesorio.id] || 0) + 1;
  guardarEstado(estado);
  return 'nuevo';
}

/** Elige al azar un elemento de la lista */
const unoAlAzar = (lista, azar) => lista[Math.floor(azar() * lista.length)];

/**
 * Sortea la rareza con los pesos de `probabilidades` (solo entre las rarezas que tiene `lista`)
 * y luego un elemento de esa rareza. Cada elemento trae su `rareza`. Devuelve null si no hay ninguno.
 */
function sortearPorRareza(lista, probabilidades, azar) {
  const rarezas = Object.entries(probabilidades).filter(([r, peso]) => peso > 0 && lista.some((x) => x.rareza === r));
  if (!rarezas.length) return null;
  const total = rarezas.reduce((s, [, peso]) => s + peso, 0);
  let tiro = azar() * total;
  const rareza = (rarezas.find(([, peso]) => (tiro -= peso) < 0) || rarezas[rarezas.length - 1])[0];
  return unoAlAzar(lista.filter((x) => x.rareza === rareza), azar);
}

/** ¿Ya puede salir otro árbol nuevo? (pasaron `enfriamiento` sobres desde el último) */
export function puedeSalirArbolNuevo(estado, enfriamiento) {
  const ultimo = estado.sobres.ultimoArbolNuevo;
  return ultimo < 0 || estado.sobres.abiertos - ultimo >= enfriamiento;
}

/**
 * Compra y abre un sobre (tienda-jardin.json → sobres.tipos[]). Entrega UN premio:
 *  - con `sobre.arbol.probabilidad`, un árbol: casi siempre una copia más de uno de `conocidos` (se puede
 *    plantar otra vez; se elige con las mismas probabilidades de rareza del sobre que los accesorios) y solo
 *    con `sobre.arbol.nuevo` (y fuera del enfriamiento) uno de `nuevos` al azar, que la UI desbloquea;
 *  - si no, un accesorio: se sortea la rareza con `sobre.probabilidades` y luego uno de esa rareza.
 * `conocidos` es una lista de { codigo, rareza } (sin copias) y `nuevos` una de codigoQR. Devuelve null si no
 * alcanzan las monedas o no hay premio; si no: { tipo: 'accesorio', accesorio, rareza } o
 * { tipo: 'arbol', codigo, nuevo, id } (`id` de la copia ganada).
 */
export function abrirSobre(estado, sobre, {
  accesorios, conocidos = [], nuevos = [], enfriamiento = 25, azar = Math.random,
}) {
  const { moneda, valor } = sobre.precio;
  if (!(moneda in estado.monedas) || estado.monedas[moneda] < valor) return null;

  let premio = null;
  if (azar() < sobre.arbol.probabilidad) {
    if (nuevos.length && puedeSalirArbolNuevo(estado, enfriamiento) && azar() < sobre.arbol.nuevo) {
      const codigo = unoAlAzar(nuevos, azar);
      premio = { tipo: 'arbol', codigo, nuevo: true, id: codigo };
      estado.sobres.ultimoArbolNuevo = estado.sobres.abiertos;
    } else {
      const elegido = sortearPorRareza(conocidos, sobre.probabilidades, azar);
      if (elegido) {
        const { codigo } = elegido;
        estado.copias[codigo] = (estado.copias[codigo] || 0) + 1;
        premio = { tipo: 'arbol', codigo, nuevo: false, id: idCopia(codigo, estado.copias[codigo] + 1) };
      }
    }
  }
  if (!premio) {
    // Solo cuentan las rarezas que tienen algún accesorio
    const accesorio = sortearPorRareza(accesorios, sobre.probabilidades, azar);
    if (!accesorio) return null;
    premio = { tipo: 'accesorio', accesorio, rareza: accesorio.rareza };
    estado.inventario[accesorio.id] = (estado.inventario[accesorio.id] || 0) + 1;
  }

  estado.monedas[moneda] -= valor;
  estado.sobres.abiertos += 1;
  guardarEstado(estado);
  return premio;
}

/** Accesorio puesto en una zona de un árbol, o null */
export function accesorioEn(estado, codigoQR, zona) {
  return estado.accesorios[codigoQR]?.[zona] || null;
}

/** Todo lo que lleva puesto un árbol: { "<zona>": "<id>" } */
export function accesoriosDe(estado, codigoQR) {
  return estado.accesorios[codigoQR] || {};
}

/**
 * Coloca una unidad del inventario en la zona de un árbol. Si esa zona ya tenía otro accesorio,
 * esa unidad vuelve al inventario. Devuelve true si se pudo colocar.
 */
export function ponerAccesorio(estado, codigoQR, accesorio) {
  if (!(estado.inventario[accesorio.id] > 0)) return false;
  const actual = estado.accesorios[codigoQR] || {};
  if (actual[accesorio.zona] === accesorio.id) return false; // ya puesto aquí
  if (actual[accesorio.zona]) estado.inventario[actual[accesorio.zona]] = (estado.inventario[actual[accesorio.zona]] || 0) + 1;
  estado.inventario[accesorio.id] -= 1;
  estado.accesorios[codigoQR] = { ...actual, [accesorio.zona]: accesorio.id };
  guardarEstado(estado);
  return true;
}

/** Quita el accesorio de una zona del árbol y devuelve esa unidad al inventario */
export function quitarAccesorio(estado, codigoQR, zona) {
  const actual = estado.accesorios[codigoQR];
  const id = actual?.[zona];
  if (!id) return false;
  estado.inventario[id] = (estado.inventario[id] || 0) + 1;
  delete actual[zona];
  if (!Object.keys(actual).length) delete estado.accesorios[codigoQR];
  guardarEstado(estado);
  return true;
}

/** Quita del jardín los árboles que ya no existen en plantas.json (no toca los demás datos) */
export function quitarDesconocidos(estado, codigosValidos) {
  let cambio = false;
  for (const [indice, codigo] of Object.entries(estado.plantados)) {
    if (!codigosValidos.has(codigoBase(codigo))) {
      console.warn(`jardinEstado: "${codigo}" ya no está en plantas.json; se libera la parcela ${Number(indice) + 1}`);
      delete estado.plantados[indice];
      cambio = true;
    }
  }
  if (cambio) guardarEstado(estado);
}
