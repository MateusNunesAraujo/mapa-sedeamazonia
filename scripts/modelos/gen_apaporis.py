"""Genera el modelo 3D de APAPORIS (static/modelos/apaporis.glb) sin dependencias.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_apaporis.py static/modelos/apaporis.glb

Sala de reuniones casi cuadrada (~11,8 x 11,6 m de techo según el polígono del mapa) al noreste
de IMANI, con el frente al oeste, hacia el prado que comparte con IMANI. Por fuera sigue la foto
static/fotos-edificios/apaporis.png: zócalo verde azulado, ventanales con marcos de madera y algunas
persianas, puerta doble a la izquierda (norte), claraboya de vidrio arriba, pilastra verde en
la esquina sur y techo de teja oscura a cuatro aguas con quiebre. Al frente, un jardinero con
borde de concreto y el andén que pasa hacia IMANI.
Adentro: mesa de juntas larga con sillas, pantalla y cámara para videoconferencias, tablero,
mueble bajo y aires acondicionados.

En el sistema local: +Z = frente (oeste), +X = sur.
"""
import sys

from comun import G, M_POR_LAT, YT, Y0, Escena, distribucion, huella, nombre_centro, techo_quiebre
from gen_imani import ANDEN
from muebles import archivador, mesa, muro_ventanas, planta, silla

MURO = "verde_teal"
YP = Y0 + 0.02
Y_ANTE, Y_DIN = Y0 + 0.9, Y0 + 2.35
P_BAJA, P_ALTA, QUIEBRE = 0.35, 0.8, 2.2
PUERTA = 0.95                     # distancia del borde de la pilastra norte a la puerta
ANCHO_PUERTA = 1.5


def ventana(esc, x0, x1, zv, persiana=False, zocalo=True):
    """Paño de vidrio con marco de madera (antepecho verde si zocalo); persiana: listones
    de madera por dentro en la parte baja, como en la foto."""
    caja = esc.caja
    y0 = Y_ANTE if zocalo else Y0 + 0.1
    if zocalo:
        caja(MURO, x0, x1, Y0, Y_ANTE, zv - 0.12, zv + 0.12)
    else:
        caja(MURO, x0, x1, Y0, y0, zv - 0.06, zv + 0.06)
    caja("vidrio", x0, x1, y0, Y_DIN, zv - 0.02, zv + 0.02)
    caja("madera", x0, x1, y0, y0 + 0.05, zv - 0.06, zv + 0.06)
    caja("madera", x0, x1, Y0 + 1.75, Y0 + 1.8, zv - 0.05, zv + 0.05)                    # travesaño
    if persiana:
        for k in range(int((Y0 + 1.7 - y0) / 0.12)):
            y = y0 + 0.1 + k * 0.12
            caja("madera", x0, x1, y, y + 0.03, zv - 0.12, zv - 0.06)


def fachada(esc, X0, X1, Z1):
    """Frente (+Z). De norte (-X) a sur (+X): pilastra delgada, paño con persiana, puerta doble
    abierta, poste, ventanal de cuatro paños sobre zócalo verde y pilastra verde gruesa."""
    caja = esc.caja
    zv = Z1 - 0.12
    caja(MURO, X0, X0 + 0.35, Y0, YT, Z1 - 0.3, Z1)
    caja(MURO, X1 - 1.0, X1, Y0, YT, Z1 - 0.45, Z1)
    p0 = X0 + 0.35 + PUERTA
    p1 = p0 + ANCHO_PUERTA
    poste = p1 + 0.2
    # Paño con persiana al lado de la puerta
    ventana(esc, X0 + 0.35, p0 - 0.08, zv, persiana=True, zocalo=False)
    # Puerta doble abierta hacia adentro
    for x in (p0, p1):
        caja("madera", x - 0.07, x + 0.07, Y0, Y_DIN, zv - 0.09, zv + 0.09)
    for x, s in ((p0 + 0.07, 1), (p1 - 0.07, -1)):
        h0, h1 = (x, x + 0.05) if s > 0 else (x - 0.05, x)
        caja("madera", h0, h1, Y0, Y_DIN - 0.03, zv - ANCHO_PUERTA / 2 - 0.05, zv - 0.1)
        caja("vidrio", h0 - 0.01, h1 + 0.01, Y0 + 0.15, Y_DIN - 0.15, zv - ANCHO_PUERTA / 2 + 0.05, zv - 0.2)
    caja("madera_osc", poste - 0.12, poste + 0.12, Y0, YT, zv - 0.14, zv + 0.14)
    # Ventanal de cuatro paños (el primero con persiana)
    a0, a1 = poste + 0.12, X1 - 1.0
    n = 4
    w = (a1 - a0) / n
    for i in range(n):
        ventana(esc, a0 + i * w + 0.04, a0 + (i + 1) * w - 0.04, zv, persiana=(i == 0))
        if i:
            caja("madera", a0 + i * w - 0.05, a0 + i * w + 0.05, Y_ANTE, YT, zv - 0.07, zv + 0.07)
    # Claraboya: vidrio con marcos de madera sobre todo el frente
    caja("madera", X0 + 0.35, X1 - 1.0, Y_DIN, Y_DIN + 0.1, zv - 0.1, zv + 0.1)
    caja("vidrio", X0 + 0.35, X1 - 1.0, Y_DIN + 0.1, YT, zv - 0.02, zv + 0.02)
    m = max(1, round((X1 - 1.0 - X0 - 0.35) / 0.9))
    for i in range(1, m):
        x = X0 + 0.35 + (X1 - 1.0 - X0 - 0.35) * i / m
        caja("madera", x - 0.04, x + 0.04, Y_DIN + 0.1, YT, zv - 0.05, zv + 0.05)
    return (p0 + p1) / 2


def jardinero(esc, x0, x1, z0, z1, alto=0.3, borde=0.15):
    caja = esc.caja
    caja("concreto", x0, x1, 0.0, alto, z0, z0 + borde)
    caja("concreto", x0, x1, 0.0, alto, z1 - borde, z1)
    caja("concreto", x0, x0 + borde, 0.0, alto, z0, z1)
    caja("concreto", x1 - borde, x1, 0.0, alto, z0, z1)
    caja("tierra", x0 + borde, x1 - borde, 0.0, alto - 0.08, z0 + borde, z1 - borde)


def construir(esc, b, inicio="inicio", terreno=True):
    """Dibuja APAPORIS en el sistema local de `b` (frente hacia +Z)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    caja = esc.caja
    b.anden(esc, terreno)

    x_puerta = fachada(esc, X0, X1, Z1)
    muro_ventanas(esc, MURO, Z0, Z1 - 0.3, X0, X0 + G, "z", paso=1.2)                     # norte
    muro_ventanas(esc, MURO, Z0, Z1 - 0.45, X1 - G, X1, "z", y_ante=Y0 + 2.0,               # sur (a IMANI)
                  y_dintel=YT - 0.15, paso=1.2)
    muro_ventanas(esc, MURO, X0 + G, X1 - G, Z0, Z0 + G, "x", y_ante=Y0 + 2.0, y_dintel=YT - 0.15)
    techo_quiebre(esc, b, P_BAJA, P_ALTA, QUIEBRE, abajo="madera")

    # Afuera: andén al frente que sigue hacia IMANI (al sur) y jardinero en el prado
    caja("concreto", b.RX0, b.RX1 + 2.0, 0.0, Y0, b.RZ1, b.RZ1 + 1.2)
    # El jardinero llega hasta el andén de IMANI, dejando un paso (foto: IMANI queda a la derecha)
    lat0, lat1, *_ = huella("APAPORIS")
    x_imani = ((lat0 + lat1) / 2 - huella("IMANI")[1]) * M_POR_LAT - ANDEN
    jardinero(esc, x_puerta + 0.8, x_imani - 0.3, b.RZ1 + 1.5, b.RZ1 + 5.0)

    # ---------------- Interior ----------------
    XI0, XI1, ZI0, ZI1 = X0 + G, X1 - G, Z0 + G, Z1 - 0.45
    caja("piso_gris", XI0, XI1, Y0, YP, ZI0, ZI1)

    # Mesa de juntas larga (a lo largo de Z, mirando a la pantalla del fondo)
    xm, z0m, z1m = 0.3, ZI0 + 2.0, ZI1 - 1.6
    mesa(esc, xm - 0.7, xm + 0.7, z0m, z1m, YP, mat="madera")
    n = int((z1m - z0m) / 0.8)
    for k in range(n):
        z = z0m + (z1m - z0m) * (k + 0.5) / n
        silla(esc, xm - 1.05, z, YP, (1, 0), mat="silla")
        silla(esc, xm + 1.05, z, YP, (-1, 0), mat="silla")
    silla(esc, xm, z1m + 0.4, YP, (0, -1), mat="silla")
    for k in range(3):                                                                    # micrófonos
        z = z0m + 0.8 + k * (z1m - z0m - 1.6) / 2
        caja("pc", xm - 0.05, xm + 0.05, YP + 0.74, YP + 0.78, z - 0.08, z + 0.08)

    # Pantalla y cámara de videoconferencia en el muro del fondo (este), sobre un mueble bajo
    caja("madera", xm - 1.0, xm + 1.0, YP, YP + 0.6, ZI0, ZI0 + 0.45)
    caja("pc", xm - 0.9, xm + 0.9, Y0 + 1.0, Y0 + 2.05, ZI0, ZI0 + 0.06)
    caja("pantalla_pc", xm - 0.86, xm + 0.86, Y0 + 1.04, Y0 + 2.01, ZI0 + 0.06, ZI0 + 0.07)
    caja("pc", xm - 0.15, xm + 0.15, Y0 + 2.1, Y0 + 2.2, ZI0, ZI0 + 0.12)                 # cámara

    # Tablero en el muro norte, archivador y planta
    caja("metal", XI0, XI0 + 0.04, 0.95, 2.25, -1.3, 1.3)
    caja("tablero", XI0 + 0.04, XI0 + 0.06, 1.0, 2.2, -1.25, 1.25)
    archivador(esc, XI1 - 0.5, XI1, ZI0 + 0.2, ZI0 + 1.0, YP)
    mesa(esc, XI1 - 0.6, XI1, ZI1 - 2.6, ZI1 - 1.2, YP)                                   # café
    caja("metal", XI1 - 0.45, XI1 - 0.2, YP + 0.74, YP + 1.05, ZI1 - 2.2, ZI1 - 1.95)
    planta(esc, XI0 + 0.5, ZI1 - 0.5, YP)

    # Aires acondicionados y paneles de luz
    for z in (-2.0, 2.0):
        caja("aire", XI1 - 0.25, XI1, YT - 0.6, YT - 0.25, z - 0.5, z + 0.5)
    for z in (-2.0, 0.0, 2.0):
        caja("metal", xm - 0.01, xm + 0.01, YT - 0.3, YT + 1.6, z - 0.01, z + 0.01)
        caja("tubo", xm - 0.06, xm + 0.06, YT - 0.35, YT - 0.3, z - 0.6, z + 0.6)

    # Partida del recorrido: en el prado, frente a la puerta
    esc.punto(inicio, x_puerta - 0.8, b.RZ1 + 3.0)


def colocar(esc, dist, inicio="inicio", terreno=True):
    b, cx, cz, frente = dist["APAPORIS"]
    esc.colocar(cx, cz, frente)
    construir(esc, b, inicio, terreno)
    esc.punto(nombre_centro("APAPORIS"), 0.0, (b.RZ0 + b.RZ1) / 2, y=8.0, extras={"nombre": "APAPORIS"})


if __name__ == "__main__":
    b, *_ = distribucion()["APAPORIS"]
    esc = Escena()
    construir(esc, b)
    esc.guardar(sys.argv[1], "APAPORIS")
