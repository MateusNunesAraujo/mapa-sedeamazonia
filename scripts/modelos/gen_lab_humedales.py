"""Genera el modelo 3D del Laboratorio de manejo y gestión de humedales
(static/modelos/lab_humedales.glb) sin dependencias.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_lab_humedales.py static/modelos/lab_humedales.glb

Bloque de ~13,6 x 17,3 m de techo (polígono del mapa) pegado al corredor cubierto del este,
con la puerta hacia él (oeste). En el plano, la esquina noreste no tiene techo: es un patio de
servicio, así que el techo tiene forma de L (cuatro aguas con un limahoya en la esquina).
Por fuera sigue la foto static/fotos/laboratorio_investigacion_biologica.png: muros ocre con
pilastras en las esquinas, ventanales con marcos de madera y persianas, una franja de listones
de madera bajo el alero, una lona pintada en el muro norte y techo de teja oscura.
Adentro: laboratorio con mesones, isla central con microscopios, lavaplatos, acuarios y
nevera; un cuarto de colecciones (ficoteca, xiloteca) con estantes de frascos; y en el patio,
tanques de agua, lavadero y tinas de humedal artificial (mesocosmos).

En el sistema local: +Z = frente (oeste), +X = sur, -X = norte, -Z = este.
"""
import sys

from comun import G, HUMEDALES, M_POR_LAT, M_POR_LNG, YT, Y0, Escena, distribucion, huella, nombre_centro
from muebles import _caja_eje, cilindro, computador, estante, mesa, planta, silla

MURO = "pared_mostaza"
YP = Y0 + 0.02
Y_ANTE, Y_DIN = Y0 + 0.8, Y0 + 2.35
PEND = 0.5
ALERO = 1.2
PUERTA = (1.0, 2.6)              # puertas dobles del frente (x local)
PUERTA_PATIO = (-4.6, -3.6)      # puerta al patio (z local)
PUERTA_CUARTO = (3.0, 4.0)       # vano entre el laboratorio y el cuarto de colecciones (z local)
# Esquina sin techo del plano (lat 301,8 a 312, lng 739 a 759,75), medida desde el borde del techo
PATIO_LAT, PATIO_LNG = 301.8, 739.0


def esquina_patio(b):
    """(PX, PZ): hasta dónde llega el patio, en el sistema local."""
    lat0, lat1, lng0, lng1 = huella(HUMEDALES)
    return b.RX0 + (lat1 - PATIO_LAT) * M_POR_LAT, b.RZ0 + (lng1 - PATIO_LNG) * M_POR_LNG


# ---------------- Techo en L ----------------
def recortar(pol, a, b, c):
    """Parte del polígono convexo `pol` [(x, z)] donde a*x + b*z + c >= 0."""
    out = []
    for i, p in enumerate(pol):
        q = pol[(i + 1) % len(pol)]
        fp, fq = a * p[0] + b * p[1] + c, a * q[0] + b * q[1] + c
        if fp >= 0:
            out.append(p)
        if (fp >= 0) != (fq >= 0):
            t = fp / (fp - fq)
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out


def techo_l(esc, b, PX, PZ, T=0.2):
    """Techo de igual pendiente sobre la L que deja el patio (x < PX y z < PZ sin techo).

    La altura en cada punto es la distancia (L∞) al borde de la L: en un plano ortogonal eso
    da exactamente las aguas, limatesas y la limahoya de la esquina. Se arma partiendo la L en
    dos regiones convexas (a cada lado de la diagonal que sale de la esquina del patio) y, en
    cada una, el agua de cada borde es donde su distancia es la menor."""
    RX0, RX1, RZ0, RZ1 = b.RX0, b.RX1, b.RZ0, b.RZ1
    ya = YT - PEND * ALERO
    caja = [(RX0, RZ0), (RX0, RZ1), (RX1, RZ1), (RX1, RZ0)]
    # Distancias a cada borde como (a, b, c): d = a*x + b*z + c
    bordes = [(-1, 0, RX1), (0, -1, RZ1), (0, 1, -RZ0), (1, 0, -RX0)]
    regiones = (
        (recortar(recortar(caja, 1, 0, -PX), 1, -1, -PX + PZ), (1, 0, -PX)),    # x >= PX, bajo la diagonal
        (recortar(recortar(caja, 0, 1, -PZ), -1, 1, PX - PZ), (0, 1, -PZ)),    # z >= PZ, sobre la diagonal
    )
    for region, patio in regiones:
        planos = bordes + [patio]
        for i, (a, bb, c) in enumerate(planos):
            cara = region
            for j, (a2, b2, c2) in enumerate(planos):
                if j != i and cara:
                    cara = recortar(cara, a2 - a, b2 - bb, c2 - c)      # d_j - d_i >= 0
            cara = [p for k, p in enumerate(cara)                         # sin puntos repetidos
                    if abs(p[0] - cara[k - 1][0]) + abs(p[1] - cara[k - 1][1]) > 1e-6]
            if len(cara) < 3:
                continue
            area = sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(cara, cara[1:] + cara[:1]))
            if area > 0:                                                  # antihorario visto desde arriba
                cara = cara[::-1]
            alto = lambda p: ya + PEND * (a * p[0] + bb * p[1] + c)
            esc.poligono("teja_osc", [[p[0], alto(p) + T, p[1]] for p in cara])
            esc.poligono("madera", [[p[0], alto(p), p[1]] for p in reversed(cara)])
    # Canto alrededor de la L (todo el borde está a la altura del alero)
    borde = [(RX0, PZ), (RX0, RZ1), (RX1, RZ1), (RX1, RZ0), (PX, RZ0), (PX, PZ)]
    for p, q in zip(borde, borde[1:] + borde[:1]):
        esc.poligono("teja_osc", [[p[0], ya, p[1]], [q[0], ya, q[1]], [q[0], ya + T, q[1]], [p[0], ya + T, p[1]]])


# ---------------- Muros ----------------
def ventanal(esc, a0, a1, c0, c1, eje="x", puerta=None, adentro=1, macizo=False):
    """Muro ocre con pilastras en las puntas, ventanales con marcos de madera y persianas,
    y arriba la franja de listones bajo el alero. puerta: vano (p0, p1) con dos hojas abiertas
    hacia `adentro` (+1: hacia +c). macizo: sin ventanas (muro liso hasta la franja)."""
    caja = _caja_eje(esc, eje)
    cm = (c0 + c1) / 2
    caja(MURO, a0, a0 + 0.4, Y0, YT, c0 - 0.03, c1 + 0.03)
    caja(MURO, a1 - 0.4, a1, Y0, YT, c0 - 0.03, c1 + 0.03)
    tramos = [(a0 + 0.4, a1 - 0.4)]
    if puerta:
        p0, p1 = puerta
        tramos = [(a0 + 0.4, p0 - 0.1), (p1 + 0.1, a1 - 0.4)]
        for x in (p0, p1):
            caja("madera_osc", x - 0.1, x + 0.1, Y0, Y_DIN, c0 - 0.02, c1 + 0.02)
        caja("madera_osc", p0 - 0.1, p1 + 0.1, Y_DIN - 0.1, Y_DIN, c0 - 0.02, c1 + 0.02)
        m = (p0 + p1) / 2
        ca = c1 if adentro > 0 else c0
        for h0, h1 in ((p0 + 0.1, p0 + 0.15), (p1 - 0.15, p1 - 0.1)):
            caja("madera", h0, h1, Y0, Y_DIN - 0.12, min(ca, ca + adentro * (m - p0 - 0.1)),
                 max(ca, ca + adentro * (m - p0 - 0.1)))
    for t0, t1 in tramos:
        if t1 - t0 < 0.05:
            continue
        if macizo:
            caja(MURO, t0, t1, Y0, Y_DIN, c0, c1)
            continue
        caja(MURO, t0, t1, Y0, Y_ANTE, c0, c1)
        caja("madera", t0, t1, Y_ANTE - 0.04, Y_ANTE, c0 - 0.05, c1 + 0.05)              # alféizar
        caja("vidrio", t0, t1, Y_ANTE, Y_DIN, cm - 0.02, cm + 0.02)
        n = max(1, round((t1 - t0) / 1.0))
        for i in range(n + 1):
            x = t0 + (t1 - t0) * i / n
            caja("madera", max(t0, x - 0.05), min(t1, x + 0.05), Y_ANTE, Y_DIN, cm - 0.06, cm + 0.06)
        caja("madera", t0, t1, Y0 + 1.75, Y0 + 1.8, cm - 0.05, cm + 0.05)                # travesaño
        cp = cm + (0.09 if adentro > 0 else -0.09)                                       # persianas
        for k in range(7):
            y = Y_ANTE + 0.1 + k * 0.12
            caja("madera", t0, t1, y, y + 0.025, cp - 0.03, cp + 0.03)
    # Viga sobre los vanos y franja de listones hasta el techo
    caja("madera", a0 + 0.4, a1 - 0.4, Y_DIN, Y_DIN + 0.1, c0 - 0.02, c1 + 0.02)
    caja("vidrio", a0 + 0.4, a1 - 0.4, Y_DIN + 0.1, YT, cm - 0.02, cm + 0.02)
    n = max(1, round((a1 - a0 - 0.8) / 0.3))
    for i in range(n + 1):
        x = a0 + 0.4 + (a1 - a0 - 0.8) * i / n
        caja("madera_osc", x - 0.035, x + 0.035, Y_DIN + 0.1, YT, c0, c1)
    caja("madera_osc", a0, a1, YT - 0.1, YT, c0 - 0.03, c1 + 0.03)


# ---------------- Muebles del laboratorio ----------------
def microscopio(esc, x, z, y):
    caja = esc.caja
    caja("blanco", x - 0.12, x + 0.12, y, y + 0.04, z - 0.15, z + 0.15)
    caja("blanco", x - 0.04, x + 0.04, y + 0.04, y + 0.32, z - 0.12, z - 0.05)
    caja("pc", x - 0.08, x + 0.08, y + 0.14, y + 0.16, z - 0.06, z + 0.08)               # platina
    caja("pc", x - 0.03, x + 0.03, y + 0.2, y + 0.42, z - 0.04, z + 0.02)                # tubo
    caja("pc", x - 0.02, x + 0.02, y + 0.38, y + 0.46, z - 0.12, z - 0.04)               # ocular


def taburete(esc, x, z, y):
    esc.caja("metal", x - 0.03, x + 0.03, y, y + 0.62, z - 0.03, z + 0.03)
    esc.caja("metal", x - 0.2, x + 0.2, y, y + 0.03, z - 0.2, z + 0.2)
    cilindro(esc, "silla_negra", x, z, 0.18, y + 0.62, y + 0.68, n=8)


def meson(esc, x0, x1, z0, z1, y, lavaplatos=()):
    """Mesón de laboratorio: gabinete de madera, cubierta clara y lavaplatos (posición, eje)."""
    caja = esc.caja
    caja("madera", x0 + 0.03, x1 - 0.03, y, y + 0.85, z0 + 0.03, z1 - 0.03)
    caja("blanco", x0, x1, y + 0.85, y + 0.9, z0, z1)
    for x, z in lavaplatos:
        caja("metal", x - 0.3, x + 0.3, y + 0.9, y + 0.91, z - 0.22, z + 0.22)
        caja("metal", x - 0.02, x + 0.02, y + 0.9, y + 1.2, z - 0.02, z + 0.02)          # grifo


def estante_frascos(esc, x0, x1, z0, z1, y, alto=2.0, niveles=5):
    """Estante abierto de metal con frascos de colección (algas, semillas, muestras en alcohol)."""
    caja = esc.caja
    largo_x = (x1 - x0) >= (z1 - z0)
    a0, a1 = (x0, x1) if largo_x else (z0, z1)
    for a in (a0, a1):
        if largo_x:
            caja("metal", a, a + 0.04, y, y + alto, z0, z1)
        else:
            caja("metal", x0, x1, y, y + alto, a, a + 0.04)
    mats = ("agua", "libro_crema", "planta", "vidrio", "relieve")
    for nivel in range(niveles):
        yb = y + 0.1 + nivel * (alto - 0.15) / niveles
        caja("metal", x0, x1, yb - 0.02, yb, z0, z1)
        n = int((a1 - a0 - 0.1) / 0.18)
        for k in range(n):
            a = a0 + 0.1 + k * 0.18
            h = 0.16 + 0.06 * ((k + nivel) % 3)
            mat = mats[(k * 2 + nivel) % len(mats)]
            if largo_x:
                caja(mat, a, a + 0.12, yb, yb + h, (z0 + z1) / 2 - 0.06, (z0 + z1) / 2 + 0.06)
            else:
                caja(mat, (x0 + x1) / 2 - 0.06, (x0 + x1) / 2 + 0.06, yb, yb + h, a, a + 0.12)


def acuario(esc, x0, x1, z0, z1, y):
    esc.caja("metal", x0, x1, y, y + 0.8, z0, z1)
    esc.caja("agua", x0 + 0.03, x1 - 0.03, y + 0.82, y + 1.22, z0 + 0.03, z1 - 0.03)
    esc.caja("vidrio", x0, x1, y + 0.8, y + 1.3, z0, z0 + 0.02)
    esc.caja("vidrio", x0, x1, y + 0.8, y + 1.3, z1 - 0.02, z1)
    esc.caja("planta", x0 + 0.1, x0 + 0.25, y + 0.82, y + 1.15, z0 + 0.1, z1 - 0.1)


def tina_humedal(esc, x0, x1, z0, z1):
    """Tina de humedal artificial: borde de concreto, agua y plantas acuáticas."""
    caja = esc.caja
    caja("concreto", x0, x1, Y0, Y0 + 0.6, z0, z0 + 0.08)
    caja("concreto", x0, x1, Y0, Y0 + 0.6, z1 - 0.08, z1)
    caja("concreto", x0, x0 + 0.08, Y0, Y0 + 0.6, z0, z1)
    caja("concreto", x1 - 0.08, x1, Y0, Y0 + 0.6, z0, z1)
    caja("agua", x0 + 0.08, x1 - 0.08, Y0, Y0 + 0.5, z0 + 0.08, z1 - 0.08)
    for k, (fx, fz) in enumerate(((0.3, 0.3), (0.7, 0.6), (0.4, 0.8))):
        x, z = x0 + (x1 - x0) * fx, z0 + (z1 - z0) * fz
        caja("planta", x - 0.12, x + 0.12, Y0 + 0.5, Y0 + 0.9 + 0.15 * k, z - 0.12, z + 0.12)


def construir(esc, b, inicio="inicio", terreno=True):
    """Dibuja el laboratorio en el sistema local de `b` (frente hacia +Z)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    caja = esc.caja
    PX, PZ = esquina_patio(b)
    QX, QZ = PX + ALERO, PZ + ALERO                 # esquina de los muros junto al patio
    b.anden(esc, terreno)

    # Muros
    ventanal(esc, X0, X1, Z1 - G, Z1, "x", puerta=PUERTA, adentro=-1)                    # frente (oeste)
    ventanal(esc, Z0, Z1, X1 - G, X1, "z", adentro=-1)                                   # sur
    ventanal(esc, QX, X1, Z0, Z0 + G, "x", adentro=1)                                    # este
    ventanal(esc, Z0, QZ + G, QX, QX + G, "z", puerta=PUERTA_PATIO, adentro=1)           # al patio
    ventanal(esc, X0, QX + G, QZ, QZ + G, "x", adentro=1)                                # cuarto, al patio
    ventanal(esc, QZ, Z1, X0, X0 + G, "z", adentro=1, macizo=True)                       # norte
    # Tabique entre el laboratorio y el cuarto de colecciones, con un vano libre
    p0, p1 = PUERTA_CUARTO
    caja("pared_int", QX, QX + G, Y0, YT, QZ + G, p0)
    caja("pared_int", QX, QX + G, Y0, YT, p1, Z1 - G)
    caja("pared_int", QX, QX + G, Y0 + 2.2, YT, p0, p1)
    techo_l(esc, b, PX, PZ)

    # Lona pintada en el muro norte (foto) y condensador del aire en el muro este
    caja("mural", X0 - 0.03, X0 - 0.01, Y0 + 0.35, Y0 + 2.2, QZ + 1.0, Z1 - 1.0)
    for k in range(9):
        z = QZ + 1.4 + k * (Z1 - QZ - 2.8) / 8
        y = Y0 + 0.6 + (k % 3) * 0.5
        caja("relieve" if k % 2 else "libro_crema", X0 - 0.04, X0 - 0.03, y, y + 0.35, z - 0.2, z + 0.2)
    caja("aire", 2.0, 2.9, Y0 + 0.3, Y0 + 1.0, Z0 - 0.4, Z0)
    caja("metal", 2.0, 2.9, Y0, Y0 + 0.3, Z0 - 0.4, Z0)

    # ---------------- Patio de servicio (sin techo) ----------------
    caja("concreto", b.RX0, QX, 0.0, Y0, b.RZ0, QZ)
    caja("concreto", b.RX0, b.RX0 + 0.15, Y0, Y0 + 1.0, b.RZ0, PZ - 1.4)                  # muretes
    caja("concreto", b.RX0, PX - 0.4, Y0, Y0 + 1.0, b.RZ0, b.RZ0 + 0.15)
    for k, z in enumerate((b.RZ0 + 0.9, b.RZ0 + 2.3)):                                    # tanques
        cilindro(esc, "mural_azul", b.RX0 + 0.95, z, 0.6, Y0, Y0 + 1.4)
        cilindro(esc, "pc", b.RX0 + 0.95, z, 0.25, Y0 + 1.4, Y0 + 1.5)
    for k in range(3):                                                                    # mesocosmos
        z = b.RZ0 + 0.6 + k * 1.3
        tina_humedal(esc, PX - 1.4, PX - 0.4, z, z + 1.0)
    caja("concreto", QX - 0.7, QX - 0.05, Y0, Y0 + 0.85, PUERTA_PATIO[0] - 1.6, PUERTA_PATIO[0] - 0.4)  # lavadero
    caja("agua", QX - 0.6, QX - 0.15, Y0 + 0.75, Y0 + 0.82, PUERTA_PATIO[0] - 1.5, PUERTA_PATIO[0] - 0.5)

    # ---------------- Laboratorio (sur) ----------------
    XI0, XI1, ZI0, ZI1 = QX + G, X1 - G, Z0 + G, Z1 - G
    caja("piso_gris", XI0, XI1, Y0, YP, ZI0, ZI1)
    # Mesón contra el muro sur, con dos lavaplatos y microscopios
    meson(esc, XI1 - 0.7, XI1, ZI0 + 1.0, ZI1 - 1.2, YP, lavaplatos=((XI1 - 0.35, -3.5), (XI1 - 0.35, 3.0)))
    for z in (-5.0, -1.5, 0.0, 1.5, 4.5):
        microscopio(esc, XI1 - 0.4, z, YP + 0.9)
        taburete(esc, XI1 - 1.05, z, YP)
    # Isla central con microscopios y taburetes a los dos lados
    xm = (XI0 + XI1) / 2 - 0.3
    meson(esc, xm - 0.6, xm + 0.6, -5.0, 3.0, YP, lavaplatos=((xm, 2.4),))
    for z in (-4.2, -2.6, -1.0, 0.6):
        microscopio(esc, xm - 0.3, z, YP + 0.9)
        microscopio(esc, xm + 0.3, z + 0.6, YP + 0.9)
        taburete(esc, xm - 0.95, z, YP)
        taburete(esc, xm + 0.95, z + 0.6, YP)
    # Acuarios contra el muro este y nevera junto a la puerta del patio
    for x in (XI0 + 0.3, XI0 + 1.9):
        acuario(esc, x, x + 1.3, ZI0, ZI0 + 0.55, YP)
    caja("nevera", XI0, XI0 + 0.75, YP, YP + 1.85, PUERTA_PATIO[1] + 0.4, PUERTA_PATIO[1] + 1.2)
    caja("nevera", XI0, XI0 + 0.75, YP, YP + 1.85, PUERTA_PATIO[1] + 1.3, PUERTA_PATIO[1] + 2.1)
    # Puesto con computador junto al frente
    mesa(esc, XI0, XI0 + 0.7, ZI1 - 2.2, ZI1 - 0.6, YP)
    computador(esc, XI0 + 0.3, ZI1 - 1.4, YP + 0.74, (1, 0))
    silla(esc, XI0 + 1.1, ZI1 - 1.4, YP, (-1, 0))

    # ---------------- Cuarto de colecciones (noroeste) ----------------
    CX0, CX1, CZ0, CZ1 = X0 + G, QX, QZ + G, Z1 - G
    caja("piso_gris", CX0, CX1, Y0, YP, CZ0, CZ1)
    estante_frascos(esc, CX0, CX0 + 0.4, CZ0 + 0.2, CZ1 - 0.3, YP)                         # muro norte
    estante_frascos(esc, CX0 + 0.6, CX1 - 0.3, CZ0, CZ0 + 0.4, YP)                         # muro del patio
    estante(esc, CX1 - 0.4, CX1, CZ1 - 2.6, CZ1 - 0.2, YP, alto=1.9, niveles=4)           # xiloteca
    mesa(esc, -3.6, -1.8, 2.4, 3.6, YP, mat="madera")
    microscopio(esc, -3.0, 3.0, YP + 0.74)
    computador(esc, -2.3, 3.0, YP + 0.74, (0, 1))
    silla(esc, -3.0, 4.0, YP, (0, -1))
    silla(esc, -2.3, 4.0, YP, (0, -1))
    planta(esc, CX0 + 0.8, CZ1 - 0.5, YP)

    # Lámparas colgadas de la estructura
    for x, z in [(xm, zz) for zz in (-5.5, -2.0, 1.5, 5.0)] + [(-3.0, 2.0), (-3.0, 5.5)]:
        caja("metal", x - 0.01, x + 0.01, YT - 0.4, YT + 0.9, z - 0.01, z + 0.01)
        caja("tubo", x - 0.06, x + 0.06, YT - 0.45, YT - 0.4, z - 0.6, z + 0.6)

    # Partida del recorrido: en el corredor, frente a la puerta
    esc.punto(inicio, sum(PUERTA) / 2, b.RZ1 + 1.0)


def colocar(esc, dist, inicio="inicio", terreno=True):
    b, cx, cz, frente = dist[HUMEDALES]
    esc.colocar(cx, cz, frente)
    construir(esc, b, inicio, terreno)
    esc.punto(nombre_centro(HUMEDALES), 1.5, (b.RZ0 + b.RZ1) / 2, y=7.0, extras={"nombre": HUMEDALES})


if __name__ == "__main__":
    b, *_ = distribucion()[HUMEDALES]
    esc = Escena()
    construir(esc, b)
    esc.guardar(sys.argv[1], "Laboratorio de humedales")
