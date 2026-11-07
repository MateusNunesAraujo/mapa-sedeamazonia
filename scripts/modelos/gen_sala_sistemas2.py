"""Genera el modelo 3D de la Sala de sistemas 2 (static/modelos/sala_sistemas2.glb) sin dependencias.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_sala_sistemas2.py static/modelos/sala_sistemas2.glb

La sala está pegada al Auditorio, en el mismo bloque y bajo el mismo techo, así que
usa su mismo estilo. No hay foto de la sala: el interior es una sala de cómputo típica
(filas de mesas con computadores, tablero, video beam y aire acondicionado).
Las medidas salen del polígono del mapa (ver comun.distribucion).
"""
import sys

from comun import Escena, G, Y0, YT, distribucion


def construir(esc, b, inicio="inicio", terreno=True):
    """Dibuja la sala en el sistema local de `b` (frente hacia +Z, tablero en el muro -X)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    caja = esc.caja
    b.anden(esc, terreno)

    # Muros laterales (el -X es el que comparte con el auditorio)
    caja("pared", X0, X0 + G, Y0, YT, Z0, Z1)
    caja("pared", X1 - G, X1, Y0, YT, Z0, Z1)

    # Muro trasero con ventanas altas (franja de vidrio + celosía)
    Y_VENT_A, Y_VENT_B = Y0 + 2.2, YT - 0.25
    caja("pared", X0, X1, Y0, Y_VENT_A, Z0, Z0 + G)
    caja("pared", X0, X1, Y_VENT_B, YT, Z0, Z0 + G)
    n_vent = max(1, round((X1 - X0 - 2 * G) / 3.2))
    paso = (X1 - X0 - 2 * G) / n_vent
    for i in range(n_vent):
        xa, xb = X0 + G + i * paso, X0 + G + (i + 1) * paso
        if i:
            caja("pared", xa - 0.1, xa + 0.1, Y_VENT_A, Y_VENT_B, Z0, Z0 + G)
        caja("vidrio", xa, xb, Y_VENT_A, Y_VENT_B, Z0 + 0.1, Z0 + 0.14)
        for k in range(4):
            y = Y_VENT_A + 0.1 + k * 0.2
            caja("madera", xa, xb, y, y + 0.06, Z0 - 0.06, Z0)

    # Fachada: ventanales con columnas de madera y la puerta (abierta) a la derecha
    XD0, XD1 = X1 - 1.6, X1 - 0.45           # vano de la puerta
    XV0, XV1 = X0 + G, XD0 - 0.3
    n_vanos = max(1, round((XV1 - XV0) / 1.3))
    ancho = (XV1 - XV0) / n_vanos
    Y_ANTEPECHO = Y0 + 0.9
    Y_DINTEL = Y0 + 2.6
    caja("pared", XV0, XV1, Y0, Y_ANTEPECHO, Z1 - G, Z1)
    for i in range(n_vanos + 1):
        x = XV0 + i * ancho
        caja("madera", x - 0.12, x + 0.12, Y0, YT, Z1 - 0.3, Z1 + 0.05)
    for i in range(n_vanos):
        xa = XV0 + i * ancho + 0.12
        xb = xa + ancho - 0.24
        xm = (xa + xb) / 2
        caja("vidrio", xa, xb, Y_ANTEPECHO, Y_DINTEL, Z1 - 0.15, Z1 - 0.1)
        caja("madera", xm - 0.04, xm + 0.04, Y_ANTEPECHO, Y_DINTEL, Z1 - 0.12, Z1 - 0.05)
        caja("madera_osc", xa, xb, Y_DINTEL, YT, Z1 - 0.2, Z1 - 0.15)
        for k in range(4):
            y = Y_DINTEL + 0.12 + k * 0.18
            caja("madera", xa, xb, y, y + 0.06, Z1 - 0.15, Z1 - 0.05)
    caja("madera", XV0, XV1, Y_DINTEL, Y_DINTEL + 0.1, Z1 - 0.15, Z1 - 0.02)

    # Tramo macizo con la puerta
    caja("pared", XV1, XD0, Y0, YT, Z1 - G, Z1)
    caja("pared", XD1, X1, Y0, YT, Z1 - G, Z1)
    caja("pared", XD0, XD1, Y0 + 2.4, YT, Z1 - G, Z1)
    caja("madera_osc", XD0 - 0.08, XD0, Y0, Y0 + 2.4, Z1 - G, Z1 + 0.03)             # marco
    caja("madera_osc", XD1, XD1 + 0.08, Y0, Y0 + 2.4, Z1 - G, Z1 + 0.03)
    caja("madera_osc", XD0 - 0.08, XD1 + 0.08, Y0 + 2.4, Y0 + 2.48, Z1 - G, Z1 + 0.03)
    caja("puerta", XD1 - 0.05, XD1, Y0, Y0 + 2.35, Z1 - G - 1.1, Z1 - G)              # hoja abierta
    # Letrero "Sala de sistemas 2" sobre la puerta
    caja("mural", XD0, XD1, Y0 + 2.6, Y0 + 3.0, Z1, Z1 + 0.03)
    caja("madera_osc", XD0 + 0.1, XD1 - 0.1, Y0 + 2.75, Y0 + 2.85, Z1 + 0.03, Z1 + 0.04)

    b.cubierta(esc)

    # ---------------- Interior ----------------
    XI0, XI1 = X0 + G, X1 - G
    ZI0, ZI1 = Z0 + G, Z1 - G
    ZC = b.ZC
    caja("piso_gris", XI0, XI1, Y0, Y0 + 0.02, ZI0, ZI1)
    YP = Y0 + 0.02
    caja("pared_int", XI0, XI0 + 0.01, YP, YT, ZI0, ZI1)
    caja("pared_int", XI1 - 0.01, XI1, YP, YT, ZI0, ZI1)

    vigas = [XI0 + 1.4 + 2.5 * k for k in range(int((XI1 - XI0 - 1.4) / 2.5) + 1)]
    b.cielo_raso(esc, vigas)

    # Tablero en el muro -X (frente de la clase)
    mt = min(2.0, (ZI1 - ZI0) / 2 - 1.0)
    caja("metal", XI0 + 0.01, XI0 + 0.05, 0.95, 2.25, ZC - mt - 0.05, ZC + mt + 0.05)
    caja("tablero", XI0 + 0.05, XI0 + 0.07, 1.0, 2.2, ZC - mt, ZC + mt)
    caja("metal", XI0 + 0.07, XI0 + 0.12, 0.95, 0.98, ZC - mt, ZC + mt)
    # Video beam colgado del cielo raso, apuntando al tablero
    xb = XI0 + 2.4
    yc = b.alto_cielo(ZC)
    caja("metal", xb - 0.02, xb + 0.02, yc - 0.6, yc, ZC - 0.02, ZC + 0.02)
    caja("aire", xb - 0.2, xb + 0.2, yc - 0.75, yc - 0.6, ZC - 0.2, ZC + 0.2)
    caja("pc", xb - 0.22, xb - 0.2, yc - 0.7, yc - 0.65, ZC - 0.05, ZC + 0.05)
    # Aire acondicionado en el muro +X
    caja("aire", XI1 - 0.25, XI1, 2.55, 2.9, ZC - 0.5, ZC + 0.5)
    caja("metal", XI1 - 0.26, XI1 - 0.25, 2.58, 2.62, ZC - 0.45, ZC + 0.45)

    def computador(x, z, y, mirando=-1):
        """Monitor, teclado y mouse sobre una mesa; mirando=-1 es hacia el tablero (-X)."""
        s = mirando
        caja("pc", x - 0.12, x + 0.12, y, y + 0.02, z - 0.1, z + 0.1)
        caja("pc", x - 0.02, x + 0.02, y + 0.02, y + 0.12, z - 0.02, z + 0.02)
        caja("pc", x - 0.03, x + 0.03, y + 0.12, y + 0.44, z - 0.28, z + 0.28)
        caja("pantalla_pc", x + s * 0.031, x + s * 0.035, y + 0.14, y + 0.42, z - 0.26, z + 0.26)
        kx = x - s * 0.3
        caja("pc", kx - 0.08, kx + 0.08, y, y + 0.02, z - 0.22, z + 0.22)
        caja("pc", kx - 0.05, kx + 0.05, y, y + 0.02, z + 0.3, z + 0.36)

    def silla(x, z, y=YP, mirando=-1):
        """Silla de oficina; mirando=-1 es hacia el tablero (-X)."""
        e = -mirando                                      # lado del espaldar
        caja("silla_negra", x - 0.24, x + 0.24, y + 0.44, y + 0.5, z - 0.24, z + 0.24)
        caja("silla_negra", x + e * 0.2, x + e * 0.26, y + 0.55, y + 0.95, z - 0.22, z + 0.22)
        caja("metal", x - 0.03, x + 0.03, y + 0.08, y + 0.44, z - 0.03, z + 0.03)
        caja("metal", x - 0.25, x + 0.25, y + 0.03, y + 0.07, z - 0.03, z + 0.03)
        caja("metal", x - 0.03, x + 0.03, y + 0.03, y + 0.07, z - 0.25, z + 0.25)

    def mesa(x0, x1, z0, z1, y=YP):
        caja("mesa", x0, x1, y + 0.72, y + 0.76, z0, z1)
        for zx in (z0 + 0.05, z1 - 0.05):
            caja("metal", x0 + 0.03, x1 - 0.03, y, y + 0.72, zx - 0.02, zx + 0.02)

    # Escritorio del profesor, cerca del tablero y del frente
    XP = XI0 + 1.2
    zp0, zp1 = ZC + 1.0, ZC + 2.5
    mesa(XP - 0.4, XP + 0.4, zp0, zp1)
    computador(XP, (zp0 + zp1) / 2, YP + 0.76, mirando=1)
    caja("pc", XP - 0.35, XP - 0.15, YP, YP + 0.45, zp1 - 0.4, zp1 - 0.2)
    silla(XP - 0.7, (zp0 + zp1) / 2, mirando=1)

    # Filas de mesas con computadores; pasillo central y un pasillo adelante para entrar
    bloques_z = [(ZI0 + 0.4, ZC - 0.6), (ZC + 0.6, ZI1 - 1.3)]
    xm = XP + 1.0
    while xm + 1.35 <= XI1 - 0.2:
        for z0, z1 in bloques_z:
            n = max(1, int((z1 - z0) / 1.0))
            mesa(xm, xm + 0.75, z0, z1)
            p = (z1 - z0) / n
            for k in range(n):
                z = z0 + p * (k + 0.5)
                computador(xm + 0.2, z, YP + 0.76)
                caja("pc", xm + 0.05, xm + 0.25, YP, YP + 0.45, z + 0.25, z + 0.43)   # torre
                silla(xm + 1.05, z)
        xm += 1.6

    # Lámparas de panel en el cielo raso
    nx = max(2, round((XI1 - XI0) / 2.3))
    for i in range(nx):
        x = XI0 + (XI1 - XI0) * (i + 0.5) / nx
        for z in (ZC - 2.8, ZC + 2.8):
            y = b.alto_cielo(z) - 0.05
            caja("metal", x - 0.32, x + 0.32, y - 0.02, y, z - 0.32, z + 0.32)
            caja("lampara", x - 0.3, x + 0.3, y - 0.04, y - 0.02, z - 0.3, z + 0.3)

    # Punto de partida del recorrido: afuera, frente a la puerta, mirando al edificio
    esc.punto(inicio, (XD0 + XD1) / 2, Z1 + 8.0)


if __name__ == "__main__":
    b, *_ = distribucion()["Sala de sistemas 2"]
    esc = Escena()
    construir(esc, b)
    esc.guardar(sys.argv[1], "Sala de sistemas 2")
