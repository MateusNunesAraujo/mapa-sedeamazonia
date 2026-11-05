"""Muebles y piezas sencillas para los interiores (en el sistema local del edificio).

`mira` es la dirección hacia donde mira el mueble (o la persona sentada): una de
(1, 0), (-1, 0), (0, 1), (0, -1) en (x, z).
"""
from comun import Y0, YT

LIBROS = ("libro_rojo", "libro_azul", "libro_verde", "libro_crema")


def _caja_eje(esc, eje):
    """Caja dada a lo largo de un eje: 'x' -> (a = x, c = z); 'z' -> (a = z, c = x)."""
    if eje == "x":
        return lambda m, a0, a1, y0, y1, c0, c1: esc.caja(m, a0, a1, y0, y1, c0, c1)
    return lambda m, a0, a1, y0, y1, c0, c1: esc.caja(m, c0, c1, y0, y1, a0, a1)


def muro_ventanas(esc, mat, a0, a1, c0, c1, eje="x", y_ante=Y0 + 0.9, y_dintel=Y0 + 2.4, paso=1.5):
    """Muro con una franja de ventanas (vidrio con marcos de madera) entre y_ante y y_dintel.
    a0..a1: a lo largo del muro; c0..c1: grosor del muro."""
    caja = _caja_eje(esc, eje)
    caja(mat, a0, a1, Y0, y_ante, c0, c1)
    caja(mat, a0, a1, y_dintel, YT, c0, c1)
    cm = (c0 + c1) / 2
    caja("vidrio", a0, a1, y_ante, y_dintel, cm - 0.02, cm + 0.02)
    caja("madera", a0, a1, y_ante - 0.04, y_ante, c0 - 0.05, c1 + 0.05)          # alféizar
    n = max(1, round((a1 - a0) / paso))
    w = (a1 - a0) / n
    for i in range(n + 1):
        a = a0 + i * w
        caja("madera", max(a0, a - 0.06), min(a1, a + 0.06), y_ante, y_dintel, cm - 0.06, cm + 0.06)


def muro_puerta(esc, mat, a0, a1, c0, c1, centro, ancho, eje="x", alto=2.4):
    """Muro macizo con un vano de puerta abierto (sin hoja) para poder pasar caminando."""
    caja = _caja_eje(esc, eje)
    p0, p1 = centro - ancho / 2, centro + ancho / 2
    caja(mat, a0, p0, Y0, YT, c0, c1)
    caja(mat, p1, a1, Y0, YT, c0, c1)
    caja(mat, p0, p1, Y0 + alto, YT, c0, c1)
    caja("madera_osc", p0 - 0.08, p0, Y0, Y0 + alto, c0 - 0.03, c1 + 0.03)        # marco
    caja("madera_osc", p1, p1 + 0.08, Y0, Y0 + alto, c0 - 0.03, c1 + 0.03)
    caja("madera_osc", p0 - 0.08, p1 + 0.08, Y0 + alto, Y0 + alto + 0.08, c0 - 0.03, c1 + 0.03)


def mesa(esc, x0, x1, z0, z1, y, mat="mesa", alto=0.74):
    esc.caja(mat, x0, x1, y + alto - 0.04, y + alto, z0, z1)
    for x in (x0 + 0.05, x1 - 0.09):
        for z in (z0 + 0.05, z1 - 0.09):
            esc.caja("metal", x, x + 0.04, y, y + alto - 0.04, z, z + 0.04)


def silla(esc, x, z, y, mira, mat="silla_negra"):
    """Silla con espaldar del lado contrario a `mira`."""
    dx, dz = mira
    esc.caja(mat, x - 0.23, x + 0.23, y + 0.44, y + 0.5, z - 0.23, z + 0.23)       # asiento
    if dx:
        xe = x - dx * 0.23
        esc.caja(mat, min(xe, xe - dx * 0.06), max(xe, xe - dx * 0.06), y + 0.5, y + 0.95, z - 0.21, z + 0.21)
    else:
        ze = z - dz * 0.23
        esc.caja(mat, x - 0.21, x + 0.21, y + 0.5, y + 0.95, min(ze, ze - dz * 0.06), max(ze, ze - dz * 0.06))
    esc.caja("metal", x - 0.03, x + 0.03, y + 0.06, y + 0.44, z - 0.03, z + 0.03)
    esc.caja("metal", x - 0.24, x + 0.24, y, y + 0.06, z - 0.03, z + 0.03)
    esc.caja("metal", x - 0.03, x + 0.03, y, y + 0.06, z - 0.24, z + 0.24)


def computador(esc, x, z, y, mira):
    """Monitor (con la pantalla hacia `mira`), teclado y mouse sobre una mesa a la altura y."""
    dx, dz = mira
    if dx:
        esc.caja("pc", x - 0.11, x + 0.11, y, y + 0.02, z - 0.09, z + 0.09)
        esc.caja("pc", x - 0.03, x + 0.03, y + 0.1, y + 0.42, z - 0.27, z + 0.27)
        xs = x + dx * 0.031
        esc.caja("pantalla_pc", min(xs, xs + dx * 0.004), max(xs, xs + dx * 0.004), y + 0.12, y + 0.4, z - 0.25, z + 0.25)
        kx = x + dx * 0.3
        esc.caja("pc", kx - 0.07, kx + 0.07, y, y + 0.02, z - 0.21, z + 0.21)
    else:
        esc.caja("pc", x - 0.09, x + 0.09, y, y + 0.02, z - 0.11, z + 0.11)
        esc.caja("pc", x - 0.27, x + 0.27, y + 0.1, y + 0.42, z - 0.03, z + 0.03)
        zs = z + dz * 0.031
        esc.caja("pantalla_pc", x - 0.25, x + 0.25, y + 0.12, y + 0.4, min(zs, zs + dz * 0.004), max(zs, zs + dz * 0.004))
        kz = z + dz * 0.3
        esc.caja("pc", x - 0.21, x + 0.21, y, y + 0.02, kz - 0.07, kz + 0.07)
    esc.caja("pc", x - 0.02, x + 0.02, y + 0.02, y + 0.1, z - 0.02, z + 0.02)       # cuello


def estante(esc, x0, x1, z0, z1, y, alto=2.0, niveles=5, tramo=0.9):
    """Estantería de madera llena de libros (los libros asoman por todas las caras largas)."""
    esc.caja("madera", x0, x1, y, y + alto, z0, z1)
    largo_x = (x1 - x0) >= (z1 - z0)
    a0, a1 = (x0, x1) if largo_x else (z0, z1)
    n = max(1, round((a1 - a0) / tramo))
    w = (a1 - a0) / n
    h = (alto - 0.15) / niveles
    for nivel in range(niveles):
        yb = y + 0.1 + nivel * h
        for i in range(n):
            aa, ab = a0 + i * w + 0.04, a0 + (i + 1) * w - 0.04
            mat = LIBROS[(i * 3 + nivel * 2) % len(LIBROS)]
            if largo_x:
                esc.caja(mat, aa, ab, yb, yb + h * 0.75, z0 - 0.015, z1 + 0.015)
            else:
                esc.caja(mat, x0 - 0.015, x1 + 0.015, yb, yb + h * 0.75, aa, ab)


def archivador(esc, x0, x1, z0, z1, y, alto=1.3):
    esc.caja("archivador", x0, x1, y, y + alto, z0, z1)
    for k in range(1, 4):
        yk = y + alto * k / 4
        esc.caja("metal", x0 - 0.01, x1 + 0.01, yk - 0.01, yk + 0.01, z0 - 0.01, z1 + 0.01)


def planta(esc, x, z, y):
    esc.caja("relieve", x - 0.2, x + 0.2, y, y + 0.4, z - 0.2, z + 0.2)             # matera de barro
    esc.caja("planta", x - 0.35, x + 0.35, y + 0.4, y + 1.1, z - 0.35, z + 0.35)
    esc.caja("planta", x - 0.2, x + 0.2, y + 1.1, y + 1.45, z - 0.2, z + 0.2)


def panel_luz(esc, x, z, y_techo):
    esc.caja("metal", x - 0.32, x + 0.32, y_techo - 0.03, y_techo, z - 0.32, z + 0.32)
    esc.caja("lampara", x - 0.3, x + 0.3, y_techo - 0.05, y_techo - 0.03, z - 0.3, z + 0.3)


def rejilla(a0, a1, paso, margen=0.0):
    """Posiciones repartidas entre a0 y a1, más o menos cada `paso`."""
    n = max(1, round((a1 - a0 - 2 * margen) / paso))
    return [a0 + margen + (a1 - a0 - 2 * margen) * (i + 0.5) / n for i in range(n)]
