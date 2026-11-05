"""Genera el modelo 3D de la Arawana (static/modelos/arawana.glb) sin dependencias.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_arawana.py static/modelos/arawana.glb

Bloque casi cuadrado (~11 x 11,5 m de techo según el polígono del mapa) al norte de la
Sala de profesores, con el frente hacia el sur. Por fuera sigue la foto static/fotos/arawana.png:
muros ocre, frente de vidrio con marcos de madera (dos puertas dobles en el centro) y techo
de teja oscura a cuatro aguas que se empina en la parte alta.
Adentro: espacio de investigación con mesa de reuniones, puestos con computador, biblioteca
y tablero.

En el sistema local: +X = este, +Z = frente (sur).
"""
import sys

from comun import YT, Y0, G, Escena, distribucion, faldones, nombre_centro
from muebles import computador, estante, mesa, muro_ventanas, planta, silla

MURO = "pared_mostaza"
YP = Y0 + 0.02
Y_ANTE, Y_DINTEL = Y0 + 1.0, Y0 + 2.45
P_BAJA, P_ALTA = 0.35, 0.85      # pendiente del techo abajo (alero) y arriba
QUIEBRE = 2.2                    # distancia del borde del techo al quiebre de pendiente


def fachada(esc, X0, X1, Z1):
    """Frente (+Z): puntas macizas, ventanas con antepecho, dos puertas dobles de vidrio en el centro
    (la del este abierta) y una franja de tablas de madera arriba."""
    caja = esc.caja
    poste = lambda x: caja("madera", x - 0.1, x + 0.1, Y0, YT, Z1 - 0.3, Z1 + 0.04)
    vidrio = lambda a, b, y0, y1: (caja("vidrio", a, b, y0, y1, Z1 - 0.15, Z1 - 0.1))

    caja(MURO, X0, X0 + 0.6, Y0, YT, Z1 - G, Z1)
    caja(MURO, X1 - 0.6, X1, Y0, YT, Z1 - G, Z1)
    cortes = [X0 + 0.6, -1.85, -0.15, 0.15, 1.85, X1 - 0.6]
    for x in cortes:
        poste(x)
    caja(MURO, -0.15, 0.15, Y0, YT, Z1 - G, Z1)                                     # columna central

    # Ventanas de los lados, con antepecho ocre
    for a, b in ((cortes[0] + 0.1, cortes[1] - 0.1), (cortes[4] + 0.1, cortes[5] - 0.1)):
        caja(MURO, a, b, Y0, Y_ANTE, Z1 - G, Z1)
        vidrio(a, b, Y_ANTE, Y_DINTEL)
        m = (a + b) / 2
        caja("madera", m - 0.04, m + 0.04, Y_ANTE, Y_DINTEL, Z1 - 0.14, Z1 - 0.06)

    # Puertas dobles: la del oeste cerrada, la del este abierta hacia adentro
    for a, b, abierta in ((cortes[1] + 0.1, cortes[2] - 0.1, False), (cortes[3] + 0.1, cortes[4] - 0.1, True)):
        m = (a + b) / 2
        if not abierta:
            vidrio(a, b, Y0 + 0.05, Y_DINTEL)
            caja("madera", m - 0.05, m + 0.05, Y0, Y_DINTEL, Z1 - 0.16, Z1 - 0.04)
            caja("madera", a, b, Y0, Y0 + 0.12, Z1 - 0.16, Z1 - 0.04)
            caja("metal", m - 0.12, m - 0.08, Y0 + 0.95, Y0 + 1.15, Z1 - 0.04, Z1)       # manijas
            caja("metal", m + 0.08, m + 0.12, Y0 + 0.95, Y0 + 1.15, Z1 - 0.04, Z1)
        else:
            for x, s in ((a, 1), (b, -1)):
                hx0, hx1 = (x, x + 0.06) if s > 0 else (x - 0.06, x)
                caja("madera", hx0, hx1, Y0, Y_DINTEL - 0.02, Z1 - G - 0.8, Z1 - G)
                caja("vidrio", hx0 - 0.01, hx1 + 0.01, Y0 + 0.15, Y_DINTEL - 0.15, Z1 - G - 0.7, Z1 - G - 0.1)

    # Franja alta: tablas de madera entre los postes
    caja("madera", X0 + 0.6, X1 - 0.6, Y_DINTEL, Y_DINTEL + 0.08, Z1 - 0.3, Z1 + 0.04)
    for a, b in zip(cortes, cortes[1:]):
        caja("madera_osc", a + 0.1, b - 0.1, Y_DINTEL + 0.08, YT, Z1 - 0.18, Z1 - 0.12)
        n = max(1, round((b - a) / 0.85))
        for k in range(1, n):
            x = a + (b - a) * k / n
            caja("madera", x - 0.03, x + 0.03, Y_DINTEL + 0.08, YT, Z1 - 0.14, Z1 - 0.08)


def techo(esc, b):
    """Teja oscura a cuatro aguas con quiebre: suave en el alero y más empinada arriba."""
    RX0, RX1, RZ0, RZ1 = b.RX0, b.RX1, b.RZ0, b.RZ1
    alero = b.X0 - b.RX0
    y_alero = YT - P_BAJA * alero
    q = QUIEBRE
    medio = (RX0 + q, RX1 - q, RZ0 + q, RZ1 - q)
    y_medio = y_alero + P_BAJA * q
    hx, hz = (medio[1] - medio[0]) / 2, (medio[3] - medio[2]) / 2
    m = min(hx, hz)
    cx, cz = (RX0 + RX1) / 2, (RZ0 + RZ1) / 2
    cima = (cx - (hx - m), cx + (hx - m), cz - (hz - m), cz + (hz - m))
    faldones(esc, "teja_osc", "cielo", (RX0, RX1, RZ0, RZ1), y_alero, medio, y_medio)
    faldones(esc, "teja_osc", "cielo", medio, y_medio, cima, y_medio + P_ALTA * m)
    # Viga de amarre sobre los muros, por dentro
    for x0, x1, z0, z1 in ((b.X0, b.X1, b.Z0, b.Z0 + G), (b.X0, b.X1, b.Z1 - G, b.Z1),
                           (b.X0, b.X0 + G, b.Z0, b.Z1), (b.X1 - G, b.X1, b.Z0, b.Z1)):
        esc.caja("madera_osc", x0, x1, YT, YT + 0.12, z0, z1)


def construir(esc, b, inicio="inicio", terreno=True):
    """Dibuja la Arawana en el sistema local de `b` (frente hacia +Z)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    caja = esc.caja
    b.anden(esc, terreno)

    fachada(esc, X0, X1, Z1)
    muro_ventanas(esc, MURO, X0, X1, Z0, Z0 + G, "x")                                  # atrás (norte)
    muro_ventanas(esc, MURO, Z0 + G, Z1 - G, X0, X0 + G, "z")                          # oeste
    muro_ventanas(esc, MURO, Z0 + G, Z1 - G, X1 - G, X1, "z")                          # este
    techo(esc, b)

    # ---------------- Interior ----------------
    XI0, XI1, ZI0, ZI1 = X0 + G, X1 - G, Z0 + G, Z1 - G
    caja("piso_gris", XI0, XI1, Y0, YP, ZI0, ZI1)

    # Mesa de reuniones en el centro
    zm = (ZI0 + ZI1) / 2 + 0.3
    mesa(esc, -1.5, 1.5, zm - 0.6, zm + 0.6, YP, mat="madera")
    for x in (-1.0, 0.0, 1.0):
        silla(esc, x, zm - 0.95, YP, (0, 1))
        silla(esc, x, zm + 0.95, YP, (0, -1))
    silla(esc, -1.85, zm, YP, (1, 0))
    silla(esc, 1.85, zm, YP, (-1, 0))

    # Puestos con computador contra el muro de atrás
    for x in (-2.4, 0.0, 2.4):
        mesa(esc, x - 0.75, x + 0.75, ZI0 + 0.1, ZI0 + 0.8, YP)
        computador(esc, x, ZI0 + 0.4, YP + 0.74, (0, 1))
        silla(esc, x, ZI0 + 1.25, YP, (0, -1))

    # Biblioteca en el muro oeste y tablero en el este
    estante(esc, XI0, XI0 + 0.35, ZI0 + 1.8, ZI1 - 1.2, YP, alto=1.9)
    caja("metal", XI1 - 0.05, XI1 - 0.01, 0.95, 2.25, zm - 1.3, zm + 1.3)
    caja("tablero", XI1 - 0.07, XI1 - 0.05, 1.0, 2.2, zm - 1.25, zm + 1.25)
    caja("metal", XI1 - 0.12, XI1 - 0.07, 0.95, 0.98, zm - 1.25, zm + 1.25)
    planta(esc, XI0 + 0.5, ZI1 - 0.5, YP)
    planta(esc, XI1 - 0.5, ZI1 - 0.5, YP)

    # Lámparas colgantes
    yt = YT + 2.2                    # hasta la cara de abajo del techo (~5,8 m en x = ±1)
    for x in (-1.0, 1.0):
        caja("metal", x - 0.01, x + 0.01, YT - 0.4, yt, zm - 0.01, zm + 0.01)
        caja("tubo", x - 0.6, x + 0.6, YT - 0.45, YT - 0.4, zm - 0.06, zm + 0.06)

    # Partida del recorrido: afuera, frente a la puerta abierta
    esc.punto(inicio, 1.0, Z1 + 5.0)


def colocar(esc, dist, inicio="inicio", terreno=True):
    b, cx, cz, frente = dist["Arawana"]
    esc.colocar(cx, cz, frente)
    construir(esc, b, inicio, terreno)
    esc.punto(nombre_centro("Arawana"), 0.0, (b.RZ0 + b.RZ1) / 2, y=8.0, extras={"nombre": "Arawana"})


if __name__ == "__main__":
    b, *_ = distribucion()["Arawana"]
    esc = Escena()
    construir(esc, b)
    esc.guardar(sys.argv[1], "Arawana")
