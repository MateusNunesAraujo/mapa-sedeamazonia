"""Genera el modelo 3D de la Biblioteca (static/modelos/biblioteca.glb) sin dependencias.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_biblioteca.py static/modelos/biblioteca.glb

En el plano la biblioteca tiene forma de L y se arma con tres partes:
  - Ala norte: sigue la hilera del Auditorio hacia el oeste, con techo a cuatro aguas
    en la punta. Adentro, estanterías y mesas de estudio.
  - Ala sur: sigue la hilera de la Dirección hacia el oeste. Es la sala de lectura;
    por fuera, el muro mostaza con el mural en relieve (foto static/fotos/biblioteca.png).
  - Hall de entrada entre las dos alas, con la puerta de vidrio hacia el patio.
"""
import math
import sys

from comun import CUMBRERA, PISO, G, Y0, YT, Escena, distribucion, nombre_centro
from muebles import (computador, estante, mesa, muro_puerta, muro_ventanas, panel_luz, planta,
                     rejilla, silla)

MURO = "pared_mostaza"
YP = Y0 + 0.02


def ala_norte(esc, b, xl):
    """Estanterías y mesas de estudio. xl: x local donde termina el hall (lado este)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    b.anden(esc, terreno=False)
    esc.caja(MURO, X0, X0 + G, Y0, YT, Z0, Z1)                                   # muro con la sala
    muro_ventanas(esc, MURO, X0 + G, X1, Z1 - G, Z1, "x")                         # frente (norte)
    muro_ventanas(esc, MURO, Z0 + G, Z1 - G, X1 - G, X1, "z")                     # oeste
    muro_puerta(esc, MURO, X0, X1, Z0, Z0 + G, (xl + X1) / 2, 2.0, "x")          # hacia el hall
    b.cubierta(esc, MURO)

    XI0, XI1, ZI0, ZI1 = X0 + G, X1 - G, Z0 + G, Z1 - G
    esc.caja("piso", XI0, XI1, Y0, YP, ZI0, ZI1)
    b.cielo_raso(esc, rejilla(XI0, XI1, 2.5), plano=True)

    # Estanterías dobles (de norte a sur) en la mitad este, y una contra el muro este
    x_fin = XI0 + (XI1 - XI0) * 0.55
    estante(esc, XI0, XI0 + 0.35, ZI0 + 1.8, ZI1 - 0.3, YP)
    x = XI0 + 1.6
    while x + 0.25 < x_fin:
        estante(esc, x - 0.25, x + 0.25, ZI0 + 1.8, ZI1 - 1.0, YP)
        x += 1.7
    # Mesas de estudio en la mitad oeste, junto a las ventanas
    xm = (x_fin + XI1) / 2 + 0.2
    for z in rejilla(ZI0 + 1.6, ZI1 - 0.4, 2.3):
        mesa(esc, xm - 0.45, xm + 0.45, z - 0.8, z + 0.8, YP, mat="madera")
        for dz in (-0.45, 0.45):
            silla(esc, xm - 0.75, z + dz, YP, (1, 0))
            silla(esc, xm + 0.75, z + dz, YP, (-1, 0))
    for x in rejilla(XI0, XI1, 2.6):
        for z in rejilla(ZI0, ZI1, 3.0):
            panel_luz(esc, x, z, YT - 0.06)


def ala_sur(esc, b, xl):
    """Sala de lectura. xl: x local donde termina el hall (lado este)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    b.anden(esc, terreno=False)
    esc.caja(MURO, X0, X0 + G, Y0, YT, Z0, Z1)                                   # muro con la Dirección
    alta = dict(y_ante=Y0 + 2.25, y_dintel=YT - 0.15)                            # ventanas altas
    muro_ventanas(esc, MURO, X0 + G, X1, Z0, Z0 + G, "x", **alta)                # atrás (sur)
    muro_ventanas(esc, MURO, Z0 + G, Z1 - G, X1 - G, X1, "z", **alta)            # oeste
    # Frente: hacia el patio, muro con mural y ventanas altas; dentro del hall, la puerta
    muro_ventanas(esc, MURO, X0 + G, xl, Z1 - G, Z1, "x", **alta)
    muro_puerta(esc, MURO, xl, X1, Z1 - G, Z1, (xl + X1) / 2, 2.0, "x")
    mural_relieve(esc, X0 + 0.8, xl - 0.6, Z1 + 0.02)
    b.cubierta(esc, MURO)

    XI0, XI1, ZI0, ZI1 = X0 + G, X1 - G, Z0 + G, Z1 - G
    esc.caja("piso", XI0, XI1, Y0, YP, ZI0, ZI1)
    b.cielo_raso(esc, rejilla(XI0, XI1, 2.5), plano=True)

    # Estanterías contra el muro de atrás y el muro este (debajo de las ventanas altas)
    estante(esc, XI0 + 0.5, XI1 - 0.5, ZI0, ZI0 + 0.35, YP)
    estante(esc, XI0, XI0 + 0.35, ZI0 + 0.6, ZI1 - 0.6, YP)
    # Mesas de lectura con seis sillas
    zc = b.ZC - 0.2
    for x in rejilla(XI0 + 1.0, XI1 - 0.5, 3.2):
        mesa(esc, x - 1.0, x + 1.0, zc - 0.5, zc + 0.5, YP, mat="madera")
        for dx in (-0.6, 0.0, 0.6):
            silla(esc, x + dx, zc - 0.8, YP, (0, 1))
            silla(esc, x + dx, zc + 0.8, YP, (0, -1))
    # Computadores de consulta junto al frente, en el lado este
    mesa(esc, XI0 + 0.6, XI0 + 3.4, ZI1 - 0.75, ZI1 - 0.05, YP)
    for x in (XI0 + 1.1, XI0 + 2.0, XI0 + 2.9):
        computador(esc, x, ZI1 - 0.35, YP + 0.74, (0, -1))
        silla(esc, x, ZI1 - 1.1, YP, (0, 1))
    for x in rejilla(XI0, XI1, 2.6):
        for z in rejilla(ZI0, ZI1, 3.0):
            panel_luz(esc, x, z, YT - 0.06)


def mural_relieve(esc, x0, x1, z):
    """Mural en relieve de barro (peces y hojas) sobre el muro que mira a +Z."""
    def pez(cx, cy, s):
        esc.poligono("relieve", [[cx - 0.7 * s, cy, z], [cx - 0.3 * s, cy - 0.28 * s, z],
                                 [cx + 0.4 * s, cy - 0.22 * s, z], [cx + 0.7 * s, cy, z],
                                 [cx + 0.4 * s, cy + 0.22 * s, z], [cx - 0.3 * s, cy + 0.28 * s, z]])
        esc.poligono("relieve", [[cx + 0.7 * s, cy, z], [cx + 1.05 * s, cy - 0.3 * s, z],
                                 [cx + 1.05 * s, cy + 0.3 * s, z]])
        esc.caja("madera_osc", cx - 0.5 * s, cx - 0.42 * s, cy + 0.04 * s, cy + 0.12 * s, z, z + 0.01)  # ojo

    def hoja(cx, cy, s):
        esc.poligono("relieve", [[cx, cy - 0.5 * s, z], [cx + 0.18 * s, cy, z],
                                 [cx, cy + 0.5 * s, z], [cx - 0.18 * s, cy, z]])

    x, k = x0 + 0.8, 0
    while x < x1 - 0.8:
        pez(x, Y0 + 0.75 + 0.35 * math.sin(k * 1.7), 0.9 + 0.25 * math.sin(k * 2.3))
        hoja(x + 0.9, Y0 + 1.6 + 0.2 * math.cos(k), 0.8)
        x += 2.1
        k += 1
    esc.caja("relieve", x0, x1, Y0 + 0.05, Y0 + 0.2, z - 0.02, z + 0.01)          # zócalo de barro


def colocar(esc, dist, inicio="inicio", terreno=True):
    """Las dos alas y el hall, cada uno en su sitio según el mapa."""
    bn, cxn, czn, frente = dist["Biblioteca norte"]
    bs, cxs, czs, _ = dist["Biblioteca sur"]
    # Con el frente al norte: x_mundo = cx - x_local, z_mundo = cz - z_local
    x_oeste = cxn - bn.X1                 # cara exterior del muro oeste
    x_este = cxn - bn.X0 - 0.6            # puerta de vidrio del hall, un poco antes de la sala
    z_n = czn - bn.Z0                     # muro de atrás del ala norte
    z_s = czs - bs.Z1                     # muro del frente del ala sur

    esc.colocar(cxn, czn, frente)
    ala_norte(esc, bn, cxn - x_este)
    esc.colocar(cxs, czs, frente)
    ala_sur(esc, bs, cxs - x_este)

    # ---- Hall de entrada (coordenadas del mundo) ----
    esc.colocar(0.0, 0.0, "sur")
    zm = (z_n + z_s) / 2
    if terreno:
        esc.caja("pasto", x_oeste - 6, x_este + 14, -0.05, 0.0, czn - bn.RZ1 - 4, czs - bs.RZ0 + 4)
    esc.caja("concreto", x_oeste - 1.2, x_este + 1.2, 0.0, PISO, z_n - 0.1, z_s + 0.1)
    esc.caja("piso", x_oeste + G, x_este, Y0, YP, z_n, z_s)
    muro_ventanas(esc, MURO, z_n, z_s, x_oeste, x_oeste + G, "z")                 # muro oeste
    # Fachada de vidrio con la puerta abierta en el centro
    xv = x_este - 0.15
    for za, zb in ((z_n, zm - 0.9), (zm + 0.9, z_s)):
        esc.caja("vidrio", xv + 0.05, xv + 0.09, Y0, Y0 + 2.5, za, zb)
        for zc in rejilla(za, zb, 1.1) + [za + 0.05, zb - 0.05]:
            esc.caja("madera", xv, xv + 0.15, Y0, Y0 + 2.5, zc - 0.05, zc + 0.05)
    esc.caja("madera", xv, xv + 0.15, Y0 + 2.5, YT, z_n, z_s)                      # dintel
    for s in (-1, 1):                                                              # hojas abiertas
        esc.caja("vidrio", xv - 0.85, xv, Y0, Y0 + 2.4, zm + s * 0.9 - 0.02, zm + s * 0.9 + 0.02)
        esc.caja("madera", xv - 0.85, xv, Y0, Y0 + 0.1, zm + s * 0.9 - 0.04, zm + s * 0.9 + 0.04)
    esc.caja("mural", xv + 0.15, xv + 0.18, Y0 + 2.62, Y0 + 3.0, zm - 0.9, zm + 0.9)  # letrero
    esc.caja("madera_osc", xv + 0.18, xv + 0.19, Y0 + 2.76, Y0 + 2.86, zm - 0.7, zm + 0.7)
    # Techo plano de muro a muro: queda a ras con el borde de los techos inclinados de las alas
    esc.caja("techo", cxn - bn.RX1, x_este + 0.8, YT, YT + 0.2, z_n, z_s)
    esc.caja("cielo", x_oeste + G, x_este, YT - 0.04, YT, z_n, z_s)
    # Mostrador de préstamo, plantas y luz
    esc.caja("madera", x_oeste + 1.2, x_oeste + 3.4, YP, YP + 1.05, z_s - 1.3, z_s - 0.7)
    esc.caja("madera_osc", x_oeste + 1.15, x_oeste + 3.45, YP + 1.05, YP + 1.1, z_s - 1.35, z_s - 0.65)
    computador(esc, x_oeste + 2.0, z_s - 1.0, YP + 1.1, (0, -1))
    silla(esc, x_oeste + 2.3, z_s - 0.3, YP, (0, -1))
    planta(esc, xv - 0.6, z_n + 0.6, YP)
    planta(esc, xv - 0.6, z_s - 0.6, YP)
    panel_luz(esc, (x_oeste + x_este) / 2, zm, YT - 0.04)

    # Partida del recorrido: en el patio, frente a la puerta, mirando al oeste
    esc.punto(inicio, x_este + 6.0, zm, giro=math.pi / 2)
    esc.punto(nombre_centro("Biblioteca"), (x_oeste + x_este) / 2, zm, y=CUMBRERA + 1.5,
              extras={"nombre": "Biblioteca"})
    return (x_oeste + x_este) / 2, zm


if __name__ == "__main__":
    dist = distribucion()
    bn, cxn, czn, _ = dist["Biblioteca norte"]
    bs, cxs, czs, _ = dist["Biblioteca sur"]
    # Modelo suelto centrado en el hall
    centro = ((cxn - bn.X1 + cxn - bn.X0) / 2, (czn + czs) / 2)
    esc = Escena(origen=centro)
    colocar(esc, dist)
    esc.guardar(sys.argv[1], "Biblioteca")
