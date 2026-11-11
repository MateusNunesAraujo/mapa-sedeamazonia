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

/* Solo para entorno de prueba */
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
// Edificios planeados: ocultos hasta activar su filtro, y no dependen del modo plantas
const edificiosFuturosLayer = L.layerGroup();
const futurosBtn = document.getElementById("futurosBtn");
// Sendero ecológico: oculto hasta activar su filtro, también independiente del modo plantas
const senderoLayer = L.layerGroup();
const estacionesLayer = L.layerGroup();
const senderoBtn = document.getElementById("senderoBtn");
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
      color: "#616161",
      fillColor: "#9e9e9e",
      fillOpacity: 0.6,
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

  // Un edificio futuro elegido desde el buscador debe verse aunque el filtro esté apagado
  if (lugar.estado === "planeado") {
    futurosBtn.checked = true;
    mostrarEdificiosFuturos(true);
  }

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

// Función para mostrar detalles del edificio seleccionado
function mostrarDetalle(lugar) {
  const fotoUrl = lugar.foto ? `/static/fotos/${lugar.foto}` : null;

  detailPhoto.innerHTML = fotoUrl
    ? `<img src="${fotoUrl}" alt="${lugar.nombre}">`
    : "📷";

  detailTitle.textContent = lugar.nombre;
  detailDescription.textContent =
    lugar.descripcion || "Sin descripción disponible.";

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

  // Botón "Ver en 3D" solo para edificios que tienen modelo (campo "modelo3d" en edifcios.json)
  const ver3DBtn = document.getElementById("detailVer3DBtn");
  if (ver3DBtn) {
    if (lugar.modelo3d && window.abrirVisor3D) {
      ver3DBtn.style.display = "inline-flex";
      ver3DBtn.onclick = () => window.abrirVisor3D({
        src: `/static/modelos/${lugar.modelo3d}`,
        nombre: lugar.nombre,
        lugar: lugar.nombre,
      });
    } else {
      ver3DBtn.style.display = "none";
      ver3DBtn.onclick = null;
    }
  }
  // Botón "Caminar": recorrido a pie en primera persona por el modelo
  const recorrerBtn = document.getElementById("detailRecorrerBtn");
  if (recorrerBtn) {
    if (lugar.modelo3d) {
      recorrerBtn.style.display = "inline-flex";
      // Se camina por el mundo con todos los edificios, empezando frente a este
      recorrerBtn.onclick = () => window.abrirRecorrido && window.abrirRecorrido({
        nombre: lugar.nombre,
        inicio: lugar.nombre,
      });
    } else {
      recorrerBtn.style.display = "none";
      recorrerBtn.onclick = null;
    }
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

// Menú lateral: agrupa álbum, mapa 3D y notificaciones, y se despliega desde el borde derecho.
// Cada opción conserva su id original, así que su lógica sigue en album-handler.js, recorrido.js y aquí.
const menuBtn = document.getElementById("menuBtn");
const menuLateral = document.getElementById("menuLateral");
const menuLateralFondo = document.getElementById("menuLateralFondo");
const menuLateralCerrar = document.getElementById("menuLateralCerrar");
const menuBadge = document.getElementById("menuBadge");

// El punto rojo del botón del menú avisa que hay novedades dentro (álbum o notificaciones)
function actualizarPuntoMenu() {
  const hayAviso = ["albumBadge", "notificationBadge"].some((id) => {
    const punto = document.getElementById(id);
    return punto && punto.style.display !== "none";
  });
  menuBadge.style.display = hayAviso ? "block" : "none";
}

function alternarMenu(abrir, { devolverFoco = false } = {}) {
  menuLateral.inert = !abrir;
  menuLateral.setAttribute("aria-hidden", String(!abrir));
  menuLateral.classList.toggle("activo", abrir);
  menuLateralFondo.classList.toggle("activo", abrir);
  menuBtn.setAttribute("aria-expanded", String(abrir));
  menuBtn.setAttribute("aria-label", abrir ? "Cerrar menú" : "Abrir menú");

  if (abrir) {
    // Dentro del menú ya se ven los puntos de cada opción
    menuBadge.style.display = "none";
    menuLateral.querySelector(".menu-item")?.focus();
  } else {
    actualizarPuntoMenu();
    if (devolverFoco) menuBtn.focus();
  }
}

const menuAbierto = () => menuLateral.classList.contains("activo");

menuBtn.addEventListener("click", () => alternarMenu(!menuAbierto(), { devolverFoco: true }));
menuLateralCerrar.addEventListener("click", () => alternarMenu(false, { devolverFoco: true }));
menuLateralFondo.addEventListener("click", () => alternarMenu(false, { devolverFoco: true }));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && menuAbierto()) alternarMenu(false, { devolverFoco: true });
});

// Al elegir una opción el menú se cierra para dejar ver lo que se abrió
menuLateral.querySelectorAll(".menu-item").forEach((opcion) => {
  opcion.addEventListener("click", () => alternarMenu(false));
});

// Opciones del menú que aún no existen (data-proximamente): muestran qué habrá en ellas
menuLateral.querySelectorAll(".menu-item[data-proximamente]").forEach((opcion) => {
  opcion.addEventListener("click", () => {
    Swal.fire({
      title: opcion.querySelector("strong").textContent,
      text: opcion.dataset.proximamente,
      footer: "Próximamente",
      icon: "info",
      iconColor: "#03A65A",
      confirmButtonText: "Entendido",
      confirmButtonColor: "#025928",
    });
  });
});

// album-handler.js muestra su punto al desbloquear una planta; se espera un instante a que lo haga
document.addEventListener("plantUnlocked", () => setTimeout(actualizarPuntoMenu, 0));

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

// Lleva el mapa a un lugar por su nombre y abre su tarjeta (lo usa el visor 3D)
window.irALugar = function (nombre) {
  const lugar = lugares.find((l) => l.nombre.toLowerCase() === nombre.toLowerCase());
  if (!lugar) return false;
  mostrarDetalle(lugar);
  enfocarLugar(lugar);
  return true;
};

// Consumo del JSON local para offline
fetch("/data/edifcios.json")
  .then((res) => res.json())
  .then((data) => {
    lugares = data;
    let polygon;

    data.forEach((lugar) => {
      console.log(lugar);
      polygon = L.polygon(lugar.puntos, obtenerEstiloBase(lugar)).addTo(
        lugar.estado === "planeado" ? edificiosFuturosLayer : poligonosLayer,
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

// Panel deslizante de filtros
const mapFilters = document.getElementById("mapFilters");
const mapFiltersTab = document.getElementById("mapFiltersTab");

mapFiltersTab.addEventListener("click", () => {
  const abierto = mapFilters.classList.toggle("open");
  const etiqueta = abierto ? "Ocultar filtros" : "Mostrar filtros";
  mapFiltersTab.setAttribute("aria-expanded", String(abierto));
  mapFiltersTab.setAttribute("aria-label", etiqueta);
  mapFiltersTab.title = etiqueta;
});

// Filtros compartidos: todo se dibuja en el mismo SVG que los puntos de árboles, así que
// el orden importa. De abajo hacia arriba: edificios futuros, borde y relleno del sendero.
function ordenarCapasDeFondo() {
  senderoLayer.getLayers().reverse().forEach((linea) => linea.bringToBack());
  edificiosFuturosLayer.eachLayer((poligono) => poligono.bringToBack());
}

function alternarCapa(capa, visible) {
  if (visible) {
    map.addLayer(capa);
    ordenarCapasDeFondo();
  } else {
    map.removeLayer(capa);
  }
}

// Filtro de edificios futuros
function mostrarEdificiosFuturos(visible) {
  alternarCapa(edificiosFuturosLayer, visible);
}

futurosBtn.addEventListener("change", () => {
  mostrarEdificiosFuturos(futurosBtn.checked);
});

// Filtro de sendero ecológico: línea ámbar con borde café, como un camino de tierra.
// No es interactiva para no bloquear los clics sobre edificios y árboles.
senderoBtn.addEventListener("change", () => {
  alternarCapa(senderoLayer, senderoBtn.checked);
  alternarCapa(estacionesLayer, senderoBtn.checked);
});

// Pin de estación: la punta del pin queda 39px debajo de la esquina superior del ícono
// (si cambia, actualizar también transform-origin de .estacion-contenido)
function crearMarcadorEstacion({ numero, nombre, icono, punto }) {
  const imagen = `<img src="${icono}" alt="">`;
  return L.marker(punto, {
    title: `Estación ${numero}: ${nombre}`,
    alt: `Estación ${numero}: ${nombre}`,
    riseOnHover: true,
    icon: L.divIcon({
      className: "estacion-marker",
      iconSize: [32, 32],
      iconAnchor: [16, 39],
      popupAnchor: [0, -39],
      html: `<div class="estacion-contenido"><div class="estacion-pin">${imagen}</div><span class="estacion-numero">${numero}</span></div>`,
    }),
  }).bindPopup(
    `<div class="estacion-popup">
      <span class="estacion-popup-icono">${imagen}</span>
      <div>
        <small>Estación ${numero}</small>
        <strong>${nombre}</strong>
      </div>
    </div>`,
  );
}

// Con el mapa alejado (la vista inicial en celular) los pines se reducen para no amontonarse
function ajustarTamanoEstaciones() {
  map.getContainer().classList.toggle("estaciones-compactas", map.getZoom() < 0);
}
map.on("zoomend", ajustarTamanoEstaciones);
ajustarTamanoEstaciones();

fetch("/data/sendero.json")
  .then((res) => res.json())
  .then(({ tramos, estaciones }) => {
    const estilo = { interactive: false, lineCap: "round", lineJoin: "round" };
    L.polyline(tramos, { ...estilo, color: "#5B3A1A", weight: 7 }).addTo(senderoLayer);
    L.polyline(tramos, { ...estilo, color: "#F2A93B", weight: 4 }).addTo(senderoLayer);
    estaciones.forEach((estacion) => {
      crearMarcadorEstacion(estacion).addTo(estacionesLayer);
    });
    ordenarCapasDeFondo();
  })
  .catch((err) => {
    console.error(err);
  });

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
