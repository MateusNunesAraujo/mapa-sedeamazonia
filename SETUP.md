# Guía de Configuración Offline + Capacitor

Esta guía te ayudará a preparar tu aplicación para trabajar completamente offline y compilarla como APK.

## ✅ Lo que ya está configurado

1. **Leaflet local** - Descargado en `static/leaflet/`
2. **Geoman local** - Descargado en `static/geoman/`
3. **Datos JSON locales** - En carpeta `data/`
4. **HTML actualizado** - Referencias cambiadas a recursos locales
5. **FastAPI configurado** - Sirve carpeta data como estática
6. **Capacitor listo** - `capacitor.config.json` creado (`webDir`: `www`)

## 💻 Configurar el proyecto en otro computador

Las carpetas `www/`, `android/`, `ios/`, `node_modules/` y `.venv/` están en `.gitignore`, así que no vienen al clonar el repositorio y hay que generarlas:

```bash
git clone https://github.com/MateusNunesAraujo/mapa-sedeamazonia.git
cd mapa-sedeamazonia
git checkout <rama>                   # la rama en la que vayas a trabajar
npm install
python -m venv .venv                  # entorno de Python para el servidor FastAPI
.venv\Scriptsctivate                # Windows (en Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt
npx cap add android                   # crea android/
npm run sync-app                      # genera www/ y ejecuta cap sync
```

> **Nota:** `www/` no es código fuente. `build.js` la genera copiando `templates/index.html`, `static/` y `data/`. Los cambios se hacen en esas carpetas, nunca en `www/`.

> **Nota:** si mueves o renombras la carpeta del proyecto, el entorno `.venv` deja de funcionar ("Fatal error in launcher: Unable to create process..."). Bórralo y vuelve a crearlo con los comandos de arriba.

## 🚀 Pasos para compilar a APK

### Paso 1: Verificar requisitos

```bash
node --version        # Debe ser 16+
npm --version         # Debe ser 8+
java -version         # Debe tener Java JDK 17 (lo pide Capacitor 5)
python --version      # Python 3.10+
```

Si falta algo, descárgalo desde:
- Node.js: https://nodejs.org/
- Java JDK: https://www.oracle.com/java/technologies/downloads/
- Android Studio: https://developer.android.com/studio

### Paso 2: Verificar la app en navegador

```bash
npm run dev
```

Abre http://localhost:8000 y verifica que:
- ✅ El mapa carga correctamente
- ✅ Los edificios aparecen como polígonos
- ✅ Las imágenes cargan sin CDN
- ✅ Sin errores en consola (F12)

### Paso 3: Inicializar Capacitor (ya está hecho)

El proyecto ya incluye `capacitor.config.json`, así que no hace falta ejecutar `npm run init-capacitor`. Si alguna vez lo vuelves a ejecutar, usa estos valores:
- **App name**: Mapa Sede Amazonia
- **App Package ID**: com.universidadnacional.mapasedeamazonia
- **Webapp directory**: www

### Paso 4: Agregar plataforma Android

```bash
npm run add-android
```

Esto crea la carpeta `android/` con el proyecto Android.

### Paso 5: Sincronizar archivos

```bash
npm run sync-app
```

Esto genera `www/` a partir de `templates/`, `static/` y `data/`, y luego copia todo al proyecto Android (`npx cap sync`). `npm run sync` solo hace el `cap sync` y no actualiza `www/`.

### Paso 6: Compilar APK

```bash
npm run build
```

El proceso tardará varios minutos. El archivo APK se encontrará en:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

## 📱 Instalar en tu teléfono

### Opción A: Usar Android Studio

1. Abre Android Studio
2. Clic en **Open Project** → Selecciona carpeta `android/`
3. Espera a que se indexe
4. Conecta tu teléfono (modo USB Debug activado)
5. Clic en **Run**

### Opción B: Línea de comandos

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Opción C: Instalador manual

Copia el archivo `app-debug.apk` al teléfono y abre desde el gestor de archivos.

## 🔄 Actualizar cambios

Después de modificar código:

```bash
npm run sync-app  # Regenerar www/ y sincronizar
npm run build     # Recompilar APK
```

## 📝 Estructura final de carpetas

```
mapa-sedeamazonia/
├── node_modules/
├── android/               ← Proyecto Android (generado, no está en git)
├── www/                   ← Generado por `npm run sync-app` (no está en git)
├── data/
│   └── edifcios.json
├── static/
│   ├── leaflet/          ← Leaflet local
│   ├── geoman/           ← Geoman local
│   ├── fotos/
│   ├── campus.png
│   └── ...
├── templates/
│   └── index.html        ← HTML actualizado
├── main.py
├── package.json          ← Actualizado
├── capacitor.config.json ← Configuración Capacitor
└── README.md
```

## 🐛 Troubleshooting

### Error: "android: command not found"
Solución: Instala el Android SDK y agrega a PATH

### Error: "JAVA_HOME not set"
Solución: 
```bash
export JAVA_HOME=/path/to/java
```

### APK funciona pero sin internet
- ✅ Es normal y esperado. Verifica que:
  - Las imágenes están en `static/fotos/`
  - Los JSON están en `data/`
  - No hay URLs externas en el código

### El mapa no carga en APK
- Verifica que Leaflet esté en `static/leaflet/`
- Abre DevTools: `chrome://inspect` en otra pestaña
- Conecta por USB y mira los errores

## 🎯 Próximos pasos

1. **Compilar para iOS** (si tienes Mac):
   ```bash
   npm run add ios
   npm run build
   ```

2. **Generar APK de release** (para publicar):
   ```bash
   # En Android Studio: Build → Generate Signed Bundle/APK
   ```

3. **Publicar en Google Play** o distribuir manualmente

¿Preguntas? Revisa:
- https://capacitorjs.com/docs/getting-started
- https://leafletjs.com/
- https://developer.android.com/
