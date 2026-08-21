/**
 * Manejador de Plantas
 * Gestiona carga de plantas, filtrado y visualización basada en estado de desbloqueo
 */

class PlantsHandler {
  constructor() {
    this.plantas = [];
    this.plantasLayer = L.layerGroup();
    this.plantasCargadas = false;
  }

  /**
   * Cargar plantas desde JSON local
   */
  async loadPlants() {
    try {
      const response = await fetch('/data/plantas.json');
      this.plantas = await response.json();
      console.log('🌿 Plantas cargadas:', this.plantas.length);
      return this.plantas;
    } catch (error) {
      console.error('❌ Error cargando plantas:', error);
      return [];
    }
  }

  /**
   * Obtener datos de una planta según su código QR
   * Retorna solo datos visibles si está desbloqueado
   */
  getPlantData(codigoQR) {
    const planta = this.plantas.find(p => p.codigoQR === codigoQR);
    if (!planta) return null;

    // Si está bloqueado, retornar datos mínimos
    if (planta.bloqueado && !unlocker.isUnlocked(codigoQR)) {
      return {
        nombre: 'Bloqueado',
        nombre_cientifico: '',
        punto: planta.punto,
        descripcion: 'Escanea un código QR para desbloquear esta planta',
        codigoQR: codigoQR,
        bloqueado: true
      };
    }

    // Si está desbloqueado, retornar todos los datos
    return {
      ...planta,
      bloqueado: false
    };
  }

  /**
   * Obtener HTML para mostrar información de planta
   * Oculta contenido si está bloqueado
   */
  getPlantHTML(codigoQR) {
    const planta = this.getPlantData(codigoQR);
    if (!planta) return '';

    // Si está bloqueado
    if (planta.bloqueado) {
      return `
        <div class="planta-bloqueada">
          <h3>🔒 ${planta.nombre}</h3>
          <p style="color: #888; font-style: italic;">${planta.descripcion}</p>
          <button onclick="abrirScanner()" class="btn-desbloquear">
            📱 Escanear QR
          </button>
        </div>
      `;
    }

    // Si está desbloqueado, mostrar todo
    return `
      <div class="planta-desbloqueada">
        <h3>${planta.nombre}</h3>
        <p class="cientifico"><em>${planta.nombre_cientifico}</em></p>
        <p><strong>Descripción:</strong> ${planta.descripcion}</p>
        <p><strong>Usos tradicionales:</strong> ${planta.usos_tradicionales || 'N/A'}</p>
        ${planta.foto ? `<img src="/static/fotos/${planta.foto}" alt="${planta.nombre}" style="max-width: 100%; margin: 10px 0;">` : ''}
      </div>
    `;
  }

  /**
   * Crear marcador en el mapa para una planta
   */
  createPlantMarker(planta) {
    const isUnlocked = !planta.bloqueado || unlocker.isUnlocked(planta.codigoQR);

    const color = isUnlocked ? '#4caf50' : '#999'; // Verde si desbloqueado, gris si bloqueado

    const marker = L.circleMarker(planta.punto, {
      color: color,
      fillColor: color,
      fillOpacity: isUnlocked ? 0.8 : 0.4,
      radius: isUnlocked ? 10 : 6,
      weight: 2
    }).bindPopup(() => this.getPlantHTML(planta.codigoQR));

    marker.on('click', () => {
      console.log('🌿 Planta seleccionada:', planta.nombre);
    });

    return marker;
  }

  /**
   * Agregar todas las plantas al mapa
   */
  addAllPlantsToMap(layer) {
    this.markers = {}; // Objeto para guardar referencias de los marcadores
    this.plantas.forEach(planta => {
      const marker = this.createPlantMarker(planta);
      marker.addTo(layer);
      this.markers[planta.codigoQR] = marker; // Guardamos el marcador
    });
    this.plantasCargadas = true;
  }

  /**
   * Actualizar visualización de plantas (después de desbloquear)
   */
  refreshPlantMarkers(map, layer) {
    // Limpiar capa anterior
    layer.clearLayers();

    // Agregar todas nuevamente con estado actualizado
    this.addAllPlantsToMap(layer);

    console.log('🔄 Marcadores de plantas actualizados');
  }

  /**
   * Obtener información de todas las plantas desbloqueadas
   */
  getUnlockedPlants() {
    return this.plantas.filter(
      p => !p.bloqueado || unlocker.isUnlocked(p.codigoQR)
    );
  }

  /**
   * Contar plantas desbloqueadas
   */
  getUnlockedCount() {
    return this.getUnlockedPlants().length;
  }
}

// Crear instancia global
const plantsHandler = new PlantsHandler();
