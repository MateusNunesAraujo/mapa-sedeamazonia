// Sistemas de desbloqueo y plantas se cargan desde otros scripts
// unlock-system.js, plants-handler.js, qr-handler.js
// Inicialización del mapa de Leaflet
const map = L.map("map", {
  crs: L.CRS.Simple,
  zoomControl: false,
  minZoom: -2, // Permite alejar más la vista (zoom out)
  maxZoom: 3,  // Permite acercar más la vista (zoom in)
});

/* SOLO EN ENTORNO DE DESARROLLO  */
// Si geoman no cargó, el mapa debe seguir funcionando sin la barra de dibujo

if (map.pm) map.pm.addControls({
  position: "topleft",

  drawMarker: false,
  drawCircle: false,
  drawCircleMarker: false,
  drawPolyline: false,
  drawRectangle: false,
  drawText: false,

  drawPolygon: true,

  editMode: true,
  dragMode: true,
  removalMode: true,
});

/* -------------------------------------- */

map.on("click", function (e) {
  var lat = e.latlng.lat;
  var lng = e.latlng.lng;
  console.log(`[${lat}, ${lng}]`);
});

L.control.zoom({ position: "bottomright" }).addTo(map);

const bounds = [
  [0, 0],
  [1000, 1000],
];

const image = L.imageOverlay("/static/Mapa%20U.png", bounds).addTo(map);
map.fitBounds(bounds);

map.on("pm:create", (e) => {
  console.log(e.layer.getLatLngs()[0]);
});

// Elementos del DOM
const searchBox = document.getElementById("searchBox");
const searchResults = document.getElementById("searchResults");
const detailCard = document.getElementById("detailCard");
const closeCardBtn = document.getElementById("closeCardBtn");

// Nuevos elementos para Notificaciones y Plantas
const plantsBtn = document.getElementById("plantsBtn");
const notificationBtn = document.getElementById("notificationBtn");
const notificationSidebar = document.getElementById("notificationSidebar");
const closeSidebarBtn = document.getElementById("closeSidebarBtn");
const notificationBadge = document.getElementById("notificationBadge");

// Capas para estructuras y plantas
const poligonosLayer = L.layerGroup().addTo(map);
const plantasLayer = L.layerGroup();
let plantasCargadas = false;
let modoPlantas = false;

// Campos internos de la tarjeta de detalle
const detailPhoto = document.getElementById("detailPhoto");
const detailTitle = document.getElementById("detailTitle");
const detailDescription = document.getElementById("detailDescription");
const detailSchedule = document.getElementById("detailSchedule");
const detailRules = document.getElementById("detailRules");
const detailNews = document.getElementById("detailNews");
const sectionStory = document.getElementById("sectionStory");
const detailStory = document.getElementById("detailStory");
const storyLinkWrapper = document.getElementById("storyLinkWrapper");
const detailStoryLink = document.getElementById("detailStoryLink");
const detailStoryLinkText = document.getElementById("detailStoryLinkText");

let lugares = [];
let poligonos = {};

function obtenerEstiloBase(lugar) {
  if (lugar.estado === "planeado") {
    return {
      color: "#AFC4D9",
      fillColor: "#6C8FA8",
      fillOpacity: 0.35,
      weight: 2,
    };
  }

  return {
    color: "#2c3e50",
    fillColor: "#3498db",
    fillOpacity: 0.25,
    weight: 2,
  };
}

function enfocarLugar(lugar) {
  console.log(lugar.nombre);
  console.log(poligonos);
  console.log(poligonos[lugar.nombre.toLowerCase()]);
  const polygon = poligonos[lugar.nombre.toLowerCase()];

  if (!polygon) return;

  map.fitBounds(polygon.getBounds(), {
    padding: [50, 50],
    animate: true,
    duration: 1,
  });

  polygon.setStyle({
    color: "#ff9800",
    fillColor: "#ff9800",
    fillOpacity: 0.6,
    weight: 3,
  });

  setTimeout(() => {
    polygon.setStyle(obtenerEstiloBase(lugar));
  }, 2000);
}

searchBox.addEventListener("click", (e) => {
  detailCard.classList.remove("active");
});

// Función para mostrar detalles del lugar seleccionado
function mostrarDetalle(lugar, esPlanta = false) {
  const fotoUrl = lugar.foto ? `/static/fotos/${lugar.foto}` : null;

  // Verificar si planta está bloqueada
  // true = Bloqueado (requiere QR), false = Desbloqueado
  const isUnlocked = !esPlanta || !lugar.bloqueado || unlocker.isUnlocked(lugar.codigoQR);
  const plantaBloqueada = esPlanta && !isUnlocked;

  if (fotoUrl && !plantaBloqueada) {
    detailPhoto.innerHTML = `<img src="${fotoUrl}" alt="${lugar.nombre}">`;
  } else if (plantaBloqueada) {
    detailPhoto.innerHTML = '<div style="font-size: 4em; display: flex; align-items: center; justify-content: center; height: 200px; background: #f5f5f5;">🔒</div>';
  } else {
    detailPhoto.innerHTML = esPlanta ? "🌿" : "📷";
  }

  // Mostrar estado bloqueado o contenido normal
  if (plantaBloqueada) {
    detailTitle.textContent = '🔒 Bloqueado';
    detailDescription.textContent =
      'Escanea un código QR para desbloquear esta planta y ver su contenido completo.';
  } else {
    detailTitle.textContent = lugar.nombre;
    detailDescription.textContent =
      lugar.descripcion || "Sin descripción disponible.";
  }

  // Elementos UI de detalles
  const sectionSchedule = document.getElementById("sectionSchedule");
  const sectionRules = document.getElementById("sectionRules");
  const sectionNews = document.getElementById("sectionNews");
  const sectionScientificName = document.getElementById(
    "sectionScientificName",
  );
  const sectionUses = document.getElementById("sectionUses");

  if (esPlanta) {
    // Ocultar info de edificios
    sectionSchedule.style.display = "none";
    sectionRules.style.display = "none";
    sectionNews.style.display = "none";
    if (sectionStory) sectionStory.style.display = "none";

    // Mostrar info de plantas solo si no está bloqueada
    if (!plantaBloqueada) {
      sectionScientificName.style.display = "flex";
      document.getElementById("detailScientificName").textContent =
        lugar.nombre_cientifico || "Desconocido";

      sectionUses.style.display = "flex";
      document.getElementById("detailUses").textContent =
        lugar.usos_tradicionales || "No especificado";
    } else {
      sectionScientificName.style.display = "none";
      sectionUses.style.display = "none";
    }
  } else {
    // Mostrar info de edificios
    sectionSchedule.style.display = "flex";
    sectionRules.style.display = "flex";
    sectionNews.style.display = "flex";

    detailSchedule.textContent = lugar.horario || "No especificado";
    if (!lugar.reglas || lugar.reglas.trim() === "") {
      detailRules.textContent = "Sin reglas específicas.";
    } else {
      const lineas = lugar.reglas
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean);

      if (lineas.length > 1) {
        const ul = document.createElement("ul");
        ul.className = "detail-rules-list";
        lineas.forEach((linea) => {
          const li = document.createElement("li");
          const cleanLine = linea.replace(/^[•\-\*]\s*/, "");
          const colonIndex = cleanLine.indexOf(":");
          if (colonIndex !== -1 && colonIndex < 35) {
            const strong = document.createElement("strong");
            strong.textContent = cleanLine.substring(0, colonIndex + 1);
            li.appendChild(strong);
            li.appendChild(
              document.createTextNode(
                " " + cleanLine.substring(colonIndex + 1).trim(),
              ),
            );
          } else {
            li.textContent = cleanLine;
          }
          ul.appendChild(li);
        });
        detailRules.innerHTML = "";
        detailRules.appendChild(ul);
      } else {
        detailRules.textContent = lugar.reglas;
      }
    }
    detailNews.textContent = lugar.novedades || "Sin novedades recientes.";

    // Renderizado del apartado de Historias y Relatos
    if (sectionStory) {
      sectionStory.style.display = "block";

      let historiaTexto = "";
      let historiaLink = "";
      let historiaLinkTitulo = "Explorar historia completa";

      if (typeof lugar.historia === "string") {
        historiaTexto = lugar.historia.trim();
      } else if (lugar.historia && typeof lugar.historia === "object") {
        historiaTexto = (lugar.historia.texto || lugar.historia.descripcion || "").trim();
        if (lugar.historia.link || lugar.historia.enlace || lugar.historia.url) {
          historiaLink = (lugar.historia.link || lugar.historia.enlace || lugar.historia.url).trim();
        }
        if (lugar.historia.titulo_link || lugar.historia.titulo_enlace || lugar.historia.link_texto) {
          historiaLinkTitulo = lugar.historia.titulo_link || lugar.historia.titulo_enlace || lugar.historia.link_texto;
        }
      }

      // Enlaces definidos a nivel raíz del objeto lugar
      if (!historiaLink) {
        historiaLink = (lugar.link_historia || lugar.enlace_historia || lugar.historia_link || lugar.link || "").trim();
      }
      if (lugar.titulo_link || lugar.link_texto) {
        historiaLinkTitulo = lugar.titulo_link || lugar.link_texto;
      }

      if (detailStory) {
        if (historiaTexto) {
          detailStory.textContent = historiaTexto;
          detailStory.classList.remove("empty-story");
        } else {
          detailStory.textContent =
            "Aún no se han registrado relatos para este espacio. Pronto conocerás anécdotas y memorias de la comunidad universitaria.";
          detailStory.classList.add("empty-story");
        }
      }

      if (storyLinkWrapper && detailStoryLink) {
        if (
          historiaLink &&
          (historiaLink.startsWith("http://") ||
            historiaLink.startsWith("https://") ||
            historiaLink.startsWith("/"))
        ) {
          detailStoryLink.href = historiaLink;
          if (detailStoryLinkText) {
            detailStoryLinkText.textContent = historiaLinkTitulo;
          }
          storyLinkWrapper.style.display = "flex";
        } else {
          detailStoryLink.removeAttribute("href");
          storyLinkWrapper.style.display = "none";
        }
      }
    }

    // Ocultar info de plantas
    sectionScientificName.style.display = "none";
    sectionUses.style.display = "none";
  }

  // Aseguramos cerrar la barra de notificaciones si se abre un detalle para limpiar la pantalla
  notificationSidebar.classList.remove("active");

  detailCard.classList.add("active");
}

// Eventos de apertura y cierre para las notificaciones
notificationBtn.addEventListener("click", () => {
  notificationSidebar.classList.add("active");
  // Ocultamos el puntito rojo una vez que el usuario abre las notificaciones
  if (notificationBadge) {
    notificationBadge.style.display = "none";
  }
  // Opcional: cerrar tarjeta de detalles si estuviera abierta
  detailCard.classList.remove("active");
});

closeSidebarBtn.addEventListener("click", () => {
  notificationSidebar.classList.remove("active");
});

// Evento para cerrar la tarjeta de detalles
closeCardBtn.addEventListener("click", () => {
  detailCard.classList.remove("active");
});

// Lógica de búsqueda predictiva
function filtrarLugares() {
  const term = searchBox.value.toLowerCase().trim();

  if (term === "") {
    searchResults.classList.remove("active");
    searchResults.innerHTML = "";
    return;
  }

  const filtrados = lugares.filter((lugar) =>
    lugar.nombre.toLowerCase().includes(term),
  );

  searchResults.innerHTML = "";

  if (filtrados.length === 0) {
    searchResults.innerHTML =
      '<div class="search-no-results">No se encontraron ubicaciones</div>';
  } else {
    filtrados.forEach((lugar) => {
      const item = document.createElement("div");
      item.className = "search-result-item";
      item.innerHTML = `<span class="item-icon">📍</span> <span>${lugar.nombre}</span>`;

      item.addEventListener("click", () => {
        searchBox.value = lugar.nombre;
        searchResults.classList.remove("active");

        mostrarDetalle(lugar);
        enfocarLugar(lugar);
      });

      searchResults.appendChild(item);
    });
  }

  searchResults.classList.add("active");
}

searchBox.addEventListener("input", filtrarLugares);

// Cerrar elementos al hacer clic fuera
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-container")) {
    searchResults.classList.remove("active");
  }
  // Cerrar sidebar si se hace clic en el mapa vacío fuera del panel
  if (
    !e.target.closest("#notificationSidebar") &&
    !e.target.closest("#notificationBtn") &&
    !e.target.closest(".leaflet-container") === false
  ) {
    // Opcional: puedes habilitar cierre por clic externo en mapa descomentando la línea de abajo
    // notificationSidebar.classList.remove("active");
  }
});

// Consumo del JSON local para offline
fetch("/data/edifcios.json")
  .then((res) => res.json())
  .then((data) => {
    lugares = data;
    let polygon;

    data.forEach((lugar) => {
      console.log(lugar);
      polygon = L.polygon(lugar.puntos, obtenerEstiloBase(lugar)).addTo(
        poligonosLayer,
      );
      // Lo guardamos usando el nombre como llave
      poligonos[lugar.nombre.toLowerCase()] = polygon;

      polygon.on("click", () => {
        mostrarDetalle(lugar);
        enfocarLugar(lugar);
      });
    });
  })
  .catch((err) => {
    console.error(err);
  });

/**
 * Actualizar display de plantas (llamado después de desbloquear)
 */
async function actualizarPlantas() {
  if (!modoPlantas) return;

  // Limpiar capa
  plantasLayer.clearLayers();

  // Recargar plantas con estado actualizado
  await plantsHandler.loadPlants();
  plantsHandler.addAllPlantsToMap(plantasLayer);

  console.log('✅ Plantas actualizadas con nuevos desbloqueos');
}

// Lógica de Modo Plantas
plantsBtn.addEventListener("click", async () => {
  modoPlantas = !modoPlantas;

  if (modoPlantas) {
    // Activar modo
    plantsBtn.classList.add("active");
    map.removeLayer(poligonosLayer);
    map.addLayer(plantasLayer);

    // Limpiar capa y cargar plantas frescas
    plantasLayer.clearLayers();
    await plantsHandler.loadPlants();
    plantsHandler.addAllPlantsToMap(plantasLayer);
    plantasCargadas = true;
  } else {
    // Desactivar modo
    plantsBtn.classList.remove("active");
    map.removeLayer(plantasLayer);
    map.addLayer(poligonosLayer);
  }
});


/**
 * Enfocar planta tras escaneo QR
 */
window.enfocarPlantaQR = async function (codigoQR) {
  // Asegurarnos de estar en modo plantas
  if (!modoPlantas) {
    modoPlantas = true;
    plantsBtn.checked = true; // Activa el interruptor visualmente

    // Cambiar las capas del mapa
    map.removeLayer(poligonosLayer);
    map.addLayer(plantasLayer);

    // Cargar y pintar las plantas (incluyendo la recién desbloqueada)
    await actualizarPlantas();
    plantasCargadas = true;

    // Esperamos un breve momento para que se rendericen en el mapa
    await new Promise(r => setTimeout(r, 100));
  } else {
    // Si ya estaba en modo plantas, actualizamos los marcadores para que se pinte de verde
    await actualizarPlantas();
  }

  // Buscar la planta completa en el handler
  const planta = plantsHandler.plantas.find(p => p.codigoQR === codigoQR);
  if (!planta) return;

  // Cerrar el modal del escáner
  if (window.qrHandler) {
    window.qrHandler.closeModal();
  }

  // Centrar el mapa con animación fluida
  map.flyTo(planta.punto, 2, {
    animate: true,
    duration: 1.5
  });

  // Mostrar el popup de estilo diálogo de Leaflet
  setTimeout(() => {
    if (plantsHandler.markers && plantsHandler.markers[codigoQR]) {
      plantsHandler.markers[codigoQR].openPopup();
    }
  }, 500);
}

/**
 * Manejador de botón QR
 * Abre modal de escaneo usando qrHandler (en qr-handler.js)
 */
const scanQRBtn = document.getElementById('scanQRBtn');
if (scanQRBtn) {
  scanQRBtn.addEventListener('click', () => {
    window.qrHandler.openScanner();
  });
}


// Ocultar el Splash Screen después de que cargue la app (desvanecer hacia la izquierda)
window.addEventListener("load", () => {
  setTimeout(() => {
    const splash = document.getElementById("splash-screen");
    if (splash) {
      splash.classList.add("hidden");
      setTimeout(() => splash.remove(), 1200);
    }
  }, 2000); // 2 segundos de visualización
});
