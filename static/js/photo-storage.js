/**
 * photo-storage.js
 * Módulo de almacenamiento local y captura de fotos para árboles recolectados.
 * Utiliza IndexedDB para almacenamiento offline permanente con caché síncrona en memoria.
 */

class TreePhotoStorage {
  constructor() {
    this.dbName = 'MapaAmazoniaDB';
    this.dbVersion = 1;
    this.storeName = 'treePhotos';
    this.db = null;
    this.cache = new Map(); // codigoQR -> dataUrl
    this.readyPromise = null;
    this.init();
  }

  /**
   * Inicializa la conexión con IndexedDB y precarga todas las fotos en memoria
   */
  init() {
    this.readyPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(this.dbName, this.dbVersion);

        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'codigoQR' });
          }
        };

        request.onsuccess = (e) => {
          this.db = e.target.result;
          this.loadAllToCache().then(() => {
            console.log(`📸 Almacén de fotos listo: ${this.cache.size} fotos cargadas`);
            document.dispatchEvent(new CustomEvent('photoStorageReady'));
            resolve();
          });
        };

        request.onerror = (e) => {
          console.warn('⚠️ Error abriendo IndexedDB, usando fallback de localStorage:', e);
          this.loadFromLocalStorageFallback();
          resolve();
        };
      } catch (err) {
        console.warn('⚠️ IndexedDB no disponible, usando localStorage fallback:', err);
        this.loadFromLocalStorageFallback();
        resolve();
      }
    });
  }

  /**
   * Carga todas las fotos guardadas en la base de datos hacia el caché en memoria
   */
  async loadAllToCache() {
    if (!this.db) return;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.getAll();

        req.onsuccess = () => {
          const records = req.result || [];
          records.forEach(r => {
            if (r && r.codigoQR && r.dataUrl) {
              this.cache.set(r.codigoQR, r.dataUrl);
            }
          });
          resolve();
        };

        req.onerror = () => {
          console.error('Error leyendo fotos de IndexedDB');
          resolve();
        };
      } catch (e) {
        console.error('Excepción en loadAllToCache:', e);
        resolve();
      }
    });
  }

  /**
   * Fallback de localStorage en caso de que IndexedDB falle
   */
  loadFromLocalStorageFallback() {
    try {
      const raw = localStorage.getItem('mapaSedeAmazonia_treePhotos');
      if (raw) {
        const parsed = JSON.parse(raw);
        Object.entries(parsed).forEach(([k, v]) => this.cache.set(k, v));
      }
    } catch (e) {
      console.warn('Error en fallback localStorage:', e);
    }
  }

  /**
   * Obtiene la foto personalizada de un árbol de forma síncrona
   * @param {string} codigoQR - Código único del espécimen
   * @returns {string|null} Data URL de la imagen o null si no tiene foto del usuario
   */
  getPhoto(codigoQR) {
    if (!codigoQR) return null;
    return this.cache.get(codigoQR) || null;
  }

  /**
   * Resuelve la ruta de la foto por defecto definida en plantas.json
   * - "foto_defecto": "arboles/andiroba.jpg"  -> /static/fotos/arboles/andiroba.jpg
   * - "foto_defecto": "/static/img/x.png" o "https://..." se usan tal cual
   * - "foto" se mantiene como campo heredado
   * @param {Object} planta - Datos de la planta
   * @returns {string|null} URL de la foto por defecto o null
   */
  getDefaultPhoto(planta) {
    if (!planta) return null;
    const ruta = (planta.foto_defecto || planta.foto || '').trim();
    if (!ruta) return null;
    if (/^(\/|https?:|data:)/i.test(ruta)) return ruta;
    return `/static/fotos/${ruta}`;
  }

  /**
   * Foto a mostrar para un árbol: la tomada por el usuario tiene prioridad,
   * si no existe se usa la foto por defecto del JSON
   * @param {Object} planta - Datos de la planta
   * @returns {string|null} URL o Data URL de la imagen
   */
  getDisplayPhoto(planta) {
    if (!planta) return null;
    return this.getPhoto(planta.codigoQR) || this.getDefaultPhoto(planta);
  }

  /**
   * Comprueba si un árbol tiene foto personalizada tomada por el usuario
   */
  hasCustomPhoto(codigoQR) {
    return this.cache.has(codigoQR);
  }

  /**
   * Guarda una foto para un árbol en IndexedDB y memoria
   * @param {string} codigoQR - Código del espécimen
   * @param {string} dataUrl - Cadena Base64 de la imagen comprimida
   */
  async savePhoto(codigoQR, dataUrl) {
    if (!codigoQR || !dataUrl) return false;

    // Actualizar caché en memoria de inmediato
    this.cache.set(codigoQR, dataUrl);

    // Guardar en IndexedDB
    if (this.db) {
      try {
        const tx = this.db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.put({
          codigoQR: codigoQR,
          dataUrl: dataUrl,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Error guardando en IndexedDB, respaldando en localStorage:', err);
        this.saveToLocalStorageFallback(codigoQR, dataUrl);
      }
    } else {
      this.saveToLocalStorageFallback(codigoQR, dataUrl);
    }

    // Notificar a toda la interfaz que la foto de este espécimen cambió
    document.dispatchEvent(new CustomEvent('treePhotoUpdated', {
      detail: { codigoQR, dataUrl }
    }));

    // Mensaje amigable al usuario
    if (window.Swal) {
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
        iconColor: '#2e7d32'
      });
      Toast.fire({
        icon: 'success',
        title: '¡Foto guardada en tu colección! 📸'
      });
    }

    return true;
  }

  /**
   * Guarda en localStorage como fallback
   */
  saveToLocalStorageFallback(codigoQR, dataUrl) {
    try {
      const raw = localStorage.getItem('mapaSedeAmazonia_treePhotos');
      const obj = raw ? JSON.parse(raw) : {};
      obj[codigoQR] = dataUrl;
      localStorage.setItem('mapaSedeAmazonia_treePhotos', JSON.stringify(obj));
    } catch (e) {
      console.error('Error guardando en localStorage fallback:', e);
    }
  }

  /**
   * Elimina la foto personalizada de un árbol
   */
  async deletePhoto(codigoQR) {
    if (!codigoQR) return;
    this.cache.delete(codigoQR);

    if (this.db) {
      try {
        const tx = this.db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.delete(codigoQR);
      } catch (e) {
        console.error('Error eliminando foto de IndexedDB:', e);
      }
    }

    document.dispatchEvent(new CustomEvent('treePhotoUpdated', {
      detail: { codigoQR, dataUrl: null }
    }));
  }

  /**
   * Abre la cámara o selector de archivos del dispositivo para capturar una foto
   * @param {string} codigoQR - Código del espécimen botánico
   */
  promptCapture(codigoQR) {
    if (!codigoQR) return;

    let input = document.getElementById('treeCameraInput');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'treeCameraInput';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.style.display = 'none';
      document.body.appendChild(input);
    }

    input.value = '';

    input.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      try {
        // Comprimir imagen usando Canvas
        const compressedDataUrl = await this.compressImage(file, 1024, 0.85);
        await this.savePhoto(codigoQR, compressedDataUrl);
      } catch (error) {
        console.error('❌ Error procesando fotografía capturada:', error);
        if (window.Swal) {
          Swal.fire({
            title: 'Error al procesar foto',
            text: 'No se pudo guardar la fotografía tomada. Intenta nuevamente.',
            icon: 'error',
            confirmButtonColor: '#2e7d32'
          });
        }
      }
    };

    input.click();
  }

  /**
   * Redimensiona y comprime una imagen a dimensiones optimizadas
   * @param {File} file - Archivo de imagen seleccionado
   * @param {number} maxDimension - Tamaño máximo en ancho o alto (px)
   * @param {number} quality - Calidad de compresión (0.0 a 1.0)
   * @returns {Promise<string>} Data URL comprimido
   */
  compressImage(file, maxDimension = 1024, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Escalar proporcionalmente
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Exportar en formato JPEG optimizado
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };

        img.onerror = (err) => reject(err);
        img.src = event.target.result;
      };

      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }
}

// Instancia global
window.photoStorage = new TreePhotoStorage();
