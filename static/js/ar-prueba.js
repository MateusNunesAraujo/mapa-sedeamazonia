/**
 * PRUEBA del paso 1 (glosario AR): visor 3D + realidad aumentada con <model-viewer>.
 * Sirve para comprobar si la AR abre dentro de la APK antes de construir el glosario.
 *
 * - "Modelo local": el .glb va dentro de la app (funciona sin internet).
 * - "Modelo en línea": un .glb público. Scene Viewer (la AR de Google) descarga el
 *   modelo por su cuenta, así que si solo funciona este, sabremos que hay que
 *   publicar los modelos en internet o abrir la AR de otra forma.
 */
(function () {
  const MODELOS = {
    local: {
      src: '/static/modelos/hoja-trifoliada.glb',
      nombre: 'Hoja trifoliada (local)',
    },
    online: {
      src: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
      nombre: 'Astronauta de ejemplo (en línea)',
    },
  };

  const modal = document.getElementById('arTestModal');
  const abrirBtn = document.getElementById('arTestBtn');
  const cerrarBtn = document.getElementById('arTestCloseBtn');
  const contenedor = document.getElementById('arTestViewer');
  const estado = document.getElementById('arTestEstado');
  const opciones = document.querySelectorAll('input[name="arTestModelo"]');
  if (!modal || !abrirBtn) return;

  let visor = null;
  let cargaLibreria = null;

  function log(texto) {
    const hora = new Date().toLocaleTimeString();
    estado.textContent = `[${hora}] ${texto}\n` + estado.textContent;
  }

  function cargarLibreria() {
    // Solo se carga al abrir la prueba, para no hacer más lenta la app al iniciar.
    if (!cargaLibreria) cargaLibreria = import('/static/js/model-viewer.min.js');
    return cargaLibreria;
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
    visor.setAttribute('alt', 'Modelo 3D de prueba');
    visor.innerHTML = '<button slot="ar-button" class="ar-test-ar-btn">📱 Ver en tu espacio (AR)</button>';

    visor.addEventListener('load', () => {
      log(`Modelo cargado. ¿AR disponible en este dispositivo?: ${visor.canActivateAR ? 'SÍ' : 'NO'}`);
    });
    visor.addEventListener('error', (e) => {
      log('Error al cargar el modelo: ' + (e.detail && e.detail.type ? e.detail.type : 'desconocido'));
    });
    visor.addEventListener('ar-status', (e) => log('Estado AR: ' + e.detail.status));
    visor.querySelector('[slot="ar-button"]').addEventListener('click', () => {
      log('Botón AR tocado. Si no se abre nada en unos segundos, la AR no funcionó.');
    });

    contenedor.appendChild(visor);
  }

  function ponerModelo(clave) {
    const m = MODELOS[clave];
    log(`Cargando: ${m.nombre}`);
    visor.src = m.src;
  }

  async function abrir() {
    modal.style.display = 'flex';
    if (visor) return;
    log('Cargando visor 3D...');
    try {
      await cargarLibreria();
      crearVisor();
      const elegido = document.querySelector('input[name="arTestModelo"]:checked');
      ponerModelo(elegido ? elegido.value : 'local');
    } catch (err) {
      log('No se pudo cargar model-viewer: ' + err.message);
    }
  }

  abrirBtn.addEventListener('click', abrir);
  cerrarBtn.addEventListener('click', () => { modal.style.display = 'none'; });
  opciones.forEach((op) => op.addEventListener('change', () => {
    if (visor && op.checked) ponerModelo(op.value);
  }));
})();
