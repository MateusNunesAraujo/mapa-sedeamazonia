"""Genera el modelo 3D de la Dirección (static/modelos/direccion.glb) sin dependencias.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_direccion.py static/modelos/direccion.glb

Bloque al sur del Auditorio, pegado al ala sur de la Biblioteca, con el frente hacia
el patio que lo separa del Auditorio. No hay foto: usa el estilo de los bloques vecinos
(paredes ocre, columnas de madera, celosías) y adentro tiene recepción, la oficina de la
dirección con mesa de reuniones y una oficina con dos puestos de trabajo.
"""
import sys

from comun import CUMBRERA, G, Y0, YT, Escena, distribucion, nombre_centro
from muebles import (archivador, computador, estante, mesa, muro_ventanas, panel_luz, planta,
                     rejilla, silla)

YP = Y0 + 0.02
ALTO_DIVISION = 2.6


def construir(esc, b, inicio="inicio", terreno=True):
    """Dibuja la Dirección en el sistema local de `b` (frente hacia +Z, -X libre, +X pegado a la biblioteca)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    caja = esc.caja
    b.anden(esc, terreno)

    caja("pared", X1 - G, X1, Y0, YT, Z0, Z1)                                    # muro con la biblioteca
    muro_ventanas(esc, "pared", Z0 + G, Z1 - G, X0, X0 + G, "z")                 # extremo libre
    muro_ventanas(esc, "pared", X0, X1 - G, Z0, Z0 + G, "x")                     # atrás

    # Fachada: ventanales con columnas y celosía, puerta abierta en el centro
    xd = (X0 + X1) / 2
    XD0, XD1 = xd - 0.6, xd + 0.6
    Y_ANTE, Y_DINTEL = Y0 + 0.9, Y0 + 2.6
    caja("pared", X0, X0 + G, Y0, YT, Z1 - G, Z1)
    for xa, xb in ((X0 + G, XD0 - 0.35), (XD1 + 0.35, X1)):
        caja("pared", xa, xb, Y0, Y_ANTE, Z1 - G, Z1)
        n = max(1, round((xb - xa) / 1.5))
        w = (xb - xa) / n
        for i in range(n + 1):
            x = xa + i * w
            caja("madera", x - 0.12, x + 0.12, Y0, YT, Z1 - 0.3, Z1 + 0.05)
        for i in range(n):
            va, vb = xa + i * w + 0.12, xa + (i + 1) * w - 0.12
            caja("vidrio", va, vb, Y_ANTE, Y_DINTEL, Z1 - 0.15, Z1 - 0.1)
            caja("madera_osc", va, vb, Y_DINTEL, YT, Z1 - 0.2, Z1 - 0.15)
            for k in range(4):
                y = Y_DINTEL + 0.12 + k * 0.18
                caja("madera", va, vb, y, y + 0.06, Z1 - 0.15, Z1 - 0.05)
    caja("pared", XD0 - 0.35, XD0, Y0, YT, Z1 - G, Z1)
    caja("pared", XD1, XD1 + 0.35, Y0, YT, Z1 - G, Z1)
    caja("pared", XD0, XD1, Y0 + 2.4, YT, Z1 - G, Z1)
    caja("madera_osc", XD0 - 0.08, XD0, Y0, Y0 + 2.4, Z1 - G, Z1 + 0.03)
    caja("madera_osc", XD1, XD1 + 0.08, Y0, Y0 + 2.4, Z1 - G, Z1 + 0.03)
    caja("madera_osc", XD0 - 0.08, XD1 + 0.08, Y0 + 2.4, Y0 + 2.48, Z1 - G, Z1 + 0.03)
    caja("puerta", XD1 - 0.05, XD1, Y0, Y0 + 2.35, Z1 - G - 1.1, Z1 - G)          # hoja abierta
    caja("mural", XD0 - 0.4, XD1 + 0.4, Y0 + 2.6, Y0 + 3.0, Z1, Z1 + 0.03)         # letrero "Dirección"
    caja("madera_osc", XD0 - 0.25, XD1 + 0.25, Y0 + 2.75, Y0 + 2.85, Z1 + 0.03, Z1 + 0.04)

    b.cubierta(esc)

    # ---------------- Interior ----------------
    XI0, XI1, ZI0, ZI1 = X0 + G, X1 - G, Z0 + G, Z1 - G
    caja("piso_gris", XI0, XI1, Y0, YP, ZI0, ZI1)
    caja("pared_int", XI1 - 0.01, XI1, YP, YT, ZI0, ZI1)
    b.cielo_raso(esc, rejilla(XI0, XI1, 2.8))

    # Divisiones entre la recepción (centro) y las dos oficinas, con su vano de puerta adelante
    xe = XD0 - 1.4                       # división de la oficina este (dirección)
    xo = XD1 + 1.4                       # división de la oficina oeste
    zp0, zp1 = ZI1 - 1.9, ZI1 - 0.9      # vano de las puertas
    for x in (xe, xo):
        caja("pared_int", x - 0.05, x + 0.05, YP, YP + ALTO_DIVISION, ZI0, zp0)
        caja("pared_int", x - 0.05, x + 0.05, YP, YP + ALTO_DIVISION, zp1, ZI1)
        caja("pared_int", x - 0.05, x + 0.05, YP + 2.2, YP + ALTO_DIVISION, zp0, zp1)
        caja("madera_osc", x - 0.07, x + 0.07, YP, YP + 2.2, zp0 - 0.05, zp0)
        caja("madera_osc", x - 0.07, x + 0.07, YP, YP + 2.2, zp1, zp1 + 0.05)

    # Recepción: mostrador frente a la puerta, sillas de espera y una planta
    zr = b.ZC - 0.6
    caja("madera", xd - 1.1, xd + 1.1, YP, YP + 1.05, zr - 0.3, zr + 0.3)
    caja("madera_osc", xd - 1.15, xd + 1.15, YP + 1.05, YP + 1.1, zr - 0.35, zr + 0.35)
    computador(esc, xd - 0.4, zr, YP + 1.1, (0, -1))
    silla(esc, xd - 0.4, zr - 0.8, YP, (0, 1))
    archivador(esc, xd + 0.5, xd + 1.0, ZI0, ZI0 + 0.6, YP)
    for x in (xe + 0.4, xe + 0.95):
        silla(esc, x, ZI1 - 0.5, YP, (0, -1), mat="silla")
    planta(esc, xo - 0.6, ZI1 - 0.6, YP)

    # Oficina de la dirección (este): escritorio, mesa de reuniones, archivo
    xm = (XI0 + xe) / 2
    mesa(esc, xm - 0.8, xm + 0.8, ZI0 + 0.9, ZI0 + 1.7, YP, mat="madera")
    computador(esc, xm, ZI0 + 1.2, YP + 0.74, (0, 1))
    silla(esc, xm, ZI0 + 0.5, YP, (0, 1))
    for dx in (-0.4, 0.4):
        silla(esc, xm + dx, ZI0 + 2.2, YP, (0, -1), mat="silla")
    estante(esc, XI0, XI0 + 0.35, ZI0 + 0.3, ZI0 + 2.3, YP)
    zt = ZI1 - 1.4
    mesa(esc, xm - 0.9, xm + 0.9, zt - 0.5, zt + 0.5, YP, mat="madera")
    for dx in (-0.45, 0.45):
        silla(esc, xm + dx, zt - 0.8, YP, (0, 1), mat="silla")
        silla(esc, xm + dx, zt + 0.8, YP, (0, -1), mat="silla")
    archivador(esc, xe - 0.65, xe - 0.1, ZI0, ZI0 + 0.6, YP)

    # Oficina oeste: dos puestos de trabajo y archivadores
    for x in rejilla(xo, XI1, 2.0, margen=0.2):
        mesa(esc, x - 0.7, x + 0.7, ZI0 + 0.1, ZI0 + 0.8, YP)
        computador(esc, x, ZI0 + 0.4, YP + 0.74, (0, 1))
        silla(esc, x, ZI0 + 1.2, YP, (0, -1))
    for z in (ZI0 + 2.4, ZI0 + 3.0):
        archivador(esc, XI1 - 0.6, XI1, z, z + 0.55, YP)

    for x in rejilla(XI0, XI1, 2.6):
        for z in rejilla(ZI0, ZI1, 3.0):
            panel_luz(esc, x, z, min(b.alto_cielo(z), YT + 0.6))

    # Partida del recorrido: en el patio, frente a la puerta (el Auditorio queda a unos 7 m)
    esc.punto(inicio, xd, Z1 + 4.5)


def colocar(esc, dist, inicio="inicio", terreno=True):
    b, cx, cz, frente = dist["Dirección"]
    esc.colocar(cx, cz, frente)
    construir(esc, b, inicio, terreno)
    esc.punto(nombre_centro("Dirección"), 0.0, b.ZC, y=CUMBRERA + 1.5, extras={"nombre": "Dirección"})


if __name__ == "__main__":
    b, *_ = distribucion()["Dirección"]
    esc = Escena()
    construir(esc, b)
    esc.guardar(sys.argv[1], "Dirección")
