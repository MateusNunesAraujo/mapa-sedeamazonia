#!/usr/bin/env node

/**
 * Script para inicializar y compilar la aplicación para mobile
 * Uso: node build.js [comando]
 * Comandos: init, build, sync, serve
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

      case 'sync-app':
        console.log('📦 Preparando archivos de desarrollo para móvil...');
        const copyDir = (src, dest) => {
          if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
          let entries = fs.readdirSync(src, { withFileTypes: true });
          for (let entry of entries) {
            let srcPath = path.join(src, entry.name);
            let destPath = path.join(dest, entry.name);
            entry.isDirectory() ? copyDir(srcPath, destPath) : fs.copyFileSync(srcPath, destPath);
          }
        };
        
        fs.copyFileSync(path.join(__dirname, 'templates', 'index.html'), path.join(__dirname, 'www', 'index.html'));
        console.log('📂 Copiando static...');
        copyDir(path.join(__dirname, 'static'), path.join(__dirname, 'www', 'static'));
        console.log('📂 Copiando data...');
        copyDir(path.join(__dirname, 'data'), path.join(__dirname, 'www', 'data'));
        
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
  sync          - Sincronizar archivos con mobile
  build         - Compilar APK para Android
  serve         - Iniciar servidor local
  dev           - Iniciar en modo desarrollo

Ejemplo: npm run build
        `);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
