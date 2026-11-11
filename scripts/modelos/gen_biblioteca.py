"""Genera el modelo 3D de la Biblioteca (static/modelos/biblioteca.glb) sin dependencias.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_biblioteca.py static/modelos/biblioteca.glb

En el plano la biblioteca tiene forma de L y se arma con tres partes:
  - Ala norte: sigue la hilera del Auditorio hacia el oeste, con techo a cuatro aguas
    en la punta. Adentro, estanterías metálicas, mesas de estudio y una oficina.
  - Ala sur: sigue la hilera de la Dirección hacia el oeste. Es la sala de lectura, con la
    sala de computadores detrás de un cerramiento de vidrio. Por fuera, el muro mostaza con
    el mural en relieve (foto static/fotos-edificios/biblioteca.png).
  - Hall de entrada entre las dos alas, con la puerta de vidrio hacia el patio.

El interior sigue las fotos de static/fotos-edificios/referencias-3d/ (1.jpeg a 10.jpeg y las
"WhatsApp Image 2026-11-05 ..."): muros blancos con zócalo de madera y una franja de
ventanas altas, techo de tablas de madera a la vista con cabios, limas y tirantes,
lámparas fluorescentes colgantes, estanterías metálicas grises de doble cara con su
cartel de clasificación, mesas naranjas con sillas azules y verdes, piso de baldosa blanca.
Dónde va cada cosa dentro de las alas es aproximado: las fotos no muestran la planta.
"""
import math
import sys

from comun import CUMBRERA, PISO, G, Y0, YT, Escena, cabio, distribucion, nombre_centro
from muebles import LIBROS, cilindro, computador, muro_puerta, muro_ventanas, planta, rejilla, silla

MURO = "pared_mostaza"
YP = Y0 + 0.02
ALTA = dict(y_ante=Y0 + 2.25, y_dintel=YT - 0.25)      # franja de ventanas altas


# ---------------- Muros por dentro ----------------
def forro(esc, eje, c, s, tramos):
    """Pintura blanca del lado de adentro de un muro y zócalo de madera.
    eje: 'x' si el muro corre a lo largo de X (su cara interior en z = c), 'z' si corre a lo
    largo de Z (cara interior en x = c). s: +1/-1, hacia dónde queda el interior.
    tramos: [(a0, a1, y0, y1)] a cubrir."""
    def caja(m, a0, a1, y0, y1, e0, e1):
        c0, c1 = sorted((c + s * e0, c + s * e1))
        if eje == "x":
            esc.caja(m, a0, a1, y0, y1, c0, c1)
        else:
            esc.caja(m, c0, c1, y0, y1, a0, a1)
    for a0, a1, y0, y1 in tramos:
        caja("blanco", a0, a1, y0, y1, 0.0, 0.015)
        if y0 <= Y0 + 0.01:
            caja("madera", a0, a1, Y0, Y0 + 0.1, 0.0, 0.03)


def con_ventanas(a0, a1, ventanas):
    """Tramos de forro de un muro con franja de ventanas (debajo y encima de la franja)."""
    return [(a0, a1, Y0, ventanas["y_ante"]), (a0, a1, ventanas["y_dintel"], YT)]


def con_puerta(a0, a1, centro, ancho, alto=2.4):
    p0, p1 = centro - ancho / 2, centro + ancho / 2
    return [(a0, p0, Y0, YT), (p1, a1, Y0, YT), (p0, p1, Y0 + alto, YT)]


# ---------------- Techo a la vista ----------------
def techo_vista(esc, b):
    """Tablas de madera siguiendo las aguas del techo (también la del extremo a cuatro aguas),
    con cabios, limas, viga de cumbrera, tirantes a la altura de los muros, otros más arriba
    y la viga de amarre sobre los muros."""
    C, B, p, ZC = CUMBRERA, b.B, b.pend, b.ZC
    xi0, xi1, zi0, zi1 = b.X0 + G, b.X1 - G, b.Z0 + G, b.Z1 - G
    semi = b.Z1 - ZC
    xa = b.X0 + semi if b.hip_izq else xi0                    # extremos de la cumbrera (adentro)
    xb = b.X1 - semi if b.hip_der else xi1

    def y(x, z):
        d = abs(z - ZC)
        if b.hip_der:
            d = max(d, x - xb)
        if b.hip_izq:
            d = max(d, xa - x)
        return C - B - p * d

    caras = [[(xa, ZC), (xb, ZC), (xi1, zi1), (xi0, zi1)],    # agua del frente
             [(xi0, zi0), (xi1, zi0), (xb, ZC), (xa, ZC)]]    # agua de atrás
    if b.hip_der:
        caras.append([(xb, ZC), (xi1, zi0), (xi1, zi1)])
    if b.hip_izq:
        caras.append([(xa, ZC), (xi0, zi1), (xi0, zi0)])
    for cara in caras:
        pts = [[x, y(x, z), z] for x, z in cara]
        esc.poligono("madera_techo", pts)
        esc.poligono("madera_techo", pts[::-1])

    H = 0.14
    bajo = lambda x, z: (x, y(x, z) - H, z)                  # cara de abajo de un cabio
    for k in range(int((xi1 - xi0) / 0.9) + 1):               # cabios de las dos aguas largas
        x = xi0 + 0.1 + k * 0.9
        if x > xi1 - 0.1:
            break
        dz = max(0.0, x - xb) if b.hip_der else 0.0
        dz = max(dz, xa - x) if b.hip_izq else dz
        for s, zb in ((1, zi1), (-1, zi0)):
            z0 = ZC + s * dz
            if abs(zb - z0) > 0.2:
                cabio(esc, bajo(x, z0), bajo(x, zb), H)
    for lado, x_cum, x_muro in (("der", xb, xi1), ("izq", xa, xi0)):
        if not getattr(b, "hip_" + lado):
            continue
        sx = 1 if lado == "der" else -1
        for k in range(int((semi - G) / 0.9) + 1):            # cabios del extremo
            dz = k * 0.9
            for s in ((1, -1) if dz else (1,)):
                z = ZC + s * dz
                x0 = x_cum + sx * dz
                if abs(x_muro - x0) > 0.2:
                    cabio(esc, bajo(x0, z), bajo(x_muro, z), H)
        for zl in (zi0, zi1):                                  # limas
            cabio(esc, bajo(x_cum, ZC), bajo(x_muro, zl), H + 0.06, ancho=0.12)

    yc = y(xa, ZC)
    esc.caja("madera_osc", xi0, xb, yc - 0.32, yc, ZC - 0.09, ZC + 0.09)       # viga de cumbrera
    n = max(1, round((xb - xi0) / 3.6))
    for i in range(n):
        x = xi0 + (xb - xi0) * (i + 0.5) / n
        esc.caja("madera_osc", x - 0.09, x + 0.09, YT - 0.35, YT - 0.12, zi0, zi1)  # tirante bajo
        ya = YT + 0.95                                                            # tirante alto
        d = (C - B - ya) / p - 0.05
        esc.caja("madera", x - 0.07, x + 0.07, ya - 0.18, ya, ZC - d, ZC + d)
    for x0, x1, z0, z1 in ((xi0, xi1, zi0, zi0 + 0.15), (xi0, xi1, zi1 - 0.15, zi1),
                           (xi0, xi0 + 0.15, zi0, zi1), (xi1 - 0.15, xi1, zi0, zi1)):
        esc.caja("madera_osc", x0, x1, YT - 0.25, YT, z0, z1)                 # viga de amarre
    return y


def lampara(esc, x, z, y_techo, a_lo_largo_x=True, largo=1.3):
    """Lámpara fluorescente colgada con dos cables del techo."""
    ya = YT - 0.15
    hx, hz = (largo / 2, 0.07) if a_lo_largo_x else (0.07, largo / 2)
    esc.caja("metal", x - hx, x + hx, ya, ya + 0.07, z - hz, z + hz)
    esc.caja("tubo", x - hx + 0.03, x + hx - 0.03, ya - 0.03, ya, z - hz + 0.02, z + hz - 0.02)
    for s in (-1, 1):
        cx, cz = (x + s * (hx - 0.1), z) if a_lo_largo_x else (x, z + s * (hz - 0.1))
        esc.caja("metal", cx - 0.006, cx + 0.006, ya + 0.07, y_techo(cx, cz), cz - 0.006, cz + 0.006)


def lamparas(esc, y_techo, x0, x1, z0, z1, paso_x=3.0, paso_z=2.8):
    for x in rejilla(x0, x1, paso_x):
        for z in rejilla(z0, z1, paso_z):
            lampara(esc, x, z, y_techo)


def aire(esc, x, z_muro, s):
    """Aire acondicionado de techo junto a un muro (s: hacia dónde queda el interior en Z)."""
    z0, z1 = sorted((z_muro, z_muro + s * 0.65))
    esc.caja("aire", x - 0.6, x + 0.6, YT - 0.6, YT - 0.35, z0, z1)
    esc.caja("metal", x - 0.55, x + 0.55, YT - 0.35, YT - 0.25, z_muro - 0.02 * s, z_muro + 0.05 * s)


# ---------------- Muebles de la biblioteca ----------------
def estante_metal(esc, x0, x1, z0, z1, y, alto=2.1, niveles=6, cara=0, cartel=True):
    """Estantería metálica gris llena de libros. cara=0: doble cara; +1/-1: una sola cara,
    con los libros hacia +c/-c (c es el lado corto). Lleva el cartel de clasificación
    en los costados."""
    largo_x = (x1 - x0) >= (z1 - z0)
    caja = esc.caja if largo_x else (lambda m, a0, a1, y0, y1, c0, c1: esc.caja(m, c0, c1, y0, y1, a0, a1))
    a0, a1, c0, c1 = (x0, x1, z0, z1) if largo_x else (z0, z1, x0, x1)
    T, cm = 0.04, (c0 + c1) / 2
    caja("gris_panel", a0, a0 + T, y, y + alto, c0, c1)
    caja("gris_panel", a1 - T, a1, y, y + alto, c0, c1)
    caja("archivador", a0, a1, y + alto - 0.03, y + alto, c0, c1)
    if cara:
        cf = c0 if cara > 0 else c1
        caja("archivador", a0 + T, a1 - T, y, y + alto, min(cf, cf + cara * 0.02), max(cf, cf + cara * 0.02))
        lados = [(cara, (c0 + 0.04, c1 - 0.03))]
    else:
        caja("archivador", a0 + T, a1 - T, y, y + alto, cm - 0.01, cm + 0.01)
        lados = [(1, (cm + 0.02, c1 - 0.03)), (-1, (c0 + 0.03, cm - 0.02))]
    h = (alto - 0.12) / niveles
    n = max(1, round((a1 - a0 - 2 * T) / 0.9))
    w = (a1 - a0 - 2 * T) / n
    for k in range(niveles):
        yb = y + 0.08 + k * h
        caja("archivador", a0 + T, a1 - T, yb - 0.02, yb, c0, c1)                 # repisa
        for s, (e0, e1) in lados:
            for i in range(n):
                v = (i * 7 + k * 3 + (s > 0) * 2) % 5                              # variedad
                aa = a0 + T + i * w + 0.03
                ab = min(aa + w * (0.55 + 0.1 * v), a0 + T + (i + 1) * w - 0.03)
                caja(LIBROS[(i * 3 + k * 2 + (s > 0)) % len(LIBROS)], aa, ab,
                     yb, yb + h * (0.62 + 0.05 * (v % 3)), e0, e1)
    if cartel:
        for a, d in ((a0, -1), (a1, 1)):
            caja("libro_crema", min(a, a + d * 0.006), max(a, a + d * 0.006),
                 y + 1.25, y + 1.75, cm - 0.17, cm + 0.17)


def mesa_naranja(esc, x0, x1, z0, z1, y):
    esc.caja("mesa_naranja", x0, x1, y + 0.71, y + 0.74, z0, z1)
    for x in (x0 + 0.06, x1 - 0.1):
        for z in (z0 + 0.06, z1 - 0.1):
            esc.caja("metal", x, x + 0.04, y, y + 0.71, z, z + 0.04)


def mesa_redonda(esc, x, z, y, r=0.6, sillas=("azul_plastico", "teal", "azul_plastico", "azul_plastico")):
    cilindro(esc, "mesa_naranja", x, z, r, y + 0.71, y + 0.74, n=16)
    cilindro(esc, "metal", x, z, 0.04, y, y + 0.71, n=6)
    esc.caja("metal", x - 0.3, x + 0.3, y, y + 0.03, z - 0.03, z + 0.03)
    esc.caja("metal", x - 0.03, x + 0.03, y, y + 0.03, z - 0.3, z + 0.3)
    d = r + 0.3
    for (dx, dz), mat in zip(((1, 0), (-1, 0), (0, 1), (0, -1)), sillas):
        if mat:
            silla(esc, x + dx * d, z + dz * d, y, (-dx, -dz), mat=mat)


def tablero_caballete(esc, x, z, y, mira_z=1):
    """Tablero blanco sobre caballete de madera, mirando hacia +Z o -Z."""
    zt = z - mira_z * 0.1
    esc.caja("pc", x - 0.62, x + 0.62, y + 0.85, y + 1.75, zt - 0.02, zt + 0.02)
    esc.caja("tablero", x - 0.6, x + 0.6, y + 0.87, y + 1.73, zt + mira_z * 0.02, zt + mira_z * 0.025)
    for dx in (-0.45, 0.45):
        esc.caja("madera", x + dx - 0.03, x + dx + 0.03, y, y + 1.9, zt - 0.03, zt + 0.03)
    esc.caja("madera", x - 0.03, x + 0.03, y, y + 1.5, z - mira_z * 0.6 - 0.03, z - mira_z * 0.6 + 0.03)


def dispensador(esc, x, z, y):
    esc.caja("archivador", x - 0.17, x + 0.17, y, y + 1.0, z - 0.17, z + 0.17)
    cilindro(esc, "vidrio", x, z, 0.14, y + 1.0, y + 1.45, n=10)


def planera(esc, x0, x1, z0, z1, y, cajones=5):
    """Mueble de cajones planos de madera para mapas (fotos 2.jpeg y 3.jpeg)."""
    alto = 0.95
    esc.caja("madera", x0, x1, y, y + alto, z0, z1)
    esc.caja("mural", x0 + 0.05, x1 - 0.05, y + alto, y + alto + 0.03, z0 + 0.05, z1 - 0.05)   # papeles
    for k in range(1, cajones):
        yk = y + alto * k / cajones
        esc.caja("madera_osc", x0 - 0.005, x1 + 0.005, yk - 0.01, yk + 0.01, z0 - 0.005, z1 + 0.005)


def armario_compacto(esc, x0, x1, z0, z1, y, alto=2.1):
    """Armarios grises con franja azul (foto 2.jpeg)."""
    esc.caja("archivador", x0, x1, y, y + alto, z0, z1)
    esc.caja("libro_azul", x0 - 0.01, x1 + 0.01, y + 0.95, y + 1.25, z0 - 0.01, z1 + 0.01)


def televisor(esc, x, z, y, mira):
    """Televisor sobre soporte con ruedas (foto 3.jpeg). mira: (dx, dz)."""
    dx, dz = mira
    hx, hz = (0.03, 0.62) if dx else (0.62, 0.03)
    esc.caja("pc", x - hx, x + hx, y + 1.15, y + 1.85, z - hz, z + hz)
    sx, sz = (0.0, 0.3) if dx else (0.3, 0.0)
    for s in (-1, 1):
        px, pz = x + s * sx - dx * 0.05, z + s * sz - dz * 0.05
        esc.caja("metal", px - 0.03, px + 0.03, y, y + 1.4, pz - 0.03, pz + 0.03)
        esc.caja("metal", px - (0.3 if dx else 0.03), px + (0.3 if dx else 0.03), y, y + 0.05,
                 pz - (0.03 if dx else 0.3), pz + (0.03 if dx else 0.3))


def vitrina_dvd(esc, x0, x1, z0, z1, y, frente_z=1):
    """Mueble de madera con puertas de vidrio y películas (foto 9.jpeg)."""
    esc.caja("madera", x0, x1, y, y + 2.0, z0, z1)
    zf = z1 if frente_z > 0 else z0
    for k in range(6):
        yb = y + 0.12 + k * 0.3
        for i in range(4):
            xa = x0 + 0.08 + i * (x1 - x0 - 0.16) / 4
            esc.caja(LIBROS[(i + k) % len(LIBROS)], xa, xa + (x1 - x0 - 0.16) / 4 - 0.02, yb, yb + 0.2,
                     min(zf, zf + frente_z * 0.01), max(zf, zf + frente_z * 0.01))
    esc.caja("vidrio", x0 + 0.04, x1 - 0.04, y + 0.08, y + 1.95,
             min(zf + frente_z * 0.01, zf + frente_z * 0.03), max(zf + frente_z * 0.01, zf + frente_z * 0.03))


def cerramiento(esc, eje, a0, a1, c, puerta, ancho=0.95):
    """Tabique de vidrio con marcos de madera sobre un muro bajo blanco y una puerta de vidrio
    abierta (sala de computadores, fotos "WhatsApp Image ... 3 PM" y "3.54.2 PM").
    eje: 'z' si corre a lo largo de Z en x = c."""
    caja = (lambda m, A0, A1, y0, y1, C0, C1: esc.caja(m, A0, A1, y0, y1, C0, C1)) if eje == "x" else \
           (lambda m, A0, A1, y0, y1, C0, C1: esc.caja(m, C0, C1, y0, y1, A0, A1))
    p0, p1 = puerta - ancho / 2, puerta + ancho / 2
    for t0, t1 in ((a0, p0), (p1, a1)):
        caja("blanco", t0, t1, Y0, Y0 + 1.0, c - 0.06, c + 0.06)
        caja("madera", t0, t1, Y0 + 1.0, Y0 + 1.05, c - 0.08, c + 0.08)
        caja("vidrio", t0, t1, Y0 + 1.05, YT - 0.25, c - 0.01, c + 0.01)
        for a in rejilla(t0, t1, 1.0) + [t0 + 0.04, t1 - 0.04]:
            caja("madera", a - 0.04, a + 0.04, Y0 + 1.0, YT - 0.25, c - 0.05, c + 0.05)
    caja("madera", a0, a1, Y0 + 2.15, Y0 + 2.2, c - 0.05, c + 0.05)                 # travesaño
    caja("madera", a0, a1, YT - 0.25, YT, c - 0.08, c + 0.08)
    caja("madera", p0 - 0.05, p0, Y0, Y0 + 2.15, c - 0.06, c + 0.06)                 # marco puerta
    caja("madera", p1, p1 + 0.05, Y0, Y0 + 2.15, c - 0.06, c + 0.06)
    caja("vidrio", p0 - 0.9, p0, Y0 + 0.05, Y0 + 2.1, c + 0.05, c + 0.08)            # hoja abierta
    caja("madera", p0 - 0.9, p0, Y0 + 0.05, Y0 + 0.15, c + 0.04, c + 0.09)
    caja("mural", p1 + 0.2, p1 + 1.0, Y0 + 2.3, Y0 + 2.5, c + 0.06, c + 0.08)          # letrero


# ---------------- Alas ----------------
def ala_norte(esc, b, xl):
    """Estanterías, mesas de estudio y una oficina al fondo (este). xl: x local donde termina
    el hall (lado este)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    XI0, XI1, ZI0, ZI1 = X0 + G, X1 - G, Z0 + G, Z1 - G
    b.anden(esc, terreno=False)
    puerta = (xl + X1) / 2
    esc.caja(MURO, X0, X0 + G, Y0, YT, Z0, Z1)                                    # muro con la sala
    muro_ventanas(esc, MURO, X0 + G, X1, Z1 - G, Z1, "x")                          # frente (norte)
    muro_ventanas(esc, MURO, Z0 + G, Z1 - G, X1 - G, X1, "z", **ALTA)              # oeste
    muro_puerta(esc, MURO, X0, X1, Z0, Z0 + G, puerta, 2.0, "x")                   # hacia el hall
    b.cubierta(esc, MURO)
    forro(esc, "z", XI0, 1, [(Z0 + G, Z1 - G, Y0, YT)])
    esc.hastial("blanco", XI0 + 0.01, 0.02, YT, ZI0, ZI1, CUMBRERA - b.B)
    forro(esc, "x", ZI1, -1, con_ventanas(XI0, XI1, dict(y_ante=Y0 + 0.9, y_dintel=Y0 + 2.4)))
    forro(esc, "z", XI1, -1, con_ventanas(ZI0, ZI1, ALTA))
    forro(esc, "x", ZI0, 1, con_puerta(XI0, XI1, puerta, 2.0))
    esc.caja("piso_claro", XI0, XI1, Y0, YP, ZI0, ZI1)
    y_techo = techo_vista(esc, b)

    # Oficina al este (mapoteca): planera, televisor, armarios y vitrina de películas
    xo = XI0 + 2.8
    zp = ZI1 - 1.0
    muro_puerta(esc, "blanco", ZI0, ZI1, xo, xo + 0.12, zp, 0.95, "z")
    esc.caja("blanco", xo, xo + 0.12, YT, YT + 0.01, ZI0, ZI1)
    planera(esc, XI0 + 0.3, XI0 + 1.5, ZI1 - 1.2, ZI1 - 0.3, YP)
    televisor(esc, XI0 + 0.5, ZI0 + 2.4, YP, (1, 0))
    mesa_naranja(esc, XI0 + 1.3, XI0 + 2.5, ZI0 + 1.8, ZI0 + 3.0, YP)
    silla(esc, XI0 + 1.9, ZI0 + 3.4, YP, (0, -1), mat="vino")
    armario_compacto(esc, XI0 + 0.2, xo - 0.3, ZI0, ZI0 + 0.6, YP)
    vitrina_dvd(esc, xo + 0.4, xo + 1.4, ZI1 - 0.4, ZI1, YP, frente_z=-1)
    lampara(esc, (XI0 + xo) / 2, (ZI0 + ZI1) / 2, y_techo)

    # Estanterías dobles de norte a sur, y mesas junto a las ventanas del oeste
    x_fin = XI0 + (XI1 - XI0) * 0.7
    x = xo + 1.2
    while x + 0.3 < x_fin:
        estante_metal(esc, x - 0.3, x + 0.3, ZI0 + 1.6, ZI1 - 1.2, YP)
        x += 1.5
    xm = (x_fin + XI1) / 2 + 0.2
    for i, z in enumerate(rejilla(ZI0 + 1.6, ZI1 - 0.4, 2.3)):
        if i % 2:
            mesa_redonda(esc, xm, z, YP)
            continue
        mesa_naranja(esc, xm - 0.45, xm + 0.45, z - 0.8, z + 0.8, YP)
        for dz, mat in ((-0.45, "azul_plastico"), (0.45, "teal")):
            silla(esc, xm - 0.75, z + dz, YP, (1, 0), mat=mat)
            silla(esc, xm + 0.75, z + dz, YP, (-1, 0), mat="azul_plastico")
    aire(esc, x_fin - 1.0, ZI1, -1)
    lamparas(esc, y_techo, xo, XI1, ZI0, ZI1)


def ala_sur(esc, b, xl):
    """Sala de lectura, con la sala de computadores al este. xl: x local donde termina el
    hall (lado este)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    XI0, XI1, ZI0, ZI1 = X0 + G, X1 - G, Z0 + G, Z1 - G
    b.anden(esc, terreno=False)
    puerta = (xl + X1) / 2
    esc.caja(MURO, X0, X0 + G, Y0, YT, Z0, Z1)                                    # muro con la Dirección
    muro_ventanas(esc, MURO, X0 + G, X1, Z0, Z0 + G, "x", **ALTA)                 # atrás (sur)
    muro_ventanas(esc, MURO, Z0 + G, Z1 - G, X1 - G, X1, "z", **ALTA)             # oeste
    # Frente: hacia el patio, muro con mural y ventanas altas; dentro del hall, la puerta
    muro_ventanas(esc, MURO, X0 + G, xl, Z1 - G, Z1, "x", **ALTA)
    muro_puerta(esc, MURO, xl, X1, Z1 - G, Z1, puerta, 2.0, "x")
    mural_relieve(esc, X0 + 0.8, xl - 0.6, Z1 + 0.02)
    b.cubierta(esc, MURO)
    forro(esc, "z", XI0, 1, [(ZI0, ZI1, Y0, YT)])
    esc.hastial("blanco", XI0 + 0.01, 0.02, YT, ZI0, ZI1, CUMBRERA - b.B)
    forro(esc, "x", ZI0, 1, con_ventanas(XI0, XI1, ALTA))
    forro(esc, "z", XI1, -1, con_ventanas(ZI0, ZI1, ALTA))
    forro(esc, "x", ZI1, -1, con_ventanas(XI0, xl, ALTA) + con_puerta(xl, XI1, puerta, 2.0))
    esc.caja("piso_claro", XI0, XI1, Y0, YP, ZI0, ZI1)
    y_techo = techo_vista(esc, b)

    # Sala de computadores al este, detrás del cerramiento de vidrio
    xc = XI0 + 3.8
    cerramiento(esc, "z", ZI0, ZI1, xc, ZI1 - 1.2)
    for z in rejilla(ZI0 + 0.3, ZI1 - 2.0, 1.4):
        mesa_naranja(esc, XI0 + 0.1, XI0 + 0.8, z - 0.6, z + 0.6, YP)
        computador(esc, XI0 + 0.35, z, YP + 0.74, (1, 0))
        silla(esc, XI0 + 1.2, z, YP, (-1, 0), mat="azul_plastico")
        mesa_naranja(esc, xc - 0.9, xc - 0.2, z - 0.6, z + 0.6, YP)
        computador(esc, xc - 0.45, z, YP + 0.74, (-1, 0))
        silla(esc, xc - 1.3, z, YP, (1, 0), mat="azul_plastico")
    lampara(esc, (XI0 + xc) / 2, (ZI0 + ZI1) / 2 - 1.5, y_techo, a_lo_largo_x=False)
    lampara(esc, (XI0 + xc) / 2, (ZI0 + ZI1) / 2 + 1.5, y_techo, a_lo_largo_x=False)

    # Sala de lectura: estanterías de una cara contra el muro de atrás, mesas redondas y
    # rectangulares, tablero en caballete y dispensador de agua
    estante_metal(esc, xc + 1.0, XI1 - 0.6, ZI0, ZI0 + 0.4, YP, cara=1)
    zc = b.ZC + 0.2
    xs = rejilla(xc + 1.2, XI1 - 0.6, 3.0)
    for i, x in enumerate(xs):
        if i % 2 == 0:
            mesa_redonda(esc, x, zc, YP, r=0.65)
        else:
            mesa_naranja(esc, x - 1.0, x + 1.0, zc - 0.5, zc + 0.5, YP)
            for dx in (-0.6, 0.0, 0.6):
                silla(esc, x + dx, zc - 0.8, YP, (0, 1), mat="azul_plastico")
                silla(esc, x + dx, zc + 0.8, YP, (0, -1), mat="teal")
    tablero_caballete(esc, xc + 1.3, ZI1 - 1.2, YP, mira_z=-1)
    dispensador(esc, xc + 0.4, ZI1 - 0.4, YP)
    planta(esc, XI1 - 0.5, ZI1 - 0.5, YP)
    aire(esc, (xc + XI1) / 2, ZI0, 1)
    lamparas(esc, y_techo, xc, XI1, ZI0, ZI1)


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
    # Foto 1.jpeg: baldosa blanca, muros blancos, ventanilla de préstamo con repisa, cartelera,
    # revistero, antenas antirrobo junto a la puerta y techo de tablas de madera.
    esc.colocar(0.0, 0.0, "sur")
    zm = (z_n + z_s) / 2
    xi = x_oeste + G
    if terreno:
        esc.caja("pasto", x_oeste - 6, x_este + 14, -0.05, 0.0, czn - bn.RZ1 - 4, czs - bs.RZ0 + 4)
    esc.caja("concreto", x_oeste - 1.2, x_este + 1.2, 0.0, PISO, z_n - 0.1, z_s + 0.1)
    esc.caja("piso_claro", xi, x_este, Y0, YP, z_n, z_s)
    muro_ventanas(esc, MURO, z_n, z_s, x_oeste, xi, "z")                          # muro oeste
    forro(esc, "z", xi, 1, con_ventanas(z_n, z_s, dict(y_ante=Y0 + 0.9, y_dintel=Y0 + 2.4)))
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
    esc.caja("madera_techo", xi, x_este, YT - 0.04, YT, z_n, z_s)
    for x in rejilla(xi, x_este, 0.9):
        esc.caja("madera_osc", x - 0.04, x + 0.04, YT - 0.16, YT - 0.04, z_n, z_s)
    # Ventanilla de préstamo sobre el muro sur del hall: marco de madera, vidrio y repisa
    va, vb = xi + 0.8, xi + 2.6
    zw = z_s - 0.02
    esc.caja("vidrio", va, vb, Y0 + 1.0, Y0 + 2.3, zw - 0.02, zw)
    for x in (va, (va + vb) / 2, vb):
        esc.caja("madera", x - 0.05, x + 0.05, Y0 + 0.95, Y0 + 2.35, zw - 0.08, zw)
    for y in (Y0 + 0.95, Y0 + 2.3):
        esc.caja("madera", va - 0.05, vb + 0.05, y, y + 0.06, zw - 0.08, zw)
    esc.caja("madera_osc", va - 0.1, vb + 0.1, Y0 + 0.95, Y0 + 1.0, zw - 0.45, zw)  # repisa
    esc.caja("libro_crema", va + 0.2, va + 0.4, Y0 + 1.0, Y0 + 1.25, zw - 0.3, zw - 0.25)
    # Cartelera de corcho en el muro norte, revistero y antenas antirrobo junto a la entrada
    esc.caja("madera", xi + 1.0, xi + 2.0, Y0 + 1.0, Y0 + 2.2, z_n, z_n + 0.04)
    esc.caja("corcho", xi + 1.05, xi + 1.95, Y0 + 1.05, Y0 + 2.15, z_n + 0.04, z_n + 0.05)
    for k in range(5):
        y = Y0 + 0.3 + k * 0.28
        esc.caja("madera", xi + 2.4, xi + 3.1, y, y + 0.03, z_n + 0.3 - k * 0.02, z_n + 0.6)
        esc.caja(LIBROS[k % len(LIBROS)], xi + 2.45, xi + 3.05, y + 0.03, y + 0.25, z_n + 0.55, z_n + 0.58)
    esc.caja("madera", xi + 2.4, xi + 2.45, YP, Y0 + 1.7, z_n + 0.25, z_n + 0.65)
    esc.caja("madera", xi + 3.05, xi + 3.1, YP, Y0 + 1.7, z_n + 0.25, z_n + 0.65)
    for z in (zm - 0.75, zm + 0.75):
        esc.caja("pantalla", xv - 1.6, xv - 1.0, YP, YP + 1.6, z - 0.03, z + 0.03)
    planta(esc, xv - 0.6, z_n + 0.6, YP)
    lampara(esc, (xi + x_este) / 2, zm, lambda x, z: YT - 0.04)

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
