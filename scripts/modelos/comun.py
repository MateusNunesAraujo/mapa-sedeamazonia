"""Piezas compartidas por los generadores de modelos 3D (sin dependencias externas).

- Escena: junta cajas y polígonos por material, los puede colocar/girar en el mundo
  y escribe el .glb.
- Conversión de coordenadas del mapa (data/edifcios.json) a metros.
- Estilo común de los bloques de la sede: medidas, techo a dos aguas y cielo raso.

Ejes del mundo (como three.js): X = este, Y = arriba, Z = sur.
Cada edificio se arma en su sistema local con el frente hacia +Z y luego se gira.
"""
import json
import math
import struct
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]

# ---------------- Mapa -> metros ----------------
# La imagen del mapa (2017 x 2799 px) está estirada a un cuadro de 1000 x 1000 unidades,
# por eso una unidad no mide lo mismo en vertical (lat) que en horizontal (lng).
# Escala sacada de la cancha de baloncesto del plano (28 x 15 m): ~5,68 px por metro.
PX_POR_M = 5.68
M_POR_LAT = 2799 / 1000 / PX_POR_M   # ~0,49 m por unidad vertical
M_POR_LNG = 2017 / 1000 / PX_POR_M   # ~0,36 m por unidad horizontal
# Origen del mundo: centro del Auditorio en el mapa (para que los números queden pequeños)
LAT0, LNG0 = 147.8, 668.2


def a_metros(lat, lng):
    """Punto del mapa [lat, lng] -> (x, z) en metros."""
    return (lng - LNG0) * M_POR_LNG, -(lat - LAT0) * M_POR_LAT


def huella(nombre):
    """Rectángulo (lat_min, lat_max, lng_min, lng_max) del polígono de un lugar."""
    with open(RAIZ / "data" / "edifcios.json", encoding="utf-8") as f:
        lugar = next(l for l in json.load(f) if l["nombre"] == nombre)
    lats = [p[0] for p in lugar["puntos"]]
    lngs = [p[1] for p in lugar["puntos"]]
    return min(lats), max(lats), min(lngs), max(lngs)


def nombre_inicio(lugar):
    """Nombre del nodo de partida del recorrido para un lugar (recorrido.js usa la misma regla)."""
    return "inicio_" + "_".join(lugar.split())


def nombre_centro(lugar):
    """Nombre del nodo sobre el techo donde va la etiqueta del lugar en la vista aérea."""
    return "centro_" + "_".join(lugar.split())


# ---------------- Materiales (color lineal, metal, rugosidad, [brillo]) ----------------
MATERIALES = {
    "pasto":      ((0.20, 0.38, 0.10), 0.0, 0.95),
    "concreto":   ((0.72, 0.71, 0.68), 0.0, 0.9),
    "pared":      ((0.80, 0.52, 0.24), 0.0, 0.85),
    "pared_int":  ((0.90, 0.86, 0.76), 0.0, 0.9),
    "madera":     ((0.45, 0.27, 0.13), 0.0, 0.7),
    "madera_osc": ((0.20, 0.13, 0.08), 0.0, 0.75),
    "vidrio":     ((0.16, 0.22, 0.26), 0.3, 0.12),
    "techo":      ((0.17, 0.18, 0.20), 0.0, 0.8),
    "mural":      ((0.92, 0.92, 0.88), 0.0, 0.8),
    "puerta":     ((0.93, 0.70, 0.18), 0.0, 0.6),
    "piso":       ((0.60, 0.33, 0.22), 0.0, 0.5),   # baldosa de barro
    "piso_gris":  ((0.75, 0.74, 0.70), 0.0, 0.45),
    "cielo":      ((0.62, 0.44, 0.26), 0.0, 0.8),
    "tarima":     ((0.38, 0.22, 0.11), 0.0, 0.55),
    "silla":      ((0.08, 0.20, 0.38), 0.0, 0.7),   # tapizado azul
    "silla_negra": ((0.10, 0.10, 0.12), 0.0, 0.7),
    "metal":      ((0.35, 0.36, 0.38), 0.6, 0.4),
    "pantalla":   ((0.96, 0.96, 0.96), 0.0, 0.9),
    "mesa":       ((0.85, 0.80, 0.70), 0.0, 0.6),
    "pc":         ((0.08, 0.08, 0.09), 0.2, 0.5),
    "pantalla_pc": ((0.10, 0.25, 0.45), 0.0, 0.3, (0.05, 0.18, 0.38)),
    "tablero":    ((0.97, 0.97, 0.97), 0.0, 0.3),
    "aire":       ((0.94, 0.94, 0.92), 0.0, 0.6),
    "lampara":    ((1.00, 0.95, 0.80), 0.0, 0.5, (1.0, 0.85, 0.55)),
    # Biblioteca (foto static/fotos-edificios/biblioteca.png): muros mostaza y mural en relieve de barro
    "pared_mostaza": ((0.62, 0.32, 0.03), 0.0, 0.85),
    "relieve":    ((0.55, 0.24, 0.12), 0.0, 0.9),
    "libro_rojo": ((0.45, 0.06, 0.05), 0.0, 0.8),
    "libro_azul": ((0.05, 0.12, 0.35), 0.0, 0.8),
    "libro_verde": ((0.08, 0.25, 0.10), 0.0, 0.8),
    "libro_crema": ((0.80, 0.72, 0.55), 0.0, 0.8),
    "archivador": ((0.55, 0.57, 0.58), 0.4, 0.5),
    "planta":     ((0.10, 0.35, 0.08), 0.0, 0.9),
    # Interior del auditorio (foto static/fotos-edificios/referencias-3d/auditorio.png)
    "blanco":     ((0.86, 0.86, 0.84), 0.0, 0.9),
    "piso_claro": ((0.78, 0.78, 0.76), 0.0, 0.35),
    "tubo":       ((1.00, 1.00, 1.00), 0.0, 0.5, (1.0, 1.0, 0.95)),   # lámpara fluorescente
    # Sala de profesores (foto static/fotos-edificios/profesores.png): muros verdes y teja asfáltica café
    "pared_verde": ((0.10, 0.33, 0.08), 0.0, 0.85),
    "techo_cafe": ((0.16, 0.08, 0.05), 0.0, 0.85),
    "nevera":     ((0.85, 0.86, 0.86), 0.2, 0.4),
    "cojin":      ((0.30, 0.10, 0.05), 0.0, 0.9),
    # Maloca (foto static/fotos-edificios/arquitectura.png): zócalo magenta y teja oscura
    "pared_roja": ((0.50, 0.03, 0.09), 0.0, 0.85),
    "teja_osc":   ((0.06, 0.06, 0.07), 0.0, 0.85),
    # Baños y tienda (fotos banos_para_hombres.png, banos_para_mujeres.png, bloque_tienda.png)
    "porcelana":  ((0.90, 0.90, 0.88), 0.0, 0.2),
    "verde_osc":  ((0.01, 0.16, 0.08), 0.0, 0.8),
    "lona_verde": ((0.02, 0.45, 0.32), 0.0, 0.6),
    "rojo":       ((0.60, 0.02, 0.02), 0.0, 0.5),
    # Aula TIC 2 (foto static/fotos-edificios/aula_tic_2.png): murales sobre muro blanco y franja rosada
    "rosa":       ((0.75, 0.20, 0.25), 0.0, 0.8),
    "mural_azul": ((0.10, 0.22, 0.45), 0.0, 0.85),
    "mural_verde": ((0.06, 0.24, 0.16), 0.0, 0.85),
    # Laboratorio de humedales: tanques y acuarios con agua
    "agua":       ((0.04, 0.16, 0.16), 0.1, 0.05),
    # IMANI y APAPORIS (fotos IMANI.png y apaporis.png): verde azulado, lona cruda y tierra
    "verde_teal": ((0.0, 0.24, 0.12), 0.0, 0.85),
    "lona_cruda": ((0.52, 0.40, 0.24), 0.0, 0.9),
    "tierra":     ((0.20, 0.12, 0.06), 0.0, 1.0),
    # Sala de posgrado (foto sala_sistemas_posgrado.png): muros vinotinto
    "vino":       ((0.25, 0.015, 0.03), 0.0, 0.85),
    # Oficina de Asesoría y Orientación Tecnológica: cajas de cartón y luces de los equipos
    "carton":     ((0.42, 0.26, 0.12), 0.0, 0.9),
    "led":        ((0.10, 0.60, 0.15), 0.0, 0.4, (0.10, 0.90, 0.20)),
    # Estructuras de gen_complementarios.py (colores sacados de sus fotos en static/fotos-edificios/)
    "teja_gris":  ((0.30, 0.31, 0.33), 0.0, 0.85),   # sarita.png
    "lamina_verde": ((0.015, 0.20, 0.16), 0.3, 0.5),  # laboratorio.png, bloque_7.png, salones_5A_B_C.png
    "salmon":     ((0.85, 0.20, 0.08), 0.0, 0.85),   # oficinas.png
    "rojo_muro":  ((0.80, 0.06, 0.035), 0.0, 0.85),  # laboratorio.png, sala2_videoconferencia.jpeg
    "magenta":    ((0.68, 0.012, 0.06), 0.0, 0.85),  # cocina.png, salones_4A_B_C.png
    "amarillo_muro": ((0.78, 0.36, 0.03), 0.0, 0.85),  # bloque_13.png, bloque_17.png, salones_5A_B_C.png
    "verde_claro": ((0.14, 0.36, 0.06), 0.0, 0.85),  # sarita.png, centro_soporte_y_recursos_tecnologicos.png
    "policarbonato": ((0.80, 0.80, 0.76), 0.0, 0.4),
    "asfalto":    ((0.06, 0.06, 0.065), 0.0, 0.95),
    "cancha_piso": ((0.30, 0.31, 0.33), 0.0, 0.8),
    "linea":      ((0.95, 0.95, 0.95), 0.0, 0.7),
    "paja":       ((0.33, 0.24, 0.13), 0.0, 1.0),    # casa-hija.jpg
    "agua_piscina": ((0.02, 0.12, 0.25), 0.1, 0.05),
    "malla_azul": ((0.02, 0.06, 0.45), 0.2, 0.6),    # piscina.png
    # Interior de la biblioteca (fotos static/fotos-edificios/referencias-3d/ de la biblioteca)
    "madera_techo": ((0.30, 0.11, 0.045), 0.0, 0.7),  # tablas del techo a la vista
    "gris_panel": ((0.17, 0.19, 0.21), 0.2, 0.6),    # costados de las estanterías metálicas
    "mesa_naranja": ((0.61, 0.17, 0.03), 0.0, 0.5),  # tablero laminado de las mesas
    "azul_plastico": ((0.01, 0.07, 0.60), 0.0, 0.5),  # sillas plásticas
    "teal":       ((0.0, 0.17, 0.17), 0.0, 0.8),     # sillas tapizadas verdes
    "corcho":     ((0.70, 0.30, 0.03), 0.0, 0.8),    # cartelera
    # Plazoleta cubierta frente al Auditorio (fotos referencias-3d/11.jpeg a 14.jpeg)
    "baldosa_rosa": ((0.60, 0.42, 0.34), 0.0, 0.5),
    "granito":    ((0.24, 0.18, 0.13), 0.0, 0.95),   # franjas de gravilla entre baldosas
    "verde_cartelera": ((0.02, 0.30, 0.08), 0.0, 0.8),
}

# ---------------- Medidas comunes de los bloques (metros) ----------------
PISO = 0.15          # alto del andén / placa
ALTO_MURO = 3.4      # alto de las paredes sobre la placa
CUMBRERA = 6.0       # altura de la cumbrera
ALERO_FRENTE = 2.0
ALERO_ATRAS = 1.5
ALERO_LADO = 1.2
G = 0.25             # grosor de muros
Y0 = PISO
YT = PISO + ALTO_MURO


def sub(a, b):
    return [a[i] - b[i] for i in range(3)]


def cross(u, v):
    return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]


def norm(v):
    L = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / L for x in v]


GIROS = {"sur": 0.0, "este": math.pi / 2, "norte": math.pi, "oeste": -math.pi / 2}


class Escena:
    def __init__(self, origen=(0.0, 0.0)):
        """origen: punto del mundo que queda en (0, 0) del archivo (para centrar modelos sueltos)."""
        self.geo = {k: {"pos": [], "nor": [], "idx": []} for k in MATERIALES}
        self.nodos = []
        self.ox, self.oz = origen
        self.colocar(0.0, 0.0, "sur")

    def colocar(self, cx, cz, frente):
        """Lo que se dibuje después queda centrado en (cx, cz) con el frente hacia ese lado.
        frente: "sur", "este", "norte", "oeste" o un ángulo en radianes (edificios en diagonal)."""
        self.cx, self.cz = cx, cz
        self.giro = GIROS[frente] if isinstance(frente, str) else frente

    def _mundo(self, p):
        x, y, z = p
        c, s = math.cos(self.giro), math.sin(self.giro)
        return [self.cx + x * c + z * s - self.ox, y, self.cz - x * s + z * c - self.oz]

    def poligono(self, mat, pts):
        """Cara plana (convexa) con sus puntos en orden antihorario visto desde afuera."""
        pts = [self._mundo(p) for p in pts]
        g = self.geo[mat]
        n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]))
        if sum(x * x for x in n) < 1e-12:   # primeros puntos repetidos o en línea: normal de Newell
            n = [sum((p[(k + 1) % 3] - q[(k + 1) % 3]) * (p[(k + 2) % 3] + q[(k + 2) % 3])
                     for p, q in zip(pts, pts[1:] + pts[:1])) for k in range(3)]
        n = norm(n)
        base = len(g["pos"])
        for p in pts:
            g["pos"].append(p)
            g["nor"].append(n)
        for i in range(1, len(pts) - 1):
            g["idx"].extend([base, base + i, base + i + 1])

    def caja(self, mat, x0, x1, y0, y1, z0, z1, rot_x=0.0, pivote=(0, 0, 0)):
        """Caja alineada a los ejes locales; opcionalmente rotada sobre el eje X alrededor de un pivote."""
        c = [[x, y, z] for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
        if rot_x:
            cs, sn = math.cos(rot_x), math.sin(rot_x)
            out = []
            for x, y, z in c:
                y, z = y - pivote[1], z - pivote[2]
                out.append([x, pivote[1] + y * cs - z * sn, pivote[2] + y * sn + z * cs])
            c = out
        for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
            self.poligono(mat, [c[i] for i in f])

    def faldon(self, mat, z_alto, y_alto, z_bajo, y_bajo, x0, x1, grosor=0.18):
        """Placa inclinada entre la cumbrera y el alero."""
        dz, dy = z_bajo - z_alto, y_bajo - y_alto
        L = math.hypot(dz, dy)
        ang = math.atan2(dy, dz)
        zc, yc = (z_alto + z_bajo) / 2, (y_alto + y_bajo) / 2
        self.caja(mat, x0, x1, yc, yc + grosor, zc - L / 2, zc + L / 2, rot_x=-ang, pivote=(0, yc, zc))

    def hastial(self, mat, x, grosor, y_base, z0, z1, y_punta):
        """Triángulo de pared bajo el techo en un extremo del edificio."""
        xa, xb = x - grosor / 2, x + grosor / 2
        a, b, t = (z0, y_base), (z1, y_base), ((z0 + z1) / 2, y_punta)
        self.poligono(mat, [[xa, a[1], a[0]], [xa, b[1], b[0]], [xa, t[1], t[0]]])
        self.poligono(mat, [[xb, a[1], a[0]], [xb, t[1], t[0]], [xb, b[1], b[0]]])
        self.poligono(mat, [[xa, t[1], t[0]], [xb, t[1], t[0]], [xb, a[1], a[0]], [xa, a[1], a[0]]])
        self.poligono(mat, [[xb, b[1], b[0]], [xb, t[1], t[0]], [xa, t[1], t[0]], [xa, b[1], b[0]]])

    def punto(self, nombre, x, z, y=0.0, extras=None, giro=0.0):
        """Nodo vacío (ej. punto de inicio del recorrido). Mira hacia -Z local, girado `giro`."""
        wx, wy, wz = self._mundo([x, y, z])
        g = self.giro + giro
        nodo = {"name": nombre, "translation": [wx, wy, wz],
                "rotation": [0.0, math.sin(g / 2), 0.0, math.cos(g / 2)]}
        if extras:
            nodo["extras"] = extras
        self.nodos.append(nodo)

    def guardar(self, ruta, nombre):
        binbuf = bytearray()
        views, accessors, primitives, materials = [], [], [], []

        def pad4(b, fill=b"\x00"):
            return bytes(b) + fill * ((4 - len(b) % 4) % 4)

        def add_view(data, target):
            data = pad4(data)
            views.append({"buffer": 0, "byteOffset": len(binbuf), "byteLength": len(data), "target": target})
            binbuf.extend(data)
            return len(views) - 1

        for mat_nombre, (color, metal, rugosidad, *brillo) in MATERIALES.items():
            g = self.geo[mat_nombre]
            if not g["idx"]:
                continue
            mat = {"name": mat_nombre, "pbrMetallicRoughness": {
                "baseColorFactor": [*color, 1.0], "metallicFactor": metal, "roughnessFactor": rugosidad}}
            if brillo:
                mat["emissiveFactor"] = list(brillo[0])
            materials.append(mat)
            p = g["pos"]
            vp = add_view(b"".join(struct.pack("<3f", *v) for v in p), 34962)
            vn = add_view(b"".join(struct.pack("<3f", *v) for v in g["nor"]), 34962)
            vi = add_view(struct.pack("<%dI" % len(g["idx"]), *g["idx"]), 34963)
            accessors.append({"bufferView": vp, "componentType": 5126, "count": len(p), "type": "VEC3",
                              "min": [min(v[i] for v in p) for i in range(3)],
                              "max": [max(v[i] for v in p) for i in range(3)]})
            accessors.append({"bufferView": vn, "componentType": 5126, "count": len(p), "type": "VEC3"})
            accessors.append({"bufferView": vi, "componentType": 5125, "count": len(g["idx"]), "type": "SCALAR"})
            a = len(accessors)
            primitives.append({"attributes": {"POSITION": a - 3, "NORMAL": a - 2}, "indices": a - 1,
                               "material": len(materials) - 1})

        nodos = [{"mesh": 0, "name": nombre}] + self.nodos
        gltf = {
            "asset": {"version": "2.0", "generator": "scripts/modelos/comun.py"},
            "scene": 0,
            "scenes": [{"nodes": list(range(len(nodos)))}],
            "nodes": nodos,
            "meshes": [{"name": nombre, "primitives": primitives}],
            "materials": materials,
            "buffers": [{"byteLength": len(binbuf)}],
            "bufferViews": views,
            "accessors": accessors,
        }
        jbin = pad4(json.dumps(gltf, separators=(",", ":"), ensure_ascii=False).encode(), b" ")
        total = 12 + 8 + len(jbin) + 8 + len(binbuf)
        with open(ruta, "wb") as f:
            f.write(struct.pack("<4sII", b"glTF", 2, total))
            f.write(struct.pack("<I4s", len(jbin), b"JSON") + jbin)
            f.write(struct.pack("<I4s", len(binbuf), b"BIN\x00") + bytes(binbuf))
        tri = sum(len(g["idx"]) for g in self.geo.values()) // 3
        print(f"OK {tri} triángulos, {total} bytes -> {ruta}")


# ---------------- Estilo común de los bloques ----------------
class Bloque:
    """Medidas de un edificio a partir de la huella de su techo (lo que se ve en el plano).

    largo: a lo largo de la fachada (X local), fondo: profundidad (Z local).
    alero_izq / alero_der: alero en -X / +X local (0 si ahí se pega otro edificio).
    cuatro_aguas_izq / _der: ese extremo del techo baja inclinado (como se ve en el
    plano) en vez de terminar en un triángulo de pared.
    """

    def __init__(self, largo, fondo, alero_izq=ALERO_LADO, alero_der=ALERO_LADO,
                 cuatro_aguas_izq=False, cuatro_aguas_der=False,
                 alero_frente=ALERO_FRENTE, alero_atras=ALERO_ATRAS):
        self.hip_izq, self.hip_der = cuatro_aguas_izq, cuatro_aguas_der
        self.RX0, self.RX1 = -largo / 2, largo / 2
        self.RZ0, self.RZ1 = -fondo / 2, fondo / 2
        self.X0, self.X1 = self.RX0 + alero_izq, self.RX1 - alero_der
        self.Z0, self.Z1 = self.RZ0 + alero_atras, self.RZ1 - alero_frente   # Z1 = fachada
        self.ZC = (self.Z0 + self.Z1) / 2                                    # bajo la cumbrera
        self.pend = (CUMBRERA - YT) / ((self.Z1 - self.Z0) / 2)

    def anden(self, esc, terreno=True):
        if terreno:
            esc.caja("pasto", self.RX0 - 4, self.RX1 + 4, -0.05, 0.0, self.RZ0 - 4, self.RZ1 + 6)
        esc.caja("concreto", self.RX0, self.RX1, 0.0, PISO, self.RZ0 + 0.5, self.RZ1 + 0.3)

    def cubierta(self, esc, mat_pared="pared", T=0.2, mat_techo="techo", hastiales=True):
        """Techo con alero, caballete y, en los extremos a dos aguas, hastiales
        (hastiales=False: sin los triángulos de pared, para cubiertas abiertas).

        Todas las aguas tienen la misma pendiente y pasan por el borde alto de los muros.
        Se arma como un sólido de grosor T: caras de arriba, de abajo y canto.
        """
        RX0, RX1, RZ0, RZ1, ZC, C, p = self.RX0, self.RX1, self.RZ0, self.RZ1, self.ZC, CUMBRERA, self.pend
        semi = self.Z1 - ZC                   # distancia del muro a la cumbrera
        xa = self.X0 + semi if self.hip_izq else RX0   # extremos de la cumbrera
        xb = self.X1 - semi if self.hip_der else RX1

        def alto(x, z):
            d = abs(z - ZC)
            if self.hip_der:
                d = max(d, x - xb)
            if self.hip_izq:
                d = max(d, xa - x)
            return C - p * d

        def esquina(borde_x, r, hacia_z):
            """Dónde corta el borde del techo la arista inclinada que sale del extremo r de la cumbrera."""
            d = abs(borde_x - r)
            lim = (RZ1 - ZC) if hacia_z > 0 else (ZC - RZ0)
            if d <= lim:
                return (borde_x, ZC + hacia_z * d)
            return (r + (lim if borde_x > r else -lim), RZ1 if hacia_z > 0 else RZ0)

        LF, LB = esquina(RX0, xa, 1), esquina(RX0, xa, -1)
        RF, RB = esquina(RX1, xb, 1), esquina(RX1, xb, -1)
        en_x = lambda q, x: abs(q[0] - x) < 1e-6

        def limpiar(pts):
            out = []
            for q in pts:
                if not out or abs(out[-1][0] - q[0]) > 1e-6 or abs(out[-1][1] - q[1]) > 1e-6:
                    out.append(q)
            if len(out) > 1 and abs(out[0][0] - out[-1][0]) < 1e-6 and abs(out[0][1] - out[-1][1]) < 1e-6:
                out.pop()
            return out

        caras = []   # (puntos x,z en orden antihorario visto desde arriba, función de altura del plano)
        frente = ([LF, (RX0, RZ1)] if en_x(LF, RX0) else [LF]) + \
                 ([(RX1, RZ1), RF] if en_x(RF, RX1) else [RF]) + [(xb, ZC), (xa, ZC)]
        caras.append((frente, lambda x, z: C - p * (z - ZC)))
        atras = ([RB, (RX1, RZ0)] if en_x(RB, RX1) else [RB]) + \
                ([(RX0, RZ0), LB] if en_x(LB, RX0) else [LB]) + [(xa, ZC), (xb, ZC)]
        caras.append((atras, lambda x, z: C - p * (ZC - z)))
        if self.hip_der:
            caras.append(([RF] + ([] if en_x(RF, RX1) else [(RX1, RZ1)]) +
                          ([] if en_x(RB, RX1) else [(RX1, RZ0)]) + [RB, (xb, ZC)],
                          lambda x, z: C - p * (x - xb)))
        if self.hip_izq:
            caras.append(([LB] + ([] if en_x(LB, RX0) else [(RX0, RZ0)]) +
                          ([] if en_x(LF, RX0) else [(RX0, RZ1)]) + [LF, (xa, ZC)],
                          lambda x, z: C - p * (xa - x)))
        for pts, y in caras:
            pts = limpiar(pts)
            if len(pts) < 3:
                continue
            esc.poligono(mat_techo, [[x, y(x, z) + T, z] for x, z in pts])
            esc.poligono(mat_techo, [[x, y(x, z), z] for x, z in reversed(pts)])

        # Canto del techo, recorriendo el borde por fuera
        bordes = [
            sorted({(RX0, RZ1), (RX1, RZ1)} | {q for q in (LF, RF) if abs(q[1] - RZ1) < 1e-6}),
            sorted({(RX1, RZ1), (RX1, RZ0), RF, RB} if self.hip_der else {(RX1, RZ1), (RX1, RZ0), (RX1, ZC)},
                   key=lambda q: -q[1]),
            sorted({(RX1, RZ0), (RX0, RZ0)} | {q for q in (LB, RB) if abs(q[1] - RZ0) < 1e-6}, key=lambda q: -q[0]),
            sorted({(RX0, RZ0), (RX0, RZ1), LF, LB} if self.hip_izq else {(RX0, RZ0), (RX0, RZ1), (RX0, ZC)},
                   key=lambda q: q[1]),
        ]
        en_borde = (lambda q: abs(q[1] - RZ1) < 1e-6, lambda q: en_x(q, RX1),
                    lambda q: abs(q[1] - RZ0) < 1e-6, lambda q: en_x(q, RX0))
        for borde, esta in zip(bordes, en_borde):
            borde = [q for q in borde if esta(q)]
            for (x0, z0), (x1, z1) in zip(borde, borde[1:]):
                if abs(x0 - x1) + abs(z0 - z1) < 1e-6:
                    continue
                y0, y1 = alto(x0, z0), alto(x1, z1)
                esc.poligono(mat_techo, [[x0, y0, z0], [x1, y1, z1], [x1, y1 + T, z1], [x0, y0 + T, z0]])

        esc.caja("madera_osc", xa, xb, C - 0.05, C + T + 0.08, ZC - 0.2, ZC + 0.2)   # caballete
        if not hastiales:
            return
        if not self.hip_izq:
            esc.hastial(mat_pared, self.X0 + G / 2, G, YT, self.Z0, self.Z1, C)
        if not self.hip_der:
            esc.hastial(mat_pared, self.X1 - G / 2, G, YT, self.Z0, self.Z1, C)

    B = 0.24   # separación del cielo raso bajo la línea del techo

    def alto_cielo(self, z):
        return CUMBRERA - self.B - self.pend * abs(z - self.ZC)

    def cielo_raso(self, esc, vigas_x, plano=False, cabios=None):
        """Cielo raso de madera siguiendo la pendiente, con tirantes y pendolones.
        plano=True: cielo raso horizontal a la altura de los muros (para techos a cuatro aguas).
        cabios: separación de los cabios (vigas inclinadas a la vista bajo las tablas)."""
        zc, p, B = self.ZC, self.pend, self.B
        xi0, xi1 = self.X0 + G, self.X1 - G
        if plano:
            esc.caja("cielo", xi0, xi1, YT - 0.06, YT - 0.02, self.Z0 + G, self.Z1 - G)
            for x in vigas_x:
                esc.caja("madera_osc", x - 0.1, x + 0.1, YT - 0.3, YT - 0.06, self.Z0 + G, self.Z1 - G)
            return
        esc.faldon("cielo", zc, CUMBRERA - B, self.Z1 - G, YT - B + p * G, xi0, xi1, grosor=0.03)
        esc.faldon("cielo", zc, CUMBRERA - B + 0.03, self.Z0 + G, YT - B + 0.03 + p * G, xi0, xi1, grosor=0.03)
        for x in vigas_x:
            esc.caja("madera_osc", x - 0.1, x + 0.1, YT - 0.45, YT - 0.25, self.Z0 + G, self.Z1 - G)
            esc.caja("madera_osc", x - 0.08, x + 0.08, YT - 0.25, self.alto_cielo(zc), zc - 0.08, zc + 0.08)
        if cabios:
            H = 0.14   # alto del cabio, justo debajo de las tablas
            n = max(1, round((xi1 - xi0) / cabios))
            for i in range(n + 1):
                x = min(xi1 - 0.04, max(xi0 + 0.04, xi0 + (xi1 - xi0) * i / n))
                esc.faldon("madera_osc", zc, CUMBRERA - B - H, self.Z1 - G, YT - B + p * G - H,
                           x - 0.04, x + 0.04, grosor=H)
                esc.faldon("madera_osc", zc, CUMBRERA - B - H, self.Z0 + G, YT - B + p * G - H,
                           x - 0.04, x + 0.04, grosor=H)
            yc = self.alto_cielo(zc)
            esc.caja("madera_osc", xi0, xi1, yc - 0.3, yc, zc - 0.1, zc + 0.1)       # viga cumbrera
            for s in (-1, 1):                                                        # correas
                z = zc + s * (self.Z1 - zc) * 0.5
                y = self.alto_cielo(z)
                esc.caja("madera_osc", xi0, xi1, y - 0.32, y - 0.14, z - 0.07, z + 0.07)


def faldones(esc, mat, mat_abajo, ext, y_ext, inn, y_inn, T=0.2):
    """Cuatro aguas entre un rectángulo exterior (x0, x1, z0, z1) a la altura y_ext y uno
    interior a y_inn (si el interior no tiene ancho, queda una cumbrera o una punta).
    Arriba en `mat`, la cara de abajo en `mat_abajo` (lo que se ve desde adentro) y un canto
    alrededor del borde exterior. Sirve para techos de planta cuadrada (Arawana, Maloca)."""
    def esquinas(r):
        x0, x1, z0, z1 = r
        return [(x0, z0), (x0, z1), (x1, z1), (x1, z0)]   # antihorario visto desde arriba
    O, I = esquinas(ext), esquinas(inn)
    for i in range(4):
        a, b, c, d = O[i], O[(i + 1) % 4], I[(i + 1) % 4], I[i]
        cara = [(a, y_ext), (b, y_ext), (c, y_inn), (d, y_inn)]
        esc.poligono(mat, [[q[0], y + T, q[1]] for q, y in cara])
        esc.poligono(mat_abajo, [[q[0], y, q[1]] for q, y in reversed(cara)])
        esc.poligono(mat, [[a[0], y_ext, a[1]], [b[0], y_ext, b[1]], [b[0], y_ext + T, b[1]], [a[0], y_ext + T, a[1]]])


def techo_quiebre(esc, b, p_baja, p_alta, quiebre, abajo="cielo"):
    """Teja oscura a cuatro aguas con quiebre: suave en el alero (p_baja) y más empinada arriba
    (p_alta), a `quiebre` metros del borde. Pasa por el borde alto de los muros si el alero es
    igual en los lados (b.X0 - b.RX0). Lleva una viga de amarre sobre los muros, por dentro."""
    RX0, RX1, RZ0, RZ1 = b.RX0, b.RX1, b.RZ0, b.RZ1
    alero = b.X0 - b.RX0
    y_alero = YT - p_baja * alero
    q = quiebre
    medio = (RX0 + q, RX1 - q, RZ0 + q, RZ1 - q)
    y_medio = y_alero + p_baja * q
    hx, hz = (medio[1] - medio[0]) / 2, (medio[3] - medio[2]) / 2
    m = min(hx, hz)
    cx, cz = (RX0 + RX1) / 2, (RZ0 + RZ1) / 2
    cima = (cx - (hx - m), cx + (hx - m), cz - (hz - m), cz + (hz - m))
    faldones(esc, "teja_osc", abajo, (RX0, RX1, RZ0, RZ1), y_alero, medio, y_medio)
    faldones(esc, "teja_osc", abajo, medio, y_medio, cima, y_medio + p_alta * m)
    for x0, x1, z0, z1 in ((b.X0, b.X1, b.Z0, b.Z0 + G), (b.X0, b.X1, b.Z1 - G, b.Z1),
                           (b.X0, b.X0 + G, b.Z0, b.Z1), (b.X1 - G, b.X1, b.Z0, b.Z1)):
        esc.caja("madera_osc", x0, x1, YT, YT + 0.12, z0, z1)


def cabio(esc, a, b_, H=0.12, ancho=0.08):
    """Viga inclinada de sección cuadrada entre los puntos a y b_ (x, y, z) de su cara de abajo."""
    (xa, ya, za), (xb, yb, zb) = a, b_
    dx, dz = xb - xa, zb - za
    L = (dx * dx + dz * dz) ** 0.5
    nx, nz = -dz / L * ancho / 2, dx / L * ancho / 2           # media anchura, de lado
    p = [[xa - nx, ya, za - nz], [xa + nx, ya, za + nz], [xb + nx, yb, zb + nz], [xb - nx, yb, zb - nz]]
    q = [[x, y + H, z] for x, y, z in p]
    esc.poligono("madera_osc", [p[3], p[2], p[1], p[0]])        # abajo
    esc.poligono("madera_osc", q)                               # arriba
    for k in range(4):
        m = (k + 1) % 4
        esc.poligono("madera_osc", [p[k], p[m], q[m], q[k]])


def cabios(esc, b, p_baja, paso=0.9, H=0.12):
    """Cabios de madera bajo el alero (a la vista en IMANI y las salas), en los cuatro lados: van del
    borde alto del muro al borde del techo, justo debajo de las tablas."""
    a = b.X0 - b.RX0
    y_muro, y_borde = YT - H, YT - p_baja * (a - 0.1) - H
    reparto = lambda u0, u1: [u0 + 0.3 + i * paso for i in range(int((u1 - u0 - 0.6) / paso) + 1)]
    for x in reparto(b.X0, b.X1):
        cabio(esc, (x, y_muro, b.Z1), (x, y_borde, b.RZ1 - 0.1), H)
        cabio(esc, (x, y_borde, b.RZ0 + 0.1), (x, y_muro, b.Z0), H)
    for z in reparto(b.Z0, b.Z1):
        cabio(esc, (b.X1, y_muro, z), (b.RX1 - 0.1, y_borde, z), H)
        cabio(esc, (b.RX0 + 0.1, y_borde, z), (b.X0, y_muro, z), H)


def techo_caseta(esc, b, y_muro, pend, mat="teja_osc", abajo="madera"):
    """Techo a cuatro aguas (o en punta si la planta es cuadrada) para bloques pequeños:
    pasa por el borde alto de los muros (y_muro) y por debajo se ve la madera del alero."""
    RX0, RX1, RZ0, RZ1 = b.RX0, b.RX1, b.RZ0, b.RZ1
    y_alero = y_muro - pend * (b.X0 - b.RX0)
    hx, hz = (RX1 - RX0) / 2, (RZ1 - RZ0) / 2
    m = min(hx, hz)
    cx, cz = RX0 + hx, RZ0 + hz
    cima = (cx - (hx - m), cx + (hx - m), cz - (hz - m), cz + (hz - m))
    faldones(esc, mat, abajo, (RX0, RX1, RZ0, RZ1), y_alero, cima, y_alero + pend * m)


# ---------------- Ubicación según el mapa ----------------
def distribucion():
    """Ubicación y medidas de los bloques modelados, sacadas de los polígonos del mapa.

    Hay dos hileras de bloques que comparten techo, con el frente hacia el norte:
      - norte: Biblioteca (ala norte) | Sala de sistemas 2 | Auditorio
      - sur:   Biblioteca (ala sur)   | Dirección
    Entre las dos hileras queda un patio angosto; la Biblioteca une sus dos alas con
    un hall de entrada que da a ese patio (ver gen_biblioteca.py).

    Aparte, al norte de la Biblioteca, va la Sala de profesores: un bloque suelto, largo
    de norte a sur, con techo a cuatro aguas y el frente hacia el este (al corredor cubierto).
    Más al norte, la Arawana (frente al sur) y, al este del corredor cubierto, la Maloca
    (entrada al oeste); las dos de planta cuadrada con techo propio (ver faldones()).

    Devuelve {nombre: (Bloque, cx, cz, frente)}. Al girar 180° (frente al norte), el
    -X local de cada bloque queda al este y el +X local al oeste.
    """
    aud, sala, bib, dire = (huella(n) for n in ("Auditorio", "Sala de sistemas 2", "Biblioteca", "Dirección"))
    # Cada hilera usa el promedio de sus polígonos para que el techo sea uno solo
    norte = ((aud[0] + sala[0]) / 2, (aud[1] + sala[1]) / 2)
    sur = ((dire[0] + bib[0]) / 2, (dire[1] + 127.125) / 2)   # 127,125: borde norte del ala sur de la biblioteca
    # Muros compartidos (promedio de los dos polígonos que se tocan)
    bib_oeste = bib[2]
    bib_sala = (623.9 + sala[2]) / 2                   # 623,9: borde este del ala norte de la biblioteca
    sala_aud = (aud[2] + sala[3]) / 2
    bib_dir = (bib[3] + dire[2]) / 2
    L = ALERO_LADO
    bloques = (
        # nombre, hilera, lng oeste, lng este, alero este (izq), alero oeste (der), oeste a cuatro aguas
        ("Biblioteca norte", norte, bib_oeste, bib_sala, 0.0, L, True),
        ("Sala de sistemas 2", norte, bib_sala, sala_aud, 0.0, 0.0, False),
        ("Auditorio", norte, sala_aud, aud[3], L, 0.0, False),
        ("Biblioteca sur", sur, bib_oeste, bib_dir, 0.0, L, True),
        ("Dirección", sur, bib_dir, dire[3], L, 0.0, False),
    )
    salida = {}
    for nombre, (lat0, lat1), lng0, lng1, alero_este, alero_oeste, hip_oeste in bloques:
        b = Bloque((lng1 - lng0) * M_POR_LNG, (lat1 - lat0) * M_POR_LAT,
                   alero_izq=alero_este, alero_der=alero_oeste, cuatro_aguas_der=hip_oeste)
        cx, cz = a_metros((lat0 + lat1) / 2, (lng0 + lng1) / 2)
        salida[nombre] = (b, cx, cz, "norte")

    # Sala de profesores: girado al este, el X local va de sur (-X) a norte (+X)
    lat0, lat1, lng0, lng1 = huella("Sala de profesores")
    b = Bloque((lat1 - lat0) * M_POR_LAT, (lng1 - lng0) * M_POR_LNG,
               cuatro_aguas_izq=True, cuatro_aguas_der=True)
    cx, cz = a_metros((lat0 + lat1) / 2, (lng0 + lng1) / 2)
    salida["Sala de profesores"] = (b, cx, cz, "este")

    # Arawana: al norte de la Sala de profesores, casi cuadrada, con el frente al sur
    lat0, lat1, lng0, lng1 = huella("Arawana")
    a = 1.3
    b = Bloque((lng1 - lng0) * M_POR_LNG, (lat1 - lat0) * M_POR_LAT,
               alero_izq=a, alero_der=a, alero_frente=a, alero_atras=a)
    cx, cz = a_metros((lat0 + lat1) / 2, (lng0 + lng1) / 2)
    salida["Arawana"] = (b, cx, cz, "sur")

    # Maloca: cuadrada, al otro lado del corredor cubierto, con la entrada al oeste
    # (girado al oeste, el X local va de norte (-X) a sur (+X))
    lat0, lat1, lng0, lng1 = huella("Maloca")
    a = 1.5
    b = Bloque((lat1 - lat0) * M_POR_LAT, (lng1 - lng0) * M_POR_LNG,
               alero_izq=a, alero_der=a, alero_frente=a, alero_atras=a)
    cx, cz = a_metros((lat0 + lat1) / 2, (lng0 + lng1) / 2)
    salida["Maloca"] = (b, cx, cz, "oeste")

    # Al norte, a los dos lados del corredor cubierto: baño de hombres (oeste, puerta al este),
    # y baño de mujeres y tienda (este, mirando al corredor / al pasillo entre los dos).
    # Girados al este u oeste, el largo (X local) va de norte a sur.
    for nombre, frente, a in (("Baños para hombres", "este", 0.9), ("Baño para mujeres", "oeste", 0.9),
                              ("Bloque para tienda", "oeste", 1.0)):
        lat0, lat1, lng0, lng1 = huella(nombre)
        b = Bloque((lat1 - lat0) * M_POR_LAT, (lng1 - lng0) * M_POR_LNG,
                   alero_izq=a, alero_der=a, alero_frente=a, alero_atras=a)
        cx, cz = a_metros((lat0 + lat1) / 2, (lng0 + lng1) / 2)
        salida[nombre] = (b, cx, cz, frente)

    # Aula TIC 2: entre los dos corredores cubiertos, al norte del baño de mujeres y la tienda.
    # La espalda da al corredor del oeste y el frente (con alero hondo sobre columnas) al este,
    # donde un pasillo la une al otro corredor. Girado al este, el X local va de sur a norte.
    lat0, lat1, lng0, lng1 = huella("Aula tic 2")
    b = Bloque((lat1 - lat0) * M_POR_LAT, (lng1 - lng0) * M_POR_LNG, alero_frente=2.2, alero_atras=1.2)
    cx, cz = a_metros((lat0 + lat1) / 2, (lng0 + lng1) / 2)
    salida["Aula tic 2"] = (b, cx, cz, "este")

    # Laboratorio de humedales: al este del corredor cubierto del este, con la puerta hacia él
    # (oeste). Girado al oeste, el X local va de norte (-X) a sur (+X); la esquina noreste es
    # un patio de servicio sin techo (ver gen_lab_humedales.py).
    lat0, lat1, lng0, lng1 = huella(HUMEDALES)
    b = Bloque((lat1 - lat0) * M_POR_LAT, (lng1 - lng0) * M_POR_LNG, alero_frente=1.2, alero_atras=1.2)
    cx, cz = a_metros((lat0 + lat1) / 2, (lng0 + lng1) / 2)
    salida[HUMEDALES] = (b, cx, cz, "oeste")

    # IMANI: pegado al corredor del este, con el frente al norte (al prado que lo separa del
    # laboratorio de humedales). Girado al norte, el X local va de este (-X) a oeste (+X).
    lat0, lat1, lng0, lng1 = huella("IMANI")
    a = 1.3
    b = Bloque((lng1 - lng0) * M_POR_LNG, (lat1 - lat0) * M_POR_LAT,
               alero_izq=a, alero_der=a, alero_frente=a, alero_atras=a)
    cx, cz = a_metros((lat0 + lat1) / 2, (lng0 + lng1) / 2)
    salida["IMANI"] = (b, cx, cz, "norte")

    # APAPORIS: al noreste de IMANI, con el frente al oeste (al mismo prado).
    # Girado al oeste, el X local va de norte (-X) a sur (+X).
    lat0, lat1, lng0, lng1 = huella("APAPORIS")
    b = Bloque((lat1 - lat0) * M_POR_LAT, (lng1 - lng0) * M_POR_LNG,
               alero_izq=a, alero_der=a, alero_frente=a, alero_atras=a)
    cx, cz = a_metros((lat0 + lat1) / 2, (lng0 + lng1) / 2)
    salida["APAPORIS"] = (b, cx, cz, "oeste")

    # Sala de sistemas 1 (al sur de IMANI, pegada al corredor) y Sala de posgrado (al este de
    # las dos, tocando a IMANI): ambas con el frente al oeste. La de posgrado da al paso que
    # queda entre IMANI y la Sala de sistemas 1. Girado al oeste, el X local va de norte a sur.
    for nombre in ("Sala de sistemas 1", "Sala de posgrado"):
        lat0, lat1, lng0, lng1 = huella(nombre)
        b = Bloque((lat1 - lat0) * M_POR_LAT, (lng1 - lng0) * M_POR_LNG,
                   alero_izq=a, alero_der=a, alero_frente=a, alero_atras=a)
        cx, cz = a_metros((lat0 + lat1) / 2, (lng0 + lng1) / 2)
        salida[nombre] = (b, cx, cz, "oeste")

    # Oficina de Asesoría y Orientación Tecnológica: al sur de la Sala de sistemas 1, también
    # con el frente al corredor (oeste). Girado al oeste, el X local va de norte a sur.
    lat0, lat1, lng0, lng1 = huella(OFICINA_TEC)
    a = 1.2
    b = Bloque((lat1 - lat0) * M_POR_LAT, (lng1 - lng0) * M_POR_LNG,
               alero_izq=a, alero_der=a, alero_frente=a, alero_atras=a)
    cx, cz = a_metros((lat0 + lat1) / 2, (lng0 + lng1) / 2)
    salida[OFICINA_TEC] = (b, cx, cz, "oeste")
    return salida


HUMEDALES = "Laboratorio - Manejo y gestión de humedales"
OFICINA_TEC = "Oficina de Asesoría y Orientación Tecnológica"
