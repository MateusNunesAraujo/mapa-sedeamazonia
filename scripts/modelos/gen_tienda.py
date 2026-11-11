"""Genera el modelo 3D del Bloque para tienda (static/modelos/tienda.glb) sin dependencias.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_tienda.py static/modelos/tienda.glb

Caseta al este del Baño para mujeres (~6,6 x 7,1 m de techo según el polígono del mapa), con
la ventana de atención hacia el pasillo que la separa del baño. Por fuera sigue la foto
static/fotos-edificios/bloque_tienda.png: zócalo verde oscuro, marcos de madera con vidrio, mostrador
con la contraventana abierta hacia afuera, techo de teja oscura a cuatro aguas y una cubierta
verde translúcida sobre el pasillo.
Adentro: mostrador con vitrina y caja registradora, estantes con productos y nevera.

En el sistema local: +Z = frente (oeste, al pasillo), +X = sur.
"""
import sys

from comun import G, M_POR_LNG, PISO, Y0, Escena, distribucion, huella, nombre_centro, techo_caseta
from muebles import estante, silla

ZOCALO = "verde_osc"
YP = Y0 + 0.02
Y_ZOC = Y0 + 1.0
YB = Y0 + 2.45
YM = Y0 + 3.0
PEND = 0.55
VENTANA = (-1.7, 0.0)            # vano de atención en el frente (x local)
PUERTA = 1.2                     # centro de la puerta de atrás (x local)
EXT_SUR = 1.2                    # la cubierta del pasillo sale un poco hacia el sur


def muro(esc, a0, a1, c0, c1, eje, hueco=None, puerta=None):
    """Zócalo verde, parales de madera con vidrio y franja alta. hueco: vano sin vidrio (a0, a1);
    puerta: centro de un vano de puerta de 0,9 m."""
    caja = (lambda m, x0, x1, y0, y1, z0, z1: esc.caja(m, x0, x1, y0, y1, z0, z1)) if eje == "x" else \
           (lambda m, x0, x1, y0, y1, z0, z1: esc.caja(m, z0, z1, y0, y1, x0, x1))
    cm = (c0 + c1) / 2
    tramos = [(a0, a1)]
    if puerta is not None:
        tramos = [(a0, puerta - 0.45), (puerta + 0.45, a1)]
        caja("madera", puerta - 0.5, puerta + 0.5, Y0 + 2.1, Y0 + 2.2, c0, c1)
        caja("madera", puerta - 0.5, puerta - 0.45, Y0, Y0 + 2.1, c0, c1)
        caja("madera", puerta + 0.45, puerta + 0.5, Y0, Y0 + 2.1, c0, c1)
        caja("vidrio", puerta - 0.45, puerta + 0.45, Y0 + 2.2, YB, cm - 0.02, cm + 0.02)
    for t0, t1 in tramos:
        caja(ZOCALO, t0, t1, Y0, Y_ZOC, c0, c1)
        caja("madera", t0, t1, Y_ZOC, Y_ZOC + 0.06, c0 - 0.03, c1 + 0.03)
        n = max(1, round((t1 - t0) / 0.9))
        for i in range(n + 1):
            a = t0 + (t1 - t0) * i / n
            caja("madera", max(t0, a - 0.05), min(t1, a + 0.05), Y_ZOC, YM, cm - 0.07, cm + 0.07)
        for i in range(n):
            va, vb = t0 + (t1 - t0) * i / n, t0 + (t1 - t0) * (i + 1) / n
            if hueco and va >= hueco[0] - 1e-6 and vb <= hueco[1] + 1e-6:
                continue
            caja("vidrio", va, vb, Y_ZOC + 0.06, YB, cm - 0.02, cm + 0.02)
            caja("madera", va, vb, Y0 + 1.9, Y0 + 1.95, cm - 0.05, cm + 0.05)
    caja("madera", a0, a1, YB, YB + 0.07, c0 - 0.02, c1 + 0.02)
    caja("vidrio", a0, a1, YB + 0.07, YM - 0.14, cm - 0.02, cm + 0.02)
    caja("madera_osc", a0, a1, YM - 0.14, YM, c0 - 0.02, c1 + 0.02)


def construir(esc, b, inicio="inicio", terreno=True, pasillo=1.6):
    """Dibuja la tienda en el sistema local de `b` (frente hacia +Z). pasillo: ancho del pasillo
    cubierto hasta el baño de mujeres (lo que queda entre los dos techos en el mapa)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    caja = esc.caja
    b.anden(esc, terreno)
    caja("concreto", b.RX0, b.RX1 + EXT_SUR, 0.0, PISO, b.RZ1, b.RZ1 + pasillo)        # piso del pasillo

    # Frente con la ventana de atención (sin vidrio en esos vanos)
    h0, h1 = VENTANA
    muro(esc, X0, X1, Z1 - G, Z1, "x", hueco=(h0, h1))
    muro(esc, X0, X1, Z0, Z0 + G, "x", puerta=PUERTA)
    muro(esc, Z0 + G, Z1 - G, X0, X0 + G, "z")
    muro(esc, Z0 + G, Z1 - G, X1 - G, X1, "z")
    caja("madera", h0, h1, Y_ZOC, Y_ZOC + 0.06, Z1 - G, Z1 + 0.35)                      # repisa de afuera
    # Contraventana de tablas abierta hacia afuera (bisagra arriba)
    caja("madera", h0, h1, YB - 1.0, YB, Z1, Z1 + 0.04, rot_x=-1.25, pivote=(0, YB, Z1))
    caja("puerta", h0 + 0.2, h0 + 0.8, Y0 + 1.95, Y0 + 2.25, Z1 + 0.05, Z1 + 0.07)        # aviso
    # Hoja de la puerta de atrás, abierta hacia adentro
    caja("madera", PUERTA + 0.4, PUERTA + 0.45, Y0, Y0 + 2.08, Z0 + G, Z0 + G + 0.85)
    techo_caseta(esc, b, YM, PEND)

    # Cubierta verde translúcida sobre el pasillo, con vigas y dos postes al sur
    za, zb = b.RZ1 - 0.4, b.RZ1 + pasillo + 0.4
    xa, xb = b.RX0, b.RX1 + EXT_SUR
    caja("lona_verde", xa, xb, 2.8, 2.83, za, zb)
    for k in range(int((xb - xa) / 1.2) + 1):
        x = xa + 0.05 + k * 1.2
        caja("madera", x - 0.04, x + 0.04, 2.7, 2.8, za, zb)
    for z in (za + 0.3, zb - 0.3):
        caja("madera", xa, xb, 2.7, 2.8, z - 0.04, z + 0.04)
        caja("madera", xb - 0.12, xb - 0.02, Y0, 2.8, z - 0.05, z + 0.05)

    # ---------------- Interior ----------------
    XI0, XI1, ZI0, ZI1 = X0 + G, X1 - G, Z0 + G, Z1 - G
    caja("piso_gris", XI0, XI1, Y0, YP, ZI0, ZI1)
    zc = (ZI0 + ZI1) / 2
    caja("madera_osc", XI0, XI1, YM - 0.14, YM, zc - 0.07, zc + 0.07)
    caja("tubo", -0.6, 0.6, YM - 0.2, YM - 0.14, zc - 0.05, zc + 0.05)

    # Mostrador bajo la ventana, vitrina y caja registradora
    caja("madera", h0, h1, YP, Y_ZOC - 0.05, ZI1 - 0.6, ZI1)
    caja("mesa", h0 - 0.05, h1 + 0.05, Y_ZOC - 0.05, Y_ZOC, ZI1 - 0.65, ZI1)
    caja("vidrio", h0 + 0.15, h0 + 0.85, Y_ZOC, Y_ZOC + 0.35, ZI1 - 0.5, ZI1 - 0.1)
    for k in range(3):
        y = Y_ZOC + 0.05 + k * 0.1
        caja("libro_crema", h0 + 0.2, h0 + 0.8, y, y + 0.04, ZI1 - 0.45, ZI1 - 0.15)   # pan / dulces
    caja("pc", h1 - 0.5, h1 - 0.15, Y_ZOC, Y_ZOC + 0.2, ZI1 - 0.5, ZI1 - 0.2)            # caja registradora
    caja("pc", h1 - 0.45, h1 - 0.2, Y_ZOC + 0.2, Y_ZOC + 0.35, ZI1 - 0.45, ZI1 - 0.43)
    silla(esc, -0.6, ZI1 - 1.0, YP, (0, 1))

    # Estantes con productos (muro norte y atrás) y nevera en la punta sur
    estante(esc, XI0, XI0 + 0.4, ZI0 + 0.2, ZI1 - 0.8, YP, alto=1.9, niveles=5, tramo=0.5)
    estante(esc, XI0 + 0.5, PUERTA - 0.6, ZI0, ZI0 + 0.4, YP, alto=1.9, niveles=5, tramo=0.5)
    caja("nevera", XI1 - 0.7, XI1, YP, YP + 1.9, zc - 0.4, zc + 0.4)
    caja("vidrio", XI1 - 0.72, XI1 - 0.7, YP + 0.1, YP + 1.8, zc - 0.35, zc + 0.35)
    for k in range(4):
        y = YP + 0.25 + k * 0.4
        for j, mat in enumerate(("rojo", "libro_azul", "planta")):
            z = zc - 0.25 + j * 0.25
            caja(mat, XI1 - 0.6, XI1 - 0.5, y, y + 0.25, z - 0.06, z + 0.06)            # bebidas
    caja("archivador", XI1 - 0.6, XI1, YP, YP + 0.9, ZI1 - 0.8, ZI1 - 0.1)              # congelador

    # Partida del recorrido: en el pasillo, frente a la ventana de atención
    esc.punto(inicio, (h0 + h1) / 2, b.RZ1 + pasillo * 0.6)


def ancho_pasillo():
    """Distancia entre el techo del Baño para mujeres y el de la tienda, según el mapa."""
    return (huella("Bloque para tienda")[2] - huella("Baño para mujeres")[3]) * M_POR_LNG


def colocar(esc, dist, inicio="inicio", terreno=True):
    b, cx, cz, frente = dist["Bloque para tienda"]
    esc.colocar(cx, cz, frente)
    construir(esc, b, inicio, terreno, pasillo=ancho_pasillo())
    esc.punto(nombre_centro("Bloque para tienda"), 0.0, (b.RZ0 + b.RZ1) / 2, y=6.0,
              extras={"nombre": "Bloque para tienda"})


if __name__ == "__main__":
    b, *_ = distribucion()["Bloque para tienda"]
    esc = Escena()
    construir(esc, b, pasillo=ancho_pasillo())
    esc.guardar(sys.argv[1], "Bloque para tienda")
