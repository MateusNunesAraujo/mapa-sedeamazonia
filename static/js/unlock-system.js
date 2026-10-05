/**
 * Sistema de Desbloqueo con Códigos QR
 * Gestiona qué plantas están desbloqueadas para el usuario actual
 * Usa localStorage para persistencia (NO necesita librerías externas)
 */

class UnlockSystem {
  constructor() {
    this.storageKey = 'mapaSedAmazonia_unlockedPlants';
    this.unlockedPlants = {};
    this.init();
  }

  /**
   * Inicializar: cargar datos guardados de localStorage
   */
  init() {
    this.loadUnlocked();
    console.log('🔓 Sistema de desbloqueo inicializado');
  }

  /**
   * Cargar plantas desbloqueadas desde localStorage
   * localStorage es nativo del navegador, persiste automáticamente
   */
  loadUnlocked() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      this.unlockedPlants = stored ? JSON.parse(stored) : {};
      console.log('📦 Plantas desbloqueadas cargadas:', Object.keys(this.unlockedPlants).length);
    } catch (error) {
      console.error('❌ Error cargando datos:', error);
      this.unlockedPlants = {};
    }
  }

  /**
   * Guardar plantas desbloqueadas en localStorage
   * Se persiste automáticamente en el dispositivo
   */
  saveUnlocked() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.unlockedPlants));
      console.log('💾 Datos guardados en localStorage');
    } catch (error) {
      console.error('❌ Error guardando datos:', error);
    }
  }

  /**
   * Desbloquear una planta con código QR
   * @param {string} codigoQR - El código detectado del QR (ej: PLANTA_001_AMAZONIA)
   * @returns {object} Información del desbloqueo
   */
  unlockPlant(codigoQR) {
    // Validar que sea un código QR válido de planta
    if (!codigoQR.startsWith('PLANTA_')) {
      return {
        success: false,
        message: '❌ Código QR inválido. No es una planta.',
        error: true
      };
    }

    // Si ya está desbloqueado
    if (this.unlockedPlants[codigoQR]) {
      return {
        success: false,
        message: '✅ Esta planta ya está desbloqueada',
        alreadyUnlocked: true
      };
    }

    // Desbloquear
    this.unlockedPlants[codigoQR] = {
      desbloqueado: true,
      fecha_desbloqueo: new Date().toISOString(),
      timestamp: Date.now()
    };

    this.saveUnlocked();

    // Disparar evento para que la UI se entere
    document.dispatchEvent(new CustomEvent('plantUnlocked', {
      detail: { codigoQR: codigoQR }
    }));

    return {
      success: true,
      message: '🎉 ¡Planta desbloqueada!',
      codigoQR: codigoQR,
      fecha: new Date().toLocaleString('es-ES')
    };
  }

  /**
   * Verificar si una planta está desbloqueada
   * @param {string} codigoQR - El código QR de la planta
   * @returns {boolean}
   */
  isUnlocked(codigoQR) {
    return !!this.unlockedPlants[codigoQR]?.desbloqueado;
  }

  /**
   * Obtener todas las plantas desbloqueadas
   * @returns {array} Array de códigos QR desbloqueados
   */
  getUnlockedList() {
    return Object.keys(this.unlockedPlants).filter(
      code => this.unlockedPlants[code].desbloqueado
    );
  }

  /**
   * Contar plantas desbloqueadas
   * @returns {number}
   */
  getUnlockedCount() {
    return this.getUnlockedList().length;
  }

  /**
   * Limpiar todos los desbloqueos (para testing o reset)
   */
  resetAll() {
    this.unlockedPlants = {};
    this.saveUnlocked();
    console.log('🔄 Todos los desbloqueos han sido reseteados');
  }

  /**
   * Desbloquear una planta manualmente (para testing)
   */
  unlockForTesting(codigoQR) {
    this.unlockedPlants[codigoQR] = {
      desbloqueado: true,
      fecha_desbloqueo: new Date().toISOString()
    };
    this.saveUnlocked();
    console.log(`✅ Planta ${codigoQR} desbloqueada para testing`);
    return true;
  }
}

// Crear instancia global que se usa en toda la app
const unlocker = new UnlockSystem();
window.unlocker = unlocker;
window.resetearDesbloqueos = function () {
  unlocker.resetAll();
  if (typeof actualizarPlantas === 'function') {
    actualizarPlantas();
  }
  console.log('🔄 Desbloqueos reseteados con éxito. Todas las plantas vuelven a su estado del JSON.');
};