"""Genera el modelo 3D de la Maloca (static/modelos/maloca.glb) sin dependencias.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_maloca.py static/modelos/maloca.glb

Salón cuadrado (~17 x 17 m de techo según el polígono del mapa) al este del corredor cubierto,
con la entrada al oeste. Por fuera sigue la foto static/fotos/arquitectura.png: zócalo magenta,
postes de madera con persianas de tablillas, puertas dobles de madera abiertas y techo de teja
oscura a cuatro aguas con una linterna (parte alta elevada y ventilada) en el centro.
Adentro: salón del pregrado de arquitectura con un pasillo de puerta a puerta (oeste-este),
mesas de dibujo inclinadas, tablero y mesa del profesor.

En el sistema local: -X = norte, +X = sur, +Z = frente (oeste), -Z = atrás (este).
"""
import sys

from comun import YT, Y0, G, Escena, distribucion, faldones, nombre_centro
from muebles import computador, estante, mesa, planta, rejilla, silla

ZOCALO = "pared_roja"
YP = Y0 + 0.02
Y_ZOC, Y_PERS = Y0 + 1.0, Y0 + 2.5     # alto del zócalo y del borde de arriba de las persianas
ANCHO_PUERTA = 2.0
P_BAJA, P_ALTA = 0.5, 0.5              # pendientes del techo grande y de la linterna
LINTERNA = 3.55                        # medio ancho de la linterna (m)
ALTO_LINTERNA = 0.75


def _eje(esc, eje):
    """Caja dada a lo largo de un muro: 'x' -> (a = x, c = z); 'z' -> (a = z, c = x)."""
    if eje == "x":
        return lambda m, a0, a1, y0, y1, c0, c1: esc.caja(m, a0, a1, y0, y1, c0, c1)
    return lambda m, a0, a1, y0, y1, c0, c1: esc.caja(m, c0, c1, y0, y1, a0, a1)


def muro(esc, a0, a1, c0, c1, eje, puerta=False, afuera=1):
    """Muro de la maloca: zócalo magenta, postes cada ~1,6 m, persianas de tablillas y una franja
    de celosía arriba. puerta=True deja un vano central con dos hojas de madera abiertas hacia
    adentro. afuera: +1/-1 según hacia qué lado de c queda el exterior."""
    caja = _eje(esc, eje)
    cm = (c0 + c1) / 2
    adentro = c0 if afuera > 0 else c1
    centro = (a0 + a1) / 2
    p0, p1 = centro - ANCHO_PUERTA / 2, centro + ANCHO_PUERTA / 2
    tramos = [(a0, p0), (p1, a1)] if puerta else [(a0, a1)]

    for t0, t1 in tramos:
        caja(ZOCALO, t0, t1, Y0, Y_ZOC, c0, c1)
        caja("madera", t0, t1, Y_ZOC, Y_ZOC + 0.05, c0 - 0.04, c1 + 0.04)                 # remate
        n = max(1, round((t1 - t0) / 1.6))
        w = (t1 - t0) / n
        for i in range(n + 1):
            a = t0 + i * w
            caja("madera", max(a0, a - 0.1), min(a1, a + 0.1), Y0, YT, cm - 0.12, cm + 0.12)
        for i in range(n):
            va, vb = t0 + i * w + 0.1, t0 + (i + 1) * w - 0.1
            y = Y_ZOC + 0.12
            while y + 0.05 < Y_PERS:                                                     # persianas
                caja("madera", va, vb, y, y + 0.05, cm - 0.05, cm + 0.05)
                y += 0.13
            caja("madera_osc", va, vb, Y_PERS, Y_PERS + 0.1, cm - 0.1, cm + 0.1)
            m = max(1, round((vb - va) / 0.25))
            for k in range(1, m):                                                        # celosía alta
                a = va + (vb - va) * k / m
                caja("madera", a - 0.025, a + 0.025, Y_PERS + 0.1, YT, cm - 0.04, cm + 0.04)
    caja("madera_osc", a0, a1, YT - 0.12, YT, c0, c1)                                     # viga de amarre

    if puerta:
        caja("madera", p0, p1, Y0 + 2.35, YT - 0.12, cm - 0.12, cm + 0.12)                # dintel
        for x, s in ((p0, 1), (p1, -1)):                                                 # hojas abiertas
            h0, h1 = (x, x + 0.06) if s > 0 else (x - 0.06, x)
            hc = adentro - afuera * 0.95
            z0, z1 = min(adentro, hc), max(adentro, hc)
            caja("madera", h0, h1, Y0, Y0 + 2.3, z0, z1)
            for k in range(8):
                y = Y0 + 1.0 + k * 0.15
                caja("madera_osc", h0 - 0.01, h1 + 0.01, y, y + 0.05, z0 + 0.08, z1 - 0.08)


def techo(esc, b):
    """Cuatro aguas grande hasta la linterna, la linterna con celosía y su techito en punta."""
    RX0, RX1, RZ0, RZ1 = b.RX0, b.RX1, b.RZ0, b.RZ1
    cx, cz = (RX0 + RX1) / 2, (RZ0 + RZ1) / 2
    alero = b.X0 - b.RX0
    y_alero = YT - P_BAJA * alero
    h = min(RX1 - cx, RZ1 - cz)
    y_hueco = y_alero + P_BAJA * (h - LINTERNA)
    L = LINTERNA
    faldones(esc, "teja_osc", "cielo", (RX0, RX1, RZ0, RZ1), y_alero,
             (cx - L, cx + L, cz - L, cz + L), y_hueco)

    # Linterna: postes y tablillas alrededor del hueco
    l = L - 0.15
    y0, y1 = y_hueco - 0.1, y_hueco + ALTO_LINTERNA
    for x0, x1, z0, z1 in ((cx - l, cx + l, cz - l - 0.06, cz - l + 0.06), (cx - l, cx + l, cz + l - 0.06, cz + l + 0.06),
                           (cx - l - 0.06, cx - l + 0.06, cz - l, cz + l), (cx + l - 0.06, cx + l + 0.06, cz - l, cz + l)):
        for k in range(4):
            y = y0 + 0.15 + k * 0.17
            esc.caja("madera", x0, x1, y, y + 0.06, z0, z1)
    for x in rejilla(cx - l, cx + l, 1.2) + [cx - l, cx + l]:
        for z in (cz - l, cz + l):
            esc.caja("madera_osc", x - 0.08, x + 0.08, y0, y1, z - 0.08, z + 0.08)
    for z in rejilla(cz - l, cz + l, 1.2):
        for x in (cx - l, cx + l):
            esc.caja("madera_osc", x - 0.08, x + 0.08, y0, y1, z - 0.08, z + 0.08)

    # Techito de la linterna, con alero sobre el hueco
    c = L + 0.4
    faldones(esc, "teja_osc", "cielo", (cx - c, cx + c, cz - c, cz + c), y1 - 0.2,
             (cx, cx, cz, cz), y1 - 0.2 + P_ALTA * c)


def mesa_dibujo(esc, x, z, y, mira=(-1, 0)):
    """Mesa de dibujo (larga en Z) con el tablero inclinado: más alto del lado hacia donde se mira (-X)."""
    x0, x1, z0, z1 = x - 0.4, x + 0.4, z - 0.6, z + 0.6
    ya, yb = y + 0.98, y + 0.8       # alto del borde de adelante (lejos) y del de atrás (cerca)
    for xl in (x0 + 0.05, x1 - 0.09):
        for zl in (z0 + 0.05, z1 - 0.09):
            esc.caja("metal", xl, xl + 0.04, y, y + 0.78, zl, zl + 0.04)
    for yy, mat in ((0.0, "blanco"), (-0.03, "metal")):
        top = [[x0, ya + yy, z0], [x0, ya + yy, z1], [x1, yb + yy, z1], [x1, yb + yy, z0]]
        esc.poligono(mat, top if yy == 0 else list(reversed(top)))
    esc.caja("madera", x1 - 0.02, x1 + 0.02, yb - 0.02, yb + 0.03, z0, z1)               # regla de apoyo
    silla(esc, x + 0.75, z, y, mira)


def construir(esc, b, inicio="inicio", terreno=True):
    """Dibuja la Maloca en el sistema local de `b` (frente hacia +Z)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    caja = esc.caja
    b.anden(esc, terreno)
    caja("concreto", X0 - 1.0, X1 + 1.0, 0.0, 0.15, b.RZ0 + 0.5, b.RZ0 + 1.5)             # andén de atrás

    muro(esc, X0, X1, Z1 - G, Z1, "x", puerta=True, afuera=1)                            # frente (oeste)
    muro(esc, X0, X1, Z0, Z0 + G, "x", puerta=True, afuera=-1)                           # atrás (este)
    muro(esc, Z0 + G, Z1 - G, X0, X0 + G, "z", afuera=-1)                                # norte
    muro(esc, Z0 + G, Z1 - G, X1 - G, X1, "z", afuera=1)                                 # sur
    for x in (X0, X1 - G):                                                               # esquinas
        for z in (Z0, Z1 - G):
            caja("madera", x - 0.05, x + G + 0.05, Y0, YT, z - 0.05, z + G + 0.05)
    techo(esc, b)

    # ---------------- Interior ----------------
    XI0, XI1, ZI0, ZI1 = X0 + G, X1 - G, Z0 + G, Z1 - G
    caja("piso", XI0, XI1, Y0, YP, ZI0, ZI1)
    caja("piso_gris", -1.0, 1.0, YP, YP + 0.005, ZI0, ZI1)                               # pasillo de puerta a puerta

    # Tablero en el muro norte y mesa del profesor
    caja("metal", XI0 + 0.01, XI0 + 0.05, 0.95, 2.35, -3.05, 3.05)
    caja("tablero", XI0 + 0.05, XI0 + 0.07, 1.0, 2.3, -3.0, 3.0)
    caja("metal", XI0 + 0.07, XI0 + 0.12, 0.95, 0.98, -3.0, 3.0)
    mesa(esc, XI0 + 1.0, XI0 + 1.8, 3.6, 5.2, YP, mat="madera")
    computador(esc, XI0 + 1.4, 4.4, YP + 0.74, (1, 0))
    silla(esc, XI0 + 0.6, 4.4, YP, (1, 0))
    estante(esc, XI0, XI0 + 0.4, ZI0 + 0.3, ZI0 + 2.6, YP)

    # Mesas de dibujo mirando al tablero, a los dos lados del pasillo
    filas = [XI0 + 2.6, XI0 + 4.4, 1.6, 3.4]
    for xf in filas:
        for z in rejilla(ZI0 + 0.4, ZI1 - 0.4, 2.0):
            mesa_dibujo(esc, xf, z, YP)

    # Mesa larga para maquetas contra el muro sur
    mesa(esc, XI1 - 0.9, XI1 - 0.1, ZI0 + 1.0, -1.6, YP, mat="madera", alto=0.9)
    for z, w in ((ZI0 + 1.6, 0.5), (ZI0 + 2.8, 0.7), (-2.6, 0.4)):
        caja("blanco", XI1 - 0.75, XI1 - 0.25, YP + 0.9, YP + 0.9 + w, z - 0.3, z + 0.3)   # maquetas
    planta(esc, XI0 + 0.6, ZI1 - 0.6, YP)
    planta(esc, XI1 - 0.6, ZI1 - 0.6, YP)

    # Partida del recorrido: afuera, frente a la puerta del oeste
    esc.punto(inicio, 0.0, Z1 + 5.0)


def colocar(esc, dist, inicio="inicio", terreno=True):
    b, cx, cz, frente = dist["Maloca"]
    esc.colocar(cx, cz, frente)
    construir(esc, b, inicio, terreno)
    esc.punto(nombre_centro("Maloca"), 0.0, (b.RZ0 + b.RZ1) / 2, y=9.5, extras={"nombre": "Maloca"})


if __name__ == "__main__":
    b, *_ = distribucion()["Maloca"]
    esc = Escena()
    construir(esc, b)
    esc.guardar(sys.argv[1], "Maloca")
