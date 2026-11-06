"""Genera el modelo 3D del IMANI (static/modelos/imani.glb) sin dependencias.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_imani.py static/modelos/imani.glb

Bloque casi cuadrado (~11,3 x 12 m de techo según el polígono del mapa) pegado al corredor
cubierto del este, con el frente al norte, hacia el prado que lo separa del laboratorio de
humedales. Por fuera sigue la foto static/fotos/IMANI.png: pilastras verde azulado en las
esquinas, frente de vidrio con marcos de madera y dos pares de puertas (el del oeste abierto),
franja alta tapada con lona cruda, alero con los cabios de madera a la vista y techo de teja
oscura a cuatro aguas con quiebre de pendiente.
Adentro: instituto de investigación con recepción, puestos con computador, mesa de trabajo,
biblioteca y cuatro columnas de madera bajo el quiebre del techo.

En el sistema local: +Z = frente (norte), +X = oeste.
"""
import sys

from comun import G, YT, Y0, Escena, distribucion, nombre_centro, techo_quiebre
from muebles import computador, estante, mesa, muro_ventanas, planta, silla

MURO = "verde_teal"
YP = Y0 + 0.02
Y_DIN = Y0 + 2.35
P_BAJA, P_ALTA, QUIEBRE = 0.35, 0.85, 2.2
PILASTRA = 0.7
ANDEN = 1.5                      # andén al frente (al norte llega el jardinero de APAPORIS)
ABIERTA = 2                      # índice del par de puertas que queda abierto (vano libre)


def fachada(esc, X0, X1, Z1):
    """Frente (+Z): pilastras verdes y ocho paños de madera y vidrio, F P P F | F P P F
    (F = vidrio fijo, P = hoja de puerta), con la franja de lona arriba."""
    caja = esc.caja
    zv = Z1 - 0.12
    caja(MURO, X0, X0 + PILASTRA, Y0, YT, Z1 - 0.45, Z1)
    caja(MURO, X1 - PILASTRA, X1, Y0, YT, Z1 - 0.45, Z1)
    a0, a1 = X0 + PILASTRA, X1 - PILASTRA
    w = (a1 - a0) / 8
    for i in range(9):
        x = a0 + i * w
        grueso = 0.1 if i == 4 else 0.06                                                 # poste central
        caja("madera", x - grueso, x + grueso, Y0, YT, zv - 0.1, zv + 0.1)
    for i in range(8):
        xa, xb = a0 + i * w + 0.06, a0 + (i + 1) * w - 0.06
        puerta = i % 4 in (1, 2)
        if puerta and i // 4 == ABIERTA - 1:
            # hoja abierta hacia adentro, pegada a su marco
            x = xa if i % 4 == 1 else xb - 0.06
            caja("madera", x, x + 0.06, Y0, Y_DIN - 0.03, zv - w - 0.05, zv - 0.1)
            caja("vidrio", x - 0.01, x + 0.07, Y0 + 0.15, Y_DIN - 0.15, zv - w + 0.05, zv - 0.2)
            continue
        if puerta:
            caja("madera", xa, xb, Y0, Y0 + 0.12, zv - 0.05, zv + 0.05)
            caja("madera", xa, xa + 0.08, Y0, Y_DIN, zv - 0.06, zv + 0.06)
            caja("madera", xb - 0.08, xb, Y0, Y_DIN, zv - 0.06, zv + 0.06)
            xm = xb - 0.1 if i % 4 == 1 else xa + 0.06
            caja("metal", xm, xm + 0.04, Y0 + 0.95, Y0 + 1.15, zv + 0.06, zv + 0.09)        # manija
        else:
            caja(MURO, xa, xb, Y0, Y0 + 0.1, zv - 0.06, zv + 0.06)                        # zócalo verde
        caja("vidrio", xa, xb, Y0 + 0.1, Y_DIN, zv - 0.02, zv + 0.02)
    caja("madera", a0, a1, Y_DIN, Y_DIN + 0.1, zv - 0.1, zv + 0.1)
    caja("lona_cruda", a0, a1, Y_DIN + 0.1, YT - 0.05, zv - 0.03, zv + 0.03)              # lona arriba
    for i in range(1, 8):
        x = a0 + i * w
        caja("madera", x - 0.05, x + 0.05, Y_DIN + 0.1, YT, zv - 0.06, zv + 0.06)


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


def cabios(esc, b, paso=0.9, H=0.12):
    """Cabios de madera bajo el alero (a la vista en la foto), en los cuatro lados: van del
    borde alto del muro al borde del techo, justo debajo de las tablas."""
    a = b.X0 - b.RX0
    y_muro, y_borde = YT - H, YT - P_BAJA * (a - 0.1) - H
    reparto = lambda u0, u1: [u0 + 0.3 + i * paso for i in range(int((u1 - u0 - 0.6) / paso) + 1)]
    for x in reparto(b.X0, b.X1):
        cabio(esc, (x, y_muro, b.Z1), (x, y_borde, b.RZ1 - 0.1), H)
        cabio(esc, (x, y_borde, b.RZ0 + 0.1), (x, y_muro, b.Z0), H)
    for z in reparto(b.Z0, b.Z1):
        cabio(esc, (b.X1, y_muro, z), (b.RX1 - 0.1, y_borde, z), H)
        cabio(esc, (b.RX0 + 0.1, y_borde, z), (b.X0, y_muro, z), H)


def construir(esc, b, inicio="inicio", terreno=True):
    """Dibuja el IMANI en el sistema local de `b` (frente hacia +Z)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    caja = esc.caja
    b.anden(esc, terreno)
    caja("concreto", b.RX0 - 1.0, b.RX1 + 1.0, 0.0, Y0, b.RZ1, b.RZ1 + ANDEN)             # andén al prado

    fachada(esc, X0, X1, Z1)
    # Costados con ventanas altas y espalda con ventanas normales
    muro_ventanas(esc, MURO, Z0, Z1 - 0.45, X0, X0 + G, "z", y_ante=Y0 + 2.0, y_dintel=YT - 0.15, paso=1.2)
    muro_ventanas(esc, MURO, Z0, Z1 - 0.45, X1 - G, X1, "z", y_ante=Y0 + 2.0, y_dintel=YT - 0.15, paso=1.2)
    muro_ventanas(esc, MURO, X0 + G, X1 - G, Z0, Z0 + G, "x")
    techo_quiebre(esc, b, P_BAJA, P_ALTA, QUIEBRE, abajo="madera")
    cabios(esc, b)

    # ---------------- Interior ----------------
    XI0, XI1, ZI0, ZI1 = X0 + G, X1 - G, Z0 + G, Z1 - 0.45
    caja("piso_gris", XI0, XI1, Y0, YP, ZI0, ZI1)

    # Cuatro columnas de madera bajo el quiebre del techo
    c = min(b.RX1, b.RZ1) - QUIEBRE - 0.4
    y_col = YT - P_BAJA * (b.X0 - b.RX0) + P_BAJA * QUIEBRE + P_ALTA * 0.4 - 0.05
    for x in (-c, c):
        for z in (-c, c):
            caja("madera_osc", x - 0.1, x + 0.1, Y0, y_col, z - 0.1, z + 0.1)
    for x in (-c, c):                                                                     # vigas
        caja("madera_osc", x - 0.08, x + 0.08, y_col - 0.25, y_col, -c, c)

    # Recepción junto a la entrada abierta (oeste) y cartelera
    caja("madera", 1.2, 3.2, YP, YP + 1.05, ZI1 - 2.2, ZI1 - 1.7)
    caja("mesa", 1.15, 3.25, YP + 1.05, YP + 1.1, ZI1 - 2.25, ZI1 - 1.6)
    computador(esc, 2.2, ZI1 - 2.5, YP + 0.74, (0, 1))
    mesa(esc, 1.4, 3.0, ZI1 - 2.9, ZI1 - 2.25, YP)
    silla(esc, 2.2, ZI1 - 3.3, YP, (0, 1))
    caja("tablero", -1.0, 0.2, Y0 + 1.1, Y0 + 1.7, ZI1 - 0.04, ZI1)                         # avisos

    # Mesa de trabajo en el centro
    mesa(esc, -1.2, 1.2, -1.3, 0.1, YP, mat="madera")
    for x in (-0.6, 0.6):
        silla(esc, x, -1.75, YP, (0, 1))
        silla(esc, x, 0.55, YP, (0, -1))

    # Puestos con computador contra la espalda
    for x in (-3.0, -1.0, 1.0, 3.0):
        mesa(esc, x - 0.75, x + 0.75, ZI0 + 0.1, ZI0 + 0.8, YP)
        computador(esc, x, ZI0 + 0.4, YP + 0.74, (0, 1))
        silla(esc, x, ZI0 + 1.25, YP, (0, -1))

    # Biblioteca en el costado este y plantas
    estante(esc, XI0, XI0 + 0.4, ZI0 + 1.8, ZI1 - 1.0, YP, alto=1.9)
    planta(esc, XI1 - 0.5, ZI1 - 0.6, YP)
    planta(esc, XI0 + 0.5, ZI1 - 0.5, YP)

    # Lámparas colgadas de las vigas
    for x in (-c, c):
        for z in (-1.5, 1.5):
            caja("metal", x - 0.01, x + 0.01, YT - 0.4, y_col - 0.25, z - 0.01, z + 0.01)
            caja("tubo", x - 0.06, x + 0.06, YT - 0.45, YT - 0.4, z - 0.6, z + 0.6)

    # Partida del recorrido: en la plazoleta, frente a las puertas abiertas
    w = (X1 - X0 - 2 * PILASTRA) / 8
    esc.punto(inicio, X0 + PILASTRA + 6 * w, b.RZ1 + 2.5)


def colocar(esc, dist, inicio="inicio", terreno=True):
    b, cx, cz, frente = dist["IMANI"]
    esc.colocar(cx, cz, frente)
    construir(esc, b, inicio, terreno)
    esc.punto(nombre_centro("IMANI"), 0.0, (b.RZ0 + b.RZ1) / 2, y=8.0, extras={"nombre": "IMANI"})


if __name__ == "__main__":
    b, *_ = distribucion()["IMANI"]
    esc = Escena()
    construir(esc, b)
    esc.guardar(sys.argv[1], "IMANI")
