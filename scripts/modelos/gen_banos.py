"""Genera los modelos 3D de los baños (static/modelos/banos_hombres.glb y banos_mujeres.glb) sin dependencias.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_banos.py hombres static/modelos/banos_hombres.glb
    python scripts/modelos/gen_banos.py mujeres static/modelos/banos_mujeres.glb

Dos casetas al norte de la Arawana y la Maloca, a los dos lados del corredor cubierto, con la
puerta hacia el corredor. Medidas de los polígonos del mapa: hombres ~7,9 x 7,6 m de techo y
mujeres ~5,0 x 7,6 m. Por fuera siguen las fotos static/fotos-edificios/banos_para_hombres.png y
banos_para_mujeres.png: muros verdes, marco de puerta de madera, una franja abierta con marcos
de madera bajo el alero y techo de teja oscura a cuatro aguas con el alero de madera a la vista.
Adentro: enchape blanco con una franja oscura, cubículos, lavamanos y (hombres) orinales.

En el sistema local: +Z = frente (puerta), X = a lo largo del bloque (de norte a sur o al revés
según el giro; la puerta queda cerca de la punta -X como en las fotos).
"""
import sys

from comun import G, Y0, Escena, distribucion, nombre_centro, techo_caseta

MURO = "pared_verde"
YP = Y0 + 0.02
YB = Y0 + 2.45          # alto del muro macizo
YM = Y0 + 3.0           # borde alto de la franja abierta (ahí se apoya el techo)
PEND = 0.55
ANCHO_PUERTA = 0.95
Y_PUERTA = Y0 + 2.1


def franja(esc, a0, a1, c0, c1, eje):
    """Franja abierta entre YB y YM: solera, viga de amarre y parales de madera cada ~1 m."""
    caja = (lambda m, x0, x1, y0, y1, z0, z1: esc.caja(m, x0, x1, y0, y1, z0, z1)) if eje == "x" else \
           (lambda m, x0, x1, y0, y1, z0, z1: esc.caja(m, z0, z1, y0, y1, x0, x1))
    caja("madera", a0, a1, YB, YB + 0.08, c0 - 0.02, c1 + 0.02)
    caja("madera_osc", a0, a1, YM - 0.14, YM, c0 - 0.02, c1 + 0.02)
    n = max(1, round((a1 - a0) / 1.0))
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        caja("madera", max(a0, a - 0.05), min(a1, a + 0.05), YB, YM, c0, c1)


def caseta(esc, b, px):
    """Muros verdes con la puerta (vano centrado en px) en el frente, franja abierta y techo."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    caja = esc.caja
    p0, p1 = px - ANCHO_PUERTA / 2, px + ANCHO_PUERTA / 2
    caja(MURO, X0, p0, Y0, YB, Z1 - G, Z1)
    caja(MURO, p1, X1, Y0, YB, Z1 - G, Z1)
    caja(MURO, p0, p1, Y_PUERTA, YB, Z1 - G, Z1)
    caja(MURO, X0, X1, Y0, YB, Z0, Z0 + G)
    caja(MURO, X0, X0 + G, Y0, YB, Z0 + G, Z1 - G)
    caja(MURO, X1 - G, X1, Y0, YB, Z0 + G, Z1 - G)
    # Marco de la puerta (madera rojiza) y letrero "Baños"
    caja("madera", p0 - 0.07, p0, Y0, Y_PUERTA + 0.07, Z1 - G - 0.02, Z1 + 0.02)
    caja("madera", p1, p1 + 0.07, Y0, Y_PUERTA + 0.07, Z1 - G - 0.02, Z1 + 0.02)
    caja("madera", p0 - 0.07, p1 + 0.07, Y_PUERTA, Y_PUERTA + 0.07, Z1 - G - 0.02, Z1 + 0.02)
    caja("mural", px - 0.3, px + 0.3, Y_PUERTA + 0.1, Y_PUERTA + 0.3, Z1, Z1 + 0.03)
    caja("planta", px + 0.18, px + 0.28, Y_PUERTA + 0.2, Y_PUERTA + 0.28, Z1 + 0.03, Z1 + 0.035)
    # Franja abierta en los cuatro lados
    franja(esc, X0, X1, Z1 - G, Z1, "x")
    franja(esc, X0, X1, Z0, Z0 + G, "x")
    franja(esc, Z0 + G, Z1 - G, X0, X0 + G, "z")
    franja(esc, Z0 + G, Z1 - G, X1 - G, X1, "z")
    techo_caseta(esc, b, YM, PEND)
    return p0, p1


def interior_base(esc, b):
    """Piso de baldosa clara, enchape blanco con franja oscura, viga y tubo de luz."""
    XI0, XI1, ZI0, ZI1 = b.X0 + G, b.X1 - G, b.Z0 + G, b.Z1 - G
    caja = esc.caja
    caja("piso_claro", XI0, XI1, Y0, YP, ZI0, ZI1)
    for x0, x1, z0, z1 in ((XI0, XI1, ZI0, ZI0 + 0.01), (XI0, XI0 + 0.01, ZI0, ZI1), (XI1 - 0.01, XI1, ZI0, ZI1)):
        caja("blanco", x0, x1, YP, Y0 + 1.5, z0, z1)
        caja("pc", x0 - 0.002, x1 + 0.002, Y0 + 1.5, Y0 + 1.6, z0 - 0.002, z1 + 0.002)
        caja("blanco", x0, x1, Y0 + 1.6, YB, z0, z1)
    zc = (ZI0 + ZI1) / 2
    caja("madera_osc", XI0, XI1, YM - 0.14, YM, zc - 0.07, zc + 0.07)
    caja("tubo", -0.6, 0.6, YM - 0.2, YM - 0.14, zc - 0.05, zc + 0.05)
    return XI0, XI1, ZI0, ZI1


def puerta_abierta(esc, p0, z_muro):
    """Hoja de madera abierta hacia adentro, pegada al lado p0 del vano."""
    esc.caja("madera", p0, p0 + 0.05, Y0, Y_PUERTA - 0.02, z_muro - ANCHO_PUERTA + 0.05, z_muro)


def cubiculos(esc, x0, n, w, z_muro, prof, abierto=0):
    """n cubículos de ancho w seguidos desde x0 contra el muro z_muro, hacia +Z (prof de fondo).
    Divisiones y puertas de madera; la puerta `abierto` queda abierta."""
    caja = esc.caja
    zf = z_muro + prof
    for i in range(n + 1):
        x = x0 + i * w
        caja("madera", x - 0.02, x + 0.02, YP + 0.15, YP + 2.0, z_muro, zf)
    for i in range(n):
        xa, xb = x0 + i * w, x0 + (i + 1) * w
        caja("madera", xa + 0.02, xa + 0.12, YP + 0.15, YP + 2.0, zf - 0.04, zf)     # paral
        if i == abierto:
            caja("madera", xa + 0.12, xa + 0.16, YP + 0.15, YP + 1.95, zf, zf + w - 0.2)
        else:
            caja("madera", xa + 0.12, xb - 0.02, YP + 0.15, YP + 1.95, zf - 0.04, zf)
            caja("metal", xb - 0.15, xb - 0.1, YP + 0.95, YP + 1.05, zf, zf + 0.02)
        xm = (xa + xb) / 2                                                          # sanitario
        caja("porcelana", xm - 0.2, xm + 0.2, YP + 0.4, YP + 0.8, z_muro, z_muro + 0.2)
        caja("porcelana", xm - 0.17, xm + 0.17, YP, YP + 0.4, z_muro + 0.15, z_muro + 0.65)
        caja("blanco", xm - 0.19, xm + 0.19, YP + 0.4, YP + 0.43, z_muro + 0.15, z_muro + 0.68)


def lavamanos(esc, z0, z1, x_muro, s, n):
    """Mesón con n lavamanos contra el muro x_muro (s = +1 si el mesón crece hacia +X) y espejo."""
    caja = esc.caja
    xa, xb = sorted((x_muro, x_muro + s * 0.55))
    caja("concreto", xa, xb, YP + 0.82, YP + 0.88, z0, z1)
    caja("blanco", xa, xb, YP, YP + 0.82, z0, z0 + 0.06)
    caja("blanco", xa, xb, YP, YP + 0.82, z1 - 0.06, z1)
    for k in range(n):
        z = z0 + (z1 - z0) * (k + 0.5) / n
        caja("porcelana", xa + 0.08, xb - 0.08, YP + 0.84, YP + 0.89, z - 0.22, z + 0.22)
        xg = x_muro + s * 0.08
        caja("metal", min(xg, xg + s * 0.15), max(xg, xg + s * 0.15), YP + 1.0, YP + 1.04, z - 0.02, z + 0.02)
        caja("metal", min(xg, xg + s * 0.03), max(xg, xg + s * 0.03), YP + 0.88, YP + 1.04, z - 0.02, z + 0.02)
    xe = x_muro + s * 0.01
    caja("vidrio", min(xe, xe + s * 0.02), max(xe, xe + s * 0.02), YP + 1.15, YP + 1.95, z0 + 0.05, z1 - 0.05)


def hombres(esc, b, inicio="inicio", terreno=True):
    X0, X1, Z1 = b.X0, b.X1, b.Z1
    b.anden(esc, terreno)
    px = X0 + 1.4
    p0, _ = caseta(esc, b, px)
    esc.caja(MURO, X0, p0 - 0.12, Y0, YB, Z1, Z1 + 0.35)                             # muro saliente (foto)
    XI0, XI1, ZI0, ZI1 = interior_base(esc, b)
    puerta_abierta(esc, p0, Z1 - G)

    # Orinales en el muro de atrás, frente a la puerta, con separadores oscuros
    for i, x in enumerate((XI0 + 0.55, XI0 + 1.25, XI0 + 1.95)):
        esc.caja("porcelana", x - 0.18, x + 0.18, YP + 0.45, YP + 1.05, ZI0, ZI0 + 0.32)
        esc.caja("metal", x - 0.02, x + 0.02, YP + 1.05, YP + 1.6, ZI0, ZI0 + 0.05)
        if i < 2:
            esc.caja("pc", x + 0.33, x + 0.37, YP + 0.5, YP + 1.4, ZI0, ZI0 + 0.45)
    # Cubículos en el resto del muro de atrás y lavamanos contra la punta +X
    w = (XI1 - (XI0 + 2.4)) / 3
    cubiculos(esc, XI0 + 2.4, 3, w, ZI0, 1.45, abierto=0)
    lavamanos(esc, ZI0 + 1.9, ZI1 - 0.2, XI1, -1, 2)
    esc.punto(inicio, px, Z1 + 4.0)


def mujeres(esc, b, inicio="inicio", terreno=True):
    X0, Z1 = b.X0, b.Z1
    b.anden(esc, terreno)
    px = X0 + 1.4
    p0, p1 = caseta(esc, b, px)
    XI0, XI1, ZI0, ZI1 = interior_base(esc, b)
    puerta_abierta(esc, p0, Z1 - G)

    # Cubículos contra el muro de atrás y lavamanos en la punta -X, junto a la entrada
    w = (XI1 - (XI0 + 2.3)) / 3
    cubiculos(esc, XI0 + 2.3, 3, w, ZI0, 1.35, abierto=2)
    lavamanos(esc, ZI0 + 1.1, ZI1 - 0.1, XI0, 1, 2)
    # Cuarto de aseo frente a la puerta (la puerta de madera que se ve en la foto)
    esc.caja("madera", XI0, XI0 + 2.3, YP, YP + 2.0, ZI0 + 1.0, ZI0 + 1.04)
    esc.caja("metal", XI0 + 1.9, XI0 + 1.95, YP + 0.95, YP + 1.05, ZI0 + 1.04, ZI0 + 1.06)

    # Afuera, en el muro del frente: extintor, dispensador y canecas de reciclaje
    caja = esc.caja
    xe = p1 + 0.9
    caja("rojo", xe - 0.08, xe + 0.08, Y0 + 0.95, Y0 + 1.5, Z1, Z1 + 0.16)
    caja("pc", xe - 0.04, xe + 0.04, Y0 + 1.5, Y0 + 1.6, Z1, Z1 + 0.1)
    caja("mural", xe - 0.12, xe + 0.12, Y0 + 1.75, Y0 + 2.0, Z1, Z1 + 0.02)
    caja("blanco", xe + 0.6, xe + 0.85, Y0 + 1.1, Y0 + 1.8, Z1, Z1 + 0.12)
    for k, mat in enumerate(("pc", "planta", "blanco")):
        x = xe + 1.4 + k * 0.45
        caja(mat, x - 0.2, x + 0.2, Y0, Y0 + 0.9, Z1 + 0.15, Z1 + 0.6)
    caja("metal", xe + 1.15, xe + 2.5, Y0 + 0.95, Y0 + 1.0, Z1 + 0.1, Z1 + 0.15)
    esc.punto(inicio, px, Z1 + 3.5)


TIPOS = {"hombres": ("Baños para hombres", hombres), "mujeres": ("Baño para mujeres", mujeres)}


def colocar(esc, dist, tipo, inicio="inicio", terreno=True):
    nombre, construir = TIPOS[tipo]
    b, cx, cz, frente = dist[nombre]
    esc.colocar(cx, cz, frente)
    construir(esc, b, inicio, terreno)
    esc.punto(nombre_centro(nombre), 0.0, (b.RZ0 + b.RZ1) / 2, y=6.0, extras={"nombre": nombre})


if __name__ == "__main__":
    nombre, construir = TIPOS[sys.argv[1]]
    b, *_ = distribucion()[nombre]
    esc = Escena()
    construir(esc, b)
    esc.guardar(sys.argv[2], nombre)
