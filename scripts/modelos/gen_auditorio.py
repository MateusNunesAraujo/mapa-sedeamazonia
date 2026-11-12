"""Genera el modelo 3D del Auditorio (static/modelos/auditorio.glb) sin dependencias externas.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_auditorio.py static/modelos/auditorio.glb

Por fuera, basado en static/fotos-edificios/auditorio.png: bloque largo de un piso, paredes ocre,
techo a dos aguas oscuro con alero grande, columnas de madera, ventanas de vidrio
y una franja de celosías de madera arriba de ellas.
La entrada está en la punta este (fotos static/fotos-edificios/referencias-3d/11.jpeg a 14.jpeg):
muro mostaza con un vano rehundido, seis puertas de madera y vidrio con claraboya, pendón,
mesa larga, dispensador de agua, gel y cartelera. Delante, la plazoleta cubierta que llega
hasta Admisión (ver plazoleta()).
Por dentro, basado en static/fotos-edificios/referencias-3d/auditorio.png: estructura de madera a
la vista, lámparas fluorescentes, piso claro, tarima baja a todo el ancho, muro del fondo
blanco (letrero de la Universidad, banderas, atril, tablero) y pupitres con pasillo central.
Las medidas salen del polígono del mapa (ver comun.distribucion); el interior se
acomoda a esas medidas.
"""
import math
import sys

from comun import GIROS, PISO, Bloque, Escena, G, Y0, YT, distribucion
from gen_biblioteca import techo_vista
from gen_complementarios import rect
from muebles import cilindro, rejilla, silla

MOSTAZA = "pared_mostaza"
ENTRADA = 2.7          # medio ancho del vano rehundido de la entrada (z local)
Y_VANO = Y0 + 3.0      # alto del vano de la entrada
SALIENTE = 0.3         # el muro de la fachada este sobresale esto alrededor del vano


def construir(esc, b, inicio="inicio", terreno=True):
    """Dibuja el auditorio en el sistema local de `b` (frente hacia +Z, tarima en +X)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    caja = esc.caja
    b.anden(esc, terreno)

    # Punta este con la entrada, punta oeste maciza y muro de atrás con ventanas y celosía
    fachada_este(esc, b)
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

    # Costado norte: tramo macizo con mural | ventanas con celosía entre columnas | tramo macizo.
    # Antes aquí iban las puertas; la entrada real está en la punta este.
    XV0 = X0 + max(4.4, 0.28 * (X1 - X0))
    XV1 = X1 - 1.4
    caja("pared", X0, XV0, Y0, YT, Z1 - G, Z1)
    caja("madera", X0 + 2.0, X0 + 2.5, Y0 + 1.0, Y0 + 2.0, Z1, Z1 + 0.03)           # cartelera
    caja("mural", X0 + 2.8, XV0 - 0.3, Y0 + 0.35, Y0 + 3.0, Z1, Z1 + 0.03)          # mural blanco
    caja("madera_osc", X0 + 3.0, X0 + 3.6, Y0 + 0.6, Y0 + 2.4, Z1 + 0.03, Z1 + 0.04)  # figura del mural

    n_vanos = max(2, round((XV1 - XV0) / 1.6))
    ancho = (XV1 - XV0) / n_vanos
    Y_ANTE, Y_DINTEL = Y0 + 0.9, Y0 + 2.6
    for i in range(n_vanos + 1):
        x = XV0 + i * ancho
        caja("madera", x - 0.12, x + 0.12, Y0, YT, Z1 - 0.3, Z1 + 0.05)           # columna
    for i in range(n_vanos):
        xa = XV0 + i * ancho + 0.12
        xb = xa + ancho - 0.24
        xm = (xa + xb) / 2
        caja("pared", xa, xb, Y0, Y_ANTE, Z1 - G, Z1)                               # antepecho
        caja("blanco", xa, xb, Y0 + 0.02, Y_ANTE, Z1 - G - 0.01, Z1 - G)
        caja("madera", xa, xb, Y_ANTE - 0.04, Y_ANTE, Z1 - G - 0.06, Z1 + 0.06)       # alféizar
        caja("vidrio", xa, xb, Y_ANTE, Y_DINTEL, Z1 - 0.15, Z1 - 0.1)
        caja("madera", xm - 0.04, xm + 0.04, Y_ANTE, Y_DINTEL, Z1 - 0.12, Z1 - 0.05)  # parteluz
        caja("madera_osc", xa, xb, Y_DINTEL, YT, Z1 - 0.2, Z1 - 0.15)               # celosía
        for k in range(4):
            y = Y_DINTEL + 0.12 + k * 0.18
            caja("madera", xa, xb, y, y + 0.06, Z1 - 0.15, Z1 - 0.05)
    caja("madera", XV0, XV1, Y_DINTEL, Y_DINTEL + 0.1, Z1 - 0.15, Z1 - 0.02)        # dintel
    caja("pared", XV1, X1, Y0, YT, Z1 - G, Z1)

    b.cubierta(esc)

    # ---------------- Interior ----------------
    XI0, XI1 = X0 + G, X1 - G
    ZI0, ZI1 = Z0 + G, Z1 - 0.3
    YP = Y0 + 0.02
    ZC = b.ZC
    caja("piso_claro", XI0, XI1, Y0, YP, ZI0, ZI1)
    for z0_, z1_, y0_, y1_ in ((ZI0, ZC - ENTRADA, YP, YT), (ZC + ENTRADA, ZI1, YP, YT),
                               (ZC - ENTRADA, ZC + ENTRADA, Y_VANO, YT)):          # muro de la entrada
        caja("blanco", XI0, XI0 + 0.01, y0_, y1_, z0_, z1_)
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

    # Punto de partida del recorrido: en la plazoleta, frente a la entrada, mirando al edificio
    esc.punto(inicio, X0 - 9.0, ZC, giro=-math.pi / 2)


def fachada_este(esc, b):
    """Punta este (X0) con la entrada, según 14.jpeg y 11.jpeg: muro mostaza que sobresale
    alrededor de un vano rehundido con seis puertas de madera y vidrio (el par del centro
    abierto para entrar caminando) y claraboya de tres vidrios; a la izquierda (sur, -Z) el
    pendón, la mesa larga con banca y sillas; a la derecha (norte, +Z) el dispensador de agua,
    el gel y la cartelera verde."""
    X0, Z0, Z1, ZC = b.X0, b.Z0, b.Z1, b.ZC
    caja = esc.caja
    za, zb = ZC - ENTRADA, ZC + ENTRADA
    xs = X0 - SALIENTE                                     # cara de afuera del muro
    for x0_, x1_ in ((xs, X0), (X0, X0 + G)):
        caja(MOSTAZA, x0_, x1_, Y0, YT, Z0, za)
        caja(MOSTAZA, x0_, x1_, Y0, YT, zb, Z1)
        caja(MOSTAZA, x0_, x1_, Y_VANO, YT, za, zb)
    esc.hastial(MOSTAZA, X0 - 0.006, 0.012, YT, Z0, Z1, b.alto_cielo(ZC) + b.B)   # triángulo mostaza

    # Puertas: marco de madera rojiza en el fondo del vano
    xp = X0 + 0.08
    YD = Y0 + 2.25
    caja("madera", xp - 0.06, xp + 0.06, YD, YD + 0.08, za, zb)                       # cabezal
    caja("madera", xp - 0.06, xp + 0.06, Y_VANO - 0.08, Y_VANO, za, zb)
    for k in range(4):                                                               # claraboya
        z = za + (zb - za) * k / 3
        caja("madera", xp - 0.06, xp + 0.06, YD, Y_VANO, z - 0.05, z + 0.05)
    caja("vidrio", xp - 0.01, xp + 0.01, YD + 0.08, Y_VANO - 0.08, za, zb)
    caja("verde_claro", xp - 0.09, xp - 0.06, YD + 0.12, YD + 0.32, ZC - 0.5, ZC - 0.1)   # letrero "Auditorio"
    caja("linea", xp - 0.09, xp - 0.06, YD + 0.12, YD + 0.32, ZC - 0.1, ZC + 0.4)
    w = (zb - za) / 6
    for i in range(6):
        z0_, z1_ = za + i * w, za + (i + 1) * w
        if i in (2, 3):                                    # par del centro, abierto hacia adentro
            zh = z0_ + 0.04 if i == 2 else z1_ - 0.04
            caja("madera", xp, xp + w - 0.1, Y0, YD, zh - 0.03, zh + 0.03)
            caja("vidrio", xp + 0.1, xp + w - 0.2, Y0 + 0.15, YD - 0.15, zh - 0.035, zh + 0.035)
            continue
        for zz in (z0_ + 0.04, z1_ - 0.04):                                         # largueros
            caja("madera", xp - 0.04, xp + 0.04, Y0, YD, zz - 0.04, zz + 0.04)
        for y0_, y1_ in ((Y0, Y0 + 0.15), (Y0 + 0.95, Y0 + 1.03), (YD - 0.1, YD)):   # travesaños
            caja("madera", xp - 0.04, xp + 0.04, y0_, y1_, z0_, z1_)
        caja("vidrio", xp - 0.01, xp + 0.01, Y0 + 0.15, YD - 0.1, z0_ + 0.08, z1_ - 0.08)
    caja("puerta", xp - 0.03, xp - 0.02, Y0 + 1.2, Y0 + 1.75, za + 0.25, za + 0.6)       # afiches
    caja("libro_rojo", xp - 0.03, xp - 0.02, Y0 + 1.2, Y0 + 1.75, zb - 0.9, zb - 0.55)
    caja("linea", xp - 0.03, xp - 0.02, Y0 + 1.3, Y0 + 1.6, za + 1.2, za + 1.45)

    # Izquierda: pendón con la ruta de atención, mesa larga de madera, banca y sillas
    zp = (Z0 + za) / 2 - 0.2
    caja("mural", xs - 0.02, xs, Y0 + 0.8, Y0 + 2.75, zp - 0.45, zp + 0.45)
    for k, m in enumerate(("rojo", "puerta", "libro_verde", "libro_azul", "rosa")):
        y = Y0 + 2.4 - k * 0.32
        caja(m, xs - 0.03, xs - 0.02, y, y + 0.08, zp - 0.38, zp - 0.3)
        caja("libro_crema", xs - 0.03, xs - 0.02, y + 0.01, y + 0.06, zp - 0.25, zp + 0.3)
    mesa_madera(esc, xs - 1.4, xs - 0.5, Z0 - 0.9, Z0 + 1.7)
    banca(esc, xs - 0.45, xs - 0.1, Z0 - 0.6, Z0 + 1.0)
    silla(esc, xs - 0.6, za - 0.6, Y0, (-1, 0), mat="silla")
    silla(esc, xs - 0.5, za - 0.05, Y0, (-1, 0), mat="silla_negra")
    silla(esc, xs - 1.2, za - 0.3, Y0, (1, 0), mat="blanco")

    # Derecha: dispensador de agua sobre una mesita, gel y cartelera verde
    zd = zb + 0.55
    cilindro(esc, "metal", xs - 0.45, zd, 0.32, Y0 + 0.72, Y0 + 0.75, n=12)
    for dz in (-0.2, 0.2):
        caja("metal", xs - 0.47, xs - 0.43, Y0, Y0 + 0.72, zd + dz - 0.02, zd + dz + 0.02)
    caja("pantalla", xs - 0.62, xs - 0.28, Y0 + 0.75, Y0 + 1.25, zd - 0.17, zd + 0.17)
    caja("pc", xs - 0.63, xs - 0.62, Y0 + 0.95, Y0 + 1.1, zd - 0.1, zd + 0.1)
    cilindro(esc, "vidrio", xs - 0.45, zd, 0.14, Y0 + 1.25, Y0 + 1.7, n=10)
    zg = zb + 1.25
    caja("metal", xs - 0.42, xs - 0.38, Y0, Y0 + 1.2, zg - 0.02, zg + 0.02)        # gel
    caja("metal", xs - 0.55, xs - 0.25, Y0, Y0 + 0.03, zg - 0.12, zg + 0.12)
    caja("linea", xs - 0.47, xs - 0.33, Y0 + 1.2, Y0 + 1.45, zg - 0.06, zg + 0.06)
    zc0, zc1 = zb + 0.9, Z1 - 0.25
    caja("madera", xs - 0.05, xs, Y0 + 1.2, Y0 + 2.3, zc0, zc1)                    # cartelera
    caja("verde_cartelera", xs - 0.06, xs - 0.05, Y0 + 1.26, Y0 + 2.24, zc0 + 0.06, zc1 - 0.06)
    for y0_, z0_, h, w_ in ((Y0 + 1.5, zc0 + 0.2, 0.55, 0.3), (Y0 + 1.75, zc0 + 0.75, 0.4, 0.45),
                            (Y0 + 1.85, zc1 - 0.5, 0.3, 0.3), (Y0 + 1.35, zc1 - 0.65, 0.3, 0.35)):
        caja("linea", xs - 0.07, xs - 0.06, y0_, y0_ + h, z0_, z0_ + w_)


def mesa_madera(esc, x0, x1, z0, z1, y=Y0):
    """Mesa larga de madera maciza (13.jpeg)."""
    esc.caja("madera", x0, x1, y + 0.72, y + 0.8, z0, z1)
    for x in (x0 + 0.08, x1 - 0.16):
        for z in (z0 + 0.1, z1 - 0.18):
            esc.caja("madera", x, x + 0.08, y, y + 0.72, z, z + 0.08)


def banca(esc, x0, x1, z0, z1, y=Y0):
    """Banca de tablillas de madera sobre marco metálico negro (12.jpeg y 13.jpeg)."""
    largo_x = (x1 - x0) >= (z1 - z0)
    for k in range(4):                                                               # tablillas
        if largo_x:
            c = z0 + (z1 - z0) * (k + 0.5) / 4
            esc.caja("madera", x0, x1, y + 0.42, y + 0.45, c - 0.035, c + 0.035)
        else:
            c = x0 + (x1 - x0) * (k + 0.5) / 4
            esc.caja("madera", c - 0.035, c + 0.035, y + 0.42, y + 0.45, z0, z1)
    if largo_x:                                                                      # marco
        for a0, a1 in ((x0, x0 + 0.04), (x1 - 0.04, x1)):
            esc.caja("pc", a0, a1, y, y + 0.42, z0, z1)
        for c0, c1 in ((z0, z0 + 0.04), (z1 - 0.04, z1)):
            esc.caja("pc", x0, x1, y + 0.38, y + 0.42, c0, c1)
    else:
        for c0, c1 in ((z0, z0 + 0.04), (z1 - 0.04, z1)):
            esc.caja("pc", x0, x1, y, y + 0.42, c0, c1)
        for a0, a1 in ((x0, x0 + 0.04), (x1 - 0.04, x1)):
            esc.caja("pc", a0, a1, y + 0.38, y + 0.42, z0, z1)


def ancho_plazoleta(b, cx):
    """Distancia entre el alero este del Auditorio y el techo de Admisión (frente al norte)."""
    return rect("Admisión y Matrícula")[0] - (cx - b.RX0)


def plazoleta(esc, b, cx, cz, frente, ancho):
    """Plazoleta cubierta entre la punta este del Auditorio y Admisión (12.jpeg y 13.jpeg):
    sigue el techo a dos aguas de la hilera con tablas de madera a la vista y vigas, sobre
    columnas redondas de madera; piso de baldosa con franjas de gravilla; bancas, mesas y
    sillas de aluminio cerca de Admisión y un televisor en su muro verde. No está en el mapa
    como lugar propio, así que no tiene etiqueta ni punto de partida."""
    p = Bloque(ancho + 0.3, b.RZ1 - b.RZ0, alero_izq=0.0, alero_der=0.0)
    xc = b.RX0 - ancho / 2 + 0.15                          # se mete 0.3 m bajo el alero del Auditorio
    g = GIROS[frente]
    esc.colocar(cx + xc * math.cos(g), cz - xc * math.sin(g), frente)
    caja = esc.caja

    # Piso: base de gravilla y baldosas de a cuatro, hasta la fachada del Auditorio
    x_fin = p.RX1 - 0.3 + (b.X0 - b.RX0) - SALIENTE        # cara de la fachada este
    caja("granito", p.RX0, x_fin, 0.0, PISO + 0.01, p.RZ0 + 0.3, p.RZ1 - 0.3)
    M, T, J = 1.1, 0.46, 0.03
    yb = PISO + 0.012
    nx, nz = int((x_fin - p.RX0 - 0.1) / M), int((p.RZ1 - p.RZ0 - 0.7) / M)
    x_ini, z_ini = x_fin - nx * M, p.RZ0 + 0.35 + ((p.RZ1 - p.RZ0 - 0.7) - nz * M) / 2
    for i in range(nx):
        for j in range(nz):
            for a in (0, 1):
                for c in (0, 1):
                    x = x_ini + i * M + 0.08 + a * (T + J)
                    z = z_ini + j * M + 0.08 + c * (T + J)
                    esc.poligono("baldosa_rosa", [[x, yb, z], [x, yb, z + T], [x + T, yb, z + T], [x + T, yb, z]])

    # Techo, estructura a la vista y columnas redondas sobre las dos líneas de vigas
    p.cubierta(esc, hastiales=False)
    techo_vista(esc, p)
    for z in (p.Z0 + 0.15, p.Z1 - 0.15):
        for x in rejilla(p.RX0, p.RX1 - 0.3, 3.6):
            cilindro(esc, "madera", x, z, 0.17, PISO, YT - 0.05, n=12)
            caja("pc", x - 0.12, x + 0.12, YT - 0.32, YT - 0.25, z - 0.2, z + 0.2)   # herraje
    for x in rejilla(p.RX0, p.RX1, 6.0):                                          # reflectores
        for z in (p.ZC - 2.5, p.ZC + 2.5):
            y = p.alto_cielo(z) - 0.15
            caja("metal", x - 0.15, x + 0.15, y - 0.08, y, z - 0.05, z + 0.05)
            caja("lampara", x - 0.13, x + 0.13, y - 0.09, y - 0.08, z - 0.04, z + 0.04)

    # Bancas junto a los bordes norte y sur
    for x in rejilla(p.RX0 + 3.0, p.RX1 - 3.0, 3.2):
        banca(esc, x - 0.7, x + 0.7, p.Z1 - 0.9, p.Z1 - 0.55, y=PISO)
    for x in rejilla(p.RX0 + 6.0, p.RX1 - 2.0, 3.6):
        banca(esc, x - 0.7, x + 0.7, p.Z0 + 0.55, p.Z0 + 0.9, y=PISO)

    # Mesas de aluminio con sillas cerca de Admisión (este, -X)
    for x in (p.RX0 + 1.8, p.RX0 + 4.0):
        for z in rejilla(p.ZC - 2.6, p.ZC + 2.6, 2.0):
            caja("metal", x - 0.45, x + 0.45, PISO + 0.72, PISO + 0.75, z - 0.4, z + 0.4)
            caja("metal", x - 0.03, x + 0.03, PISO, PISO + 0.72, z - 0.03, z + 0.03)
            caja("metal", x - 0.3, x + 0.3, PISO, PISO + 0.03, z - 0.03, z + 0.03)
            silla(esc, x - 0.75, z, PISO, (1, 0), mat="metal")
            silla(esc, x + 0.75, z, PISO, (-1, 0), mat="metal")

    # Televisor en el muro verde de Admisión (bajo el alero de Admisión, mirando a la plazoleta)
    xa = p.RX0 - 1.2 + 0.04
    zt = p.ZC + 2.6
    caja("pc", xa, xa + 0.06, Y0 + 1.4, Y0 + 2.2, zt - 0.7, zt + 0.7)
    caja("pantalla_pc", xa + 0.06, xa + 0.07, Y0 + 1.45, Y0 + 2.15, zt - 0.65, zt + 0.65)


def colocar(esc, dist, inicio="inicio", terreno=True):
    """El Auditorio en su sitio del mapa y la plazoleta cubierta delante de la entrada."""
    b, cx, cz, frente = dist["Auditorio"]
    esc.colocar(cx, cz, frente)
    construir(esc, b, inicio=inicio, terreno=terreno)
    plazoleta(esc, b, cx, cz, frente, ancho_plazoleta(b, cx))
    esc.colocar(cx, cz, frente)
    return b


if __name__ == "__main__":
    dist = distribucion()
    b, cx, cz, _ = dist["Auditorio"]
    esc = Escena()
    construir(esc, b)
    ancho = ancho_plazoleta(b, cx)
    plazoleta(esc, b, 0.0, 0.0, "sur", ancho)
    esc.colocar(0.0, 0.0, "sur")
    esc.caja("pasto", b.RX0 - ancho - 4, b.RX0, -0.05, 0.0, b.RZ0 - 4, b.RZ1 + 6)   # pasto bajo la plazoleta
    esc.guardar(sys.argv[1], "Auditorio")
