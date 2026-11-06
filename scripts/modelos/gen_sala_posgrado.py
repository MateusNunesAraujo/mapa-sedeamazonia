"""Genera el modelo 3D de la Sala de posgrado (static/modelos/sala_posgrado.glb) sin dependencias.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_sala_posgrado.py static/modelos/sala_posgrado.glb

Bloque casi cuadrado (~11,5 x 11,2 m de techo según el polígono del mapa) al este de IMANI y de
la Sala de sistemas 1, con el frente al oeste: sus puertas dan al paso que queda entre esas dos
y su esquina norte queda bajo el alero de IMANI (así se ve en la foto). Por fuera sigue la foto
static/fotos/sala_sistemas_posgrado.png: muros vinotinto, muro macizo al norte con el extintor,
ventana de madera sobre antepecho, dos pares de puertas de vidrio, claraboya, cabios a la vista
y techo de teja oscura con quiebre.
Adentro: puestos con computador contra los dos costados, mesa de trabajo en el centro, tablero,
casillero para los bolsos (regla de la sala) y columnas bajo el quiebre.

En el sistema local: +Z = frente (oeste), +X = sur.
"""
import sys

from comun import G, YT, Y0, Escena, cabios, distribucion, nombre_centro, techo_quiebre
from muebles import archivador, computador, frente_madera, mesa, muro_ventanas, planta, rejilla, silla

NOMBRE = "Sala de posgrado"
MURO = "vino"
YP = Y0 + 0.02
P_BAJA, P_ALTA, QUIEBRE = 0.35, 0.85, 2.2
MACIZO = 1.6                     # muro vinotinto de la punta norte del frente


def construir(esc, b, inicio="inicio", terreno=True):
    """Dibuja la sala en el sistema local de `b` (frente hacia +Z)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    caja = esc.caja
    b.anden(esc, terreno)

    # Frente: muro macizo al norte (con extintor y aviso), paños de madera y pilastra al sur
    zv = Z1 - 0.12
    caja(MURO, X0, X0 + MACIZO, Y0, YT, Z1 - 0.3, Z1)
    xe = X0 + MACIZO - 0.5
    caja("rojo", xe - 0.08, xe + 0.08, Y0 + 0.9, Y0 + 1.45, Z1, Z1 + 0.16)                 # extintor
    caja("tablero", xe - 0.15, xe + 0.15, Y0 + 1.7, Y0 + 2.0, Z1, Z1 + 0.01)              # aviso
    puertas = frente_madera(esc, MURO, X0 + MACIZO, X1 - 0.3, zv, "|VVPP|PPF", abiertas=(0,))
    caja(MURO, X1 - 0.3, X1, Y0, YT, Z1 - 0.3, Z1)

    muro_ventanas(esc, MURO, Z0, Z1 - 0.3, X0, X0 + G, "z", y_ante=Y0 + 2.0,              # norte (a IMANI)
                  y_dintel=YT - 0.15, paso=1.2)
    muro_ventanas(esc, MURO, Z0, Z1 - 0.3, X1 - G, X1, "z", paso=1.2)                     # sur
    muro_ventanas(esc, MURO, X0 + G, X1 - G, Z0, Z0 + G, "x")                              # fondo
    techo_quiebre(esc, b, P_BAJA, P_ALTA, QUIEBRE, abajo="madera")
    cabios(esc, b, P_BAJA)

    # ---------------- Interior ----------------
    XI0, XI1, ZI0, ZI1 = X0 + G, X1 - G, Z0 + G, Z1 - 0.3
    caja("piso_gris", XI0, XI1, Y0, YP, ZI0, ZI1)

    # Columnas de madera bajo el quiebre del techo, con sus vigas
    c = min(b.RX1, b.RZ1) - QUIEBRE - 0.4
    y_col = YT - P_BAJA * (b.X0 - b.RX0) + P_BAJA * QUIEBRE + P_ALTA * 0.4 - 0.05
    for x in (-c, c):
        for z in (-c, c):
            caja("madera_osc", x - 0.1, x + 0.1, Y0, y_col, z - 0.1, z + 0.1)
        caja("madera_osc", x - 0.08, x + 0.08, y_col - 0.25, y_col, -c, c)

    # Puestos con computador contra los dos costados, mirando al muro
    for xm, s in ((XI0, 1), (XI1, -1)):
        x0, x1 = (xm, xm + 0.7) if s > 0 else (xm - 0.7, xm)
        mesa(esc, x0, x1, -2.6, 2.6, YP)
        for z in rejilla(-2.6, 2.6, 1.05):
            computador(esc, xm + s * 0.3, z, YP + 0.74, (s, 0))
            caja("pc", xm + s * 0.1 - 0.1, xm + s * 0.1 + 0.1, YP, YP + 0.42, z + 0.25, z + 0.45)
            silla(esc, xm + s * 1.15, z, YP, (-s, 0))

    # Mesa de trabajo en el centro
    mesa(esc, -0.9, 0.9, -1.6, 0.8, YP, mat="madera")
    for z in (-1.0, 0.2):
        silla(esc, -1.25, z, YP, (1, 0))
        silla(esc, 1.25, z, YP, (-1, 0))

    # Tablero en el fondo (este), archivador y planta
    caja("metal", -1.5, 1.5, 0.95, 2.25, ZI0, ZI0 + 0.04)
    caja("tablero", -1.45, 1.45, 1.0, 2.2, ZI0 + 0.04, ZI0 + 0.06)
    archivador(esc, XI1 - 0.5, XI1, ZI0 + 0.1, ZI0 + 0.9, YP)
    planta(esc, XI0 + 0.5, ZI0 + 0.5, YP)

    # Casillero para los bolsos detrás del muro macizo del frente
    caja("madera", XI0 + 0.1, XI0 + 1.2, YP, YP + 1.2, ZI1 - 0.4, ZI1)
    for k in range(1, 3):
        caja("madera_osc", XI0 + 0.1, XI0 + 1.2, YP + 0.4 * k - 0.02, YP + 0.4 * k, ZI1 - 0.42, ZI1 - 0.38)

    # Aires acondicionados en el fondo y lámparas colgadas de las vigas
    for x in (-2.8, 2.8):
        caja("aire", x - 0.5, x + 0.5, YT - 0.6, YT - 0.25, ZI0, ZI0 + 0.25)
    for x in (-c, c):
        for z in (-1.5, 1.5):
            caja("metal", x - 0.01, x + 0.01, YT - 0.4, y_col - 0.25, z - 0.01, z + 0.01)
            caja("tubo", x - 0.06, x + 0.06, YT - 0.45, YT - 0.4, z - 0.6, z + 0.6)

    # Partida del recorrido: en el paso entre IMANI y la Sala de sistemas 1, frente a la puerta
    esc.punto(inicio, puertas[0], b.RZ1 + 2.5)


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
