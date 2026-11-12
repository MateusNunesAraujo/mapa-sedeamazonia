/**
 * Recorrido a pie en primera persona por un modelo 3D (.glb) con three.js.
 *
 *   window.abrirRecorrido({ nombre: 'Auditorio', inicio: 'Auditorio' })
 *
 * Por defecto carga el mundo con todos los edificios (recorrido.glb) y empieza frente
 * al edificio "inicio". Con { src } se puede recorrer otro modelo suelto.
 *
 * Controles:
 *  - Celular: flechas en pantalla (o joystick tocando la mitad izquierda) para caminar,
 *    arrastrar en la derecha para mirar, botones 🏃 Correr y ⤒ Saltar.
 *  - PC: W A S D o flechas para caminar, Shift para correr, Espacio para saltar,
 *    arrastrar con el mouse para mirar.
 *
 * El punto de partida sale del nodo "inicio_<edificio>" (o "inicio") del .glb.
 * No se atraviesan paredes ni objetos, y se pueden subir escalones bajos.
 * three.js solo se carga al abrir el recorrido, para no hacer más lenta la app.
 */

const ALTURA_OJOS = 1.6;      // metros sobre el piso
const VELOCIDAD = 1.8;        // metros por segundo (caminando)
const VELOCIDAD_CORRER = 3.8; // metros por segundo (corriendo)
const IMPULSO_SALTO = 4.2;    // velocidad hacia arriba al saltar (≈ 70 cm de alto)
const GRAVEDAD = 12;          // un poco más fuerte que la real para que el salto se sienta ágil
const RADIO = 0.3;            // distancia mínima a paredes y objetos
const ESCALON_MAX = 0.35;     // lo más alto que se puede subir sin saltar
const ALTURAS_CHOQUE = [0.45, 1.0, 1.5];  // alturas (sobre los pies) donde se revisan choques

// Mundo con todos los edificios en su sitio (scripts/modelos/gen_recorrido.py)
// ?v=: súbelo cada vez que regeneres el mundo, para que el navegador no use una copia vieja
const MUNDO = '/static/modelos/recorrido.glb?v=14';

let THREE = null;
let GLTFLoader = null;

async function cargarThree() {
  if (!THREE) {
    THREE = await import('./three/three.module.min.js');
    ({ GLTFLoader } = await import('./three/addons/loaders/GLTFLoader.js'));
  }
}

function crearInterfaz(nombre) {
  const raiz = document.createElement('div');
  raiz.className = 'recorrido';
  raiz.innerHTML = `
    <div class="recorrido-barra">
      <span class="recorrido-titulo"></span>
      <div class="recorrido-barra-botones">
        <button type="button" class="recorrido-modo"></button>
        <button type="button" class="recorrido-salir" aria-label="Salir del recorrido">✕ Salir</button>
      </div>
    </div>
    <div class="recorrido-cargando">Cargando recorrido…</div>
    <div class="recorrido-etiquetas"></div>
    <div class="recorrido-ayuda solo-caminar">
      <span class="solo-tactil">Flechas para caminar · Arrastra a la derecha para mirar</span>
      <span class="solo-pc">W A S D caminar · Shift correr · Espacio saltar · Arrastra para mirar</span>
    </div>
    <div class="recorrido-ayuda solo-aereo">
      <span class="solo-tactil">Arrastra para girar · Pellizca para acercar · Dos dedos para mover · Toca un nombre para entrar</span>
      <span class="solo-pc">Arrastra para girar · Rueda para acercar · Clic derecho o W A S D para mover · Clic en un nombre para entrar</span>
    </div>
    <div class="recorrido-joystick"><div class="recorrido-palanca"></div></div>
    <div class="recorrido-flechas" aria-label="Caminar">
      <button type="button" class="recorrido-flecha arriba" data-dir="w" aria-label="Adelante">▲</button>
      <button type="button" class="recorrido-flecha izquierda" data-dir="a" aria-label="Izquierda">◀</button>
      <button type="button" class="recorrido-flecha derecha" data-dir="d" aria-label="Derecha">▶</button>
      <button type="button" class="recorrido-flecha abajo" data-dir="s" aria-label="Atrás">▼</button>
    </div>
    <div class="recorrido-acciones">
      <button type="button" class="recorrido-accion correr" aria-pressed="false" aria-label="Correr">🏃<span>Correr</span></button>
      <button type="button" class="recorrido-accion saltar" aria-label="Saltar">⤒<span>Saltar</span></button>
    </div>`;
  raiz.querySelector('.recorrido-titulo').textContent = nombre || 'Recorrido';
  document.body.appendChild(raiz);
  return raiz;
}

// Árboles sencillos para que se sienta el campus. Van en el pasto, lejos de edificios,
// andenes, canchas y puntos de partida (evitar: posiciones donde no puede haber árboles).
function crearEntorno(scene, modelo, caja, obstaculos, evitar) {
  const centro = caja.getCenter(new THREE.Vector3());
  const tam = caja.getSize(new THREE.Vector3());
  const MARGEN = 30;

  // Piso bajo todo el modelo y alrededor (antes era fijo en el origen y quedaba corto)
  const lado = Math.max(tam.x, tam.z) + 2 * MARGEN + 200;
  const piso = new THREE.Mesh(
    new THREE.PlaneGeometry(lado, lado),
    // mismo verde que el pasto del modelo (valores lineales, como en el .glb)
    new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(0.20, 0.38, 0.10) }),
  );
  piso.rotation.x = -Math.PI / 2;
  piso.position.set(centro.x, -0.06, centro.z);
  scene.add(piso);

  // Cuadrícula de 2 m con lo ocupado: todo lo del modelo que no es pasto
  const CEL = 2;
  const x0 = caja.min.x - MARGEN, z0 = caja.min.z - MARGEN;
  const nx = Math.ceil((tam.x + 2 * MARGEN) / CEL), nz = Math.ceil((tam.z + 2 * MARGEN) / CEL);
  const ocupado = new Uint8Array(nx * nz);
  const marcar = (xa, xb, za, zb) => {
    const i0 = Math.max(0, Math.floor((xa - x0) / CEL)), i1 = Math.min(nx - 1, Math.floor((xb - x0) / CEL));
    const j0 = Math.max(0, Math.floor((za - z0) / CEL)), j1 = Math.min(nz - 1, Math.floor((zb - z0) / CEL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) ocupado[j * nx + i] = 1;
  };
  const v = new THREE.Vector3();
  modelo.updateMatrixWorld(true);
  modelo.traverse((o) => {
    if (!o.isMesh || o.material.name === 'pasto') return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    const n = idx ? idx.count : pos.count;
    const punto = (k) => v.fromBufferAttribute(pos, idx ? idx.getX(k) : k).applyMatrix4(o.matrixWorld);
    for (let k = 0; k < n; k += 3) {
      let xa = Infinity, xb = -Infinity, za = Infinity, zb = -Infinity;
      for (let m = 0; m < 3; m++) {
        punto(k + m);
        xa = Math.min(xa, v.x); xb = Math.max(xb, v.x); za = Math.min(za, v.z); zb = Math.max(zb, v.z);
      }
      marcar(xa, xb, za, zb);
    }
  });
  for (const p of evitar) marcar(p.x - 4, p.x + 4, p.z - 4, p.z + 4);
  const libre = (x, z) => {           // ni la celda ni sus vecinas a 4 m están ocupadas
    const i = Math.floor((x - x0) / CEL), j = Math.floor((z - z0) / CEL);
    for (let dj = -2; dj <= 2; dj++) {
      for (let di = -2; di <= 2; di++) {
        const a = i + di, b = j + dj;
        if (a >= 0 && b >= 0 && a < nx && b < nz && ocupado[b * nx + a]) return false;
      }
    }
    return true;
  };

  // Árboles en instancias (pocas llamadas de dibujo aunque sean muchos)
  const MAX = 160;
  const matCopas = [0x2f6b26, 0x3d7d2c, 0x285c22].map((c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
  const troncos = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 3.2, 7),
    new THREE.MeshLambertMaterial({ color: 0x5a3a1f }), MAX);
  const copas = matCopas.map((m) => new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.2, 0), m, MAX));
  const cuenta = [0, 0, 0];
  const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), esc = new THREE.Vector3(), eje = new THREE.Vector3(0, 1, 0);
  let semilla = 7, puestos = 0;
  const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280);
  for (let intento = 0; intento < 2000 && puestos < MAX; intento++) {
    const x = x0 + azar() * nx * CEL, z = z0 + azar() * nz * CEL;
    const escala = 0.8 + azar() * 0.7;
    if (!libre(x, z)) continue;
    marcar(x - 3, x + 3, z - 3, z + 3);            // que no queden encimados
    esc.setScalar(escala);
    troncos.setMatrixAt(puestos, mat.compose(v.set(x, 1.6 * escala, z), q.identity(), esc));
    const c = puestos % 3;
    copas[c].setMatrixAt(cuenta[c]++, mat.compose(v.set(x, 4.2 * escala, z), q.setFromAxisAngle(eje, azar() * 3), esc));
    puestos++;
  }
  troncos.count = puestos;
  copas.forEach((m, c) => { m.count = cuenta[c]; });
  scene.add(troncos, ...copas);
  obstaculos.push(troncos);
}

function controlesTactiles(raiz, estado) {
  const joy = raiz.querySelector('.recorrido-joystick');
  const palanca = raiz.querySelector('.recorrido-palanca');
  const R = 50;
  let dedoJoy = null, origen = null;
  let dedoVista = null, ultimo = null;

  const lienzo = raiz.querySelector('canvas');
  lienzo.addEventListener('touchstart', (e) => {
    if (estado.modo !== 'caminar') return;
    for (const t of e.changedTouches) {
      if (t.clientX < window.innerWidth / 2 && dedoJoy === null) {
        dedoJoy = t.identifier;
        origen = { x: t.clientX, y: t.clientY };
        joy.style.left = `${t.clientX - 60}px`;
        joy.style.top = `${t.clientY - 60}px`;
        joy.classList.add('activo');
      } else if (dedoVista === null) {
        dedoVista = t.identifier;
        ultimo = { x: t.clientX, y: t.clientY };
      }
    }
    e.preventDefault();
  }, { passive: false });

  lienzo.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === dedoJoy) {
        let dx = t.clientX - origen.x, dy = t.clientY - origen.y;
        const d = Math.hypot(dx, dy);
        if (d > R) { dx *= R / d; dy *= R / d; }
        palanca.style.transform = `translate(${dx}px, ${dy}px)`;
        estado.tactil.x = dx / R;
        estado.tactil.y = -dy / R;
      } else if (t.identifier === dedoVista) {
        estado.yaw -= (t.clientX - ultimo.x) * 0.005;
        estado.pitch -= (t.clientY - ultimo.y) * 0.005;
        ultimo = { x: t.clientX, y: t.clientY };
      }
    }
    e.preventDefault();
  }, { passive: false });

  const soltar = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === dedoJoy) {
        dedoJoy = null;
        estado.tactil.x = estado.tactil.y = 0;
        palanca.style.transform = '';
        joy.classList.remove('activo');
      } else if (t.identifier === dedoVista) {
        dedoVista = null;
      }
    }
  };
  lienzo.addEventListener('touchend', soltar);
  lienzo.addEventListener('touchcancel', soltar);
}

function controlesPC(raiz, estado) {
  const lienzo = raiz.querySelector('canvas');
  let arrastrando = false, ultimo = null;
  lienzo.addEventListener('mousedown', (e) => { arrastrando = true; ultimo = { x: e.clientX, y: e.clientY }; });
  window.addEventListener('mouseup', estado.alSoltarMouse = () => { arrastrando = false; });
  window.addEventListener('mousemove', estado.alMoverMouse = (e) => {
    if (!arrastrando || estado.modo !== 'caminar') return;
    estado.yaw -= (e.clientX - ultimo.x) * 0.004;
    estado.pitch -= (e.clientY - ultimo.y) * 0.004;
    ultimo = { x: e.clientX, y: e.clientY };
  });
  const teclas = {
    KeyW: 'w', ArrowUp: 'w', KeyS: 's', ArrowDown: 's', KeyA: 'a', ArrowLeft: 'a', KeyD: 'd', ArrowRight: 'd',
    ShiftLeft: 'correr', ShiftRight: 'correr',
  };
  window.addEventListener('keydown', estado.alBajarTecla = (e) => {
    if (teclas[e.code]) { estado.teclas[teclas[e.code]] = true; e.preventDefault(); }
    if (e.code === 'Space') { estado.pedirSalto = true; e.preventDefault(); }
    if (e.code === 'Escape') estado.salir();
  });
  window.addEventListener('keyup', estado.alSubirTecla = (e) => {
    if (teclas[e.code]) estado.teclas[teclas[e.code]] = false;
  });
}

// Botones en pantalla: flechas (se mantienen presionadas), correr (prende/apaga) y saltar
function controlesBotones(raiz, estado) {
  raiz.querySelectorAll('.recorrido-flecha').forEach((btn) => {
    const dir = btn.dataset.dir;
    const soltar = () => { estado.botones[dir] = false; btn.classList.remove('presionado'); };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      estado.botones[dir] = true;
      btn.classList.add('presionado');
    });
    btn.addEventListener('pointerup', soltar);
    btn.addEventListener('pointercancel', soltar);
    btn.addEventListener('lostpointercapture', soltar);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  const correr = raiz.querySelector('.recorrido-accion.correr');
  correr.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    estado.corriendo = !estado.corriendo;
    correr.classList.toggle('activo', estado.corriendo);
    correr.setAttribute('aria-pressed', String(estado.corriendo));
  });

  const saltar = raiz.querySelector('.recorrido-accion.saltar');
  saltar.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    estado.pedirSalto = true;
  });
}

// Vista aérea: cámara que orbita alrededor de un punto del piso, mirando inclinada.
// Un dedo / clic izquierdo gira, pellizcar / rueda acerca, dos dedos / clic derecho mueven.
function controlesAereos(raiz, estado) {
  const lienzo = raiz.querySelector('canvas');
  const o = estado.orbita;
  const girar = (dx, dy) => {
    o.yaw -= dx * 0.006;
    o.pitch = Math.max(0.25, Math.min(1.45, o.pitch + dy * 0.004));
  };
  // Mover el punto de mira sobre el piso, según hacia dónde mira la cámara
  estado.moverAereo = (dx, dy) => {
    const k = o.dist * 0.0018;
    const s = Math.sin(o.yaw), c = Math.cos(o.yaw);
    o.objetivo.x += (-dx * c - dy * s) * k;
    o.objetivo.z += (dx * s - dy * c) * k;
  };
  const acercar = (factor) => { o.dist = Math.max(8, Math.min(160, o.dist * factor)); };

  // Táctil
  let toques = new Map(), previo = null;
  const resumen = () => {
    const ts = [...toques.values()];
    const cx = ts.reduce((a, t) => a + t.x, 0) / ts.length;
    const cy = ts.reduce((a, t) => a + t.y, 0) / ts.length;
    const d = ts.length > 1 ? Math.hypot(ts[0].x - ts[1].x, ts[0].y - ts[1].y) : 0;
    return { n: ts.length, cx, cy, d };
  };
  const actualizar = (e) => {
    for (const t of e.changedTouches) toques.set(t.identifier, { x: t.clientX, y: t.clientY });
  };
  lienzo.addEventListener('touchstart', (e) => {
    if (estado.modo !== 'aereo') return;
    actualizar(e);
    previo = resumen();
    e.preventDefault();
  }, { passive: false });
  lienzo.addEventListener('touchmove', (e) => {
    if (estado.modo !== 'aereo' || !previo) return;
    actualizar(e);
    const r = resumen();
    if (r.n === 1 && previo.n === 1) girar(r.cx - previo.cx, r.cy - previo.cy);
    if (r.n >= 2 && previo.n >= 2) {
      if (previo.d > 0 && r.d > 0) acercar(previo.d / r.d);
      estado.moverAereo(r.cx - previo.cx, r.cy - previo.cy);
    }
    previo = r;
    e.preventDefault();
  }, { passive: false });
  const soltar = (e) => {
    for (const t of e.changedTouches) toques.delete(t.identifier);
    previo = toques.size ? resumen() : null;
  };
  lienzo.addEventListener('touchend', soltar);
  lienzo.addEventListener('touchcancel', soltar);

  // Mouse
  let boton = -1, ultimo = null;
  lienzo.addEventListener('mousedown', (e) => {
    if (estado.modo !== 'aereo') return;
    boton = e.button;
    ultimo = { x: e.clientX, y: e.clientY };
  });
  lienzo.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mouseup', estado.alSoltarMouseAereo = () => { boton = -1; });
  window.addEventListener('mousemove', estado.alMoverMouseAereo = (e) => {
    if (boton < 0 || estado.modo !== 'aereo') return;
    const dx = e.clientX - ultimo.x, dy = e.clientY - ultimo.y;
    if (boton === 2 || e.shiftKey) estado.moverAereo(dx, dy);
    else girar(dx, dy);
    ultimo = { x: e.clientX, y: e.clientY };
  });
  lienzo.addEventListener('wheel', (e) => {
    if (estado.modo !== 'aereo') return;
    acercar(e.deltaY > 0 ? 1.1 : 1 / 1.1);
    e.preventDefault();
  }, { passive: false });
}

async function abrirRecorrido({ src = MUNDO, nombre, inicio, modo = 'caminar' } = {}) {
  const raiz = crearInterfaz(nombre);
  const cargando = raiz.querySelector('.recorrido-cargando');
  let animacion = null, renderer = null, alRedimensionar = null;

  const estado = {
    yaw: 0, pitch: 0,
    tactil: { x: 0, y: 0 },
    teclas: {},
    botones: {},
    corriendo: false,     // botón 🏃 en pantalla
    pedirSalto: false,
    salir: () => {},
    modo,                 // 'caminar' o 'aereo'
    // yaw -2.6: vista desde el noroeste, que muestra las fachadas y la sala de sistemas
    orbita: { yaw: -2.6, pitch: 0.6, dist: 40, objetivo: null },
  };

  estado.salir = () => {
    cancelAnimationFrame(animacion);
    window.removeEventListener('resize', alRedimensionar);
    window.removeEventListener('mouseup', estado.alSoltarMouse);
    window.removeEventListener('mousemove', estado.alMoverMouse);
    window.removeEventListener('keydown', estado.alBajarTecla);
    window.removeEventListener('keyup', estado.alSubirTecla);
    window.removeEventListener('mouseup', estado.alSoltarMouseAereo);
    window.removeEventListener('mousemove', estado.alMoverMouseAereo);
    clearTimeout(estado.ocultarAyuda);
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }
    raiz.remove();
  };
  raiz.querySelector('.recorrido-salir').addEventListener('click', () => estado.salir());

  try {
    await cargarThree();
    const gltf = await new GLTFLoader().loadAsync(src);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    raiz.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfe3ff);
    scene.fog = new THREE.Fog(0xbfe3ff, 25, 90);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8670, 2.2));
    const sol = new THREE.DirectionalLight(0xfff2dd, 1.8);
    sol.position.set(20, 30, 15);
    scene.add(sol);

    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 300);
    scene.add(gltf.scene);

    // Todo lo que tiene el modelo cuenta como obstáculo y como piso
    const obstaculos = [];
    gltf.scene.traverse((o) => { if (o.isMesh) obstaculos.push(o); });
    const caja = new THREE.Box3().setFromObject(gltf.scene);
    const partidas = [];
    gltf.scene.traverse((o) => { if (o.name.startsWith('inicio')) partidas.push(o.getWorldPosition(new THREE.Vector3())); });
    crearEntorno(scene, gltf.scene, caja, obstaculos, partidas);

    // Punto de partida: frente al edificio pedido ("inicio_<nombre>", misma regla que
    // scripts/modelos/comun.py) o el "inicio" por defecto
    const pies = new THREE.Vector3();
    const nodoDe = (prefijo, lugar) => gltf.scene.getObjectByName(
      THREE.PropertyBinding.sanitizeNodeName(prefijo + lugar.trim().split(/\s+/).join('_')));
    function irAInicio(lugar) {
      const nodo = (lugar && nodoDe('inicio_', lugar)) || gltf.scene.getObjectByName('inicio');
      estado.pitch = 0;
      if (nodo) {
        nodo.getWorldPosition(pies);
        const e = new THREE.Euler().setFromQuaternion(nodo.getWorldQuaternion(new THREE.Quaternion()), 'YXZ');
        estado.yaw = e.y;
      } else {
        caja.getCenter(pies);
        pies.z = caja.max.z + 3;
        pies.y = 0;
        estado.yaw = 0;
      }
    }
    irAInicio(inicio);

    // Vista aérea: arranca sobre el punto de partida (el centro del campus en el mundo
    // completo, donde está la mayoría de edificios) o sobre todo el lugar en un modelo suelto.
    // Ya no se ve todo el mundo de una vez: con la Casa hija y los Alojamientos mide cientos
    // de metros y los nombres quedaban amontonados.
    const tam = caja.getSize(new THREE.Vector3());
    const partida = gltf.scene.getObjectByName('inicio');
    estado.orbita.objetivo = partida
      ? partida.getWorldPosition(new THREE.Vector3()).setY(0)
      : caja.getCenter(new THREE.Vector3()).setY(0);
    estado.orbita.dist = Math.min(90, Math.max(tam.x, tam.z) * 0.9);

    // Marcador de dónde estás caminando (solo se ve desde arriba)
    const marcador = new THREE.Mesh(
      new THREE.ConeGeometry(0.6, 1.6, 12),
      new THREE.MeshLambertMaterial({ color: 0xe03a2f, emissive: 0x551010 }),
    );
    marcador.rotation.x = Math.PI;   // punta hacia abajo
    scene.add(marcador);

    // Etiquetas con el nombre de cada edificio (nodos "centro_<nombre>" del .glb)
    const capaEtiquetas = raiz.querySelector('.recorrido-etiquetas');
    const etiquetas = [];
    gltf.scene.traverse((o) => {
      if (!o.name.startsWith('centro_')) return;
      const lugar = o.userData.nombre || o.name.slice(7).replace(/_/g, ' ');
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'recorrido-etiqueta';
      const texto = document.createElement('span');   // se recorta con "…" si es muy largo
      texto.textContent = lugar;
      el.appendChild(texto);
      el.title = `Entrar caminando a ${lugar}`;
      el.addEventListener('click', () => { irAInicio(lugar); cambiarModo('caminar'); });
      capaEtiquetas.appendChild(el);
      etiquetas.push({ el, pos: o.getWorldPosition(new THREE.Vector3()) });
    });

    const botonModo = raiz.querySelector('.recorrido-modo');
    function cambiarModo(nuevo) {
      const desdeCaminar = estado.modo === 'caminar';
      estado.modo = nuevo;
      raiz.classList.toggle('modo-aereo', nuevo === 'aereo');
      botonModo.textContent = nuevo === 'aereo' ? '🚶 Caminar' : '🗺️ Vista aérea';
      estado.tactil.x = estado.tactil.y = 0;
      // Al subir desde el recorrido, la vista aérea se centra donde estabas
      if (nuevo === 'aereo' && desdeCaminar) estado.orbita.objetivo.set(pies.x, 0, pies.z);
      camera.fov = nuevo === 'aereo' ? 50 : 70;
      if (nuevo === 'caminar') camera.near = 0.05;
      camera.updateProjectionMatrix();
      marcador.visible = nuevo === 'aereo';
      // Mostrar unos segundos la ayuda del modo al que se cambió
      raiz.querySelectorAll('.recorrido-ayuda').forEach((a) => a.classList.remove('oculta'));
      clearTimeout(estado.ocultarAyuda);
      estado.ocultarAyuda = setTimeout(
        () => raiz.querySelectorAll('.recorrido-ayuda').forEach((a) => a.classList.add('oculta')), 6000);
    }
    botonModo.addEventListener('click', () => cambiarModo(estado.modo === 'aereo' ? 'caminar' : 'aereo'));

    controlesTactiles(raiz, estado);
    controlesPC(raiz, estado);
    controlesBotones(raiz, estado);
    controlesAereos(raiz, estado);

    alRedimensionar = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', alRedimensionar);

    const rayo = new THREE.Raycaster();
    const abajo = new THREE.Vector3(0, -1, 0);
    const origen = new THREE.Vector3();

    // ¿Hay algo en esa dirección antes de "distancia"?
    function bloqueado(dir, distancia) {
      for (const h of ALTURAS_CHOQUE) {
        origen.set(pies.x, pies.y + h, pies.z);
        rayo.set(origen, dir);
        rayo.far = distancia + RADIO;
        if (rayo.intersectObjects(obstaculos, false).length) return true;
      }
      return false;
    }

    // Altura del piso bajo los pies
    function alturaPiso() {
      origen.set(pies.x, pies.y + ESCALON_MAX + 0.05, pies.z);
      rayo.set(origen, abajo);
      rayo.far = 50;
      const hit = rayo.intersectObjects(obstaculos, false)[0];
      return hit ? hit.point.y : -0.06;
    }

    // Gravedad y salto. En el piso, los escalones bajos se suben suavemente.
    let velY = 0;
    function moverVertical(dt) {
      const piso = alturaPiso();
      const enPiso = velY <= 0 && pies.y <= piso + 0.03;

      if (estado.pedirSalto && enPiso) velY = IMPULSO_SALTO;
      estado.pedirSalto = false;

      if (velY > 0 || pies.y > piso + 0.03) {
        // En el aire
        velY -= GRAVEDAD * dt;
        pies.y += velY * dt;
        if (pies.y <= piso) { pies.y = piso; velY = 0; }   // aterrizaje
      } else {
        velY = 0;
        pies.y += (piso - pies.y) * 0.5;                    // subir un escalón
      }
    }

    const proy = new THREE.Vector3();
    function cuadroAereo(fx, fy, dt) {
      const o = estado.orbita;
      if (fx || fy) estado.moverAereo(-fx * 500 * dt, fy * 500 * dt);   // W A S D / flechas
      // Que no se pierda de vista el lugar
      o.objetivo.x = Math.max(caja.min.x, Math.min(caja.max.x, o.objetivo.x));
      o.objetivo.z = Math.max(caja.min.z, Math.min(caja.max.z, o.objetivo.z));
      const horiz = Math.cos(o.pitch) * o.dist;
      camera.position.set(
        o.objetivo.x + Math.sin(o.yaw) * horiz,
        o.objetivo.y + Math.sin(o.pitch) * o.dist,
        o.objetivo.z + Math.cos(o.yaw) * horiz,
      );
      camera.lookAt(o.objetivo);
      // Desde lejos, un "near" más grande evita que se vean cosas a través del techo
      // (en celulares la precisión de profundidad es baja)
      const near = Math.max(0.5, o.dist * 0.08);
      if (Math.abs(camera.near - near) > 0.05) { camera.near = near; camera.updateProjectionMatrix(); }
      scene.fog.near = o.dist * 1.5;
      scene.fog.far = o.dist * 4 + 60;
      marcador.position.set(pies.x, pies.y + 2.2 + Math.sin(performance.now() / 300) * 0.3, pies.z);
      renderer.render(scene, camera);

      // Etiquetas sin amontonarse: primero las más cercanas a la cámara; una etiqueta que se
      // encimaría con otra ya puesta, o que está muy lejos, se oculta hasta que haya espacio.
      const W = window.innerWidth, H = window.innerHeight;
      const lejos = o.dist * 2.2;
      for (const e of etiquetas) e.d = e.pos.distanceTo(camera.position);
      etiquetas.sort((a, b) => a.d - b.d);
      const puestas = [];
      for (const e of etiquetas) {
        proy.copy(e.pos).project(camera);
        let visible = proy.z < 1 && Math.abs(proy.x) < 1.1 && Math.abs(proy.y) < 1.1 && e.d < lejos;
        const px = (proy.x + 1) / 2 * W, py = (1 - proy.y) / 2 * H;
        if (visible) {
          if (!e.ancho) {                       // tamaño medido una sola vez
            e.el.style.display = '';
            e.ancho = e.el.offsetWidth;
            e.alto = e.el.offsetHeight;
          }
          const r = { x0: px - e.ancho / 2 - 3, x1: px + e.ancho / 2 + 3, y0: py - e.alto - 9, y1: py + 2 };
          visible = !puestas.some((p) => r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0);
          if (visible) puestas.push(r);
        }
        e.el.style.display = visible ? '' : 'none';
        if (visible) e.el.style.transform = `translate(${px}px, ${py}px) translate(-50%, -100%)`;
      }
    }

    const reloj = new THREE.Clock();
    const avance = new THREE.Vector3();
    const eje = new THREE.Vector3();

    function cuadro() {
      animacion = requestAnimationFrame(cuadro);
      const dt = Math.min(reloj.getDelta(), 0.05);

      const t = estado.teclas, b = estado.botones;
      let fx = estado.tactil.x + (t.d || b.d ? 1 : 0) - (t.a || b.a ? 1 : 0);
      let fy = estado.tactil.y + (t.w || b.w ? 1 : 0) - (t.s || b.s ? 1 : 0);
      const fuerza = Math.hypot(fx, fy);
      if (fuerza > 1) { fx /= fuerza; fy /= fuerza; }

      if (estado.modo === 'aereo') {
        cuadroAereo(fx, fy, dt);
        return;
      }

      const corriendo = estado.corriendo || t.correr;
      // Al correr se abre un poco el campo de visión: da sensación de velocidad
      const fovObjetivo = corriendo && fuerza > 0.05 ? 78 : 70;
      if (Math.abs(camera.fov - fovObjetivo) > 0.1) {
        camera.fov += (fovObjetivo - camera.fov) * 0.1;
        camera.updateProjectionMatrix();
      }

      if (fuerza > 0.05) {
        const sin = Math.sin(estado.yaw), cos = Math.cos(estado.yaw);
        const velocidad = corriendo ? VELOCIDAD_CORRER : VELOCIDAD;
        // adelante = -Z girado por yaw; derecha = +X girado por yaw
        avance.set(-sin * fy + cos * fx, 0, -cos * fy - sin * fx).multiplyScalar(velocidad * dt);
        // Cada eje por separado: así se "resbala" contra las paredes en vez de frenar en seco
        for (const comp of ['x', 'z']) {
          const d = avance[comp];
          if (!d) continue;
          eje.set(comp === 'x' ? Math.sign(d) : 0, 0, comp === 'z' ? Math.sign(d) : 0);
          if (!bloqueado(eje, Math.abs(d))) pies[comp] += d;
        }
      }
      moverVertical(dt);

      estado.pitch = Math.max(-1.2, Math.min(1.2, estado.pitch));
      camera.position.set(pies.x, pies.y + ALTURA_OJOS, pies.z);
      camera.rotation.set(estado.pitch, estado.yaw, 0, 'YXZ');
      scene.fog.near = 25;
      scene.fog.far = 90;
      renderer.render(scene, camera);
    }

    cargando.remove();
    cambiarModo(estado.modo);
    cuadro();
  } catch (err) {
    console.error(err);
    cargando.textContent = 'No se pudo cargar el recorrido: ' + err.message;
  }
}

window.abrirRecorrido = abrirRecorrido;

// Botón "Mapa 3D" de la pantalla principal: abre el mundo en vista aérea
document.getElementById('mapa3DBtn')?.addEventListener('click', () =>
  abrirRecorrido({ nombre: 'Mapa 3D', modo: 'aereo' }));
