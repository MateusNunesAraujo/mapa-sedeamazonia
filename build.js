#!/usr/bin/env node

/**
 * Script para inicializar y compilar la aplicación para mobile y web
 * Uso: node build.js [comando]
 * Comandos: init, add-android, sync, sync-app, build-web, build, serve, dev
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const commands = process.argv[2] || 'help';

function run(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve(stdout + stderr);
    });
  });
}

// Copia una carpeta completa (con subcarpetas) de src a dest
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(srcPath, destPath) : fs.copyFileSync(srcPath, destPath);
  }
}

// Arma www/ desde cero con lo necesario para la app (lo usan la web en Netlify y la APK)
function prepararWww() {
  // www/ se regenera completa: así no quedan archivos que ya se borraron o movieron en el código
  // (por ejemplo la antigua static/fotos/), que de otro modo terminarían también en la APK
  const wwwDir = path.join(__dirname, 'www');
  console.log('🧹 Limpiando www/...');
  fs.rmSync(wwwDir, { recursive: true, force: true });
  fs.mkdirSync(wwwDir, { recursive: true });

  fs.copyFileSync(path.join(__dirname, 'templates', 'index.html'), path.join(wwwDir, 'index.html'));
  console.log('📂 Copiando static...');
  copyDir(path.join(__dirname, 'static'), path.join(wwwDir, 'static'));
  console.log('📂 Copiando data...');
  copyDir(path.join(__dirname, 'data'), path.join(wwwDir, 'data'));
}

// Copia el ícono de static/iconos/icono_app/android a los recursos del proyecto Android.
// Se repite en cada sync-app por si android/ se vuelve a crear con `npx cap add android`.
function instalarIconoAndroid() {
  const origen = path.join(__dirname, 'static', 'iconos', 'icono_app', 'android');
  const res = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');
  if (!fs.existsSync(origen) || !fs.existsSync(res)) {
    console.log('⚠️  No se encontró el ícono o android/; se omite el ícono de la app');
    return;
  }
  console.log('🎨 Instalando ícono de la app...');

  // Se borran los íconos viejos de todas las densidades (incluida ldpi, que no trae el ícono nuevo):
  // si quedaran, Android los preferiría sobre los nuevos en esas pantallas
  for (const dir of fs.readdirSync(res)) {
    if (!dir.startsWith('mipmap-')) continue;
    for (const nombre of ['ic_launcher.png', 'ic_launcher_round.png',
                          'ic_launcher_foreground.png', 'ic_launcher_background.png']) {
      fs.rmSync(path.join(res, dir, nombre), { force: true });
    }
  }

  // Íconos clásicos por densidad (Android 7 y anteriores)
  for (const dir of fs.readdirSync(origen)) {
    if (dir.startsWith('mipmap-')) copyDir(path.join(origen, dir), path.join(res, dir));
  }

  // Ícono adaptable (Android 8+): capas de 432 px = 108 dp en xxxhdpi; las demás densidades las escala Android
  const xxxhdpi = path.join(res, 'mipmap-xxxhdpi');
  for (const capa of ['ic_launcher_foreground.png', 'ic_launcher_background.png']) {
    fs.copyFileSync(path.join(origen, 'adaptive', capa), path.join(xxxhdpi, capa));
  }
  const anydpi = path.join(res, 'mipmap-anydpi-v26');
  fs.mkdirSync(anydpi, { recursive: true });
  const xml = fs.readFileSync(path.join(origen, 'adaptive', 'ic_launcher.xml'));
  fs.writeFileSync(path.join(anydpi, 'ic_launcher.xml'), xml);
  fs.writeFileSync(path.join(anydpi, 'ic_launcher_round.xml'), xml);
}

async function main() {
  try {
    switch (commands) {
      case 'init':
        console.log('🚀 Inicializando Capacitor...');
        await run('npx cap init');
        console.log('✅ Capacitor inicializado');
        break;

      case 'add-android':
        console.log('📱 Agregando soporte Android...');
        await run('npx cap add android');
        console.log('✅ Android agregado');
        break;

      case 'sync':
        console.log('🔄 Sincronizando archivos (solo cap sync)...');
        await run('npx cap sync');
        console.log('✅ Archivos sincronizados');
        break;

      case 'build-web':
        // Solo arma www/, sin Capacitor. Es el comando que usa Netlify.
        console.log('🌐 Preparando www/ para la web...');
        prepararWww();
        console.log('✅ www/ lista para publicar');
        break;

      case 'sync-app':
        console.log('📦 Preparando archivos de desarrollo para móvil...');
        prepararWww();
        instalarIconoAndroid();
        console.log('🔄 Sincronizando con Capacitor...');
        await run('npx cap sync');
        console.log('✅ ¡Listo! Puedes probar en Android Studio');
        break;

      case 'build':
        console.log('🔨 Compilando APK...');
        await run('npx cap build android');
        console.log('✅ APK compilado en android/app/build/outputs/apk/');
        break;

      case 'serve':
        console.log('📡 Iniciando servidor...');
        await run('uvicorn main:app --reload --host 0.0.0.0 --port 8000');
        break;

      case 'dev':
        console.log('🚀 Iniciando servidor en modo desarrollo...');
        await run('uvicorn main:app --reload');
        break;

      default:
        console.log(`
Comandos disponibles:

  init          - Inicializar Capacitor
  add-android   - Agregar soporte Android
  sync          - Sincronizar archivos con mobile (solo cap sync)
  sync-app      - Regenerar www/ y sincronizar con Capacitor (APK)
  build-web     - Regenerar www/ solamente (web / Netlify)
  build         - Compilar APK para Android
  serve         - Iniciar servidor local
  dev           - Iniciar en modo desarrollo

Ejemplo: npm run build-web
        `);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();