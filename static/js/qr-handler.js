/**
 * Manejador de Scanner QR
 * Gestiona lectura de códigos QR y proceso de desbloqueo
 */

import QrScanner from '/static/js/qr-scanner.min.js';

class QRScannerHandler {
  constructor() {
    this.qrScanner = null;
    this.isScanning = false;
    this.scanResultElement = document.getElementById('qrResult');
  }

  /**
   * Inicializar scanner QR
   */
  async initScanner() {
    try {
      const video = document.getElementById('qrVideo');
      const loader = document.getElementById('qrLoader');
      
      // Mostrar el loader sobre el video temporalmente
      if (loader) loader.style.display = 'flex';

      // Detener scanner anterior si existe
      if (this.qrScanner) {
        await this.qrScanner.stop();
      }

      // Crear nuevo scanner
      this.qrScanner = new QrScanner(
        video,
        result => this.handleQRDetected(result),
        {
          onDecodeError: err => console.log('QR Error:', err),
          preferredCamera: 'environment', // Usa cámara trasera
          highlightCodeOutline: true,
          maxScansPerSecond: 5
        }
      );

      await this.qrScanner.start();
      
      // Ocultar loader cuando la cámara esté lista
      if (loader) loader.style.display = 'none';

      this.isScanning = true;
      console.log('📱 Scanner QR iniciado');
    } catch (error) {
      console.error('❌ Error inicializando scanner:', error);
      alert('❌ Error al acceder a la cámara. Verifica permisos.');
    }
  }

  /**
   * Manejar QR detectado
   */
  async handleQRDetected(result) {
    const qrCode = result.data.trim();
    console.log('📲 QR Detectado:', qrCode);

    // Procesar desbloqueo
    const resultData = unlocker.unlockPlant(qrCode);

    // Mostrar resultado
    if (resultData.success) {
      await this.stopScanner();
      this.closeModal();

      Swal.fire({
        title: '¡Planta Descubierta!',
        text: 'Has desbloqueado exitosamente esta planta.',
        icon: 'success',
        confirmButtonText: 'Ver detalles',
        confirmButtonColor: '#4caf50'
      }).then(() => {
        if (typeof window.enfocarPlantaQR === 'function') {
          window.enfocarPlantaQR(qrCode);
        }
      });
    } else if (resultData.alreadyUnlocked) {
      await this.stopScanner();
      this.closeModal();

      Swal.fire({
        title: 'Ya descubierta',
        text: resultData.message,
        icon: 'info',
        confirmButtonText: 'Ir a la planta',
        confirmButtonColor: '#2196F3'
      }).then(() => {
        if (typeof window.enfocarPlantaQR === 'function') {
          window.enfocarPlantaQR(qrCode);
        }
      });
    } else {
      this.showErrorMessage(resultData.message);
      // Pausar scanner después de detectar un error
      await this.stopScanner();
    }
  }

  /**
   * Mostrar mensaje de éxito
   */
  showSuccessMessage(data) {
    this.scanResultElement.innerHTML = `
      <div style="background: #4caf50; color: white; padding: 15px; border-radius: 8px; margin-top: 15px;">
        <h3>✅ ${data.message}</h3>
        <p><strong>Planta desbloqueada:</strong> ${data.codigoQR}</p>
        <p><strong>Hora:</strong> ${data.fecha}</p>
      </div>
    `;
    this.scanResultElement.style.display = 'block';
  }

  /**
   * Mostrar mensaje de advertencia
   */
  showWarningMessage(message) {
    this.scanResultElement.innerHTML = `
      <div style="background: #ff9800; color: white; padding: 15px; border-radius: 8px; margin-top: 15px;">
        <h3>${message}</h3>
      </div>
    `;
    this.scanResultElement.style.display = 'block';
  }

  /**
   * Mostrar mensaje de error
   */
  showErrorMessage(message) {
    this.scanResultElement.innerHTML = `
      <div style="background: #f44336; color: white; padding: 15px; border-radius: 8px; margin-top: 15px;">
        <h3>${message}</h3>
      </div>
    `;
    this.scanResultElement.style.display = 'block';
  }

  /**
   * Detener scanner
   */
  async stopScanner() {
    if (this.qrScanner) {
      await this.qrScanner.stop();
      this.isScanning = false;
      console.log('📱 Scanner detenido');
    }
  }

  /**
   * Cerrar modal de scanner
   */
  closeModal() {
    this.stopScanner();
    document.getElementById('qrScannerModal').style.display = 'none';
    this.scanResultElement.innerHTML = '';
    this.scanResultElement.style.display = 'none';
  }

  /**
   * Abrir modal y iniciar scanner
   */
  openScanner() {
    document.getElementById('qrScannerModal').style.display = 'block';
    this.initScanner();
  }
}

// Crear instancia global
window.qrHandler = new QRScannerHandler();

// Funciones globales para HTML
window.abrirScanner = function() {
  window.qrHandler.openScanner();
}

window.closeQRScanner = function() {
  window.qrHandler.closeModal();
}

/**
 * Actualizar display después de desbloquear
 * Llama a la función en index.js para actualizar el mapa
 */
function refreshDisplay() {
  if (typeof actualizarPlantas === 'function') {
    actualizarPlantas();
  }
}
