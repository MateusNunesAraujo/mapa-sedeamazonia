/**
 * favorites.js
 * Sistema de "árbol favorito": guarda en el dispositivo los códigos QR de los árboles
 * marcados con el corazón y avisa al mapa y al álbum cuando cambian.
 */

class FavoritesStore {
  constructor() {
    this.storageKey = 'arbolesFavoritos';
    this.favoritos = new Set(this.load());
  }

  /**
   * Leer favoritos guardados (localStorage puede no estar disponible)
   */
  load() {
    try {
      const data = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn('⚠️ No se pudieron leer los favoritos:', error);
      return [];
    }
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify([...this.favoritos]));
    } catch (error) {
      console.warn('⚠️ No se pudieron guardar los favoritos:', error);
    }
  }

  isFavorite(codigoQR) {
    return this.favoritos.has(codigoQR);
  }

  /**
   * Marcar o desmarcar un árbol y notificar a la interfaz
   */
  toggle(codigoQR) {
    if (this.favoritos.has(codigoQR)) {
      this.favoritos.delete(codigoQR);
    } else {
      this.favoritos.add(codigoQR);
    }
    this.save();

    const favorito = this.favoritos.has(codigoQR);
    document.dispatchEvent(new CustomEvent('favoritesUpdated', { detail: { codigoQR, favorito } }));
    return favorito;
  }

  /**
   * HTML del botón de corazón. `className` define su posición (popup o tarjeta del álbum)
   */
  buttonHTML(codigoQR, className) {
    const favorito = this.isFavorite(codigoQR);
    const etiqueta = favorito ? 'Quitar de favoritos' : 'Marcar como favorito';
    return `
      <button class="${className} btn-favorito ${favorito ? 'is-fav' : ''}"
              onclick="event.stopPropagation(); window.favorites.toggle('${codigoQR}')"
              title="${etiqueta}" aria-label="${etiqueta}" aria-pressed="${favorito}">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.4.7-1.3 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" />
        </svg>
      </button>
    `;
  }
}

window.favorites = new FavoritesStore();
