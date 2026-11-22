/**
 * Transición de entrada a "Mi jardín" con el logo de Forgames, al estilo de una intro de consola:
 *   1. Barrido de píxeles que tapa la pantalla.
 *   2. El logo se arma por piezas: control (rebote), cruceta, botones que se encienden uno a uno,
 *      el brote que crece y las letras que caen.
 *   3. Barra de carga en píxeles mientras se abre el jardín por debajo (tapa la carga de Three.js).
 *   4. Iris que se abre desde el brote: la cámara "entra" al jardín.
 *
 * Tocar la pantalla adelanta la animación (cuando el jardín ya cargó).
 * Las capas del logo son PNG de 800×800 alineados entre sí (static/transicion/).
 */

const CARPETA_CAPAS = '/static/transicion/';
const FONDO = '#f4f1e8';
const VERDE = '#a8ad3e';
const OSCURO = '#263037';

// Puntos de anclaje de cada pieza, en % del lienzo del logo
const PIEZAS = {
  cuerpo: '50% 56%',
  cruceta: '27.7% 47.3%',
  brote: '49% 41.8%', // punta del tallo: el brote crece desde aquí
  boton0: '72.9% 41.9%',
  boton1: '78.3% 47.3%',
  boton2: '72.9% 52.8%',
  boton3: '67.4% 47.3%',
};
const LETRAS_X = [12.9, 23.0, 34.3, 44.3, 55.4, 67.1, 78.1, 87.0];

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function estilos() {
  if (document.getElementById('transicionJardinCss')) return;
  const css = document.createElement('style');
  css.id = 'transicionJardinCss';
  css.textContent = `
  .tj-capa{position:fixed;inset:0;z-index:9999;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
  .tj-pixeles{position:absolute;inset:0;width:100%;height:100%}
  .tj-escena{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4vmin;opacity:0}
  .tj-escena::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.35;
    background:repeating-linear-gradient(0deg,rgba(38,48,55,.06) 0 1px,transparent 1px 3px)}
  .tj-logo{position:relative;width:min(62vmin,340px);aspect-ratio:1}
  .tj-logo img{position:absolute;inset:0;width:100%;height:100%;opacity:0;will-change:transform,opacity;pointer-events:none}
  .tj-carga{display:flex;flex-direction:column;align-items:center;gap:10px;opacity:0;
    font:700 12px/1 ui-monospace,"Courier New",monospace;letter-spacing:.22em;color:${OSCURO}}
  .tj-barra{display:flex;gap:4px;padding:4px;border:3px solid ${OSCURO};border-radius:3px}
  .tj-barra i{width:14px;height:12px;background:${VERDE};opacity:.15;transition:opacity .08s}
  .tj-barra i.on{opacity:1}
  .tj-chispa{position:absolute;width:7px;height:7px;background:${VERDE};pointer-events:none}
  .tj-saltar{position:absolute;bottom:max(18px,env(safe-area-inset-bottom));left:0;right:0;text-align:center;
    font:600 11px ui-monospace,monospace;letter-spacing:.2em;color:${OSCURO};opacity:0;transition:opacity .3s}
  `;
  document.head.appendChild(css);
}

/* ---------- Sonido chiptune con WebAudio (sin archivos) ---------- */
function crearSonido(activo) {
  if (!activo) return { nota() {}, barrido() {}, cerrar() {} };
  let ctx;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return { nota() {}, barrido() {}, cerrar() {} }; }
  const sonar = (f0, f1, dur, tipo = 'square', vol = 0.06, retraso = 0) => {
    const t = ctx.currentTime + retraso;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };
  return {
    nota: (f, dur = 0.09, tipo, vol) => sonar(f, f, dur, tipo, vol),
    barrido: (f0, f1, dur, tipo, vol) => sonar(f0, f1, dur, tipo, vol),
    cerrar: () => setTimeout(() => ctx.close().catch(() => {}), 1500),
  };
}

/* ---------- Barrido de píxeles (canvas) ---------- */
function barridoPixeles(canvas, duracion, color) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth; const h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const c = canvas.getContext('2d');
  c.scale(dpr, dpr);
  const lado = Math.ceil(Math.max(w, h) / 14);
  const cols = Math.ceil(w / lado); const filas = Math.ceil(h / lado);
  const celdas = [];
  for (let y = 0; y < filas; y++) {
    for (let x = 0; x < cols; x++) {
      // Diagonal desde abajo a la izquierda, con algo de azar para que se vea "pixelado"
      const orden = (x / cols + (filas - 1 - y) / filas) / 2;
      celdas.push({ x: x * lado, y: y * lado, inicio: orden * 0.6 + Math.random() * 0.15 });
    }
  }
  return new Promise((listo) => {
    const t0 = performance.now();
    (function cuadro(ahora) {
      const p = (ahora - t0) / duracion;
      c.clearRect(0, 0, w, h);
      c.fillStyle = color;
      for (const celda of celdas) {
        const k = Math.min(Math.max((p - celda.inicio) / 0.25, 0), 1);
        if (!k) continue;
        const s = lado * (k < 1 ? Math.ceil(k * 4) / 4 : 1) + 1; // crece en 4 pasos, como sprite
        c.fillRect(celda.x + (lado - s) / 2, celda.y + (lado - s) / 2, s, s);
      }
      if (p < 1) requestAnimationFrame(cuadro); else listo();
    })(t0);
  });
}

/**
 * Reproduce la transición y abre el jardín por debajo.
 * @param {object} opciones
 *   cargar: función (puede ser async) que abre el jardín; se llama con la pantalla ya tapada.
 *           Recibe `progreso(fraccion)` (0 a 1) para mover la barra según lo que de verdad cargó.
 *           Si nunca lo llama, la barra avanza sola hasta el 80 % y espera a que termine.
 *   sonido: true para los bips chiptune.
 *   carpeta: ruta de las capas PNG del logo.
 *   saltable: false para que tocar la pantalla no adelante la animación (visitar jardines).
 * @returns {Promise<void>} se resuelve cuando la transición terminó y el jardín quedó a la vista.
 */
export async function transicionJardin({ cargar = () => {}, sonido = true, carpeta = CARPETA_CAPAS, capas = null, saltable = true } = {}) {
  const url = (nombre) => (capas && capas[nombre]) || `${carpeta}${nombre}.png`;

  // Movimiento reducido: un fundido corto y listo
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    const velo = Object.assign(document.createElement('div'), { style: `position:fixed;inset:0;z-index:9999;background:${FONDO};opacity:0;transition:opacity .2s` });
    document.body.appendChild(velo);
    await espera(20); velo.style.opacity = 1; await espera(220);
    await cargar(); velo.style.opacity = 0; await espera(220); velo.remove();
    return;
  }

  estilos();
  const sfx = crearSonido(sonido);
  const capa = document.createElement('div');
  capa.className = 'tj-capa';
  capa.setAttribute('aria-hidden', 'true');
  capa.innerHTML = `
    <canvas class="tj-pixeles"></canvas>
    <div class="tj-escena">
      <div class="tj-logo">
        <img data-p="cuerpo"><img data-p="cruceta">
        <img data-p="boton0"><img data-p="boton1"><img data-p="boton2"><img data-p="boton3">
        <img data-p="brote">
        ${LETRAS_X.map((_, i) => `<img data-l="${i}">`).join('')}
      </div>
      <div class="tj-carga"><div class="tj-barra">${'<i></i>'.repeat(10)}</div><span>ENTRANDO AL JARDÍN</span></div>
      <div class="tj-saltar">TOCA PARA CONTINUAR</div>
    </div>`;
  document.body.appendChild(capa);

  const escena = capa.querySelector('.tj-escena');
  const logo = capa.querySelector('.tj-logo');
  const pieza = (n) => logo.querySelector(`[data-p="${n}"]`);
  const letras = [...logo.querySelectorAll('[data-l]')];

  // Precarga de las capas (son pequeñas; en la APK están en local)
  const imgs = [...logo.querySelectorAll('img')];
  imgs.forEach((img) => {
    const n = img.dataset.p || `letra${img.dataset.l}`;
    img.src = url(n);
    img.style.transformOrigin = PIEZAS[n] || `${LETRAS_X[img.dataset.l]}% 90%`;
  });
  const precarga = Promise.all(imgs.map((img) => img.decode?.().catch(() => {})));

  let saltar = false;
  const animaciones = [];
  const anim = (el, frames, opts) => { const a = el.animate(frames, { fill: 'both', ...opts }); animaciones.push(a); return a; };
  if (saltable) capa.addEventListener('pointerdown', () => { saltar = true; animaciones.forEach((a) => a.finish()); });

  // 1. Barrido de píxeles
  sfx.barrido(140, 520, 0.35, 'square', 0.04);
  await Promise.all([barridoPixeles(capa.querySelector('.tj-pixeles'), 420, FONDO), precarga]);
  capa.style.background = FONDO;
  capa.querySelector('.tj-pixeles').remove();
  escena.style.opacity = 1;

  // El jardín empieza a cargar por debajo, ya tapado
  let progreso = 0; // fracción cargada que informa `cargar` (nunca retrocede)
  let informa = false;
  const informar = (fraccion) => {
    informa = true;
    progreso = Math.max(progreso, Math.min(1, Number(fraccion) || 0));
  };
  const carga = Promise.resolve().then(() => cargar(informar)).catch((err) => console.error('Error al abrir el jardín:', err));
  let cargado = false;
  carga.then(() => { cargado = true; });

  // 2. El logo se arma
  const rebote = 'cubic-bezier(.34,1.56,.64,1)';
  anim(pieza('cuerpo'), [
    { opacity: 0, transform: 'scale(.2,.2)' },
    { opacity: 1, transform: 'scale(1.18,.84)', offset: 0.45 },
    { transform: 'scale(.93,1.08)', offset: 0.7 },
    { opacity: 1, transform: 'scale(1,1)' },
  ], { duration: 480, easing: 'ease-out' });
  sfx.barrido(110, 220, 0.18, 'triangle', 0.12);

  setTimeout(() => { if (!saltar) sfx.nota(330, 0.06); }, 300);
  anim(pieza('cruceta'), [
    { opacity: 0, transform: 'scale(0) rotate(-180deg)' },
    { opacity: 1, transform: 'scale(1) rotate(0)' },
  ], { duration: 360, delay: 300, easing: rebote });

  [0, 1, 2, 3].forEach((i) => {
    const retraso = 480 + i * 85;
    setTimeout(() => { if (!saltar) sfx.nota([523, 659, 784, 1047][i], 0.07); }, retraso);
    anim(pieza(`boton${i}`), [
      { opacity: 0, transform: 'scale(0)', filter: 'brightness(2)' },
      { opacity: 1, transform: 'scale(1.5)', filter: 'brightness(1.6)', offset: 0.5 },
      { opacity: 1, transform: 'scale(1)', filter: 'brightness(1)' },
    ], { duration: 260, delay: retraso, easing: 'ease-out' });
  });

  setTimeout(() => { if (!saltar) sfx.barrido(260, 1040, 0.32, 'square', 0.05); }, 860);
  anim(pieza('brote'), [
    { opacity: 0, transform: 'scale(0,0)' },
    { opacity: 1, transform: 'scale(.35,1.15)', offset: 0.35 },
    { transform: 'scale(1.18,.92) rotate(-6deg)', offset: 0.6 },
    { transform: 'scale(.96,1.04) rotate(4deg)', offset: 0.8 },
    { opacity: 1, transform: 'scale(1) rotate(0)' },
  ], { duration: 620, delay: 860, easing: 'ease-out' });
  setTimeout(() => { if (!saltar) chispas(logo); }, 1150);

  letras.forEach((l, i) => {
    anim(l, [
      { opacity: 0, transform: 'translateY(-55%)' },
      { opacity: 1, transform: 'translateY(2%) scale(1.08,.9)', offset: 0.7 },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ], { duration: 300, delay: 1280 + i * 50, easing: 'cubic-bezier(.5,0,.75,0)' });
  });
  setTimeout(() => {
    if (saltar) return;
    sfx.nota(98, 0.12, 'triangle', 0.18);
    logo.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-3px,2px)' }, { transform: 'translate(3px,-2px)' }, { transform: 'translate(0,0)' }], { duration: 160 });
  }, 1280 + 7 * 50 + 220);

  // 3. Barra de carga
  const carga$ = capa.querySelector('.tj-carga');
  const segmentos = [...carga$.querySelectorAll('i')];
  anim(carga$, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 250, delay: 1500 });
  await esperarOSaltar(1750, () => saltar);

  const MIN_BARRA = 650; // aunque todo esté listo, la barra tarda al menos esto en llenarse
  const tBarra = performance.now();
  const total = segmentos.length;
  let encendidos = 0;
  if (saltable) setTimeout(() => { capa.querySelector('.tj-saltar').style.opacity = 0.55; }, 2500);
  while (encendidos < total) {
    // Cuánto marca la carga real; el último segmento se reserva para cuando `cargar` termina.
    // Sin informes de progreso, avanza sola hasta el 80 %.
    const real = cargado ? total : informa ? Math.min(total - 1, Math.floor(progreso * total)) : Math.floor(total * 0.8);
    const porTiempo = Math.ceil(((performance.now() - tBarra) / MIN_BARRA) * total);
    // Un segmento por cuadro, para que se vea avanzar aunque la carga dé un salto grande
    if (encendidos < Math.min(real, porTiempo)) {
      segmentos[encendidos++].classList.add('on');
      if (!saltar) sfx.nota(440 + encendidos * 40, 0.03, 'square', 0.03);
    }
    if (saltar && cargado) segmentos.forEach((s) => s.classList.add('on')), (encendidos = segmentos.length);
    await espera(saltar ? 16 : 45);
  }
  await carga;
  if (!saltar) await espera(180);

  // 4. Iris desde el brote: el logo se acerca y el agujero revela el jardín
  sfx.barrido(392, 1568, 0.4, 'square', 0.05);
  const caja = logo.getBoundingClientRect();
  const cx = caja.left + caja.width * 0.49;
  const cy = caja.top + caja.height * 0.30; // entre las hojas
  const radioMax = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
  logo.style.transformOrigin = '49% 30%';
  logo.animate([{ transform: 'scale(1)' }, { transform: 'scale(.9)', offset: 0.25 }, { transform: 'scale(5)', opacity: 0 }],
    { duration: 650, easing: 'cubic-bezier(.6,0,.9,.5)', fill: 'forwards' });
  carga$.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(10px)' }], { duration: 180, fill: 'forwards' });
  capa.querySelector('.tj-saltar').style.opacity = 0;

  await new Promise((listo) => {
    const ti = performance.now();
    const DUR = 650;
    (function cuadro(ahora) {
      const p = Math.min((ahora - ti) / DUR, 1);
      const e = p < 0.2 ? 0 : Math.pow((p - 0.2) / 0.8, 2.2); // pausa corta y luego se abre rápido
      const r = e * radioMax;
      const mascara = `radial-gradient(circle at ${cx}px ${cy}px, transparent ${r}px, #000 ${r + 1}px)`;
      capa.style.webkitMaskImage = mascara;
      capa.style.maskImage = mascara;
      if (p < 1) requestAnimationFrame(cuadro); else listo();
    })(ti);
  });

  capa.remove();
  sfx.cerrar();
}

async function esperarOSaltar(ms, saltado) {
  const fin = performance.now() + ms;
  while (performance.now() < fin && !saltado()) await espera(30);
}

/** Pequeña explosión de píxeles verdes que salen del brote */
function chispas(logo) {
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('i');
    s.className = 'tj-chispa';
    s.style.left = '49%'; s.style.top = '22%';
    if (i % 3 === 0) s.style.background = OSCURO;
    logo.appendChild(s);
    const ang = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
    const dist = 60 + Math.random() * 70;
    s.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist}px)) scale(.3)`, opacity: 0 },
    ], { duration: 520 + Math.random() * 200, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' }).onfinish = () => s.remove();
  }
}
