/**
 * Visor 3D + realidad aumentada con <model-viewer>.
 *
 * - Botón 🧊 (PRUEBA): abre el visor con opciones para probar modelos y la AR en la APK.
 * - window.abrirVisor3D({ src, nombre, lugar }): abre un modelo concreto (ej. desde
 *   el botón "Ver en 3D" de la tarjeta de un edificio).
 * - Si el modelo tiene "lugar", al tocar el modelo se cierra el visor y el mapa
 *   va a ese lugar (usa window.irALugar de index.js).
 *
 * Nota AR: Scene Viewer (la AR de Google) descarga el modelo por su cuenta, por eso
 * hay una opción "en línea" para comprobar si el problema es el modelo local.
 */
(function () {
  const MODELOS = {
    local: {
      src: '/static/modelos/hoja-trifoliada.glb',
      nombre: 'Hoja trifoliada (local)',
    },
    auditorio: {
      src: '/static/modelos/auditorio.glb',
      nombre: 'Auditorio',
      lugar: 'Auditorio',
    },
    sala_sistemas2: {
      src: '/static/modelos/sala_sistemas2.glb',
      nombre: 'Sala de sistemas 2',
      lugar: 'Sala de sistemas 2',
    },
    online: {
      src: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
      nombre: 'Astronauta de ejemplo (en línea)',
    },
  };

  const modal = document.getElementById('arTestModal');
  const abrirBtn = document.getElementById('arTestBtn');
  const cerrarBtn = document.getElementById('arTestCloseBtn');
  const titulo = document.getElementById('arTestTitle');
  const opcionesBox = document.getElementById('arTestOpciones');
  const contenedor = document.getElementById('arTestViewer');
  const pista = document.getElementById('arTestPista');
  const recorrerBtn = document.getElementById('arTestRecorrerBtn');
  const estado = document.getElementById('arTestEstado');
  const opciones = document.querySelectorAll('input[name="arTestModelo"]');
  if (!modal || !abrirBtn) return;

  let visor = null;
  let cargaLibreria = null;
  let modeloActual = null;

  function log(texto) {
    const hora = new Date().toLocaleTimeString();
    estado.textContent = `[${hora}] ${texto}\n` + estado.textContent;
  }

  function cargarLibreria() {
    // Solo se carga al abrir el visor, para no hacer más lenta la app al iniciar.
    if (!cargaLibreria) cargaLibreria = import('/static/js/model-viewer.min.js');
    return cargaLibreria;
  }

  function cerrar() {
    modal.style.display = 'none';
  }

  // Al tocar (no arrastrar) el modelo, ir a su lugar en el mapa
  function activarToque() {
    let inicio = null;
    visor.addEventListener('pointerdown', (e) => {
      inicio = { x: e.clientX, y: e.clientY, t: Date.now() };
    });
    visor.addEventListener('pointerup', (e) => {
      if (!inicio || !modeloActual || !modeloActual.lugar) return;
      const movido = Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y);
      const rapido = Date.now() - inicio.t < 400;
      inicio = null;
      if (movido > 10 || !rapido) return; // fue un giro o zoom, no un toque

      // Solo cuenta si el toque cayó sobre el modelo y no sobre el fondo
      if (!visor.positionAndNormalFromPoint(e.clientX, e.clientY)) return;

      log(`Yendo a "${modeloActual.lugar}" en el mapa`);
      cerrar();
      if (!window.irALugar || !window.irALugar(modeloActual.lugar)) {
        log(`No se encontró "${modeloActual.lugar}" en el mapa`);
      }
    });
  }

  function crearVisor() {
    visor = document.createElement('model-viewer');
    visor.setAttribute('ar', '');
    visor.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
    visor.setAttribute('ar-scale', 'auto');
    visor.setAttribute('camera-controls', '');
    visor.setAttribute('touch-action', 'pan-y');
    visor.setAttribute('auto-rotate', '');
    visor.setAttribute('shadow-intensity', '1');
    visor.setAttribute('alt', 'Modelo 3D');
    visor.innerHTML = '<button slot="ar-button" class="ar-test-ar-btn">📱 Ver en tu espacio (AR)</button>';

    visor.addEventListener('load', () => {
      log(`Modelo cargado. ¿AR disponible en este dispositivo?: ${visor.canActivateAR ? 'SÍ' : 'NO'}`);
    });
    visor.addEventListener('error', (e) => {
      log('Error al cargar el modelo: ' + (e.detail && e.detail.type ? e.detail.type : 'desconocido'));
    });
    visor.addEventListener('ar-status', (e) => log('Estado AR: ' + e.detail.status));
    visor.querySelector('[slot="ar-button"]').addEventListener('click', (e) => {
      e.stopPropagation();
      log('Botón AR tocado. Si no se abre nada en unos segundos, la AR no funcionó.');
    });

    contenedor.appendChild(visor);
    activarToque();
  }

  function ponerModelo(modelo) {
    modeloActual = modelo;
    pista.style.display = modelo.lugar ? 'block' : 'none';
    recorrerBtn.style.display = modelo.lugar ? 'block' : 'none';
    log(`Cargando: ${modelo.nombre}`);
    visor.src = modelo.src;
  }

  async function abrir(modelo, { conOpciones }) {
    modal.style.display = 'flex';
    opcionesBox.style.display = conOpciones ? 'flex' : 'none';
    titulo.textContent = conOpciones ? 'Prueba 3D / AR' : modelo.nombre;
    try {
      if (!visor) {
        log('Cargando visor 3D...');
        await cargarLibreria();
        crearVisor();
      }
      if (!modeloActual || modeloActual.src !== modelo.src) ponerModelo(modelo);
      else modeloActual = modelo;
    } catch (err) {
      log('No se pudo cargar model-viewer: ' + err.message);
    }
  }

  // Desde otros scripts (botón "Ver en 3D" de la tarjeta)
  window.abrirVisor3D = (modelo) => abrir(modelo, { conOpciones: false });

  abrirBtn.addEventListener('click', () => {
    const elegido = document.querySelector('input[name="arTestModelo"]:checked');
    abrir(MODELOS[elegido ? elegido.value : 'local'], { conOpciones: true });
  });
  cerrarBtn.addEventListener('click', cerrar);
  recorrerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!modeloActual || !window.abrirRecorrido) return;
    cerrar();
    window.abrirRecorrido({ nombre: modeloActual.nombre, inicio: modeloActual.lugar });
  });
  // Que tocar el botón no cuente como "tocar el edificio"
  recorrerBtn.addEventListener('pointerup', (e) => e.stopPropagation());
  opciones.forEach((op) => op.addEventListener('change', () => {
    if (visor && op.checked) ponerModelo(MODELOS[op.value]);
  }));
})();
