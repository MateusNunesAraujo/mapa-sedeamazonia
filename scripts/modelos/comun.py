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
    # Biblioteca (foto static/fotos/biblioteca.png): muros mostaza y mural en relieve de barro
    "pared_mostaza": ((0.62, 0.32, 0.03), 0.0, 0.85),
    "relieve":    ((0.55, 0.24, 0.12), 0.0, 0.9),
    "libro_rojo": ((0.45, 0.06, 0.05), 0.0, 0.8),
    "libro_azul": ((0.05, 0.12, 0.35), 0.0, 0.8),
    "libro_verde": ((0.08, 0.25, 0.10), 0.0, 0.8),
    "libro_crema": ((0.80, 0.72, 0.55), 0.0, 0.8),
    "archivador": ((0.55, 0.57, 0.58), 0.4, 0.5),
    "planta":     ((0.10, 0.35, 0.08), 0.0, 0.9),
    # Interior del auditorio (foto static/fotos/fotos para 3d/auditorio.png)
    "blanco":     ((0.86, 0.86, 0.84), 0.0, 0.9),
    "piso_claro": ((0.78, 0.78, 0.76), 0.0, 0.35),
    "tubo":       ((1.00, 1.00, 1.00), 0.0, 0.5, (1.0, 1.0, 0.95)),   # lámpara fluorescente
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
        """Lo que se dibuje después queda centrado en (cx, cz) con el frente hacia ese lado."""
        self.cx, self.cz, self.giro = cx, cz, GIROS[frente]

    def _mundo(self, p):
        x, y, z = p
        c, s = math.cos(self.giro), math.sin(self.giro)
        return [self.cx + x * c + z * s - self.ox, y, self.cz - x * s + z * c - self.oz]

    def poligono(self, mat, pts):
        """Cara plana (convexa) con sus puntos en orden antihorario visto desde afuera."""
        pts = [self._mundo(p) for p in pts]
        g = self.geo[mat]
        n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])))
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
                 cuatro_aguas_izq=False, cuatro_aguas_der=False):
        self.hip_izq, self.hip_der = cuatro_aguas_izq, cuatro_aguas_der
        self.RX0, self.RX1 = -largo / 2, largo / 2
        self.RZ0, self.RZ1 = -fondo / 2, fondo / 2
        self.X0, self.X1 = self.RX0 + alero_izq, self.RX1 - alero_der
        self.Z0, self.Z1 = self.RZ0 + ALERO_ATRAS, self.RZ1 - ALERO_FRENTE   # Z1 = fachada
        self.ZC = (self.Z0 + self.Z1) / 2                                    # bajo la cumbrera
        self.pend = (CUMBRERA - YT) / ((self.Z1 - self.Z0) / 2)

    def anden(self, esc, terreno=True):
        if terreno:
            esc.caja("pasto", self.RX0 - 4, self.RX1 + 4, -0.05, 0.0, self.RZ0 - 4, self.RZ1 + 6)
        esc.caja("concreto", self.RX0, self.RX1, 0.0, PISO, self.RZ0 + 0.5, self.RZ1 + 0.3)

    def cubierta(self, esc, mat_pared="pared", T=0.2):
        """Techo con alero, caballete y, en los extremos a dos aguas, hastiales.

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
            esc.poligono("techo", [[x, y(x, z) + T, z] for x, z in pts])
            esc.poligono("techo", [[x, y(x, z), z] for x, z in reversed(pts)])

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
                esc.poligono("techo", [[x0, y0, z0], [x1, y1, z1], [x1, y1 + T, z1], [x0, y0 + T, z0]])

        esc.caja("madera_osc", xa, xb, C - 0.05, C + T + 0.08, ZC - 0.2, ZC + 0.2)   # caballete
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


# ---------------- Ubicación según el mapa ----------------
def distribucion():
    """Ubicación y medidas de los bloques modelados, sacadas de los polígonos del mapa.

    Hay dos hileras de bloques que comparten techo, con el frente hacia el norte:
      - norte: Biblioteca (ala norte) | Sala de sistemas 2 | Auditorio
      - sur:   Biblioteca (ala sur)   | Dirección
    Entre las dos hileras queda un patio angosto; la Biblioteca une sus dos alas con
    un hall de entrada que da a ese patio (ver gen_biblioteca.py).

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
    return salida
