"""Genera el modelo 3D del Aula TIC 2 (static/modelos/aula_tic2.glb) sin dependencias.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_aula_tic2.py static/modelos/aula_tic2.glb

Bloque casi cuadrado (~14,7 x 16 m de techo según el polígono del mapa) entre los dos
corredores cubiertos, al norte del Baño para mujeres y la tienda. La espalda da al corredor
del oeste; el frente mira al este, donde un pasillo con cubierta plana la une al otro corredor
(y otro pasillo igual sale al norte, como se ve en el plano).
Por fuera sigue la foto static/fotos/aula_tic_2.png: muros blancos, alero hondo sobre columnas
de madera, frente de vidrio con marcos de madera, murales en los muros macizos, franja rosada y
mural blanco y negro en el costado norte (con los condensadores del aire) y techo de teja
oscura a cuatro aguas con quiebre de pendiente.
Adentro: sala de cómputo con cuatro filas de computadores, puesto del profesor, tablero y
pantalla de video beam.

En el sistema local: +Z = frente (este), +X = norte.
"""
import sys

from comun import G, YT, Y0, Escena, distribucion, nombre_centro, techo_quiebre
from muebles import archivador, computador, mesa, muro_ventanas, rejilla, silla

MURO = "blanco"
YP = Y0 + 0.02
Y_DINTEL = Y0 + 2.45
P_BAJA, P_ALTA = 0.35, 0.45      # pendiente del techo abajo (alero) y arriba
QUIEBRE = 2.2                    # distancia del borde del techo al quiebre de pendiente
NICHO = 3.6                      # largo del cuarto macizo que sale al frente en la punta norte
SALE = 1.0                       # cuánto sale ese cuarto bajo el alero
PUERTA = (-1.2, 0.6)             # vano de las puertas dobles del frente (x local)
PANEL_SUR = 2.0                  # muro bajo con mural en la punta sur del frente


def y_alero(b):
    return YT - P_BAJA * (b.X0 - b.RX0)


def techo(esc, b):
    """Teja oscura a cuatro aguas con quiebre, como se ve en el plano (cuadro interior)."""
    techo_quiebre(esc, b, P_BAJA, P_ALTA, QUIEBRE)


def columnas(esc, b):
    """Columnas de madera rolliza en el borde del alero del frente, con su viga."""
    z = b.RZ1 - 0.35
    alto = y_alero(b) + P_BAJA * 0.35 - 0.03
    for x in (b.RX0 + 0.4, -3.4, 1.4, b.RX1 - 0.4):
        esc.caja("madera_osc", x - 0.13, x + 0.13, 0.0, alto, z - 0.13, z + 0.13)
        esc.caja("concreto", x - 0.2, x + 0.2, 0.0, 0.25, z - 0.2, z + 0.2)             # base
    esc.caja("madera_osc", b.RX0 + 0.3, b.RX1 - 0.3, alto - 0.22, alto, z - 0.09, z + 0.09)


def mural_cara(esc, x0, x1, y0, y1, z):
    """Mural del cuarto norte (foto): cielo azul, monte verde y un rostro con el pelo oscuro."""
    caja = esc.caja
    caja("mural_azul", x0, x1, y0, y1, z, z + 0.02)
    caja("mural_verde", x0, x1, y0, y0 + (y1 - y0) * 0.35, z + 0.02, z + 0.03)
    caja("mural_verde", (x0 + x1) / 2, x1, y0, y0 + (y1 - y0) * 0.6, z + 0.02, z + 0.03)
    xc = x0 + (x1 - x0) * 0.3
    caja("pc", xc - 0.45, xc + 0.45, y0 + 0.2, y1 - 0.05, z + 0.03, z + 0.04)            # pelo
    caja("blanco", xc - 0.28, xc + 0.28, y1 - 0.85, y1 - 0.15, z + 0.04, z + 0.05)       # rostro
    caja("pc", xc - 0.18, xc - 0.06, y1 - 0.45, y1 - 0.4, z + 0.05, z + 0.06)            # ojos
    caja("pc", xc + 0.06, xc + 0.18, y1 - 0.45, y1 - 0.4, z + 0.05, z + 0.06)
    caja("mural_azul", xc - 0.2, xc - 0.12, y1 - 0.75, y1 - 0.5, z + 0.05, z + 0.06)     # pintura facial
    for k in range(5):                                                                    # estrellas
        xs = xc + 0.8 + k * 0.35
        ys = y1 - 0.25 - (k % 2) * 0.2
        caja("tablero", xs - 0.03, xs + 0.03, ys - 0.03, ys + 0.03, z + 0.02, z + 0.03)


def fachada(esc, b):
    """Frente (+Z): muro bajo con mural al sur, ventanal con puertas dobles abiertas en el centro y,
    al norte, un cuarto macizo que sale bajo el alero con el mural del rostro."""
    caja = esc.caja
    X0, X1, Z1 = b.X0, b.X1, b.Z1
    XN = X1 - NICHO
    zv = Z1 - 0.12                                      # plano del vidrio

    # Punta sur: muro bajo blanco con mural verde y vidrio encima
    xs = X0 + PANEL_SUR
    caja(MURO, X0, xs, Y0, Y0 + 2.0, Z1 - G, Z1)
    caja("mural_verde", X0 + 0.2, xs - 0.1, Y0 + 0.4, Y0 + 1.9, Z1, Z1 + 0.02)
    caja("blanco", X0 + 0.6, X0 + 1.3, Y0 + 0.9, Y0 + 1.8, Z1 + 0.02, Z1 + 0.03)         # rostro
    caja("vidrio", X0, xs, Y0 + 2.0, YT, zv - 0.02, zv + 0.02)
    caja("madera", X0, xs, Y0 + 2.0, Y0 + 2.06, Z1 - G, Z1)

    # Ventanal con marcos de madera; las puertas dobles quedan abiertas (vano libre)
    p0, p1 = PUERTA
    tramos = [(xs, p0), (p1, XN)]
    for a0, a1 in tramos:
        n = max(1, round((a1 - a0) / 0.9))
        for i in range(n + 1):
            x = a0 + (a1 - a0) * i / n
            caja("madera", x - 0.06, x + 0.06, Y0, YT, zv - 0.07, zv + 0.07)
        caja("vidrio", a0, a1, Y0 + 0.05, Y_DINTEL, zv - 0.02, zv + 0.02)
        caja("madera", a0, a1, Y0, Y0 + 0.1, zv - 0.07, zv + 0.07)
        caja("madera", a0, a1, Y0 + 1.0, Y0 + 1.05, zv - 0.05, zv + 0.05)               # travesaño
    caja("madera", xs, XN, Y_DINTEL, Y_DINTEL + 0.08, zv - 0.08, zv + 0.08)
    caja("vidrio", xs, XN, Y_DINTEL + 0.08, YT, zv - 0.02, zv + 0.02)                   # claraboya
    for x in (p0, p1):
        caja("madera_osc", x - 0.08, x + 0.08, Y0, Y_DINTEL, zv - 0.09, zv + 0.09)
    for x, s in ((p0 + 0.08, 1), (p1 - 0.08, -1)):                                     # hojas abiertas
        hx0, hx1 = (x, x + 0.05) if s > 0 else (x - 0.05, x)
        caja("madera", hx0, hx1, Y0, Y_DINTEL - 0.03, zv - 0.9, zv - 0.08)
        caja("vidrio", hx0 - 0.01, hx1 + 0.01, Y0 + 0.15, Y_DINTEL - 0.15, zv - 0.8, zv - 0.18)
    # Franja blanca entre el muro y el techo (el alero del frente es más hondo)
    caja(MURO, X0 + 1.0, XN, YT, YT + 0.3, Z1 - G, Z1)

    # Cuarto macizo de la punta norte, con el mural del rostro
    zf = Z1 + SALE
    caja(MURO, XN, X1, Y0, YT, zf - G, zf)
    caja(MURO, XN, XN + G, Y0, YT, Z1, zf - G)
    mural_cara(esc, XN + 0.3, X1 - 0.3, Y0 + 0.6, Y0 + 2.6, zf)


def costado_norte(esc, b):
    """Muro norte macizo: mural blanco y negro de trazos, franja rosada arriba y los
    condensadores del aire acondicionado sobre una base de metal."""
    caja = esc.caja
    X1, Z0, Z1 = b.X1, b.Z0, b.Z1 + SALE
    caja(MURO, X1 - G, X1, Y0, YT, Z0, Z1)
    caja("rosa", X1, X1 + 0.02, YT - 0.55, YT - 0.1, Z0 + 0.3, Z1 - 0.3)
    # Mural de trazos negros (la mitad del frente hacia el aire)
    z0, z1 = Z1 - 5.5, Z1 - 0.3
    caja("blanco", X1, X1 + 0.02, Y0 + 0.3, YT - 0.65, z0, z1)
    for k in range(int((z1 - z0) / 0.35)):
        z = z0 + 0.1 + k * 0.35
        y = Y0 + 0.5 + (k % 3) * 0.6
        caja("pc", X1 + 0.02, X1 + 0.03, y, y + 0.06, z, z + 0.25)
        caja("pc", X1 + 0.02, X1 + 0.03, Y0 + 0.4, YT - 0.75, z + 0.27, z + 0.31)
        caja("pc", X1 + 0.02, X1 + 0.03, y + 0.9, y + 0.96, z, z + 0.25)
    # Condensadores
    for z in (Z1 - 1.5, Z1 - 2.6):
        caja("metal", X1 + 0.1, X1 + 0.6, Y0, Y0 + 0.4, z - 0.45, z + 0.45)
        caja("aire", X1 + 0.15, X1 + 0.55, Y0 + 0.4, Y0 + 1.65, z - 0.45, z + 0.45)
        caja("pc", X1 + 0.55, X1 + 0.57, Y0 + 0.55, Y0 + 1.5, z - 0.35, z + 0.35)        # rejilla
    caja("metal", X1 + 0.2, X1 + 0.25, Y0 + 1.0, YT - 0.6, Z1 - 3.2, Z1 - 3.15)          # tubería


def pasillo(esc, x0, x1, z0, z1, y=2.85):
    """Pasillo con placa de concreto y cubierta plana sobre cuatro postes de metal."""
    esc.caja("concreto", x0, x1, 0.0, Y0, z0, z1)
    esc.caja("techo", x0 - 0.2, x1 + 0.2, y, y + 0.1, z0, z1)
    esc.caja("madera_osc", x0 - 0.2, x1 + 0.2, y - 0.15, y, z0, z0 + 0.1)
    for x in (x0 + 0.1, x1 - 0.1):
        for z in (z0 + 0.4, z1 - 0.1):
            esc.caja("metal", x - 0.05, x + 0.05, Y0, y, z - 0.05, z + 0.05)


def construir(esc, b, inicio="inicio", terreno=True):
    """Dibuja el Aula TIC 2 en el sistema local de `b` (frente hacia +Z)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    caja = esc.caja
    b.anden(esc, terreno)
    caja("concreto", b.RX0, b.RX1, 0.0, Y0, Z1, b.RZ1)                                  # andén bajo el alero

    fachada(esc, b)
    costado_norte(esc, b)
    muro_ventanas(esc, MURO, Z0, Z1, X0, X0 + G, "z")                                   # sur
    # Espalda (al corredor del oeste): maciza, con una franja de ventanas altas
    Y_VA, Y_VB = Y0 + 2.3, YT - 0.2
    caja(MURO, X0 + G, X1 - G, Y0, Y_VA, Z0, Z0 + G)
    caja(MURO, X0 + G, X1 - G, Y_VB, YT, Z0, Z0 + G)
    caja("vidrio", X0 + G, X1 - G, Y_VA, Y_VB, Z0 + 0.1, Z0 + 0.14)
    for x in rejilla(X0 + G, X1 - G, 1.6)[:-1]:
        caja("madera", x + 0.75, x + 0.85, Y_VA, Y_VB, Z0, Z0 + G)
    techo(esc, b)
    columnas(esc, b)

    # Pasillos que salen al este (al otro corredor) y al norte, según el plano
    pasillo(esc, -2.5, 1.9, b.RZ1 - 0.3, b.RZ1 + 2.8)
    caja("concreto", b.RX1 - 0.3, b.RX1 + 2.2, 0.0, Y0, -4.5, 3.3)                      # al norte
    caja("techo", b.RX1 - 0.3, b.RX1 + 2.2, 2.85, 2.95, -4.7, 3.5)
    for z in (-4.4, 3.2):
        caja("metal", b.RX1 + 2.05, b.RX1 + 2.15, Y0, 2.85, z - 0.05, z + 0.05)

    # ---------------- Interior ----------------
    XI0, XI1, ZI0, ZI1 = X0 + G, X1 - G, Z0 + G, Z1 - G
    caja("piso_gris", XI0, XI1, Y0, YP, ZI0, ZI1)
    caja("piso_gris", X1 - NICHO + G, XI1, Y0, YP, ZI1, Z1 + SALE - G)                  # piso del cuarto

    # Tablero y pantalla en el muro de atrás, video beam colgado del techo
    caja("metal", -2.3, 1.3, 0.95, 2.25, ZI0, ZI0 + 0.04)
    caja("tablero", -2.25, 1.25, 1.0, 2.2, ZI0 + 0.04, ZI0 + 0.06)
    caja("metal", -2.25, 1.25, 0.95, 0.98, ZI0 + 0.04, ZI0 + 0.12)
    caja("metal", 1.8, 4.6, 2.5, 2.55, ZI0 + 0.05, ZI0 + 0.15)
    caja("pantalla", 1.9, 4.5, 0.9, 2.5, ZI0 + 0.08, ZI0 + 0.1)
    caja("metal", 3.19, 3.21, YT - 0.6, YT + 1.5, -1.01, -0.99)
    caja("pc", 2.95, 3.45, YT - 0.75, YT - 0.6, -1.2, -0.8)

    # Puesto del profesor (mirando a la sala)
    mesa(esc, -5.4, -3.6, ZI0 + 1.0, ZI0 + 1.7, YP)
    computador(esc, -4.5, ZI0 + 1.45, YP + 0.74, (0, -1))
    silla(esc, -4.5, ZI0 + 0.6, YP, (0, 1))

    # Cuatro filas de mesas con computadores, con pasillo al medio
    for zr in (-3.6, -1.6, 0.4, 2.4):
        for a0, a1 in ((XI0 + 0.3, -0.7), (0.7, XI1 - 0.3)):
            mesa(esc, a0, a1, zr, zr + 0.7, YP)
            for x in rejilla(a0, a1, 1.0):
                computador(esc, x, zr + 0.3, YP + 0.74, (0, 1))
                caja("pc", x - 0.1, x + 0.1, YP, YP + 0.42, zr + 0.1, zr + 0.55)          # torre
                silla(esc, x, zr + 1.15, YP, (0, -1))

    # Cuarto norte: rack de red e impresora
    archivador(esc, XI1 - 0.6, XI1, ZI1 + 0.1, Z1 + SALE - G - 0.05, YP, alto=1.8)
    mesa(esc, X1 - NICHO + G + 0.1, X1 - NICHO + G + 1.3, ZI1 + 0.1, Z1 + SALE - G - 0.05, YP)
    caja("pc", X1 - NICHO + G + 0.3, X1 - NICHO + G + 0.9, YP + 0.74, YP + 1.0, ZI1 + 0.2, Z1 + SALE - G - 0.2)

    # Aires acondicionados en lo alto del muro norte y lámparas colgantes
    for z in (-4.0, 1.0):
        caja("aire", XI1 - 0.25, XI1, YT - 0.6, YT - 0.25, z - 0.5, z + 0.5)
    yt = YT + 2.0                    # cara de abajo del techo cerca del centro
    for x in (-3.0, 0.0, 3.0):
        for z in (-3.0, 1.5):
            caja("metal", x - 0.01, x + 0.01, YT - 0.3, yt, z - 0.01, z + 0.01)
            caja("tubo", x - 0.6, x + 0.6, YT - 0.35, YT - 0.3, z - 0.06, z + 0.06)

    # Partida del recorrido: en el pasillo del este, frente a las puertas
    esc.punto(inicio, sum(PUERTA) / 2, b.RZ1 + 1.6)


def colocar(esc, dist, inicio="inicio", terreno=True):
    b, cx, cz, frente = dist["Aula tic 2"]
    esc.colocar(cx, cz, frente)
    construir(esc, b, inicio, terreno)
    esc.punto(nombre_centro("Aula tic 2"), 0.0, (b.RZ0 + b.RZ1) / 2, y=8.0, extras={"nombre": "Aula tic 2"})


if __name__ == "__main__":
    b, *_ = distribucion()["Aula tic 2"]
    esc = Escena()
    construir(esc, b)
    esc.guardar(sys.argv[1], "Aula TIC 2")
