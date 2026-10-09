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
      const response = await fetch(`/data/plantas.json?t=${Date.now()}`, { cache: 'no-cache' });
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

    // true = Bloqueado (requiere QR), false = Desbloqueado
    const isUnlocked = !planta.bloqueado || unlocker.isUnlocked(codigoQR);

    // Si está bloqueado, retornar datos mínimos
    if (!isUnlocked) {
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
   * Normaliza los usos de una planta para soportar cualquier estructura de datos:
   * - Objeto clave-valor: { "Medicinal": "...", "Aserrío": "...", "Otros": "..." }
   * - Arreglo: [{ titulo: "Medicinal", texto: "..." }] o [{ tipo: "Medicinal", descripcion: "..." }]
   * - Texto simple tradicional: usos_tradicionales: "..."
   */
  formatearUsos(planta) {
    if (!planta) return [];

    // Objeto clave-valor: { "Medicinal": "...", "Aserrío": "..." }
    if (planta.usos && typeof planta.usos === 'object' && !Array.isArray(planta.usos)) {
      return Object.entries(planta.usos)
        .filter(([titulo, texto]) => texto && String(texto).trim().length > 0)
        .map(([titulo, texto]) => ({
          titulo: String(titulo).trim(),
          texto: String(texto).trim()
        }));
    }

    // Arreglo de usos
    if (Array.isArray(planta.usos)) {
      return planta.usos.map(item => {
        if (typeof item === 'string') {
          const colonIdx = item.indexOf(':');
          if (colonIdx !== -1) {
            return {
              titulo: item.substring(0, colonIdx).trim(),
              texto: item.substring(colonIdx + 1).trim()
            };
          }
          return { titulo: 'Uso', texto: item.trim() };
        }
        if (item && typeof item === 'object') {
          return {
            titulo: item.titulo || item.tipo || item.nombre || 'Uso',
            texto: item.texto || item.descripcion || item.detalle || ''
          };
        }
        return { titulo: 'Uso', texto: String(item) };
      }).filter(u => u.texto.length > 0);
    }

    // Compatibilidad con usos_tradicionales
    if (planta.usos_tradicionales && typeof planta.usos_tradicionales === 'string') {
      const texto = planta.usos_tradicionales.trim();
      if (texto && texto !== 'N/A') {
        return [{ titulo: 'Usos tradicionales', texto }];
      }
    }

    return [];
  }

  /**
   * Obtener HTML para la carta de presentación de la planta (popup en el mapa)
   * Oculta contenido si está bloqueado
   */
  getPlantHTML(codigoQR) {
    const planta = this.getPlantData(codigoQR);
    if (!planta) return '';

    // true = Bloqueado (requiere QR), false = Desbloqueado
    const isUnlocked = !planta.bloqueado || unlocker.isUnlocked(codigoQR);

    // Si está bloqueado
    if (!isUnlocked) {
      return `
        <div class="planta-card-popup locked">
          <div class="planta-card-photo">
            <div class="planta-photo-placeholder locked">
              <span class="placeholder-icon">🔒</span>
              <span>Árbol bloqueado</span>
            </div>
          </div>
          <div class="planta-card-body">
            <h3 class="planta-card-title">🔒 Especie no identificada</h3>
            <p class="planta-card-desc" style="color: #64748b; font-style: italic;">
              ${planta.descripcion || 'Escanea el código QR de este espécimen en el campus para desbloquear su información.'}
            </p>
            <button onclick="abrirScanner()" class="btn-desbloquear-popup">
              📱 Escanear QR
            </button>
          </div>
        </div>
      `;
    }

    // Foto tomada por el usuario o, en su defecto, la foto por defecto del JSON
    const finalPhotoSrc = window.photoStorage ? window.photoStorage.getDisplayPhoto(planta) : null;

    // Botón de favorito en la esquina superior derecha (SOLO para árboles desbloqueados)
    const favoritoBtnHTML = isUnlocked ? window.favorites.buttonHTML(planta.codigoQR, 'btn-favorito-popup') : '';

    // Espacio para la foto con fallback elegante si no existe archivo de imagen
    const photoHTML = `
      <div class="planta-card-photo">
        ${finalPhotoSrc 
          ? `<img src="${finalPhotoSrc}" alt="${planta.nombre}" class="planta-card-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
             <div class="planta-photo-placeholder" style="display: none;">
               <span class="placeholder-icon">🌳</span>
               <span>Fotografía botánica</span>
             </div>`
          : `<div class="planta-photo-placeholder">
               <span class="placeholder-icon">🌳</span>
               <span>Espacio para fotografía</span>
             </div>`
        }
        ${favoritoBtnHTML}
      </div>
    `;

    // Nombre científico / especie
    const cientifico = planta.especie || planta.nombre_cientifico || '';

    // Carta de presentación botánica
    return `
      <div class="planta-card-popup">
        ${photoHTML}
        <div class="planta-card-body">
          <div class="planta-card-header">
            ${planta.familia ? `<span class="planta-badge-familia">${planta.familia}</span>` : ''}
            <h3 class="planta-card-title">${planta.nombre}</h3>
            ${cientifico ? `<p class="planta-card-especie"><em>${cientifico}</em></p>` : ''}
            ${planta.placa ? `<span class="planta-card-placa">Placa ${planta.placa}</span>` : ''}
          </div>

          ${planta.nombres_comunes ? `
            <p class="planta-card-alt-names">
              <strong>Nombres comunes:</strong> ${planta.nombres_comunes}
            </p>
          ` : ''}

          ${planta.descripcion ? `
            <div class="planta-card-desc">
              <p>${planta.descripcion}</p>
            </div>
          ` : ''}

          <!-- Los usos y la ficha técnica completa se ven en el álbum -->
          <button onclick="window.albumHandler.openPlantFromMap('${planta.codigoQR}')"
                  class="btn-desbloquear-popup btn-ver-mas-popup">
            📖 Ver más información
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Crear marcador en el mapa para una planta
   */
  createPlantMarker(planta) {
    // true = Bloqueado (requiere QR), false = Desbloqueado
    const isUnlocked = !planta.bloqueado || unlocker.isUnlocked(planta.codigoQR);

    // Terracota (tierra amazónica) si desbloqueado, gris si bloqueado.
    // No se usa verde porque se confunde con los árboles dibujados en la imagen del mapa;
    // el borde blanco separa el punto del fondo.
    const color = isUnlocked ? '#C2571A' : '#999';

    const marker = L.circleMarker(planta.punto, {
      color: '#ffffff',
      fillColor: color,
      fillOpacity: isUnlocked ? 0.95 : 0.6,
      radius: isUnlocked ? 9 : 6,
      weight: isUnlocked ? 2.5 : 1.5
    }).bindPopup(() => this.getPlantHTML(planta.codigoQR), {
      maxWidth: 360,
      minWidth: 280,
      className: 'planta-leaflet-popup'
    });

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
window.plantsHandler = plantsHandler; // el álbum lo usa para formatear los usos

// Escuchar actualización de foto o de favorito para refrescar el popup del mapa si está abierto
const refrescarPopupAbierto = (e) => {
  const { codigoQR } = e.detail;
  if (plantsHandler && plantsHandler.markers && plantsHandler.markers[codigoQR]) {
    const marker = plantsHandler.markers[codigoQR];
    if (marker.isPopupOpen && marker.isPopupOpen()) {
      marker.setPopupContent(plantsHandler.getPlantHTML(codigoQR));
    }
  }
};
document.addEventListener('treePhotoUpdated', refrescarPopupAbierto);
document.addEventListener('favoritesUpdated', refrescarPopupAbierto);
