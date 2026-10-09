/**
 * album-handler.js
 * Módulo para el Álbum / Herbario de Árboles Recolectados
 * Gestión de catálogo, filtros dinámicos, grid de 2 columnas y vista de detalle minimalista.
 */

class AlbumHandler {
  constructor() {
    this.plantas = [];
    this.filteredPlantas = [];
    this.currentSelectedPlant = null;

    // Elementos DOM
    this.modal = null;
    this.detailModal = null;
    this.grid = null;
    this.albumBtn = null;
    this.albumBadge = null;

    // Filtros
    this.searchInput = null;
    this.filterFamilia = null;
    this.filterEspecie = null;
    this.filterUso = null;
    this.filterEstado = null;
    this.emptyState = null;

    // Contadores
    this.counterText = null;
    this.progressBar = null;

    this.initialized = false;
  }

  /**
   * Inicialización del módulo
   */
  init() {
    if (this.initialized) return;

    this.modal = document.getElementById('albumModal');
    this.detailModal = document.getElementById('treeDetailModal');
    this.grid = document.getElementById('albumGrid');
    this.albumBtn = document.getElementById('albumBtn');
    this.albumBadge = document.getElementById('albumBadge');

    this.searchInput = document.getElementById('albumSearchInput');
    this.filterFamilia = document.getElementById('albumFilterFamilia');
    this.filterEspecie = document.getElementById('albumFilterEspecie');
    this.filterUso = document.getElementById('albumFilterUso');
    this.filterEstado = document.getElementById('albumFilterEstado');
    this.emptyState = document.getElementById('albumEmptyState');

    this.counterText = document.getElementById('albumCounterText');
    this.progressBar = document.getElementById('albumProgressBarFill');

    this.bindEvents();
    this.initialized = true;
    console.log('🌿 Álbum de Árboles Recolectados inicializado');
  }

  /**
   * Vinculación de eventos de la interfaz
   */
  bindEvents() {
    // Botón principal de la barra superior
    if (this.albumBtn) {
      this.albumBtn.addEventListener('click', () => {
        this.openAlbum();
      });
    }

    // Filtros en tiempo real
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => this.applyFilters());
    }
    if (this.filterFamilia) {
      this.filterFamilia.addEventListener('change', () => this.applyFilters());
    }
    if (this.filterEspecie) {
      this.filterEspecie.addEventListener('change', () => this.applyFilters());
    }
    if (this.filterUso) {
      this.filterUso.addEventListener('change', () => this.applyFilters());
    }
    if (this.filterEstado) {
      this.filterEstado.addEventListener('change', () => this.applyFilters());
    }

    // Flecha para mostrar/ocultar los filtros
    this.filtersToggle = document.getElementById('albumFiltersToggle');
    this.filtersPanel = document.getElementById('albumFiltersCollapsible');
    if (this.filtersToggle && this.filtersPanel) {
      this.filtersToggle.addEventListener('click', () => {
        const open = this.filtersPanel.classList.toggle('open');
        this.filtersToggle.setAttribute('aria-expanded', String(open));
        this.filtersToggle.title = open ? 'Ocultar filtros' : 'Mostrar filtros';
      });
    }

    // Botón para resetear filtros
    const resetBtn = document.getElementById('albumResetFiltersBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetFilters());
    }

    // Botón de cierre del modal principal
    const closeBtn = document.getElementById('albumCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeAlbum());
    }

    // Botón para volver desde el detalle al álbum
    const backBtn = document.getElementById('treeDetailBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.closeDetail());
    }

    // Botón de cierre en el modal de detalle
    const closeDetailBtn = document.getElementById('treeDetailCloseBtn');
    if (closeDetailBtn) {
      closeDetailBtn.addEventListener('click', () => this.closeDetail());
    }

    // Cerrar al hacer clic en el backdrop
    window.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeAlbum();
      }
      if (e.target === this.detailModal) {
        this.closeDetail();
      }
    });

    // Cerrar con Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.lightbox && this.lightbox.classList.contains('show')) {
          this.closeLightbox();
        } else if (this.detailModal && this.detailModal.classList.contains('show')) {
          this.closeDetail();
        } else if (this.modal && this.modal.classList.contains('show')) {
          this.closeAlbum();
        }
      }
    });

    // Escuchar evento cuando se desbloquea una nueva planta
    document.addEventListener('plantUnlocked', (e) => {
      if (this.albumBadge) {
        this.albumBadge.style.display = 'block';
      }
      // Si el modal está abierto, refrescar datos
      if (this.modal && this.modal.classList.contains('show')) {
        this.loadAndRender();
      }
    });

    // Al marcar o quitar un favorito, re-aplicar filtros (el filtro de favoritos puede cambiar el resultado)
    document.addEventListener('favoritesUpdated', () => {
      if (this.modal && this.modal.classList.contains('show')) {
        this.applyFilters();
      }
    });

    // Escuchar cuando se actualiza la foto de un árbol
    document.addEventListener('treePhotoUpdated', (e) => {
      // Refrescar el grid si el modal está abierto
      if (this.modal && this.modal.classList.contains('show')) {
        this.renderGrid();
      }
      // Refrescar el detalle si está abierto y corresponde a la misma planta
      if (this.currentSelectedPlant && this.currentSelectedPlant.codigoQR === e.detail.codigoQR) {
        this.renderDetail(this.currentSelectedPlant);
      }
    });
  }

  /**
   * Abre la ventana del álbum
   */
  async openAlbum() {
    if (this.albumBadge) {
      this.albumBadge.style.display = 'none';
    }

    if (this.modal) {
      this.modal.classList.add('show');
      document.body.style.overflow = 'hidden';
    }

    await this.loadAndRender();
  }

  /**
   * Cierra la ventana del álbum
   */
  closeAlbum() {
    if (this.modal) {
      this.modal.classList.remove('show');
    }
    document.body.style.overflow = '';
  }

  /**
   * Abre el modal de detalle de un árbol
   */
  openDetail(planta) {
    this.currentSelectedPlant = planta;
    this.renderDetail(planta);

    if (this.detailModal) {
      this.detailModal.classList.add('show');
    }
  }

  /**
   * Abre el álbum directamente en la ficha de un árbol (botón "Ver más información" del mapa)
   */
  async openPlantFromMap(codigoQR) {
    // `map` es la constante global declarada en index.js (no está en window)
    if (typeof map !== 'undefined') map.closePopup();
    await this.openAlbum();
    const planta = this.plantas.find(p => p.codigoQR === codigoQR);
    if (planta) this.openDetail(planta);
  }

  /**
   * Cierra el modal de detalle
   */
  closeDetail() {
    this.closeLightbox();
    if (this.detailModal) {
      this.detailModal.classList.remove('show');
    }
    this.currentSelectedPlant = null;
  }

  /**
   * Muestra la foto del detalle ampliada a pantalla completa
   */
  openLightbox(src, alt = '') {
    if (!src) return;

    if (!this.lightbox) {
      this.lightbox = document.createElement('div');
      this.lightbox.className = 'photo-lightbox';
      this.lightbox.setAttribute('role', 'dialog');
      this.lightbox.setAttribute('aria-modal', 'true');
      this.lightbox.innerHTML = `
        <button type="button" class="photo-lightbox-close" aria-label="Cerrar imagen">&times;</button>
        <img class="photo-lightbox-img" alt="">
      `;
      // Cualquier clic (fondo, imagen o botón) cierra el visor
      this.lightbox.addEventListener('click', () => this.closeLightbox());
      document.body.appendChild(this.lightbox);
    }

    const img = this.lightbox.querySelector('.photo-lightbox-img');
    img.src = src;
    img.alt = alt;
    this.lightbox.classList.add('show');
  }

  /**
   * Cierra el visor de foto ampliada
   */
  closeLightbox() {
    if (this.lightbox) {
      this.lightbox.classList.remove('show');
    }
  }

  /**
   * Carga las plantas actualizadas y refresca la vista
   */
  async loadAndRender() {
    if (window.plantsHandler) {
      this.plantas = await window.plantsHandler.loadPlants();
    } else {
      try {
        const res = await fetch(`/data/plantas.json?t=${Date.now()}`);
        this.plantas = await res.json();
      } catch (err) {
        console.error('Error cargando plantas en Álbum:', err);
        this.plantas = [];
      }
    }

    this.populateFilterOptions();
    this.updateProgressCounter();
    this.applyFilters();
  }

  /**
   * Actualiza el contador de plantas recolectadas y la barra de progreso
   */
  updateProgressCounter() {
    const total = this.plantas.length;
    if (total === 0) return;

    let unlockedCount = 0;
    this.plantas.forEach(p => {
      const isUnlocked = !p.bloqueado || (window.unlocker && window.unlocker.isUnlocked(p.codigoQR));
      if (isUnlocked) unlockedCount++;
    });

    const percent = Math.round((unlockedCount / total) * 100);

    if (this.counterText) {
      this.counterText.innerHTML = `Recolectados: <strong>${unlockedCount}</strong> de <strong>${total}</strong> especies (${percent}%)`;
    }

    if (this.progressBar) {
      this.progressBar.style.width = `${percent}%`;
    }
  }

  /**
   * Puebla dinámicamente los selectores de familias, especies y usos
   */
  populateFilterOptions() {
    const selectedFamilia = this.filterFamilia ? this.filterFamilia.value : '';
    const selectedEspecie = this.filterEspecie ? this.filterEspecie.value : '';
    const selectedUso = this.filterUso ? this.filterUso.value : '';

    const familias = new Set();
    const especies = new Set();
    const usos = new Set();

    this.plantas.forEach(p => {
      if (p.familia && p.familia.trim()) {
        familias.add(p.familia.trim());
      }
      const esp = p.especie || p.nombre_cientifico;
      if (esp && esp.trim()) {
        especies.add(esp.trim());
      }

      // Extraer usos
      if (p.usos && typeof p.usos === 'object' && !Array.isArray(p.usos)) {
        Object.keys(p.usos).forEach(u => {
          if (u && u.trim()) usos.add(u.trim());
        });
      } else if (Array.isArray(p.usos)) {
        p.usos.forEach(item => {
          if (typeof item === 'string') {
            const colon = item.indexOf(':');
            const cat = colon !== -1 ? item.substring(0, colon).trim() : item.trim();
            if (cat) usos.add(cat);
          } else if (item && typeof item === 'object') {
            const cat = item.titulo || item.tipo || item.nombre;
            if (cat) usos.add(cat.trim());
          }
        });
      }
    });

    // Rellenar familias
    if (this.filterFamilia) {
      const sortedFamilias = Array.from(familias).sort((a, b) => a.localeCompare(b));
      this.filterFamilia.innerHTML = '<option value="">Todas las familias</option>' +
        sortedFamilias.map(f => `<option value="${f}">${f}</option>`).join('');
      this.filterFamilia.value = sortedFamilias.includes(selectedFamilia) ? selectedFamilia : '';
    }

    // Rellenar especies
    if (this.filterEspecie) {
      const sortedEspecies = Array.from(especies).sort((a, b) => a.localeCompare(b));
      this.filterEspecie.innerHTML = '<option value="">Todas las especies</option>' +
        sortedEspecies.map(e => `<option value="${e}">${e}</option>`).join('');
      this.filterEspecie.value = sortedEspecies.includes(selectedEspecie) ? selectedEspecie : '';
    }

    // Rellenar usos
    if (this.filterUso) {
      const sortedUsos = Array.from(usos).sort((a, b) => a.localeCompare(b));
      this.filterUso.innerHTML = '<option value="">Todos los usos</option>' +
        sortedUsos.map(u => `<option value="${u}">${u}</option>`).join('');
      this.filterUso.value = sortedUsos.includes(selectedUso) ? selectedUso : '';
    }
  }

  /**
   * Resetea todos los filtros aplicados
   */
  resetFilters() {
    if (this.searchInput) this.searchInput.value = '';
    if (this.filterFamilia) this.filterFamilia.value = '';
    if (this.filterEspecie) this.filterEspecie.value = '';
    if (this.filterUso) this.filterUso.value = '';
    if (this.filterEstado) this.filterEstado.value = 'todos';
    this.applyFilters();
  }

  /**
   * Aplica los filtros seleccionados a la lista de plantas
   */
  applyFilters() {
    const searchText = this.searchInput ? this.searchInput.value.trim().toLowerCase() : '';
    const selectedFamilia = this.filterFamilia ? this.filterFamilia.value.trim().toLowerCase() : '';
    const selectedEspecie = this.filterEspecie ? this.filterEspecie.value.trim().toLowerCase() : '';
    const selectedUso = this.filterUso ? this.filterUso.value.trim().toLowerCase() : '';
    const estado = this.filterEstado ? this.filterEstado.value : 'todos';

    // Marcar la flecha si hay filtros aplicados (visible con el panel cerrado)
    if (this.filtersToggle) {
      const hasActive = !!(selectedFamilia || selectedEspecie || selectedUso || estado !== 'todos');
      this.filtersToggle.classList.toggle('has-active', hasActive);
    }

    this.filteredPlantas = this.plantas.filter(planta => {
      const isUnlocked = !planta.bloqueado || (window.unlocker && window.unlocker.isUnlocked(planta.codigoQR));

      // Filtro por estado de desbloqueo
      if (estado === 'desbloqueados' && !isUnlocked) return false;
      if (estado === 'bloqueados' && isUnlocked) return false;
      if (estado === 'favoritos' && !(window.favorites && window.favorites.isFavorite(planta.codigoQR))) return false;

      // Filtro por Familia
      if (selectedFamilia) {
        const fam = (planta.familia || '').trim().toLowerCase();
        if (fam !== selectedFamilia) return false;
      }

      // Filtro por Especie
      if (selectedEspecie) {
        const esp = (planta.especie || planta.nombre_cientifico || '').trim().toLowerCase();
        if (esp !== selectedEspecie) return false;
      }

      // Filtro por Uso
      if (selectedUso) {
        let hasUso = false;
        if (planta.usos && typeof planta.usos === 'object' && !Array.isArray(planta.usos)) {
          hasUso = Object.keys(planta.usos).some(k => k.trim().toLowerCase() === selectedUso);
        } else if (Array.isArray(planta.usos)) {
          hasUso = planta.usos.some(item => {
            if (typeof item === 'string') {
              return item.toLowerCase().includes(selectedUso);
            }
            if (item && typeof item === 'object') {
              const titulo = (item.titulo || item.tipo || item.nombre || '').toLowerCase();
              return titulo === selectedUso;
            }
            return false;
          });
        }
        if (!hasUso) return false;
      }

      // Búsqueda por texto (nombre, científico, común, familia)
      if (searchText) {
        const nombre = (planta.nombre || '').toLowerCase();
        const comun = (planta.nombres_comunes || '').toLowerCase();
        const cientifico = (planta.nombre_cientifico || planta.especie || '').toLowerCase();
        const familia = (planta.familia || '').toLowerCase();

        const match = nombre.includes(searchText) ||
          comun.includes(searchText) ||
          cientifico.includes(searchText) ||
          familia.includes(searchText);

        if (!match) return false;
      }

      return true;
    });

    this.renderGrid();
  }

  /**
   * Renderiza el grid de 2 columnas con solo foto y nombre
   */
  renderGrid() {
    if (!this.grid) return;

    this.grid.innerHTML = '';

    if (this.filteredPlantas.length === 0) {
      if (this.emptyState) this.emptyState.style.display = 'flex';
      return;
    }

    if (this.emptyState) this.emptyState.style.display = 'none';

    this.filteredPlantas.forEach(planta => {
      const isUnlocked = !planta.bloqueado || (window.unlocker && window.unlocker.isUnlocked(planta.codigoQR));
      const card = document.createElement('div');
      card.className = `album-tree-card ${isUnlocked ? 'unlocked' : 'locked'}`;
      card.setAttribute('data-qr', planta.codigoQR);

      // Foto tomada por el usuario tiene prioridad sobre la foto por defecto del JSON
      const finalPhotoSrc = window.photoStorage ? window.photoStorage.getDisplayPhoto(planta) : null;

      const photoHTML = finalPhotoSrc ? `
        <img src="${finalPhotoSrc}" alt="${planta.nombre}" class="album-card-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="album-card-img-placeholder" style="display: none;">
          <span class="album-card-icon">${isUnlocked ? '🌿' : '🔒'}</span>
        </div>
      ` : `
        <div class="album-card-img-placeholder">
          <span class="album-card-icon">${isUnlocked ? '🌿' : '🔒'}</span>
        </div>
      `;

      // Botón de favorito en la esquina superior derecha (SOLO para árboles desbloqueados)
      const favoritoBtnHTML = isUnlocked ? window.favorites.buttonHTML(planta.codigoQR, 'album-btn-favorito') : '';

      // Cada carta es una foto "pegada" con esquineros y un rótulo con el nombre debajo
      const displayName = isUnlocked ? planta.nombre : 'Espécimen Bloqueado';

      card.innerHTML = `
        <div class="album-photo-mount">
          <div class="album-card-media">
            ${photoHTML}
          </div>
          <span class="album-photo-corner tl" aria-hidden="true"></span>
          <span class="album-photo-corner tr" aria-hidden="true"></span>
          <span class="album-photo-corner bl" aria-hidden="true"></span>
          <span class="album-photo-corner br" aria-hidden="true"></span>
          ${!isUnlocked ? '<div class="album-card-locked-badge"><span class="lock-icon">🔒</span></div>' : favoritoBtnHTML}
        </div>
        <button type="button" class="album-card-info" aria-label="Ver información de ${displayName}">
          <h3 class="album-card-name" title="${displayName}">${displayName}</h3>
          <span class="album-card-hint">${isUnlocked ? 'Ver ficha ›' : 'Bloqueado'}</span>
        </button>
      `;

      // Clic en la foto o en el rótulo del nombre para abrir el detalle
      card.addEventListener('click', () => {
        if (isUnlocked) {
          this.openDetail(planta);
        } else {
          Swal.fire({
            title: 'Espécimen Bloqueado',
            text: `Escanea el código QR de "${planta.nombre}" en el campus para desbloquear su ficha completa en tu herbario.`,
            icon: 'info',
            confirmButtonColor: '#2e7d32',
            confirmButtonText: 'Entendido'
          });
        }
      });

      this.grid.appendChild(card);
    });
  }

  /**
   * Renderiza el contenido del modal de detalle ampliado
   * Diseño minimalista: foto al principio, nombre, familia/especie, descripción y espacio adicional
   */
  renderDetail(planta) {
    const photoEl = document.getElementById('detailPlantPhotoContainer');
    const nameEl = document.getElementById('detailPlantName');
    const badgesEl = document.getElementById('detailPlantBadges');
    const sectionsEl = document.getElementById('detailPlantSections');

    if (!planta) return;

    // Foto superior
    if (photoEl) {
      const isUnlocked = !planta.bloqueado || (window.unlocker && window.unlocker.isUnlocked(planta.codigoQR));
      const photoSrc = window.photoStorage ? window.photoStorage.getDisplayPhoto(planta) : null;

      const cameraBtnDetail = isUnlocked ? `
        <button class="detail-btn-camera-capture" 
                onclick="event.stopPropagation(); window.photoStorage.promptCapture('${planta.codigoQR}')" 
                title="Tomar o cambiar foto de este árbol" 
                aria-label="Tomar foto del árbol">
          📷 <span class="camera-btn-text">Tomar foto</span>
        </button>
      ` : '';

      photoEl.innerHTML = photoSrc ? `
        <img src="${photoSrc}" alt="${planta.nombre}" class="detail-hero-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="detail-hero-placeholder" style="display: none;">
          <span class="detail-placeholder-icon">🌳</span>
          <p>Fotografía de espécimen botánico</p>
        </div>
        ${cameraBtnDetail}
      ` : `
        <div class="detail-hero-placeholder">
          <span class="detail-placeholder-icon">🌳</span>
          <p>Fotografía en proceso de catalogación</p>
        </div>
        ${cameraBtnDetail}
      `;

      // Clic en la foto del detalle para verla ampliada
      const heroImg = photoEl.querySelector('.detail-hero-img');
      if (heroImg) {
        heroImg.title = 'Toca para ampliar';
        heroImg.addEventListener('click', () => this.openLightbox(heroImg.src, planta.nombre));
      }
    }

    // Nombre de la planta
    if (nameEl) {
      nameEl.textContent = planta.nombre;
    }

    // Familia y especie (chips/badges estilizados)
    if (badgesEl) {
      const cientifico = planta.especie || planta.nombre_cientifico || '';
      badgesEl.innerHTML = `
        ${planta.familia ? `<span class="detail-chip detail-chip-family">Familia: <strong>${planta.familia}</strong></span>` : ''}
        ${cientifico ? `<span class="detail-chip detail-chip-species">Especie: <em>${cientifico}</em></span>` : ''}
        ${planta.placa ? `<span class="detail-chip detail-chip-placa">Placa: <strong>${planta.placa}</strong></span>` : ''}
      `;
    }

    // Secciones de la ficha en orden: nombres comunes, descripción botánica,
    // distribución y ecología, usos (ficha técnica) y categorías de uso (placa)
    if (sectionsEl) {
      const ficha = planta.ficha || {};
      const parrafos = (lista) => lista.map(p => `<p>${p}</p>`).join('');
      const conTexto = (lista) => Array.isArray(lista) && lista.length > 0;
      const deTexto = (texto) => (texto && texto.trim() ? [texto.trim()] : []);

      const secciones = [];
      const agregar = (titulo, contenido) => {
        if (contenido) secciones.push({ titulo, contenido });
      };

      // Si no hay ficha técnica se usa la información corta de la placa
      const comunes = conTexto(ficha.nombres_comunes) ? ficha.nombres_comunes : deTexto(planta.nombres_comunes);
      const descripcion = conTexto(ficha.descripcion_botanica) ? ficha.descripcion_botanica : deTexto(planta.descripcion);

      agregar('Nombres comunes', conTexto(comunes) && parrafos(comunes));
      agregar('Descripción botánica', conTexto(descripcion)
        ? parrafos(descripcion)
        : '<p class="detail-text-empty">Sin descripción registrada por el momento para este espécimen.</p>');
      agregar('Distribución y ecología', conTexto(ficha.distribucion_ecologia) && parrafos(ficha.distribucion_ecologia));
      agregar('Usos (ficha técnica)', conTexto(ficha.usos) && parrafos(ficha.usos));

      const usosCategorias = window.plantsHandler ? window.plantsHandler.formatearUsos(planta) : [];
      agregar('Categorías de uso', usosCategorias.length > 0 && `
        <ul class="planta-usos-lista detail-usos-lista">
          ${usosCategorias.map(u => `
            <li class="planta-uso-item">
              <strong class="planta-uso-titulo">${u.titulo}:</strong> <span class="planta-uso-texto">${u.texto}</span>
            </li>
          `).join('')}
        </ul>
        ${planta.nota_usos ? `<p class="detail-uses-note">* ${planta.nota_usos}</p>` : ''}
      `);

      sectionsEl.innerHTML = secciones.map(({ titulo, contenido }) => `
        <div class="detail-section">
          <h4 class="detail-section-title">${titulo}</h4>
          <div class="detail-description-text">${contenido}</div>
        </div>
      `).join('');
    }
  }
}

// Instancia global
window.albumHandler = new AlbumHandler();

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.albumHandler.init());
} else {
  window.albumHandler.init();
}
