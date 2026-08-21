# Mapa Sede Amazonia - Aplicación Offline

Aplicación web interactiva para visualizar el mapa de la Universidad Nacional de Colombia - Sede Amazonia, optimizada para funcionar completamente offline.

## Características

✅ **Completamente Offline** - No requiere conexión a internet una vez instalada
✅ **Responsive** - Funciona en desktop, tablet y móviles
✅ **Mapa Interactivo** - Basado en Leaflet.js
✅ **Datos Locales** - JSON almacenados localmente
✅ **Empaquetable** - Se puede compilar a APK para Android

## Requisitos Previos

- Node.js 16+ ([descargar](https://nodejs.org/))
- Java JDK 11+ (para Android)
- Android SDK (para compilar APK)
- Git

## Instalación Local

### 1. Clonar el repositorio

\`\`\`bash
git clone <tu-repo>
cd mapa-sedeamazonia
\`\`\`

### 2. Instalar dependencias

\`\`\`bash
npm install
pip install -r requirements.txt
\`\`\`

### 3. Ejecutar en desarrollo

```

## 💻 Flujo de Desarrollo (PC)

La aplicación está diseñada para que el desarrollo se realice cómodamente desde el navegador de tu computadora.

### 1. Iniciar el servidor local
```bash
npm run dev
```
Abre [http://localhost:8000](http://localhost:8000) en tu navegador (Chrome, Edge, etc.).

### 2. Edición de archivos
Modifica directamente los archivos en estas carpetas:
- `templates/index.html` - Estructura HTML
- `static/` - Estilos CSS, lógica JavaScript y fotos
- `data/` - Archivos JSON (edificios y plantas)

*Los cambios se reflejarán instantáneamente en tu navegador al recargar la página. (No modifiques la carpeta `www` manualmente).*

---

## 📱 Sincronización y Compilación para Android (Capacitor)

Cuando hayas probado tus cambios en la web y estés listo para pasarlos a la aplicación móvil (Android Studio), utiliza el comando automático de sincronización.

### 1. Preparar archivos y Sincronizar
```bash
npm run sync-app
```
*Este comando mágico hace todo el trabajo por ti: copia tus archivos desde `templates/`, `static/` y `data/` hacia la carpeta `www/` y luego inyecta esos cambios en tu proyecto de Android (usando `cap sync`).*

### 2. Sincronización manual (Opcional)
Si ya has modificado manualmente la carpeta `www/` y solo quieres sincronizar con Android sin sobreescribir:
```bash
npm run sync
```

### 3. Compilar APK desde consola
```bash
npm run build
```
El APK se generará en: `android/app/build/outputs/apk/debug/app-debug.apk`

*(También puedes abrir el proyecto en Android Studio y darle al botón de Play ▶️ para instalarlo directamente en tu emulador o dispositivo).*

### 4. Abrir proyecto por comando
```bash
npx cap open android
```

## Estructura del Proyecto

```
mapa-sedeamazonia/
├── data/                 # Datos JSON locales
│   ├── edifcios.json    # Datos de edificios
│   └── plantas.json     # Datos de plantas
├── static/              # Archivos estáticos
│   ├── leaflet/         # Leaflet (descargado localmente)
│   ├── geoman/          # Geoman (descargado localmente)
│   └── fotos/           # Fotos de edificios y plantas
├── templates/           # HTML
│   └── index.html
├── main.py              # Servidor FastAPI
├── package.json         # Dependencias npm
├── capacitor.config.json # Configuración de Capacitor
└── requirements.txt     # Dependencias Python
```

## Notas de Offline

- ✅ Leaflet y Geoman están descargados localmente
- ✅ Datos JSON en carpeta `/data`
- ✅ Imágenes en `/static/fotos`
- ✅ No depende de CDNs
- ✅ Funciona completamente sin internet

## Desarrollo

Para modificar datos, edita:
- `data/edifcios.json` - Información de edificios
- `static/fotos/` - Imágenes

Luego recarga la página en el navegador.

## Troubleshooting

### "No se carga el mapa"
- Verifica que los archivos estén en `static/leaflet/`
- Abre la consola (F12) y busca errores

### "No se cargan los datos"
- Verifica que `data/edifcios.json` esté bien formado (JSON válido)
- Revisa la consola del navegador

### Problemas con APK
- Asegúrate de tener Android SDK instalado
- Ejecuta `npx cap update` para actualizar dependencias

## Licencia

Universidad Nacional de Colombia - Sede Amazonia

## Contacto

Para preguntas o problemas, contacta al equipo de desarrollo.
