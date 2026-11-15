/**
 * Mi jardín: vista isométrica (cámara fija en ángulo de tres cuartos desde arriba, estilo
 * juego de estrategia) del jardín donde el usuario planta los árboles que desbloquea.
 *
 *  - Arrastrar: mover la vista. Rueda o pellizcar: acercar/alejar. Tocar una parcela: elegirla.
 *  - El ángulo de la cámara no cambia (proyección ortográfica, sin perspectiva).
 *  - El progreso (qué árbol hay en cada parcela, monedas) se guarda con jardin-estado.js.
 *  - Cada árbol usa el modelo indicado en su campo "modelo3d" de plantas.json, que solo está
 *    disponible si el árbol está desbloqueado (plantsHandler.getModelUrl). Si no tiene modelo,
 *    o el modelo no carga, se muestra un brote provisional.
 *
 * Solo se vuelve a dibujar cuando algo cambia. Si algún árbol plantado trae animación (clip
 * "idle" en su .glb), se dibuja de forma continua a 30 cuadros por segundo mientras haya árboles
 * animados; con "reducir movimiento" activado en el sistema, los árboles quedan quietos.
 * three.js se carga únicamente al abrir el jardín.
 */
import { montarInterfazJuego, arbolesDelUsuario, cargarCatalogo } from './jardin-ui.js?v=13';
import { pedirPermisoAvisos, cancelarAvisoSed, programarAvisoSed, alTocarAviso } from './jardin-notificaciones.js?v=1';
import {
  cargarEstado, arbolEn, plantar, parcelaDe, parcelasLibres, quitarDesconocidos,
  moverArbol, regar, estadoRegadera, estaMojado, tieneSed, asegurarSed, accesoriosDe, tocaLlover, llover, tocaPregunta, PREGUNTA,
  celdasParaAmpliar, comprarParcela, CUADRICULA_INICIAL, guardarEstado,
} from './jardin-estado.js?v=11';

// Distribución del jardín
const { filas: FILAS, columnas: COLUMNAS } = CUADRICULA_INICIAL; // cuadrícula inicial, centrada en el origen
const TAM_PARCELA = 4;      // lado de cada parcela, en metros
const PASILLO = 5;          // camino entre parcelas (ancho para poder observar cada árbol de cerca)
const PASO = TAM_PARCELA + PASILLO; // distancia entre centros de parcelas vecinas
const ALTO_TIERRA = 0.22;
const SUELO_PARCELA = ALTO_TIERRA + 0.06; // altura de la superficie de la tierra
const ALTO_CERCA = 0.7;
const ANCHO_PUERTA = 1.1;   // hueco en la cerca del frente de cada parcela
const ALTO_ARBOL = 3.6;     // altura máxima de un árbol en el jardín
const ANCHO_ARBOL = TAM_PARCELA * 0.9; // ancho máximo, para que no se salga de su parcela

// Cámara isométrica: girada 45° y elevada ~35° (isometría verdadera)
const GIRO = Math.PI / 4;
const ELEVACION = Math.atan(1 / Math.SQRT2);
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 3;

// Observar un árbol de cerca: cámara en perspectiva que gira alrededor de él
const OBSERVAR = {
  fov: 45,
  distancia: [2.5, 7],     // mínima y máxima (la máxima no llega a los árboles vecinos)
  distanciaInicial: 5.5,
  elevacion: [0.1, 1.25],  // ángulo sobre el horizonte, en radianes
  elevacionInicial: 0.35,
};

// Animaciones de los árboles: cuadros por segundo máximos y clip preferido del .glb
const CUADROS_POR_SEGUNDO = 30;
const CLIP_PREFERIDO = 'idle';

// Lluvia al entrar (si toca, ver tocaLlover en jardin-estado.js): cuánto dura y en cuántos
// segundos del inicio los árboles van soltando sus monedas
const LLUVIA_DURACION_MS = 2 * 60 * 1000;
const LLUVIA_GANANCIA_S = 10;

// Colores (paleta verde de la app; el pasto usa el verde lima de la pantalla de inicio)
const COLOR = {
  cielo: 0xdff0d0,
  cieloLluvia: 0x8e9c9a,
  pasto: 0x9ec636,
  camino: 0xe6d6b0,
  tierraArriba: 0x7b4a2a,
  tierraLado: 0x5a3519,
  surco: 0x63391d,
  poste: 0x8a5a2e,
  travesano: 0xb07a43,
  seleccion: 0x41f2a0,
  origenPala: 0xffc107,  // parcela del árbol que se está moviendo con la pala
  mojada: 0x2e1a0c,      // tierra recién regada
  gota: 0x4fc3f7,
  arbustos: [0x03a65a, 0x027333, 0x4f9a2a],
  piedra: 0xa7a59c,
  flores: [0xffffff, 0xffd54f, 0xf48fb1],
  brote: 0x4caf50,
  tallo: 0x6d4c2f,
  letrero: 0xd9b07a,
};

const CARPETA_ACCESORIOS = '/static/img/accesorios/';

let THREE = null;
let GLTFLoader = null;

async function cargarThree() {
  if (!THREE) THREE = await import('./three/three.module.min.js');
  if (!GLTFLoader) ({ GLTFLoader } = await import('./three/addons/loaders/GLTFLoader.js'));
}

function crearInterfaz() {
  const raiz = document.createElement('div');
  raiz.className = 'jardin';
  raiz.setAttribute('role', 'dialog');
  raiz.setAttribute('aria-modal', 'true');
  raiz.setAttribute('aria-label', 'Mi jardín');
  raiz.innerHTML = `
    <div class="jardin-barra">
      <div>
        <span class="jardin-subtitulo">Sede Amazonia</span>
        <h2 class="jardin-titulo">Mi jardín</h2>
      </div>
      <div class="jardin-barra-derecha">
        <button type="button" class="jardin-salir" aria-label="Salir del jardín">&times;</button>
      </div>
    </div>
    <div class="jardin-cargando">Preparando el jardín…</div>
    <div class="jardin-ayuda">
      <span class="jardin-ayuda-aviso">Los árboles del jardín son versiones animadas, pensadas para entretener: no reproducen con exactitud a las especies reales.</span>
      <span class="solo-tactil">Arrastra para moverte · Pellizca para acercar · Toca una parcela</span>
      <span class="solo-pc">Arrastra para moverte · Rueda para acercar · Clic en una parcela</span>
    </div>
    <div class="jardin-info" aria-live="polite" hidden>
      <div class="jardin-info-textos">
        <strong class="jardin-info-titulo"></strong>
        <span class="jardin-info-texto"></span>
      </div>
      <button type="button" class="jardin-info-accion" hidden></button>
    </div>
    <div class="jardin-observar" hidden>
      <div class="jardin-observar-textos">
        <strong class="jardin-observar-nombre"></strong>
        <span class="solo-tactil">Arrastra para girar · Pellizca para acercar</span>
        <span class="solo-pc">Arrastra para girar · Rueda para acercar</span>
      </div>
      <button type="button" class="jardin-observar-volver">Volver al jardín</button>
    </div>`;
  document.body.appendChild(raiz);
  return raiz;
}

/** "3 h 20 min", "45 min" o "menos de un minuto" */
function formatearEspera(ms) {
  const minutos = Math.ceil(ms / 60000);
  if (minutos < 1) return 'menos de un minuto';
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (!horas) return `${resto} min`;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

// Generador pseudoaleatorio con semilla: la decoración queda siempre igual
function azarConSemilla(semilla) {
  let s = semilla;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

/** Centro en el suelo de la celda [columna, fila]; la cuadrícula inicial queda centrada en el origen */
function centroCelda([c, f]) {
  return { x: (c - (COLUMNAS - 1) / 2) * PASO, z: (f - (FILAS - 1) / 2) * PASO };
}

/**
 * Construye las parcelas (una por celda), el camino, las cercas y la decoración dentro de un grupo,
 * para poder rehacerlo cuando el jardín crece. Devuelve lo que se puede tocar y la extensión del jardín.
 */
function construirJardin(scene, celdas) {
  const grupo = new THREE.Group();
  scene.add(grupo);

  // Extensión: caja que encierra todas las celdas (el camino asoma medio pasillo alrededor)
  const columnas = celdas.map(([c]) => c);
  const filas = celdas.map(([, f]) => f);
  const esquina1 = centroCelda([Math.min(...columnas), Math.min(...filas)]);
  const esquina2 = centroCelda([Math.max(...columnas), Math.max(...filas)]);
  const limites = {
    minX: esquina1.x - PASO / 2, maxX: esquina2.x + PASO / 2,
    minZ: esquina1.z - PASO / 2, maxZ: esquina2.z + PASO / 2,
  };
  const ancho = limites.maxX - limites.minX;
  const fondo = limites.maxZ - limites.minZ;
  const centro = { x: (limites.minX + limites.maxX) / 2, z: (limites.minZ + limites.maxZ) / 2 };

  // Camino de tierra clara: una loseta por celda; juntas forman los pasillos entre parcelas
  const camino = new THREE.InstancedMesh(
    new THREE.BoxGeometry(PASO, 0.06, PASO),
    new THREE.MeshLambertMaterial({ color: COLOR.camino }),
    celdas.length,
  );
  camino.receiveShadow = true;

  // Parcelas: bloque de tierra (arriba más clara que los lados) con surcos
  const geoTierra = new THREE.BoxGeometry(TAM_PARCELA, ALTO_TIERRA, TAM_PARCELA);
  const matLado = new THREE.MeshLambertMaterial({ color: COLOR.tierraLado });
  const matArriba = new THREE.MeshLambertMaterial({ color: COLOR.tierraArriba });
  const matsTierra = [matLado, matLado, matArriba, matLado, matLado, matLado];

  const SURCOS = 5;
  const surcos = new THREE.InstancedMesh(
    new THREE.BoxGeometry(TAM_PARCELA * 0.86, 0.07, 0.18),
    new THREE.MeshLambertMaterial({ color: COLOR.surco }),
    celdas.length * SURCOS,
  );
  surcos.receiveShadow = true;

  // Cercas: postes y travesaños como instancias de una sola caja (escalada en cada una)
  const postes = [];
  const travesanos = [];
  const agregarLado = (x1, z1, x2, z2, hueco) => {
    const largo = Math.hypot(x2 - x1, z2 - z1);
    const tramos = hueco
      ? [[0, (largo - ANCHO_PUERTA) / 2], [(largo + ANCHO_PUERTA) / 2, largo]]
      : [[0, largo]];
    const dx = (x2 - x1) / largo;
    const dz = (z2 - z1) / largo;
    for (const [a, b] of tramos) {
      const n = Math.max(1, Math.round((b - a) / 1));
      for (let i = 0; i <= n; i++) {
        const t = a + ((b - a) * i) / n;
        postes.push([x1 + dx * t, z1 + dz * t]);
      }
      const medio = (a + b) / 2;
      for (const alto of [0.32, 0.56]) {
        travesanos.push({ x: x1 + dx * medio, z: z1 + dz * medio, largo: b - a, alto, giro: Math.atan2(-dz, dx) });
      }
    }
  };

  const parcelas = [];
  const m = new THREE.Matrix4();
  let iSurco = 0;
  celdas.forEach((celda, indice) => {
    const [columna, fila] = celda;
    const { x, z } = centroCelda(celda);
    camino.setMatrixAt(indice, m.makeTranslation(x, 0.03, z));

    const tierra = new THREE.Mesh(geoTierra, matsTierra);
    tierra.position.set(x, ALTO_TIERRA / 2 + 0.06, z);
    tierra.receiveShadow = true;
    tierra.castShadow = true;
    tierra.userData.parcela = indice;
    grupo.add(tierra);
    parcelas.push({ numero: indice + 1, fila, columna, x, z, malla: tierra });

    for (let s = 0; s < SURCOS; s++) {
      const sz = z + (s - (SURCOS - 1) / 2) * (TAM_PARCELA * 0.82 / (SURCOS - 1));
      surcos.setMatrixAt(iSurco++, m.makeTranslation(x, SUELO_PARCELA + 0.02, sz));
    }

    // Cerca alrededor, un poco por fuera de la tierra; la puerta mira hacia la cámara (+Z)
    const h = TAM_PARCELA / 2 + 0.25;
    agregarLado(x - h, z - h, x + h, z - h, false);
    agregarLado(x + h, z - h, x + h, z + h, false);
    agregarLado(x - h, z + h, x + h, z + h, true);
    agregarLado(x - h, z - h, x - h, z + h, false);
  });
  grupo.add(camino, surcos);

  const mallaPostes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.14, ALTO_CERCA, 0.14),
    new THREE.MeshLambertMaterial({ color: COLOR.poste }),
    postes.length,
  );
  postes.forEach(([px, pz], i) => mallaPostes.setMatrixAt(i, m.makeTranslation(px, ALTO_CERCA / 2 + 0.06, pz)));
  mallaPostes.castShadow = true;
  grupo.add(mallaPostes);

  const mallaTravesanos = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 0.08, 0.06),
    new THREE.MeshLambertMaterial({ color: COLOR.travesano }),
    travesanos.length,
  );
  const q = new THREE.Quaternion();
  const eje = new THREE.Vector3(0, 1, 0);
  const escala = new THREE.Vector3();
  const pos = new THREE.Vector3();
  travesanos.forEach((t, i) => {
    q.setFromAxisAngle(eje, t.giro);
    mallaTravesanos.setMatrixAt(i, m.compose(pos.set(t.x, t.alto + 0.06, t.z), q, escala.set(t.largo, 1, 1)));
  });
  mallaTravesanos.castShadow = true;
  grupo.add(mallaTravesanos);

  decorar(grupo, limites);

  return { grupo, parcelas, limites, ancho, fondo, centro };
}

/** Arbustos, piedras y flores alrededor del jardín (fuera del camino) */
function decorar(grupo, limites) {
  const azar = azarConSemilla(11);
  const ancho = limites.maxX - limites.minX;
  const fondo = limites.maxZ - limites.minZ;
  const cx = (limites.minX + limites.maxX) / 2;
  const cz = (limites.minZ + limites.maxZ) / 2;
  const fuera = (margen) => {
    // Punto en un anillo alrededor del camino
    for (;;) {
      const x = (azar() - 0.5) * (ancho + margen * 2);
      const z = (azar() - 0.5) * (fondo + margen * 2);
      if (Math.abs(x) > ancho / 2 + 0.6 || Math.abs(z) > fondo / 2 + 0.6) return [cx + x, cz + z];
    }
  };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();

  const geoArbusto = new THREE.IcosahedronGeometry(0.7, 0);
  COLOR.arbustos.forEach((color) => {
    const n = 9;
    const malla = new THREE.InstancedMesh(geoArbusto, new THREE.MeshLambertMaterial({ color, flatShading: true }), n);
    for (let i = 0; i < n; i++) {
      const [x, z] = fuera(7);
      const t = 0.7 + azar() * 0.8;
      q.setFromEuler(e.set(0, azar() * 3, 0));
      malla.setMatrixAt(i, m.compose(p.set(x, 0.45 * t, z), q, s.set(t, t * 0.8, t)));
    }
    malla.castShadow = true;
    grupo.add(malla);
  });

  const piedras = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.35, 0),
    new THREE.MeshLambertMaterial({ color: COLOR.piedra, flatShading: true }),
    14,
  );
  for (let i = 0; i < 14; i++) {
    const [x, z] = fuera(5);
    const t = 0.5 + azar() * 0.9;
    q.setFromEuler(e.set(azar() * 3, azar() * 3, 0));
    piedras.setMatrixAt(i, m.compose(p.set(x, 0.12 * t, z), q, s.set(t, t * 0.6, t)));
  }
  piedras.castShadow = true;
  grupo.add(piedras);

  const geoFlor = new THREE.IcosahedronGeometry(0.12, 0);
  COLOR.flores.forEach((color) => {
    const n = 16;
    const malla = new THREE.InstancedMesh(geoFlor, new THREE.MeshLambertMaterial({ color, flatShading: true }), n);
    for (let i = 0; i < n; i++) {
      const [x, z] = fuera(6);
      malla.setMatrixAt(i, m.makeTranslation(x, 0.1, z));
    }
    grupo.add(malla);
  });
}

/** Brote provisional para los árboles que aún no tienen modelo 3D: tallo, hojas y un letrero */
function crearBrote() {
  const grupo = new THREE.Group();
  const matHoja = new THREE.MeshLambertMaterial({ color: COLOR.brote, flatShading: true });
  const tallo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.09, 0.9, 6),
    new THREE.MeshLambertMaterial({ color: COLOR.tallo }),
  );
  tallo.position.y = 0.45;
  grupo.add(tallo);
  const geoHoja = new THREE.SphereGeometry(0.32, 6, 4);
  for (const [x, y, rz] of [[-0.28, 0.85, 0.7], [0.28, 0.95, -0.7], [0, 1.1, 0]]) {
    const hoja = new THREE.Mesh(geoHoja, matHoja);
    hoja.scale.set(1, 0.45, 0.7);
    hoja.position.set(x, y, 0);
    hoja.rotation.z = rz;
    grupo.add(hoja);
  }
  // Letrero de madera clavado al lado (indica que el árbol todavía está creciendo)
  const madera = new THREE.MeshLambertMaterial({ color: COLOR.letrero });
  const palo = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.6, 0.07), madera);
  palo.position.set(0.75, 0.3, 0.35);
  const tabla = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.05), madera);
  tabla.position.set(0.75, 0.6, 0.37);
  grupo.add(palo, tabla);
  grupo.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return grupo;
}

async function abrirJardin() {
  if (document.querySelector('.jardin')) return;
  const raiz = crearInterfaz();
  const cargando = raiz.querySelector('.jardin-cargando');
  const info = raiz.querySelector('.jardin-info');
  const infoAccion = info.querySelector('.jardin-info-accion');
  let cerrado = false;
  let renderer = null;
  let scene = null;
  let ui = null; // interfaz 2D (jardin-ui.js): monedas, herramientas y paneles
  let estadoAbierto = null; // progreso cargado; al salir se programa con él el aviso de sed
  const recursosSueltos = []; // geometrías y materiales que no siempre están en la escena
  const quitarEventos = [];
  const escuchar = (objetivo, tipo, fn, opciones) => {
    objetivo.addEventListener(tipo, fn, opciones);
    quitarEventos.push(() => objetivo.removeEventListener(tipo, fn, opciones));
  };

  const cerrar = () => {
    if (cerrado) return;
    cerrado = true;
    quitarEventos.forEach((quitar) => quitar());
    if (estadoAbierto) {
      // Un solo aviso de "tienen sed" para cuando el usuario no esté en el jardín (solo en la app)
      const estadoFinal = estadoAbierto;
      programarAvisoSed(estadoFinal).then(() => guardarEstado(estadoFinal));
    }
    if (scene) {
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((mat) => mat.dispose());
      });
    }
    recursosSueltos.forEach((r) => r.dispose());
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }
    raiz.remove();
  };
  raiz.querySelector('.jardin-salir').addEventListener('click', cerrar);
  // Escape cierra primero el panel o la herramienta activa, y después el jardín
  let salirObservar = () => false; // se define al cargar la escena
  escuchar(window, 'keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (ui && ui.cerrarCapa()) return;
    if (salirObservar()) return;
    cerrar();
  });

  try {
    await cargarThree();
    // Árboles del usuario (desbloqueados) para saber qué hay plantado y qué está guardado
    const arboles = await arbolesDelUsuario();
    if (cerrado) return; // se salió mientras cargaba

    let catalogoAccesorios = new Map();
    try {
      const catalogo = await cargarCatalogo();
      catalogoAccesorios = new Map(catalogo.accesorios.map((a) => [a.id, a]));
    } catch (err) {
      console.warn('No se pudo cargar el catálogo de accesorios para el jardín:', err);
    }
    if (cerrado) return;

    const plantasPorCodigo = new Map(arboles.map((p) => [p.codigoQR, p]));
    const todasLasPlantas = window.plantsHandler?.plantas || [];
    const estado = cargarEstado();
    estadoAbierto = estado;
    // Mientras se está en el jardín no hace falta el aviso; se vuelve a programar al salir
    cancelarAvisoSed(estado).then((cambio) => { if (cambio) guardarEstado(estado); });
    if (Object.keys(estado.plantados).length) pedirPermisoAvisos();
    // Solo si plantas.json cargó: si falló, no se debe liberar ninguna parcela por error
    if (todasLasPlantas.length) quitarDesconocidos(estado, new Set(todasLasPlantas.map((p) => p.codigoQR)));

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    raiz.prepend(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(COLOR.cielo);
    const luzCielo = new THREE.HemisphereLight(0xffffff, 0x6b8f3a, 1.6);
    scene.add(luzCielo);

    // Pasto alrededor (fijo); el resto del jardín se vuelve a construir cuando se compra una parcela
    const pasto = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshLambertMaterial({ color: COLOR.pasto }));
    pasto.rotation.x = -Math.PI / 2;
    pasto.receiveShadow = true;
    scene.add(pasto);

    let jardin = construirJardin(scene, estado.celdas);
    let totalParcelas = jardin.parcelas.length;

    // Sol con sombras suaves que cubren todo el jardín (se reajusta cuando el jardín crece)
    const sol = new THREE.DirectionalLight(0xfff4e0, 2.2);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    sol.shadow.bias = -0.0008;
    scene.add(sol, sol.target);
    function ajustarSol() {
      const { x, z } = jardin.centro;
      const radioSombra = Math.max(jardin.ancho, jardin.fondo) * 0.75 + 6;
      sol.position.set(x - 12, 22, z + 10);
      sol.target.position.set(x, 0, z);
      Object.assign(sol.shadow.camera, { left: -radioSombra, right: radioSombra, top: radioSombra, bottom: -radioSombra, near: 1, far: 80 });
      sol.shadow.camera.updateProjectionMatrix();
    }
    ajustarSol();

    // Marca de la parcela elegida
    const marca = new THREE.Mesh(
      new THREE.PlaneGeometry(TAM_PARCELA + 0.1, TAM_PARCELA + 0.1),
      new THREE.MeshBasicMaterial({ color: COLOR.seleccion, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    marca.rotation.x = -Math.PI / 2;
    marca.visible = false;
    scene.add(marca);

    // Tierra mojada: se oscurece la parcela mientras su árbol no se puede volver a regar
    const geoMojada = new THREE.PlaneGeometry(TAM_PARCELA * 0.98, TAM_PARCELA * 0.98);
    const matMojada = new THREE.MeshBasicMaterial({ color: COLOR.mojada, transparent: true, opacity: 0.35, depthWrite: false });
    function crearMojada(p) {
      const mojada = new THREE.Mesh(geoMojada, matMojada);
      mojada.rotation.x = -Math.PI / 2;
      mojada.position.set(p.x, SUELO_PARCELA + 0.07, p.z);
      mojada.visible = false;
      scene.add(mojada);
      return mojada;
    }
    const mojadas = jardin.parcelas.map(crearMojada);

    // Burbuja blanca con una gota: el árbol pide agua (solo entonces se puede regar)
    function texturaBurbuja() {
      const lienzo = document.createElement('canvas');
      lienzo.width = 256; lienzo.height = 256;
      const ctx = lienzo.getContext('2d');
      const r = 56;
      const x0 = 24, y0 = 16, x1 = 232, y1 = 190; // caja de la burbuja; debajo queda el piquito
      ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x0 + r, y0);
      ctx.lineTo(x1 - r, y0); ctx.quadraticCurveTo(x1, y0, x1, y0 + r);
      ctx.lineTo(x1, y1 - r); ctx.quadraticCurveTo(x1, y1, x1 - r, y1);
      ctx.lineTo(150, y1); ctx.lineTo(128, y1 + 34); ctx.lineTo(106, y1); // piquito hacia el árbol
      ctx.lineTo(x0 + r, y1); ctx.quadraticCurveTo(x0, y1, x0, y1 - r);
      ctx.lineTo(x0, y0 + r); ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = 'transparent';
      // Gota de agua azul con brillo
      const cx = 128, cy = 108;
      ctx.fillStyle = '#2f9fe0';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 62);
      ctx.bezierCurveTo(cx + 10, cy - 36, cx + 46, cy - 14, cx + 46, cy + 16);
      ctx.arc(cx, cy + 16, 46, 0, Math.PI, false);
      ctx.bezierCurveTo(cx - 46, cy - 14, cx - 10, cy - 36, cx, cy - 62);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.ellipse(cx - 18, cy + 12, 8, 16, -0.35, 0, Math.PI * 2);
      ctx.fill();
      const textura = new THREE.CanvasTexture(lienzo);
      textura.colorSpace = THREE.SRGBColorSpace;
      return textura;
    }
    const matBurbuja = new THREE.SpriteMaterial({ map: texturaBurbuja(), transparent: true, depthTest: false });
    recursosSueltos.push(matBurbuja.map, matBurbuja);
    const ALTO_BURBUJA = ALTO_ARBOL + 1.15;
    function crearBurbuja(p) {
      const burbuja = new THREE.Sprite(matBurbuja);
      burbuja.scale.set(1.5, 1.5, 1);
      burbuja.center.set(0.5, 0); // el piquito queda justo en la posición
      burbuja.position.set(p.x, ALTO_BURBUJA, p.z);
      burbuja.renderOrder = 10;
      burbuja.visible = false;
      scene.add(burbuja);
      return burbuja;
    }
    const burbujas = jardin.parcelas.map(crearBurbuja);

    // Cámara ortográfica con ángulo fijo; solo se mueve el punto que mira y el zoom
    const camara = new THREE.OrthographicCamera();
    const direccion = new THREE.Vector3(
      Math.sin(GIRO) * Math.cos(ELEVACION),
      Math.sin(ELEVACION),
      Math.cos(GIRO) * Math.cos(ELEVACION),
    );
    const objetivo = new THREE.Vector3();
    let altoVista = 1;

    // Cámara para observar un árbol de cerca; mientras se observa, es la que dibuja la escena
    const camaraCerca = new THREE.PerspectiveCamera(OBSERVAR.fov, window.innerWidth / window.innerHeight, 0.1, 200);
    let camaraActiva = camara;
    let observando = null; // { indice, centro, azimut, elevacion, distancia }

    // Tamaño de la vista para que todo el jardín quepa en pantalla (vertical u horizontal)
    function ajustarVista() {
      const aspecto = window.innerWidth / window.innerHeight;
      const diagonal = (jardin.ancho + jardin.fondo) * Math.SQRT1_2;
      const anchoNecesario = diagonal * 1.08;
      const altoNecesario = diagonal * Math.sin(ELEVACION) * 1.5;
      altoVista = Math.max(anchoNecesario / aspecto, altoNecesario);
      camara.left = (-altoVista * aspecto) / 2;
      camara.right = (altoVista * aspecto) / 2;
      camara.top = altoVista / 2;
      camara.bottom = -altoVista / 2;
      camara.near = 0.1;
      camara.far = 200;
      camara.updateProjectionMatrix();
      camaraCerca.aspect = aspecto;
      camaraCerca.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function ubicarCamara() {
      const { minX, maxX, minZ, maxZ } = jardin.limites;
      objetivo.x = Math.max(minX, Math.min(maxX, objetivo.x));
      objetivo.z = Math.max(minZ, Math.min(maxZ, objetivo.z));
      camara.position.copy(objetivo).addScaledVector(direccion, 60);
      camara.lookAt(objetivo);
    }

    let pendiente = false;
    function dibujar() {
      if (pendiente || cerrado) return;
      pendiente = true;
      requestAnimationFrame(() => {
        pendiente = false;
        if (!cerrado) renderer.render(scene, camaraActiva);
      });
    }

    ajustarVista();
    ubicarCamara();

    // --- Árboles plantados ---
    const cargador = new GLTFLoader();
    const modelos = new Map();          // ruta -> Promise<gltf | null>
    const arbolesEnEscena = new Map();  // índice de parcela -> objeto 3D
    const mezcladores = new Set();      // animaciones activas de los árboles plantados y sus accesorios

    /** Mezcladores de un árbol: el de su modelo y los de sus accesorios animados */
    const mezcladoresDe = (arbol) => [arbol.userData.mezclador, ...(arbol.userData.mezcladoresAccesorios || [])].filter(Boolean);
    function activarMezcladores(arbol) {
      const lista = mezcladoresDe(arbol);
      lista.forEach((m) => mezcladores.add(m));
      if (lista.length) iniciarAnimacion();
    }
    function quitarMezcladores(arbol) {
      mezcladoresDe(arbol).forEach((m) => { m.stopAllAction(); mezcladores.delete(m); });
    }
    const efectos = new Set();          // efectos de corta duración: (segundos) => true mientras sigan
    const reducirMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    function cargarModelo(ruta) {
      if (!modelos.has(ruta)) {
        modelos.set(ruta, cargador.loadAsync(ruta)
          .catch((err) => {
            console.warn(`No se pudo cargar el modelo ${ruta}; se muestra un brote`, err);
            return null;
          }));
      }
      return modelos.get(ruta);
    }

    const texturas = new Map(); // ruta -> Promise<THREE.Texture | null>
    const cargadorTexturas = new THREE.TextureLoader();
    function cargarTextura(ruta) {
      if (!texturas.has(ruta)) {
        texturas.set(ruta, cargadorTexturas.loadAsync(ruta)
          .catch((err) => {
            console.warn(`No se pudo cargar la pintura ${ruta}`, err);
            return null;
          }));
      }
      return texturas.get(ruta);
    }

    /**
     * Modelo del árbol escalado para caber en la parcela, apoyado en la tierra y mirando a la cámara.
     * Sin ruta (árbol bloqueado o sin modelo todavía) se usa el brote provisional.
     */
    async function crearArbol(codigo) {
      const ruta = window.plantsHandler?.getModelUrl(codigo) || null;
      const gltf = ruta ? await cargarModelo(ruta) : null;
      const original = gltf?.scene || null;
      const modelo = original ? original.clone(true) : crearBrote();
      const caja = new THREE.Box3().setFromObject(modelo);
      const tam = caja.getSize(new THREE.Vector3());
      const escala = original ? Math.min(ALTO_ARBOL / tam.y, ANCHO_ARBOL / Math.max(tam.x, tam.z)) : 1;
      const anclas = anclasDe(modelo, caja);
      const arbol = new THREE.Group();
      // Puntos de cada zona en coordenadas del modelo, para ubicar sus botones en pantalla
      arbol.userData.modelo = modelo;
      arbol.userData.zonas = Object.fromEntries(['cabeza', 'rostro', 'cuello'].map((z) => [z, modelo.worldToLocal(anclas[z].punto.clone())]));
      arbol.add(modelo);
      modelo.scale.multiplyScalar(escala);
      modelo.position.y = -caja.min.y * escala;
      arbol.rotation.y = GIRO; // el frente (+Z del modelo) mira hacia la cámara
      modelo.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });

      // Animación del modelo (clip "idle" o el primero), empezando en un punto al azar para que
      // los árboles no se muevan todos al mismo tiempo
      if (gltf?.animations?.length && !reducirMovimiento) {
        const clip = THREE.AnimationClip.findByName(gltf.animations, CLIP_PREFERIDO) || gltf.animations[0];
        const mezclador = new THREE.AnimationMixer(modelo);
        const accion = mezclador.clipAction(clip);
        accion.play();
        accion.time = Math.random() * clip.duration;
        arbol.userData.mezclador = mezclador;
      }
      arbol.userData.mezcladoresAccesorios = await ponerAccesoriosDelArbol(codigo, tam.y, anclas);
      return arbol;
    }

    /** Vértices de un nodo (y sus hijos) en el espacio del modelo, como [x, y, z, x, y, z, ...] */
    function verticesDe(nodo) {
      const puntos = [];
      const v = new THREE.Vector3();
      nodo?.traverse((o) => {
        if (!o.isMesh) return;
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          puntos.push(v.x, v.y, v.z);
        }
      });
      return puntos;
    }

    /**
     * Dónde y de qué nodo cuelga cada accesorio, en el espacio del modelo sin escalar, a partir de
     * los nodos con nombre del .glb (canopy, face, eye_L/eye_R, mouth, trunk_feet). Al colgarlos de
     * esos nodos siguen la animación del árbol. Sin nodos (el brote), se estima con la caja completa.
     * Cada ancla: { padre, inversa, giro, escalaNodo, punto, ... }
     */
    function anclasDe(modelo, caja) {
      const tam = caja.getSize(new THREE.Vector3());
      const nodo = (nombre) => modelo.getObjectByName(nombre) || null;
      const cajaDe = (n) => (n ? new THREE.Box3().setFromObject(n) : null);
      const centro = (b) => b.getCenter(new THREE.Vector3());
      // Cómo pasar del espacio del modelo al del nodo del que colgará el accesorio
      const engancheEn = (n) => {
        const padre = n || modelo;
        const giro = new THREE.Quaternion();
        const escalaNodo = new THREE.Vector3();
        padre.matrixWorld.decompose(new THREE.Vector3(), giro, escalaNodo);
        return { padre, inversa: padre.matrixWorld.clone().invert(), giro: giro.invert(), escalaNodo: escalaNodo.x };
      };

      // Cabeza: sobre la copa. alturaEn(radio) da la altura de la copa en un anillo alrededor de su
      // eje, para que el ala del sombrero la toque en el borde y no se apoye en el punto más alto
      const copaNodo = nodo('canopy');
      const copa = cajaDe(copaNodo) || caja;
      const cCopa = centro(copa);
      const puntosCopa = verticesDe(copaNodo);
      const cabeza = {
        ...engancheEn(copaNodo),
        punto: new THREE.Vector3(cCopa.x, copa.max.y, cCopa.z),
        alturaEn(radio) {
          // Un ala muy ancha se apoyaría en los costados de la copa y el sombrero quedaría hundido:
          // como mucho se apoya a la mitad del radio de la copa
          const radioCopa = Math.max(copa.max.x - copa.min.x, copa.max.z - copa.min.z) / 2;
          const apoyo = Math.min(radio, radioCopa * 0.5);
          let maxY = -Infinity;
          for (let i = 0; i < puntosCopa.length; i += 3) {
            const d = Math.hypot(puntosCopa[i] - cCopa.x, puntosCopa[i + 2] - cCopa.z);
            if (d >= apoyo * 0.7 && d <= apoyo && puntosCopa[i + 1] > maxY) maxY = puntosCopa[i + 1];
          }
          return Number.isFinite(maxY) ? maxY : copa.max.y;
        },
      };

      const caraNodo = nodo('face');
      const cara = cajaDe(caraNodo);
      if (!cara) {
        return {
          cabeza,
          rostro: { ...engancheEn(null), punto: new THREE.Vector3(0, caja.min.y + tam.y * 0.5, tam.z * 0.25), anchoCara: tam.x * 0.25, bajoOjos: tam.y * 0.1 },
          cuello: { ...engancheEn(null), punto: new THREE.Vector3(0, caja.min.y + tam.y * 0.4, 0), radioTronco: tam.x * 0.15 },
        };
      }

      // Rostro: entre los ojos, al frente de la cara
      const ojos = [cajaDe(nodo('eye_L')), cajaDe(nodo('eye_R'))].filter(Boolean);
      const cCara = centro(cara);
      const entreOjos = ojos.length === 2 ? centro(ojos[0]).lerp(centro(ojos[1]), 0.5) : cCara;
      const frente = Math.max(cara.max.z, ...ojos.map((b) => b.max.z));
      const rostro = {
        ...engancheEn(caraNodo),
        punto: new THREE.Vector3(entreOjos.x, entreOjos.y, frente),
        anchoCara: cara.max.x - cara.min.x,
        bajoOjos: entreOjos.y - cara.min.y, // hasta dónde llega la cara por debajo del punto
      };

      // Cuello: bajo la boca. El eje y el radio del tronco a esa altura se miden con los vértices
      // del tronco en una franja (que se ensancha si quedan muy pocos)
      const boca = cajaDe(nodo('mouth')) || cara;
      const troncoNodo = nodo('trunk_feet') || nodo('body');
      const yCuello = boca.min.y - (cara.max.y - cara.min.y) * 0.2;
      const puntosTronco = verticesDe(troncoNodo);
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, enFranja = 0;
      for (let banda = tam.y * 0.02; enFranja < 6 && banda < tam.y; banda *= 2) {
        minX = Infinity; maxX = -Infinity; minZ = Infinity; maxZ = -Infinity; enFranja = 0;
        for (let i = 0; i < puntosTronco.length; i += 3) {
          if (Math.abs(puntosTronco[i + 1] - yCuello) > banda) continue;
          enFranja++;
          minX = Math.min(minX, puntosTronco[i]); maxX = Math.max(maxX, puntosTronco[i]);
          minZ = Math.min(minZ, puntosTronco[i + 2]); maxZ = Math.max(maxZ, puntosTronco[i + 2]);
        }
      }
      const cTronco = enFranja ? new THREE.Vector3((minX + maxX) / 2, yCuello, (minZ + maxZ) / 2) : centro(cajaDe(troncoNodo) || cara);
      const radioTronco = enFranja ? Math.max(maxX - minX, maxZ - minZ) / 2 : frente - cTronco.z;
      const cuello = { ...engancheEn(troncoNodo), punto: new THREE.Vector3(cTronco.x, yCuello, cTronco.z), radioTronco };

      return { cabeza, rostro, cuello };
    }

    /** Radio interior de un anillo (collar): el vértice más cercano a su eje vertical */
    function radioInterior(pieza) {
      let radio = Infinity;
      const v = new THREE.Vector3();
      pieza.traverse((o) => {
        if (!o.isMesh) return;
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          radio = Math.min(radio, Math.hypot(v.x, v.z));
        }
      });
      return radio;
    }

    /**
     * Carga los accesorios puestos en este árbol (ver jardin-estado.js) y los cuelga del nodo del
     * modelo que les corresponde. Todo se calcula en unidades del modelo sin escalar: al escalar el
     * árbol, escalan con él. Devuelve los mezcladores de los accesorios que traen animación.
     */
    async function ponerAccesoriosDelArbol(codigo, alturaModelo, anclas) {
      const mezcladoresPieza = [];
      for (const [zona, id] of Object.entries(accesoriosDe(estado, codigo))) {
        const def = catalogoAccesorios.get(id);
        if (!def) continue;
        const ancla = anclas[zona] || anclas.cabeza;
        const punto = ancla.punto.clone();
        let pieza = null;
        let escalaPieza = alturaModelo; // los modelos están pensados para un árbol de 1 de alto
        if (def.modelo) {
          const gltf = await cargarModelo(`/static/modelos/accesorios/${def.modelo}`);
          if (!gltf) continue;
          pieza = gltf.scene.clone(true);
          // Si el GLB trae animaciones, se reproducen todas en bucle sobre esta copia (empezando en
          // un punto al azar para que dos accesorios iguales no se muevan a la vez)
          if (gltf.animations?.length && !reducirMovimiento) {
            const mezclador = new THREE.AnimationMixer(pieza);
            gltf.animations.forEach((clip) => {
              const accion = mezclador.clipAction(clip);
              accion.play();
              accion.time = Math.random() * clip.duration;
            });
            mezcladoresPieza.push(mezclador);
          }
          const tamPieza = new THREE.Box3().setFromObject(pieza).getSize(new THREE.Vector3());
          if (zona === 'cuello') {
            // El anillo se escala para que su interior quede justo pegado al tronco
            let interior = radioInterior(pieza);
            if (!(interior > tamPieza.x * 0.1)) interior = tamPieza.x * 0.42; // sin hueco claro: se estima
            escalaPieza = (ancla.radioTronco * 0.97) / interior;
          } else if (zona === 'cabeza') {
            punto.y = ancla.alturaEn((Math.max(tamPieza.x, tamPieza.z) / 2) * escalaPieza);
          }
          pieza.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        } else if (def.pintura) {
          const textura = await cargarTextura(`${CARPETA_ACCESORIOS}${def.pintura}`);
          if (!textura) continue;
          // Cuadrado centrado entre los ojos, recortado por abajo donde termina la cara: así no
          // baja hasta el cuello ni se dibuja encima del collar
          const lado = ancla.anchoCara * 1.3;
          const recorte = Math.max(0, lado / 2 - ancla.bajoOjos);
          const geometria = new THREE.PlaneGeometry(lado, lado - recorte);
          const uv = geometria.attributes.uv;
          for (let i = 0; i < uv.count; i++) if (uv.getY(i) === 0) uv.setY(i, recorte / lado);
          pieza = new THREE.Mesh(
            geometria,
            new THREE.MeshBasicMaterial({
              map: textura, transparent: true, depthWrite: false,
              polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, // siempre detrás de lo que toque la cara
            }),
          );
          pieza.renderOrder = -1;
          escalaPieza = 1;
          punto.y += recorte / 2;
          punto.z += alturaModelo * 0.01; // un pelo por delante de la cara para que no parpadee contra ella
        }
        if (!pieza) continue;
        pieza.position.copy(punto).applyMatrix4(ancla.inversa);
        pieza.quaternion.copy(ancla.giro);
        pieza.scale.setScalar(escalaPieza / ancla.escalaNodo);
        ancla.padre.add(pieza);
      }
      return mezcladoresPieza;
    }

    // Ciclo de animación: solo corre mientras haya árboles animados o efectos (crecer, lluvia,
    // moneda), limitado a CUADROS_POR_SEGUNDO
    let animando = false;
    let ultimoCuadro = 0;
    const intervalo = 1000 / CUADROS_POR_SEGUNDO;
    function iniciarAnimacion() {
      if (animando || cerrado) return;
      animando = true;
      ultimoCuadro = performance.now();
      requestAnimationFrame(cuadroAnimado);
    }
    function cuadroAnimado(ahora) {
      if (cerrado || (mezcladores.size === 0 && efectos.size === 0)) { animando = false; return; }
      requestAnimationFrame(cuadroAnimado);
      const transcurrido = ahora - ultimoCuadro;
      if (transcurrido < intervalo - 1) return;
      ultimoCuadro = ahora;
      // Si la app estuvo en segundo plano, no se recupera de golpe todo el tiempo perdido
      const segundos = Math.min(transcurrido / 1000, 0.1);
      mezcladores.forEach((m) => m.update(segundos));
      efectos.forEach((efecto) => { if (!efecto(segundos)) efectos.delete(efecto); });
      renderer.render(scene, camaraActiva);
    }
    function agregarEfecto(efecto) {
      efectos.add(efecto);
      iniciarAnimacion();
    }

    async function ponerArbol(indice, { crecer = false } = {}) {
      const codigo = arbolEn(estado, indice);
      const anterior = arbolesEnEscena.get(indice);
      if (anterior) {
        scene.remove(anterior);
        quitarMezcladores(anterior);
      }
      arbolesEnEscena.delete(indice);
      if (!codigo) { dibujar(); return; }

      const arbol = await crearArbol(codigo);
      if (cerrado || arbolEn(estado, indice) !== codigo) return; // cambió mientras cargaba
      const parcela = jardin.parcelas[indice];
      arbol.position.set(parcela.x, SUELO_PARCELA, parcela.z);
      arbol.userData.parcela = indice;
      scene.add(arbol);
      arbolesEnEscena.set(indice, arbol);
      activarMezcladores(arbol);
      actualizarHumedad();
      if (crecer) animarCrecimiento(arbol);
      else dibujar();
    }

    // Al plantar o mover, el árbol crece desde el suelo con un pequeño rebote
    function animarCrecimiento(arbol) {
      const DURACION = 0.65;
      let t = 0;
      arbol.scale.setScalar(0.05);
      agregarEfecto((segundos) => {
        t = Math.min(1, t + segundos / DURACION);
        const rebote = 1 + 0.12 * Math.sin(t * Math.PI) * (1 - t);
        arbol.scale.setScalar(Math.max(0.05, t * rebote));
        return t < 1;
      });
    }

    function actualizarHumedad() {
      const ahora = Date.now();
      mojadas.forEach((mojada, i) => {
        const codigo = arbolEn(estado, i);
        mojada.visible = !!codigo && estaMojado(estado, codigo, ahora);
      });
      actualizarSed(ahora);
      dibujar();
    }

    // Muestra la burbuja de los árboles que piden agua; mientras haya alguna, flotan suavemente
    let flotandoBurbujas = false;
    function actualizarSed(ahora = Date.now()) {
      let alguna = false;
      burbujas.forEach((burbuja, i) => {
        const codigo = arbolEn(estado, i);
        burbuja.visible = !!codigo && !!plantasPorCodigo.get(codigo) && tieneSed(estado, codigo, ahora);
        if (burbuja.visible) alguna = true;
      });
      if (!alguna || flotandoBurbujas || reducirMovimiento) return;
      flotandoBurbujas = true;
      let t = 0;
      agregarEfecto((segundos) => {
        t += segundos;
        let sigue = false;
        burbujas.forEach((burbuja, i) => {
          if (!burbuja.visible) return;
          sigue = true;
          burbuja.position.y = ALTO_BURBUJA + Math.sin(t * 2.2 + i) * 0.12;
        });
        if (sigue) return true;
        flotandoBurbujas = false;
        return false;
      });
    }

    // Corazón que sube del árbol al regarlo (emoji sobre un lienzo)
    function texturaCorazon() {
      const lienzo = document.createElement('canvas');
      lienzo.width = 128; lienzo.height = 128;
      const ctx = lienzo.getContext('2d');
      ctx.font = '96px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e0245e'; // por si el sistema no tiene emojis a color
      ctx.fillText('\u2764\uFE0F', 64, 70);
      const textura = new THREE.CanvasTexture(lienzo);
      textura.colorSpace = THREE.SRGBColorSpace;
      return textura;
    }
    let mapaCorazon = null;
    function efectoCorazon(x, z) {
      if (!mapaCorazon) { mapaCorazon = texturaCorazon(); recursosSueltos.push(mapaCorazon); }
      // Un corazón grande y dos pequeños que salen un poco después, a los lados
      const corazones = [
        { dx: 0, dz: 0, escala: 1.1, retraso: 0 },
        { dx: -0.6, dz: 0.3, escala: 0.6, retraso: 0.25 },
        { dx: 0.6, dz: -0.3, escala: 0.6, retraso: 0.45 },
      ].map((c) => {
        const material = new THREE.SpriteMaterial({ map: mapaCorazon, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(material);
        sprite.renderOrder = 11;
        sprite.visible = false;
        sprite.position.set(x + c.dx, ALTO_ARBOL + 0.9, z + c.dz);
        scene.add(sprite);
        return { ...c, sprite, material };
      });
      const DURACION = 1.5;
      let t = 0;
      agregarEfecto((segundos) => {
        t += segundos;
        let vivos = 0;
        corazones.forEach((c) => {
          const u = (t - c.retraso) / DURACION;
          if (u < 0) { vivos++; return; }
          if (u >= 1) { c.sprite.visible = false; return; }
          vivos++;
          c.sprite.visible = true;
          const subida = 1 - Math.pow(1 - u, 2);
          c.sprite.position.y = ALTO_ARBOL + 0.9 + subida * 2.2;
          c.sprite.position.x = x + c.dx + Math.sin(u * Math.PI * 2 + c.retraso * 7) * 0.15;
          const latido = 1 + 0.12 * Math.sin(u * Math.PI * 6);
          c.sprite.scale.setScalar(c.escala * Math.min(1, u / 0.15) * latido);
          c.material.opacity = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
        });
        if (vivos) return true;
        corazones.forEach((c) => { scene.remove(c.sprite); c.material.dispose(); });
        return false;
      });
    }

    // Lluvia de gotas sobre el árbol al regarlo
    const geoGota = new THREE.SphereGeometry(0.07, 6, 4);
    const matGota = new THREE.MeshLambertMaterial({ color: COLOR.gota, emissive: 0x0b4f6c });
    recursosSueltos.push(geoGota, matGota);
    function efectoLluvia(x, z) {
      const N = 28;
      const gotas = new THREE.InstancedMesh(geoGota, matGota, N);
      const datos = Array.from({ length: N }, () => {
        const angulo = Math.random() * Math.PI * 2;
        const radio = Math.sqrt(Math.random()) * 1.4;
        return {
          x: x + Math.cos(angulo) * radio,
          z: z + Math.sin(angulo) * radio,
          y: ALTO_ARBOL + 0.8 + Math.random() * 1.5,
          velocidad: 5 + Math.random() * 2,
          retraso: Math.random() * 0.35,
        };
      });
      const m = new THREE.Matrix4();
      const oculta = new THREE.Matrix4().makeScale(0, 0, 0);
      datos.forEach((_, i) => gotas.setMatrixAt(i, oculta));
      scene.add(gotas);
      let t = 0;
      agregarEfecto((segundos) => {
        t += segundos;
        let vivas = 0;
        datos.forEach((g, i) => {
          if (t < g.retraso) { vivas++; return; }
          g.y -= g.velocidad * segundos;
          if (g.y <= SUELO_PARCELA) { gotas.setMatrixAt(i, oculta); return; }
          vivas++;
          gotas.setMatrixAt(i, m.makeScale(1, 1.8, 1).setPosition(g.x, g.y, g.z));
        });
        gotas.instanceMatrix.needsUpdate = true;
        if (vivas) return true;
        scene.remove(gotas);
        gotas.dispose();
        return false;
      });
    }

    // Moneda que sale del árbol girando y se desvanece
    const geoMoneda = new THREE.CylinderGeometry(0.7, 0.7, 0.14, 28);
    recursosSueltos.push(geoMoneda);
    function efectoMoneda(x, z, tipo) {
      const oro = tipo === 'oro';
      const material = new THREE.MeshStandardMaterial({
        color: oro ? 0xf2b01e : 0xc9ced3,
        emissive: oro ? 0x4a3000 : 0x2a2d30,
        metalness: 0.7,
        roughness: 0.3,
        transparent: true,
      });
      const moneda = new THREE.Mesh(geoMoneda, material);
      moneda.rotation.x = Math.PI / 2; // de canto, mirando de frente
      const grupo = new THREE.Group();
      grupo.add(moneda);
      const alturaInicial = ALTO_ARBOL + 0.6;
      grupo.position.set(x, alturaInicial, z);
      grupo.rotation.y = GIRO; // empieza con la cara hacia la cámara
      scene.add(grupo);
      const DURACION = 1.6;
      let t = 0;
      agregarEfecto((segundos) => {
        t = Math.min(1, t + segundos / DURACION);
        const subida = 1 - Math.pow(1 - t, 3);
        grupo.position.y = alturaInicial + subida * 1.6;
        // Media vuelta lenta y de regreso: se ve casi siempre de frente, con brillo al girar
        grupo.rotation.y = GIRO + Math.sin(t * Math.PI * 2) * 0.9;
        grupo.scale.setScalar(Math.min(1, t / 0.12));
        material.opacity = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
        if (t < 1) return true;
        scene.remove(grupo);
        material.dispose();
        return false;
      });
    }

    for (let i = 0; i < totalParcelas; i++) if (arbolEn(estado, i)) ponerArbol(i);

    // --- Lluvia: a veces, al entrar, llueve sobre todo el jardín y cada árbol puede dar moneda ---
    let lloviendo = false;
    function iniciarLluvia() {
      if (lloviendo || cerrado) return;
      const plantados = [];
      for (let i = 0; i < totalParcelas; i++) if (arbolEn(estado, i)) plantados.push(i);
      if (!plantados.length) return;
      lloviendo = true;
      const { porArbol, total } = llover(estado, plantados.map((i) => arbolEn(estado, i)));
      mostrarTarjeta('¡Está lloviendo!', 'La lluvia riega todos tus árboles');
      actualizarHumedad();

      // El cielo y la luz se oscurecen al empezar y vuelven a aclararse al terminar
      const cieloClaro = new THREE.Color(COLOR.cielo);
      const cieloOscuro = new THREE.Color(COLOR.cieloLluvia);
      const luzNormal = { sol: sol.intensity, cielo: luzCielo.intensity };
      const oscurecer = (t) => {
        scene.background.copy(cieloClaro).lerp(cieloOscuro, t);
        sol.intensity = luzNormal.sol * (1 - 0.6 * t);
        luzCielo.intensity = luzNormal.cielo * (1 - 0.4 * t);
      };

      // Gotas sobre todo el jardín; al llegar al suelo vuelven arriba
      const N = 500;
      const ALTO = 14;
      const gotas = new THREE.InstancedMesh(geoGota, matGota, N);
      const datos = Array.from({ length: N }, () => ({
        x: jardin.centro.x + (Math.random() - 0.5) * (jardin.ancho + 10),
        z: jardin.centro.z + (Math.random() - 0.5) * (jardin.fondo + 10),
        y: Math.random() * ALTO,
        velocidad: 9 + Math.random() * 3,
      }));
      const m = new THREE.Matrix4();
      scene.add(gotas);

      const duracionS = LLUVIA_DURACION_MS / 1000;
      const pasoMoneda = LLUVIA_GANANCIA_S / porArbol.length;
      let t = 0;
      let siguiente = 0; // próximo árbol que suelta su moneda
      agregarEfecto((segundos) => {
        t += segundos;
        oscurecer(Math.max(0, Math.min(1, t / 1.5, (duracionS - t) / 1.5)));
        datos.forEach((g, i) => {
          g.y -= g.velocidad * segundos;
          if (g.y <= 0) g.y = ALTO;
          gotas.setMatrixAt(i, m.makeScale(1, 1.8, 1).setPosition(g.x, g.y, g.z));
        });
        gotas.instanceMatrix.needsUpdate = true;
        // Las monedas salen de los árboles una tras otra durante los primeros segundos
        while (siguiente < porArbol.length && t >= 1 + siguiente * pasoMoneda) {
          const { moneda } = porArbol[siguiente];
          const parcela = jardin.parcelas[plantados[siguiente]];
          siguiente++;
          if (moneda) {
            efectoMoneda(parcela.x, parcela.z, moneda);
            ui?.actualizarMonedas(moneda);
          }
        }
        if (t < duracionS) return true;
        scene.remove(gotas);
        gotas.dispose();
        oscurecer(0);
        lloviendo = false;
        actualizarHumedad();
        resumenLluvia(total);
        return false;
      });
    }

    function resumenLluvia({ plata, oro }) {
      if (cerrado) return;
      const partes = [];
      if (plata) partes.push(`${plata} de plata`);
      if (oro) partes.push(`${oro} de oro`);
      const texto = partes.length
        ? `Tus árboles te dieron ${partes.join(' y ')}`
        : 'Esta vez los árboles no soltaron monedas';
      if (window.Swal) {
        window.Swal.fire({ title: 'Dejó de llover', text: texto, icon: 'success', iconColor: '#03A65A', confirmButtonColor: '#025928' });
      } else {
        mostrarTarjeta('Dejó de llover', texto);
      }
    }

    // --- Tarjeta de la parcela elegida ---
    let parcelaElegida = null;
    let accionTarjeta = null;
    infoAccion.addEventListener('click', () => accionTarjeta?.());

    function mostrarTarjeta(titulo, texto, accion = null) {
      info.querySelector('.jardin-info-titulo').textContent = titulo;
      info.querySelector('.jardin-info-texto').textContent = texto;
      infoAccion.hidden = !accion;
      accionTarjeta = accion?.fn || null;
      if (accion) infoAccion.textContent = accion.texto;
      info.hidden = false;
      ocultarAyuda();
    }

    /** Posición en pantalla (px) de las zonas del árbol de una parcela, o null si aún no está en escena */
    function posicionesZonas(indice) {
      const arbol = arbolesEnEscena.get(indice);
      const { modelo, zonas } = arbol?.userData || {};
      if (!modelo || !zonas) return null;
      arbol.updateWorldMatrix(true, true);
      // Rostro y cuello quedan casi en el mismo punto: se abren a los lados formando un triángulo con la copa
      const DESPLAZAMIENTO = { cabeza: [0, 0], rostro: [-56, -10], cuello: [56, 14] };
      const posiciones = {};
      for (const [zona, punto] of Object.entries(zonas)) {
        const v = modelo.localToWorld(punto.clone()).project(camara);
        const [dx, dy] = DESPLAZAMIENTO[zona] || [0, 0];
        posiciones[zona] = {
          x: Math.round(((v.x + 1) / 2) * window.innerWidth) + dx,
          y: Math.round(((1 - v.y) / 2) * window.innerHeight) + dy,
        };
      }
      return posiciones;
    }

    function reubicarZonas() {
      if (parcelaElegida === null || !ui) return;
      const posiciones = posicionesZonas(parcelaElegida);
      if (posiciones) ui.reubicarZonas(posiciones);
    }

    function marcarParcela(indice) {
      parcelaElegida = indice;
      ui?.ocultarZonas();
      if (indice === null) {
        marca.visible = false;
        info.hidden = true;
      } else {
        const parcela = jardin.parcelas[indice];
        marca.position.set(parcela.x, SUELO_PARCELA + 0.09, parcela.z);
        marca.visible = true;
      }
      dibujar();
    }

    const nombreDe = (codigo) => plantasPorCodigo.get(codigo)?.nombre || 'Árbol bloqueado';

    // --- Pala: tocar un árbol para tomarlo y otra parcela para llevarlo (si tiene árbol, se intercambian) ---
    let origenPala = null;

    function soltarPala() {
      origenPala = null;
      marca.material.color.setHex(COLOR.seleccion);
      ui?.cambiarAviso(null);
    }

    function colocar(arbol, indice) {
      const p = jardin.parcelas[indice];
      arbol.position.set(p.x, SUELO_PARCELA, p.z);
      arbol.userData.parcela = indice;
      arbolesEnEscena.set(indice, arbol);
      animarCrecimiento(arbol);
    }

    function usarPala(indice) {
      const codigo = arbolEn(estado, indice);
      const titulo = `Parcela ${indice + 1}`;

      if (origenPala === null) {
        if (!codigo) { mostrarTarjeta(titulo, 'No hay ningún árbol para mover aquí'); return; }
        origenPala = indice;
        marca.material.color.setHex(COLOR.origenPala);
        mostrarTarjeta(`Moviendo ${nombreDe(codigo)}`, 'Toca otra parcela para llevarlo allí, o tócalo otra vez para soltarlo');
        ui.cambiarAviso(`Pala: toca otra parcela para mover ${nombreDe(codigo)}`);
        dibujar();
        return;
      }

      const origen = origenPala;
      soltarPala();
      if (indice === origen) { marcarParcela(null); return; }

      const movido = arbolEn(estado, origen);
      const desplazado = arbolEn(estado, indice);
      if (!moverArbol(estado, origen, indice)) { mostrarTarjeta(titulo, 'No se pudo mover el árbol'); return; }

      // Se mueven los objetos 3D ya cargados; si alguno aún estaba cargando, se vuelven a crear
      const objMovido = arbolesEnEscena.get(origen);
      const objDesplazado = arbolesEnEscena.get(indice);
      arbolesEnEscena.delete(origen);
      arbolesEnEscena.delete(indice);
      if (objMovido && (!desplazado || objDesplazado)) {
        colocar(objMovido, indice);
        if (objDesplazado) colocar(objDesplazado, origen);
      } else {
        if (objMovido) { scene.remove(objMovido); quitarMezcladores(objMovido); }
        if (objDesplazado) { scene.remove(objDesplazado); quitarMezcladores(objDesplazado); }
        ponerArbol(indice, { crecer: true });
        if (desplazado) ponerArbol(origen, { crecer: true });
      }
      actualizarHumedad();
      if (desplazado) {
        mostrarTarjeta(
          `Intercambiaste ${nombreDe(movido)} y ${nombreDe(desplazado)}`,
          `${nombreDe(movido)} pasó a la parcela ${indice + 1} y ${nombreDe(desplazado)} a la ${origen + 1}`,
        );
      } else {
        mostrarTarjeta(`Moviste ${nombreDe(movido)}`, `Ahora está en la parcela ${indice + 1}`);
      }
    }

    // --- Regadera global: tantos riegos como litros tenga (5 de inicio, se amplía en la tienda); cada uno se recarga a los 15 min ---
    function textoRegadera() {
      const r = estadoRegadera(estado);
      if (r.cargas === r.max) return { ...r, aviso: `Regadera llena (${r.cargas}/${r.max}): toca un árbol que pida agua` };
      if (r.cargas === 0) return { ...r, aviso: `Regadera vacía: próximo riego en ${formatearEspera(r.siguienteMs)}` };
      return { ...r, aviso: `Regadera (${r.cargas}/${r.max}): toca un árbol que pida agua · otro riego en ${formatearEspera(r.siguienteMs)}` };
    }

    function refrescarRegadera() {
      if (!ui || cerrado) return;
      ui.actualizarRegadera(textoRegadera());
    }

    function usarRegadera(indice) {
      const codigo = arbolEn(estado, indice);
      const titulo = `Parcela ${indice + 1}`;
      if (!codigo) { mostrarTarjeta(titulo, 'No hay ningún árbol para regar aquí'); return; }

      const nombre = nombreDe(codigo);
      const resultado = regar(estado, codigo);
      if (!resultado.regado) {
        if (resultado.motivo === 'sinSed') {
          mostrarTarjeta(`${nombre} no tiene sed`, 'Espera a que te pida agua con su burbuja para regarlo');
        } else {
          mostrarTarjeta('La regadera está vacía', `El próximo riego estará listo en ${formatearEspera(resultado.siguienteMs)}`);
        }
        refrescarRegadera();
        return;
      }
      const { moneda, cargas } = resultado;
      refrescarRegadera();
      const parcela = jardin.parcelas[indice];
      burbujas[indice].visible = false; // ya no pide agua
      efectoLluvia(parcela.x, parcela.z);
      // La tierra se oscurece y salen el corazón y la moneda cuando terminan de caer las gotas
      setTimeout(() => {
        if (cerrado) return;
        actualizarHumedad();
        efectoCorazon(parcela.x, parcela.z);
        if (moneda) {
          efectoMoneda(parcela.x, parcela.z, moneda);
          ui.actualizarMonedas(moneda);
        }
      }, 700);
      const quedan = cargas === 0 ? 'La regadera quedó vacía' : `Te quedan ${cargas} ${cargas === 1 ? 'riego' : 'riegos'}`;
      mostrarTarjeta(
        `¡Regaste ${nombre}!`,
        moneda ? `Ganaste una moneda de ${moneda} · ${quedan}` : `Esta vez no salió moneda · ${quedan}`,
      );
    }

    function plantarEn(codigo, indice) {
      if (!plantar(estado, codigo, indice)) {
        mostrarTarjeta(`Parcela ${indice + 1}`, 'No se pudo plantar aquí: la parcela ya tiene un árbol');
        return;
      }
      ponerArbol(indice, { crecer: true });
      marcarParcela(indice);
      const planta = plantasPorCodigo.get(codigo);
      mostrarTarjeta(`¡Plantaste ${planta ? planta.nombre : 'un árbol'}!`, `Parcela ${indice + 1}`);
    }

    // --- Observar un árbol de cerca: cámara que orbita alrededor de él ---
    const observarCapa = raiz.querySelector('.jardin-observar');

    function ubicarCamaraCerca() {
      const { centro, azimut, elevacion, distancia } = observando;
      camaraCerca.position.set(
        centro.x + Math.cos(elevacion) * Math.sin(azimut) * distancia,
        centro.y + Math.sin(elevacion) * distancia,
        centro.z + Math.cos(elevacion) * Math.cos(azimut) * distancia,
      );
      camaraCerca.lookAt(centro);
    }

    function observarArbol(indice) {
      const arbol = arbolesEnEscena.get(indice);
      const codigo = arbolEn(estado, indice);
      if (!arbol || !codigo) return;
      ui?.soltarModo();
      marcarParcela(null);
      const caja = new THREE.Box3().setFromObject(arbol);
      const parcela = jardin.parcelas[indice];
      observando = {
        indice,
        centro: new THREE.Vector3(parcela.x, (caja.min.y + caja.max.y) / 2, parcela.z),
        azimut: GIRO, // se empieza viendo el frente del árbol, como en la vista del jardín
        elevacion: OBSERVAR.elevacionInicial,
        distancia: OBSERVAR.distanciaInicial,
      };
      camaraActiva = camaraCerca;
      ubicarCamaraCerca();
      observarCapa.querySelector('.jardin-observar-nombre').textContent = nombreDe(codigo);
      observarCapa.hidden = false;
      raiz.classList.add('observando');
      ocultarAyuda();
      dibujar();
    }

    salirObservar = () => {
      if (!observando) return false;
      observando = null;
      camaraActiva = camara;
      observarCapa.hidden = true;
      raiz.classList.remove('observando');
      dibujar();
      return true;
    };
    observarCapa.querySelector('.jardin-observar-volver').addEventListener('click', salirObservar);

    function girarCamaraCerca(dx, dy) {
      observando.azimut -= dx * 0.008;
      observando.elevacion = Math.max(OBSERVAR.elevacion[0], Math.min(OBSERVAR.elevacion[1], observando.elevacion + dy * 0.006));
      ubicarCamaraCerca();
      dibujar();
    }

    function acercarCamaraCerca(factor) {
      observando.distancia = Math.max(OBSERVAR.distancia[0], Math.min(OBSERVAR.distancia[1], observando.distancia / factor));
      ubicarCamaraCerca();
      dibujar();
    }

    // --- Controles: arrastrar para mover, pellizcar o rueda para acercar, tocar para elegir ---
    const lienzo = renderer.domElement;
    const derecha = new THREE.Vector3(Math.cos(GIRO), 0, -Math.sin(GIRO));
    const alFondo = new THREE.Vector3(-direccion.x, 0, -direccion.z).normalize();

    function mover(dx, dy) {
      const k = altoVista / camara.zoom / window.innerHeight;
      objetivo.addScaledVector(derecha, -dx * k);
      objetivo.addScaledVector(alFondo, (dy * k) / Math.sin(ELEVACION));
      ubicarCamara();
      reubicarZonas();
      dibujar();
    }

    function acercar(factor) {
      camara.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, camara.zoom * factor));
      camara.updateProjectionMatrix();
      reubicarZonas();
      dibujar();
    }

    // La ayuda inicial se retira en cuanto el usuario empieza a jugar, para no tapar la tarjeta
    const ocultarAyuda = () => raiz.querySelector('.jardin-ayuda')?.classList.add('oculta');

    const rayo = new THREE.Raycaster();
    const puntero = new THREE.Vector2();
    let mallasParcela = jardin.parcelas.map((p) => p.malla);

    /** Parcela bajo el punto tocado (sobre la tierra o sobre el árbol que tiene encima) */
    function parcelaEn(cx, cy) {
      puntero.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
      rayo.setFromCamera(puntero, camara);
      const golpes = rayo.intersectObjects([...mallasParcela, ...arbolesEnEscena.values()], true);
      for (const golpe of golpes) {
        for (let o = golpe.object; o; o = o.parent) {
          if (Number.isInteger(o.userData.parcela)) return o.userData.parcela;
        }
      }
      return null;
    }

    // --- Parcela nueva (modo 'parcela'): lugares libres pegados al jardín, marcados con un "+" ---
    const NOMBRE_MONEDA = { plata: 'monedas de plata', oro: 'monedas de oro' };
    const candidatos = new THREE.Group();
    candidatos.visible = false;
    scene.add(candidatos);
    let candidatoElegido = null; // celda [columna, fila] del lugar tocado
    let precioParcela = null;    // precio vigente; lo da la tienda al pulsar "Nueva parcela"
    const geoCandidato = new THREE.PlaneGeometry(TAM_PARCELA, TAM_PARCELA);
    const geoBarra = new THREE.BoxGeometry(TAM_PARCELA * 0.4, 0.06, 0.3);
    const matCandidato = new THREE.MeshBasicMaterial({ color: COLOR.seleccion, transparent: true, opacity: 0.3, depthWrite: false });
    const matCandidatoElegido = new THREE.MeshBasicMaterial({ color: COLOR.origenPala, transparent: true, opacity: 0.55, depthWrite: false });
    const matMas = new THREE.MeshBasicMaterial({ color: 0xffffff });

    function mostrarCandidatos() {
      candidatos.clear();
      for (const celda of celdasParaAmpliar(estado)) {
        const { x, z } = centroCelda(celda);
        const lugar = new THREE.Group();
        lugar.position.set(x, 0.05, z);
        lugar.userData.celda = celda;
        const suelo = new THREE.Mesh(geoCandidato, matCandidato);
        suelo.rotation.x = -Math.PI / 2;
        suelo.name = 'suelo';
        const barra = new THREE.Mesh(geoBarra, matMas);
        const barraCruzada = new THREE.Mesh(geoBarra, matMas);
        barraCruzada.rotation.y = Math.PI / 2;
        lugar.add(suelo, barra, barraCruzada);
        candidatos.add(lugar);
      }
      candidatos.visible = true;
      dibujar();
    }

    function ocultarCandidatos() {
      candidatos.clear();
      candidatos.visible = false;
      candidatoElegido = null;
      dibujar();
    }

    /** Vuelve a construir el terreno con las celdas actuales (los árboles no se mueven: cada celda conserva su lugar) */
    function reconstruirJardin() {
      scene.remove(jardin.grupo);
      jardin.grupo.traverse((o) => {
        o.geometry?.dispose();
        [].concat(o.material || []).forEach((mat) => mat.dispose());
      });
      jardin = construirJardin(scene, estado.celdas);
      totalParcelas = jardin.parcelas.length;
      mallasParcela = jardin.parcelas.map((p) => p.malla);
      for (let i = mojadas.length; i < jardin.parcelas.length; i++) mojadas.push(crearMojada(jardin.parcelas[i]));
      for (let i = burbujas.length; i < jardin.parcelas.length; i++) burbujas.push(crearBurbuja(jardin.parcelas[i]));
      ajustarSol();
      ajustarVista();
      ubicarCamara();
      actualizarHumedad();
    }

    function comprarParcelaElegida() {
      if (!candidatoElegido || !precioParcela) return;
      const { moneda, valor } = precioParcela;
      const indice = comprarParcela(estado, candidatoElegido, precioParcela);
      if (indice < 0) {
        const faltan = Math.max(0, valor - estado.monedas[moneda]);
        mostrarTarjeta('Nueva parcela', faltan ? `Te faltan ${faltan} ${NOMBRE_MONEDA[moneda]}` : 'No se pudo comprar la parcela aquí');
        return;
      }
      ui.soltarModo(); // quita los lugares marcados
      reconstruirJardin();
      ui.actualizarMonedas(moneda);
      marcarParcela(indice);
      const guardados = arboles.filter((p) => parcelaDe(estado, p.codigoQR) === null).length;
      mostrarTarjeta(
        '¡Nueva parcela!',
        `La parcela ${indice + 1} ya está lista para plantar`,
        guardados > 0 ? { texto: 'Plantar aquí', fn: () => ui.abrirArboles(indice) } : null,
      );
    }

    /** En modo 'parcela': tocar un lugar marcado lo elige y ofrece comprarlo */
    function elegirLugarParcela(cx, cy) {
      puntero.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
      rayo.setFromCamera(puntero, camara);
      const golpe = rayo.intersectObjects(candidatos.children, true)[0];
      let lugar = null;
      for (let o = golpe?.object; o; o = o.parent) if (o.userData.celda) { lugar = o; break; }
      candidatos.children.forEach((l) => { l.getObjectByName('suelo').material = l === lugar ? matCandidatoElegido : matCandidato; });
      marcarParcela(null);
      candidatoElegido = lugar?.userData.celda || null;
      if (!lugar || !precioParcela) {
        mostrarTarjeta('Nueva parcela', 'Toca uno de los lugares marcados con + para elegir dónde ponerla');
      } else {
        const { moneda, valor } = precioParcela;
        mostrarTarjeta('Nueva parcela', `Aquí irá la parcela ${totalParcelas + 1} · Cuesta ${valor} ${NOMBRE_MONEDA[moneda]}`, {
          texto: 'Comprar aquí',
          fn: comprarParcelaElegida,
        });
      }
      dibujar();
    }

    function elegir(cx, cy) {
      if (ui?.modo() === 'parcela') { elegirLugarParcela(cx, cy); return; }
      const indice = parcelaEn(cx, cy);
      if (indice === null) { marcarParcela(null); return; }
      marcarParcela(indice);

      const codigo = arbolEn(estado, indice);
      const planta = codigo ? plantasPorCodigo.get(codigo) : null;
      const modo = ui?.modo();
      const titulo = `Parcela ${indice + 1}`;

      if (modo === 'plantar') {
        const pendienteDePlantar = ui.arbolPorPlantar();
        if (codigo) { mostrarTarjeta(titulo, 'Esta parcela ya tiene un árbol. Elige una vacía'); return; }
        ui.soltarModo();
        plantarEn(pendienteDePlantar.codigoQR, indice);
        return;
      }
      // La pala también mueve árboles bloqueados: solo cambia su lugar, no muestra su información
      if (modo === 'pala') { usarPala(indice); return; }
      if (codigo && !planta) {
        // Plantado antes, pero hoy bloqueado (por ejemplo, tras reiniciar los desbloqueos):
        // no se muestra su información ni su modelo hasta volver a escanear su QR
        mostrarTarjeta('Árbol bloqueado', `Escanea su código QR en el campus para desbloquearlo · ${titulo}`);
        return;
      }
      if (modo === 'regadera') { usarRegadera(indice); return; }
      if (codigo) {
        const especie = planta?.especie || planta?.nombre_cientifico || '';
        mostrarTarjeta(planta.nombre, `${especie} · ${titulo}`);
        // Botones de copa, rostro y cuello sobre el árbol para ponerle o quitarle accesorios
        const posiciones = posicionesZonas(indice);
        if (posiciones) ui.mostrarZonas({ codigoQR: codigo, nombre: planta.nombre, posiciones });
        return;
      }
      // Parcela vacía: se puede plantar aquí uno de los árboles guardados
      const guardados = arboles.filter((p) => parcelaDe(estado, p.codigoQR) === null).length;
      if (guardados > 0) {
        mostrarTarjeta(titulo, 'Vacía', { texto: 'Plantar aquí', fn: () => ui.abrirArboles(indice) });
      } else {
        mostrarTarjeta(titulo, 'Vacía · desbloquea más árboles escaneando los QR del campus');
      }
    }

    const punteros = new Map();
    let inicioToque = null;
    let distanciaPrevia = 0;
    escuchar(lienzo, 'pointerdown', (e) => {
      lienzo.setPointerCapture(e.pointerId);
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      inicioToque = punteros.size === 1 ? { x: e.clientX, y: e.clientY, t: Date.now() } : null;
      if (punteros.size === 2) {
        const [a, b] = [...punteros.values()];
        distanciaPrevia = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    escuchar(lienzo, 'pointermove', (e) => {
      const previo = punteros.get(e.pointerId);
      if (!previo) return;
      const actual = { x: e.clientX, y: e.clientY };
      if (punteros.size === 1) {
        if (observando) girarCamaraCerca(actual.x - previo.x, actual.y - previo.y);
        else mover(actual.x - previo.x, actual.y - previo.y);
      }
      punteros.set(e.pointerId, actual);
      if (punteros.size === 2) {
        const [a, b] = [...punteros.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (distanciaPrevia > 0) (observando ? acercarCamaraCerca : acercar)(d / distanciaPrevia);
        distanciaPrevia = d;
      }
    });
    const soltar = (e) => {
      if (!punteros.has(e.pointerId)) return;
      punteros.delete(e.pointerId);
      if (e.type === 'pointerup' && inicioToque && punteros.size === 0 && !observando) {
        const movido = Math.hypot(e.clientX - inicioToque.x, e.clientY - inicioToque.y);
        if (movido < 8 && Date.now() - inicioToque.t < 500) elegir(e.clientX, e.clientY);
      }
      if (punteros.size < 2) distanciaPrevia = 0;
      if (punteros.size === 0) inicioToque = null;
    };
    escuchar(lienzo, 'pointerup', soltar);
    escuchar(lienzo, 'pointercancel', soltar);
    escuchar(lienzo, 'wheel', (e) => {
      e.preventDefault();
      (observando ? acercarCamaraCerca : acercar)(e.deltaY > 0 ? 1 / 1.1 : 1.1);
    }, { passive: false });
    escuchar(window, 'resize', () => { ajustarVista(); ubicarCamara(); reubicarZonas(); dibujar(); });

    ui = montarInterfazJuego(raiz, {
      estado,
      // Al tomar o soltar una herramienta se limpia la parcela elegida
      alCambiarModo: (modo) => {
        origenPala = null;
        marca.material.color.setHex(COLOR.seleccion);
        marcarParcela(null);
        ocultarAyuda();
        if (modo === 'parcela') mostrarCandidatos();
        else ocultarCandidatos();
      },
      // "Nueva parcela" en la tienda: guarda el precio; los lugares se marcan al entrar al modo 'parcela'
      alComprarParcela: (precio) => { precioParcela = precio; },
      // "Espacio de 1 L" comprado en la tienda: el contador de la regadera muestra la ranura nueva
      alAmpliarRegadera: refrescarRegadera,
      // Árbol elegido en "Mis árboles" para una parcela concreta ("Plantar aquí")
      alElegirArbol: (codigo, indice) => plantarEn(codigo, indice),
      alCambiarAccesorios: (codigo) => {
        const indice = parcelaDe(estado, codigo);
        if (indice !== null) ponerArbol(indice);
      },
      // "Observar" en "Mis árboles": ver ese árbol de cerca
      alObservarArbol: (codigo) => {
        const indice = parcelaDe(estado, codigo);
        if (indice !== null) observarArbol(indice);
      },
    });

    // Riegos de la regadera, tierra mojada y burbujas de sed: se refrescan al abrir y cada 30 s mientras el jardín está abierto
    asegurarSed(estado); // los árboles sin hora de sed (guardados viejos) la reciben ahora
    actualizarSed();
    refrescarRegadera();
    const temporizador = setInterval(() => { refrescarRegadera(); actualizarHumedad(); }, 30 * 1000);
    quitarEventos.push(() => clearInterval(temporizador));

    cargando.remove();
    dibujar();
    // La ayuda se esconde sola después de unos segundos
    setTimeout(() => ocultarAyuda(), 6000);
    // Solo se decide al entrar (nunca en segundo plano): si toca, empieza a llover enseguida
    if (tocaLlover(estado)) {
      const esperaLluvia = setTimeout(iniciarLluvia, 2000);
      quitarEventos.push(() => clearTimeout(esperaLluvia));
    }
    // Botón de pregunta: si toca, aparece en un momento al azar de esta visita
    if (tocaPregunta(estado)) {
      const [minimo, maximo] = PREGUNTA.esperaMs;
      const esperaPregunta = setTimeout(() => ui?.mostrarBotonPregunta(), minimo + Math.random() * (maximo - minimo));
      quitarEventos.push(() => clearTimeout(esperaPregunta));
    }
    // Expuesto solo para pruebas y depuración desde la consola
    raiz.jardin = {
      estado,
      parcelasLibres: () => parcelasLibres(estado, totalParcelas),
      parcelaElegida: () => parcelaElegida,
      celdas: () => estado.celdas.map((c) => [...c]),
      lugaresParaAmpliar: () => celdasParaAmpliar(estado),
      comprarParcela: (celda) => { candidatoElegido = celda; comprarParcelaElegida(); },
      arbolesEnEscena: () => [...arbolesEnEscena.keys()],
      // Centro de una parcela en la pantalla (px), para tocarla en pruebas automáticas
      posicionEnPantalla(indice) {
        const p = jardin.parcelas[indice];
        const v = new THREE.Vector3(p.x, SUELO_PARCELA, p.z).project(camara);
        return { x: Math.round((v.x + 1) / 2 * window.innerWidth), y: Math.round((1 - v.y) / 2 * window.innerHeight) };
      },
      cajaArbol(indice) {
        const arbol = arbolesEnEscena.get(indice);
        if (!arbol) return null;
        const b = new THREE.Box3().setFromObject(arbol);
        const r3 = (v) => v.toArray().map((n) => +n.toFixed(2));
        return { min: r3(b.min), max: r3(b.max), parcela: [jardin.parcelas[indice].x, jardin.parcelas[indice].z], escala: arbol.scale.x };
      },
      animacion: () => ({ animando, arbolesAnimados: mezcladores.size, efectos: efectos.size }),
      parcelasMojadas: () => mojadas.map((m, i) => (m.visible ? i : -1)).filter((i) => i >= 0),
      regadera: () => estadoRegadera(estado),
      conSed: () => burbujas.map((b, i) => (b.visible ? i : -1)).filter((i) => i >= 0),
      pedirAgua(indice) { // prueba: el árbol de esa parcela pide agua ya
        const codigo = arbolEn(estado, indice);
        if (!codigo) return false;
        estado.sed[codigo] = Date.now();
        actualizarHumedad();
        return true;
      },
      llover: iniciarLluvia,
      pregunta: () => ui?.mostrarBotonPregunta(),
      observar: observarArbol,
      observando: () => observando && { indice: observando.indice, distancia: +observando.distancia.toFixed(2) },
      tiempoAnimacion(indice) {
        const m = arbolesEnEscena.get(indice)?.userData.mezclador;
        return m ? +m.time.toFixed(3) : null;
      },
      modeloDe(indice) {
        const nombres = [];
        arbolesEnEscena.get(indice)?.traverse((o) => { if (o.name) nombres.push(o.name); });
        return nombres.slice(0, 3);
      },
    };
  } catch (err) {
    console.error(err);
    cargando.textContent = 'No se pudo cargar el jardín: ' + err.message;
  }
}

window.abrirJardin = abrirJardin;
// Tocar la notificación de sed abre el jardín directamente
alTocarAviso(() => abrirJardin());

// Opción "Mi jardín" del menú lateral
document.getElementById('menuJardinBtn')?.addEventListener('click', () => abrirJardin());
