"""Genera el modelo 3D de la Sala de sistemas 1 (static/modelos/sala_sistemas1.glb) sin dependencias.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_sala_sistemas1.py static/modelos/sala_sistemas1.glb

Bloque casi cuadrado (~11,2 x 11,4 m de techo según el polígono del mapa) al sur de IMANI,
pegado al corredor cubierto del este y con el frente hacia él (oeste). Por fuera sigue la foto
static/fotos/sala_sistemas_1.png: muros ocre, frente de madera y vidrio con dos pares de puertas
y claraboya, muro macizo al sur con la frase "Nuestra piel es una gran página en blanco; el
cuerpo, un libro", alero con los cabios a la vista, techo de teja oscura con quiebre y una
buganvilia en la esquina.
Adentro: sala de cómputo con tres filas de computadores, tablero y puesto del profesor,
casillero para los bolsos junto a la entrada (regla de la sala) y columnas bajo el quiebre.

En el sistema local: +Z = frente (oeste), +X = sur.
"""
import sys

from comun import G, YT, Y0, Escena, cabios, distribucion, nombre_centro, techo_quiebre
from muebles import computador, frente_madera, mesa, muro_ventanas, planta, rejilla, silla

NOMBRE = "Sala de sistemas 1"
MURO = "pared_mostaza"
YP = Y0 + 0.02
P_BAJA, P_ALTA, QUIEBRE = 0.35, 0.85, 2.2
MACIZO = 1.8                     # muro de la frase en la punta sur del frente


def frase(esc, x0, x1, z):
    """La frase pintada en blanco, como renglones cortos, y la placa de abajo."""
    largos = (0.55, 0.9, 1.0, 0.95, 0.75, 0.85, 0.6)
    for k, L in enumerate(largos):
        y = Y0 + 2.55 - k * 0.2
        xm = (x0 + x1) / 2
        esc.caja("tablero", xm - L / 2, xm + L / 2, y, y + 0.07, z, z + 0.01)
    esc.caja("tablero", x0 + 0.1, x1 - 0.1, Y0 + 1.05, Y0 + 1.2, z, z + 0.01)


def buganvilia(esc, x, z):
    planta(esc, x, z, 0.0)
    for dx, dy, dz in ((0.25, 1.2, 0.1), (-0.2, 1.35, -0.15), (0.05, 1.5, 0.25), (-0.3, 1.0, 0.2)):
        esc.caja("rosa", x + dx - 0.12, x + dx + 0.12, dy, dy + 0.2, z + dz - 0.12, z + dz + 0.12)


def construir(esc, b, inicio="inicio", terreno=True):
    """Dibuja la sala en el sistema local de `b` (frente hacia +Z)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    caja = esc.caja
    b.anden(esc, terreno)

    # Frente: pilastra al norte, paños de madera y vidrio, muro macizo con la frase al sur
    zv = Z1 - 0.12
    caja(MURO, X0, X0 + 0.3, Y0, YT, Z1 - 0.3, Z1)
    puertas = frente_madera(esc, MURO, X0 + 0.3, X1 - MACIZO, zv, "FPPF|FPPF", abiertas=(1,))
    caja(MURO, X1 - MACIZO, X1, Y0, YT, Z1 - 0.45, Z1)
    frase(esc, X1 - MACIZO + 0.15, X1 - 0.15, Z1)

    muro_ventanas(esc, MURO, Z0, Z1 - 0.3, X0, X0 + G, "z", paso=1.2)                     # norte
    muro_ventanas(esc, MURO, Z0, Z1 - 0.45, X1 - G, X1, "z", paso=1.2)                    # sur
    muro_ventanas(esc, MURO, X0 + G, X1 - G, Z0, Z0 + G, "x", y_ante=Y0 + 2.0, y_dintel=YT - 0.15)
    techo_quiebre(esc, b, P_BAJA, P_ALTA, QUIEBRE, abajo="madera")
    cabios(esc, b, P_BAJA)
    buganvilia(esc, b.RX1 + 0.7, b.RZ1 - 0.8)

    # ---------------- Interior ----------------
    XI0, XI1, ZI0, ZI1 = X0 + G, X1 - G, Z0 + G, Z1 - 0.45
    caja("piso_gris", XI0, XI1, Y0, YP, ZI0, ZI1)

    # Columnas de madera bajo el quiebre del techo, con sus vigas
    c = min(b.RX1, b.RZ1) - QUIEBRE - 0.4
    y_col = YT - P_BAJA * (b.X0 - b.RX0) + P_BAJA * QUIEBRE + P_ALTA * 0.4 - 0.05
    for x in (-c, c):
        for z in (-c, c):
            caja("madera_osc", x - 0.1, x + 0.1, Y0, y_col, z - 0.1, z + 0.1)
        caja("madera_osc", x - 0.08, x + 0.08, y_col - 0.25, y_col, -c, c)

    # Tablero en el muro del fondo (este) y puesto del profesor
    caja("metal", -1.6, 1.6, 0.95, 2.25, ZI0, ZI0 + 0.04)
    caja("tablero", -1.55, 1.55, 1.0, 2.2, ZI0 + 0.04, ZI0 + 0.06)
    mesa(esc, -2.4, -0.9, ZI0 + 1.0, ZI0 + 1.7, YP)
    computador(esc, -1.65, ZI0 + 1.45, YP + 0.74, (0, -1))
    silla(esc, -1.65, ZI0 + 0.6, YP, (0, 1))

    # Tres filas de mesas con computadores, mirando al tablero, con pasillo al medio
    for zr in (-2.1, -0.4, 1.3):
        for a0, a1 in ((XI0 + 0.3, -0.6), (0.6, XI1 - 0.3)):
            mesa(esc, a0, a1, zr, zr + 0.7, YP)
            for x in rejilla(a0, a1, 1.0):
                computador(esc, x, zr + 0.3, YP + 0.74, (0, 1))
                caja("pc", x - 0.1, x + 0.1, YP, YP + 0.42, zr + 0.1, zr + 0.55)          # torre
                silla(esc, x, zr + 1.15, YP, (0, -1))

    # Casillero para los bolsos junto a la entrada
    caja("madera", XI0, XI0 + 0.75, YP, YP + 1.2, ZI1 - 0.4, ZI1)
    for k in range(1, 3):
        caja("madera_osc", XI0, XI0 + 0.75, YP + 0.4 * k - 0.02, YP + 0.4 * k, ZI1 - 0.42, ZI1 - 0.38)

    # Aires acondicionados en el muro norte y lámparas colgadas de las vigas
    for z in (-2.0, 1.5):
        caja("aire", XI0, XI0 + 0.25, YT - 0.6, YT - 0.25, z - 0.5, z + 0.5)
    for x in (-c, c):
        for z in (-1.5, 1.5):
            caja("metal", x - 0.01, x + 0.01, YT - 0.4, y_col - 0.25, z - 0.01, z + 0.01)
            caja("tubo", x - 0.06, x + 0.06, YT - 0.45, YT - 0.4, z - 0.6, z + 0.6)

    # Partida del recorrido: en el corredor, frente a las puertas abiertas
    esc.punto(inicio, puertas[1], b.RZ1 + 2.0)


def colocar(esc, dist, inicio="inicio", terreno=True):
    b, cx, cz, frente = dist[NOMBRE]
    esc.colocar(cx, cz, frente)
    construir(esc, b, inicio, terreno)
    esc.punto(nombre_centro(NOMBRE), 0.0, (b.RZ0 + b.RZ1) / 2, y=8.0, extras={"nombre": NOMBRE})


if __name__ == "__main__":
    b, *_ = distribucion()[NOMBRE]
    esc = Escena()
    construir(esc, b)
    esc.guardar(sys.argv[1], NOMBRE)
