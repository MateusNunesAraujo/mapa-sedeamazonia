"""Genera el modelo 3D del Auditorio (static/modelos/auditorio.glb) sin dependencias externas.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_auditorio.py static/modelos/auditorio.glb

Por fuera, basado en static/fotos-edificios/auditorio.png: bloque largo de un piso, paredes ocre,
techo a dos aguas oscuro con alero grande, columnas de madera, puertas de vidrio
y una franja de celosías de madera arriba de las puertas.
Por dentro, basado en static/fotos-edificios/referencias-3d/auditorio.png: estructura de madera a
la vista, lámparas fluorescentes, piso claro, tarima baja a todo el ancho, muro del fondo
blanco (letrero de la Universidad, banderas, atril, tablero) y pupitres con pasillo central.
Las medidas salen del polígono del mapa (ver comun.distribucion); el interior se
acomoda a esas medidas.
"""
import sys

from comun import Escena, G, Y0, YT, distribucion
from muebles import rejilla

VANOS_ABIERTOS_DESDE_CENTRO = (-1, 0)   # vanos de vidrio abiertos para entrar caminando


def construir(esc, b, inicio="inicio", terreno=True):
    """Dibuja el auditorio en el sistema local de `b` (frente hacia +Z, tarima en +X)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    caja = esc.caja
    b.anden(esc, terreno)

    # Muros laterales y muro de atrás con ventanas y celosía (en la foto, los dos lados largos tienen ventanas)
    caja("pared", X0, X0 + G, Y0, YT, Z0, Z1)
    caja("pared", X1 - G, X1, Y0, YT, Z0, Z1)
    Y_ANTE_A, Y_CEL_A = Y0 + 0.9, Y0 + 2.5
    caja("pared", X0 + G, X1 - G, Y0, Y_ANTE_A, Z0, Z0 + G)
    caja("blanco", X0 + G, X1 - G, Y0 + 0.02, Y_ANTE_A, Z0 + G, Z0 + G + 0.01)
    n_v = max(2, round((X1 - X0 - 2 * G) / 1.6))
    w_v = (X1 - X0 - 2 * G) / n_v
    for i in range(n_v + 1):
        x = X0 + G + i * w_v
        caja("madera", max(X0 + G, x - 0.12), min(X1 - G, x + 0.12), Y_ANTE_A, YT, Z0 - 0.05, Z0 + G + 0.05)
    for i in range(n_v):
        xa, xb = X0 + G + i * w_v + 0.12, X0 + G + (i + 1) * w_v - 0.12
        caja("vidrio", xa, xb, Y_ANTE_A, Y_CEL_A, Z0 + 0.1, Z0 + 0.14)
        caja("madera", (xa + xb) / 2 - 0.04, (xa + xb) / 2 + 0.04, Y_ANTE_A, Y_CEL_A, Z0 + 0.08, Z0 + 0.16)
        caja("madera", xa, xb, Y_ANTE_A - 0.04, Y_ANTE_A, Z0 - 0.06, Z0 + G + 0.06)      # alféizar
        for k in range(5):                                                               # celosía
            y = Y_CEL_A + 0.06 + k * 0.19
            caja("madera", xa, xb, y, y + 0.07, Z0 + 0.06, Z0 + 0.19)
    caja("madera", X0 + G, X1 - G, Y_CEL_A, Y_CEL_A + 0.06, Z0 + 0.05, Z0 + 0.2)

    # Fachada: tramo macizo con entrada y mural | puertas de vidrio | tramo con puerta amarilla
    XV0 = X0 + max(4.4, 0.28 * (X1 - X0))
    XV1 = X1 - 1.4
    caja("pared", X0, XV0, Y0, YT, Z1 - G, Z1)
    caja("madera_osc", X0 + 0.5, X0 + 1.7, Y0, Y0 + 2.6, Z1, Z1 + 0.02)             # vano de entrada
    caja("madera", X0 + 2.0, X0 + 2.5, Y0 + 1.0, Y0 + 2.0, Z1, Z1 + 0.03)           # cartelera
    caja("mural", X0 + 2.8, XV0 - 0.3, Y0 + 0.35, Y0 + 3.0, Z1, Z1 + 0.03)          # mural blanco
    caja("madera_osc", X0 + 3.0, X0 + 3.6, Y0 + 0.6, Y0 + 2.4, Z1 + 0.03, Z1 + 0.04)  # figura del mural

    n_vanos = max(2, round((XV1 - XV0) / 1.6))
    ancho = (XV1 - XV0) / n_vanos
    abiertos = {n_vanos // 2 + d for d in VANOS_ABIERTOS_DESDE_CENTRO}
    Y_DINTEL = Y0 + 2.6
    for i in range(n_vanos + 1):
        x = XV0 + i * ancho
        caja("madera", x - 0.12, x + 0.12, Y0, YT, Z1 - 0.3, Z1 + 0.05)           # columna
    for i in range(n_vanos):
        xa = XV0 + i * ancho + 0.12
        xb = xa + ancho - 0.24
        xm = (xa + xb) / 2
        if i not in abiertos:
            caja("vidrio", xa, xb, Y0, Y_DINTEL, Z1 - 0.15, Z1 - 0.1)
            caja("madera", xm - 0.04, xm + 0.04, Y0, Y_DINTEL, Z1 - 0.12, Z1 - 0.05)  # parteluz
            caja("madera", xa, xb, Y0, Y0 + 0.12, Z1 - 0.12, Z1 - 0.05)              # zócalo
        caja("madera_osc", xa, xb, Y_DINTEL, YT, Z1 - 0.2, Z1 - 0.15)               # celosía
        for k in range(4):
            y = Y_DINTEL + 0.12 + k * 0.18
            caja("madera", xa, xb, y, y + 0.06, Z1 - 0.15, Z1 - 0.05)
    caja("madera", XV0, XV1, Y_DINTEL, Y_DINTEL + 0.1, Z1 - 0.15, Z1 - 0.02)        # dintel

    caja("pared", XV1, X1, Y0, YT, Z1 - G, Z1)
    caja("puerta", X1 - 1.1, X1 - 0.35, Y0, Y0 + 2.4, Z1, Z1 + 0.03)

    b.cubierta(esc)

    # ---------------- Interior ----------------
    XI0, XI1 = X0 + G, X1 - G
    ZI0, ZI1 = Z0 + G, Z1 - 0.3
    YP = Y0 + 0.02
    ZC = b.ZC
    caja("piso_claro", XI0, XI1, Y0, YP, ZI0, ZI1)
    caja("blanco", XI0, XI0 + 0.01, YP, YT, ZI0, ZI1)                    # muro de la entrada
    caja("blanco", XI1 - 0.01, XI1, YP, YT, ZI0, ZI1)                    # muro del fondo
    for x in (XI0 + 0.005, XI1 - 0.005):                                 # triángulos blancos bajo el techo
        esc.hastial("blanco", x, 0.01, YT, Z0 + G, Z1 - G, b.alto_cielo(ZC))

    # Estructura de madera a la vista: tablas, cabios, tirantes con pendolón, correas
    b.cielo_raso(esc, rejilla(XI0, XI1, 3.9), cabios=0.55)

    # Lámparas fluorescentes colgadas en dos filas, a lo ancho del salón
    for x in rejilla(XI0 + 0.5, XI1 - 0.5, 2.6):
        for z in (ZC - 2.3, ZC + 2.3):
            for dz in (-0.5, 0.5):
                caja("metal", x - 0.006, x + 0.006, 3.05, b.alto_cielo(z + dz), z + dz - 0.006, z + dz + 0.006)
            caja("metal", x - 0.07, x + 0.07, 3.02, 3.07, z - 0.65, z + 0.65)
            caja("tubo", x - 0.05, x + 0.05, 2.98, 3.02, z - 0.62, z + 0.62)

    # Tarima baja de baldosa a todo el ancho, con borde gris
    XT = XI1 - 3.2
    ALTO_TARIMA = 0.3
    YS = YP + ALTO_TARIMA
    caja("piso_claro", XT, XI1, YP, YS, ZI0, ZI1)
    caja("concreto", XT - 0.03, XT, YP, YS + 0.005, ZI0, ZI1)

    # Muro del fondo (+X), visto de frente desde el público: izquierda = -Z, derecha = +Z
    XF = XI1 - 0.01
    # Letrero de la Universidad Nacional, arriba al centro
    caja("mural", XF - 0.04, XF, 2.55, 3.15, ZC - 0.9, ZC + 0.9)
    caja("madera_osc", XF - 0.05, XF - 0.04, 2.95, 3.03, ZC - 0.75, ZC + 0.75)
    caja("madera_osc", XF - 0.05, XF - 0.04, 2.7, 2.76, ZC - 0.55, ZC + 0.55)
    caja("libro_azul", XF - 0.05, XF - 0.04, 2.7, 3.0, ZC - 0.85, ZC - 0.7)
    # Puerta de madera (cerrada) a la izquierda
    caja("madera_osc", XF - 0.06, XF, YS, YS + 2.2, ZC - 2.7, ZC - 1.8)
    caja("metal", XF - 0.09, XF - 0.06, YS + 1.0, YS + 1.05, ZC - 1.95, ZC - 1.85)
    # Tablero blanco a la derecha
    caja("metal", XF - 0.04, XF, YS + 0.85, YS + 2.15, ZC + 1.15, ZC + 3.25)
    caja("tablero", XF - 0.05, XF - 0.04, YS + 0.9, YS + 2.1, ZC + 1.2, ZC + 3.2)
    # Aire acondicionado arriba a la izquierda, parlantes en las esquinas, video beam colgado
    caja("aire", XF - 0.25, XF, 3.0, 3.35, ZC - 3.4, ZC - 2.4)
    caja("metal", XF - 0.26, XF - 0.25, 3.03, 3.07, ZC - 3.35, ZC - 2.45)
    for zp in (ZI0 + 0.5, ZI1 - 0.5):
        caja("pc", XI1 - 0.35, XI1 - 0.05, 2.9, 3.4, zp - 0.2, zp + 0.2)
        caja("metal", XI1 - 0.05, XI1, 3.0, 3.3, zp - 0.05, zp + 0.05)
    xb = XT - 3.0
    yb = b.alto_cielo(ZC)
    caja("metal", xb - 0.02, xb + 0.02, 3.1, yb, ZC - 0.02, ZC + 0.02)
    caja("aire", xb - 0.2, xb + 0.2, 2.95, 3.1, ZC - 0.17, ZC + 0.17)
    caja("pc", xb + 0.2, xb + 0.22, 2.99, 3.06, ZC - 0.05, ZC + 0.05)

    # Banderas (Colombia y otra) junto al atril, a la izquierda del centro
    for zb, colores in ((ZC - 1.2, ("puerta", "libro_azul", "libro_rojo")), (ZC - 0.75, ("blanco", "libro_verde", "blanco"))):
        caja("metal", XF - 0.45, XF - 0.42, YS, YS + 2.3, zb - 0.015, zb + 0.015)
        caja("metal", XF - 0.55, XF - 0.32, YS, YS + 0.05, zb - 0.1, zb + 0.1)
        alto = (0.42, 0.21, 0.21) if colores[0] == "puerta" else (0.28, 0.28, 0.28)
        y = YS + 2.2
        for mat, h in zip(colores, alto):                                          # tela caída junto al asta
            caja(mat, XF - 0.44, XF - 0.42, y - h, y, zb + 0.015, zb + 0.3)
            y -= h
    # Atril con el escudo
    za = ZC - 0.15
    caja("madera", XF - 0.95, XF - 0.5, YS, YS + 1.1, za - 0.25, za + 0.25)
    caja("madera_osc", XF - 1.0, XF - 0.45, YS + 1.1, YS + 1.15, za - 0.3, za + 0.3)
    caja("mural", XF - 0.96, XF - 0.95, YS + 0.55, YS + 0.9, za - 0.12, za + 0.12)
    caja("puerta", XF - 0.97, XF - 0.96, YS + 0.62, YS + 0.82, za - 0.06, za + 0.06)
    # Mesa blanca con una silla en el centro de la tarima
    xm = XT + 1.4
    caja("blanco", xm - 0.3, xm + 0.3, YS + 0.72, YS + 0.76, ZC - 0.9, ZC + 0.9)
    for zx in (ZC - 0.85, ZC + 0.81):
        caja("metal", xm - 0.25, xm + 0.25, YS, YS + 0.72, zx, zx + 0.04)
    caja("silla_negra", xm + 0.45, xm + 0.9, YS + 0.44, YS + 0.5, ZC - 0.22, ZC + 0.22)
    caja("silla_negra", xm + 0.86, xm + 0.92, YS + 0.5, YS + 0.95, ZC - 0.2, ZC + 0.2)
    for dz in (-0.18, 0.15):
        caja("metal", xm + 0.48, xm + 0.88, YS, YS + 0.44, ZC + dz, ZC + dz + 0.03)

    def pupitre(x, z, y=YP):
        """Pupitre mirando a la tarima (+X): asiento azul, espaldar gris y brazo para escribir a la derecha (+Z)."""
        caja("silla", x - 0.22, x + 0.22, y + 0.42, y + 0.48, z - 0.22, z + 0.22)          # asiento
        caja("silla_negra", x - 0.27, x - 0.21, y + 0.46, y + 0.92, z - 0.22, z + 0.22)    # espaldar
        caja("silla", x - 0.265, x - 0.215, y + 0.58, y + 0.86, z - 0.19, z + 0.19)
        for dz in (-0.2, 0.18):                                                            # patas
            caja("metal", x - 0.22, x + 0.2, y, y + 0.03, z + dz, z + dz + 0.025)
            caja("metal", x - 0.02, x + 0.0, y, y + 0.42, z + dz, z + dz + 0.025)
        caja("madera", x - 0.05, x + 0.33, y + 0.7, y + 0.72, z + 0.12, z + 0.38)          # brazo
        caja("metal", x - 0.03, x - 0.0, y + 0.48, y + 0.7, z + 0.22, z + 0.25)

    # Público: dos bloques con pasillo central y pasillos junto a los muros largos
    PASO_Z, PASO_X = 0.62, 0.95
    LADO, CENTRO = 0.95, 0.8
    for z0, z1 in ((ZI0 + LADO, ZC - CENTRO), (ZC + CENTRO, ZI1 - LADO)):
        n = max(1, int((z1 - z0) / PASO_Z))
        zs = [z0 + (z1 - z0) * (k + 0.5) / n for k in range(n)]
        x = XI0 + 1.3
        while x < XT - 1.3:
            for z in zs:
                pupitre(x, z)
            x += PASO_X

    # Punto de partida del recorrido: afuera, frente a los vanos abiertos, mirando al edificio
    x_ini = XV0 + ancho * (max(abiertos) + 0.5)    # centro de una puerta abierta (no frente a la columna)
    esc.punto(inicio, x_ini, Z1 + 10.0)


if __name__ == "__main__":
    b, *_ = distribucion()["Auditorio"]
    esc = Escena()
    construir(esc, b)
    esc.guardar(sys.argv[1], "Auditorio")
