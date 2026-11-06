"""Genera el modelo 3D de la Oficina de Asesoría y Orientación Tecnológica
(static/modelos/oficina_tec.glb) sin dependencias.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_oficina_tec.py static/modelos/oficina_tec.glb

Bloque casi cuadrado (~11,4 x 11,1 m de techo según el polígono del mapa) al sur de la Sala de
sistemas 1, con el frente al corredor cubierto del este (oeste). En la foto
static/fotos/oficina_asesoria_y_orientacion_tecnologica.png se ve la sala ocre y la buganvilia
detrás, a la izquierda (al norte), lo que confirma la orientación.

Por fuera, como en la foto: muros vinotinto; frente de madera con celosías a los lados de la
puerta doble, ventanales con persianas de madera en la mitad baja y claraboya de vidrio; letrero
sobre la puerta, afiche, lector de tarjetas y lámpara; techo de teja oscura con quiebre de
pendiente, cabios a la vista y un gablete de ventilación en la punta; canales y bajantes;
andén con cuneta y rejillas; condensadores del aire y contador de luz al sur y una lámpara solar
detrás.

Adentro (oficina de soporte técnico): sala de espera con dispensador de agua, recepción, dos
puestos con doble pantalla y uno más en el centro, banco de reparación con un computador abierto,
portátil, multímetro, cautín, caja de herramientas y lámpara; rack de red con luces; estantería
de equipos y cajas; carro de portátiles para préstamo; impresora; oficina de coordinación con
divisiones de vidrio; reloj, cartelera, guardaescobas, baldosas, cielo raso blanco con paneles de
luz y aires acondicionados.

En el sistema local: +Z = frente (oeste), +X = sur, -X = norte, -Z = este (fondo).
"""
import math
import sys

from comun import (G, OFICINA_TEC, YT, Y0, Escena, cabios, distribucion, nombre_centro,
                   techo_quiebre)
from muebles import (archivador, cilindro, computador, frente_madera, mesa, panel_luz, planta,
                     rejilla, silla)

MURO = "vino"
YP = Y0 + 0.02
Y_DIN = Y0 + 2.35
P_BAJA, P_ALTA, QUIEBRE = 0.35, 0.85, 2.2
FRENTE = "JPPJ|VVWW"                                   # de norte a sur, como en la foto
ANCHOS = (0.85, 0.7, 0.7, 0.85, 1, 1, 1, 1)
PILASTRA_N, MACIZO_S = 0.25, 0.6                       # puntas macizas del frente
DIVISION_X, DIVISION_Z = 1.2, -1.0                     # oficina de coordinación (esquina SE)


class Girado:
    """Dibuja en un sistema girado `ang` alrededor del centro del edificio, para armar cada
    costado como si fuera un frente (+Z hacia afuera). Se usa con `with`."""

    def __init__(self, esc, ang):
        self.esc, self.ang = esc, ang

    def __enter__(self):
        self.antes = self.esc.giro
        self.esc.giro += self.ang
        return self.esc

    def __exit__(self, *_):
        self.esc.giro = self.antes


# ---------------- Por fuera ----------------
def costado(esc, a0, a1, zc, panos, anchos=None, macizo=0.0, abiertas=()):
    """Un costado en su sistema girado: pilastras vinotinto en las puntas, un tramo macizo opcional
    desde a0 y paños de madera (frente_madera) en el resto. zc: cara exterior del muro."""
    caja = esc.caja
    caja(MURO, a0, a0 + 0.3 + macizo, Y0, YT, zc - G, zc)
    caja(MURO, a1 - 0.3, a1, Y0, YT, zc - G, zc)
    return frente_madera(esc, MURO, a0 + 0.3 + macizo, a1 - 0.3, zc - 0.12, panos,
                         anchos=anchos, abiertas=abiertas)


def detalles_frente(esc, b, puerta):
    """Letrero sobre la puerta, afiche en la celosía, lector de tarjetas y lámpara de pared."""
    caja = esc.caja
    z = b.Z1 - 0.12 + 0.1
    caja("tablero", puerta - 0.4, puerta + 0.4, Y_DIN + 0.12, Y_DIN + 0.4, z, z + 0.02)
    for k, L in enumerate((0.6, 0.45)):
        y = Y_DIN + 0.3 - k * 0.1
        caja("pc", puerta - L / 2, puerta + L / 2, y, y + 0.03, z + 0.02, z + 0.025)
    xa = puerta + 0.78 + 0.4                                                              # afiche
    caja("tablero", xa - 0.22, xa + 0.22, Y0 + 1.3, Y0 + 1.9, z + 0.04, z + 0.05)
    for i, (dx, dy) in enumerate(((-0.09, 0.12), (0.09, 0.12), (-0.09, -0.12), (0.09, -0.12))):
        caja("mural_azul" if i % 3 else "pc", xa + dx - 0.07, xa + dx + 0.07, Y0 + 1.6 + dy - 0.08,
             Y0 + 1.6 + dy + 0.08, z + 0.05, z + 0.055)
    xl = puerta + 0.78 + 0.08                                                             # lector
    caja("pc", xl - 0.05, xl + 0.05, Y0 + 1.15, Y0 + 1.3, z, z + 0.04)
    caja("led", xl - 0.01, xl + 0.01, Y0 + 1.27, Y0 + 1.28, z + 0.04, z + 0.045)
    caja("metal", puerta - 0.03, puerta + 0.03, YT - 0.25, YT - 0.2, z, z + 0.3)          # lámpara
    caja("lampara", puerta - 0.1, puerta + 0.1, YT - 0.32, YT - 0.25, z + 0.2, z + 0.4)


def gablete(esc, b):
    """Caballete corto con dos gabletes de ventilación (triángulos de listones) en la punta del
    techo, de frente a fondo, como el que asoma en la foto."""
    caja = esc.caja
    y_alero = YT - P_BAJA * (b.X0 - b.RX0)
    m = min(b.RX1, b.RZ1) - QUIEBRE
    y_top = y_alero + P_BAJA * QUIEBRE + P_ALTA * m
    L, W, H = 0.65, 0.6, 0.55                     # medio largo, medio ancho y alto del caballete
    yb = y_top - P_ALTA * W                       # donde el gablete se apoya en el techo
    yr = yb + H
    for s in (1, -1):                             # dos aguas, de arriba hacia cada lado
        a, c = [0.0, yr + 0.06, -L], [s * (W + 0.15), yb - 0.05, -L]
        cara = [a, [a[0], a[1], L], [c[0], c[1], L], c]
        if s < 0:
            cara = cara[::-1]
        esc.poligono("teja_osc", cara)
        esc.poligono("madera", [[p[0], p[1] - 0.04, p[2]] for p in reversed(cara)])
    caja("madera_osc", -0.05, 0.05, yr, yr + 0.1, -L - 0.05, L + 0.05)                     # cumbrera
    for s in (1, -1):                                                                      # gabletes
        zf = s * (L - 0.05)
        tri = [[-W, yb - 0.1, zf], [W, yb - 0.1, zf], [0.0, yr, zf]]
        esc.poligono("pc", tri if s > 0 else tri[::-1])                                    # hueco oscuro
        for k in range(7):
            x = -W + 0.12 + k * (2 * W - 0.24) / 6
            alto = yr - (yr - yb + 0.1) * abs(x) / W
            caja("madera", x - 0.035, x + 0.035, yb - 0.1, alto, zf + s * 0.01 - 0.02, zf + s * 0.01 + 0.02)


def canales(esc, b):
    """Canal de lámina alrededor del alero y una bajante en cada esquina."""
    caja = esc.caja
    ya = YT - P_BAJA * (b.X0 - b.RX0)
    RX0, RX1, RZ0, RZ1 = b.RX0, b.RX1, b.RZ0, b.RZ1
    for x0, x1, z0, z1 in ((RX0 - 0.14, RX1 + 0.14, RZ1, RZ1 + 0.14), (RX0 - 0.14, RX1 + 0.14, RZ0 - 0.14, RZ0),
                           (RX0 - 0.14, RX0, RZ0, RZ1), (RX1, RX1 + 0.14, RZ0, RZ1)):
        caja("metal", x0, x1, ya - 0.12, ya + 0.02, z0, z1)
    for x in (RX0 - 0.07, RX1 + 0.07):
        for z in (RZ0 - 0.07, RZ1 + 0.07):
            caja("metal", x - 0.04, x + 0.04, 0.12, ya - 0.12, z - 0.04, z + 0.04)
            caja("concreto", x - 0.15, x + 0.15, 0.0, 0.08, z - 0.15, z + 0.15)          # salpicadero


def andén(esc, b):
    """Andén ancho al frente con la cuneta bajo el alero (rejilla de metal) y dos sumideros."""
    caja = esc.caja
    x0, x1 = b.RX0 - 1.5, b.RX1 + 1.5
    caja("concreto", x0, x1, 0.0, Y0, b.RZ1 + 0.3, b.RZ1 + 2.6)
    caja("pc", x0, x1, 0.0, Y0 - 0.02, b.RZ1 - 0.1, b.RZ1 + 0.3)                           # cuneta
    for x in [x0 + 0.08 + k * 0.15 for k in range(int((x1 - x0) / 0.15))]:
        caja("metal", x - 0.02, x + 0.02, Y0 - 0.03, Y0 - 0.01, b.RZ1 - 0.1, b.RZ1 + 0.3)
    for xs in (b.RX0 + 0.2, b.RX0 + 1.4):                                                  # sumideros
        zs = b.RZ1 + 1.5
        caja("pc", xs - 0.35, xs + 0.35, Y0, Y0 + 0.005, zs - 0.35, zs + 0.35)
        for k in range(5):
            x = xs - 0.28 + k * 0.14
            caja("metal", x - 0.02, x + 0.02, Y0, Y0 + 0.01, zs - 0.33, zs + 0.33)


def costado_sur(esc, b):
    """Afuera del muro sur (+X): dos condensadores sobre base, tubería y contador de luz."""
    caja = esc.caja
    x = b.X1
    for z in (-0.6, 0.6):
        caja("concreto", x + 0.1, x + 0.7, 0.0, Y0 + 0.1, z - 0.5, z + 0.5)
        caja("aire", x + 0.15, x + 0.6, Y0 + 0.1, Y0 + 0.75, z - 0.42, z + 0.42)
        caja("pc", x + 0.6, x + 0.61, Y0 + 0.2, Y0 + 0.65, z - 0.3, z + 0.15)              # rejilla
        caja("metal", x + 0.02, x + 0.07, Y0 + 0.5, YT - 0.4, z + 0.3, z + 0.35)            # tubería
    caja("archivador", x, x + 0.18, Y0 + 1.3, Y0 + 1.75, 2.6, 2.95)                        # contador
    caja("pantalla_pc", x + 0.18, x + 0.19, Y0 + 1.5, Y0 + 1.62, 2.68, 2.87)
    caja("metal", x + 0.03, x + 0.07, Y0 + 1.75, YT - 0.1, 2.75, 2.8)


def lampara_solar(esc, x, z):
    """Poste de alumbrado con panel solar (asoma detrás del techo en la foto)."""
    caja = esc.caja
    caja("concreto", x - 0.25, x + 0.25, 0.0, 0.3, z - 0.25, z + 0.25)
    caja("metal", x - 0.06, x + 0.06, 0.3, 6.2, z - 0.06, z + 0.06)
    caja("metal", x - 0.03, x + 0.03, 6.0, 6.05, z - 0.06, z + 0.9)                        # brazo
    caja("metal", x - 0.15, x + 0.15, 5.85, 6.0, z + 0.6, z + 1.1)                         # luminaria
    caja("lampara", x - 0.13, x + 0.13, 5.83, 5.85, z + 0.62, z + 1.08)
    caja("pantalla_pc", x - 0.45, x + 0.45, 6.3, 6.34, z - 0.35, z + 0.35, rot_x=0.5, pivote=(0, 6.32, z))
    caja("metal", x - 0.47, x + 0.47, 6.27, 6.3, z - 0.37, z + 0.37, rot_x=0.5, pivote=(0, 6.32, z))


# ---------------- Muebles de la oficina ----------------
def portatil(esc, x, z, y, mira=1, abierto=True):
    """Portátil con la pantalla hacia +Z (mira=1) o -Z (mira=-1)."""
    caja = esc.caja
    caja("pc", x - 0.17, x + 0.17, y, y + 0.02, z - 0.12, z + 0.12)
    caja("metal", x - 0.14, x + 0.14, y + 0.02, y + 0.022, z - 0.05 * mira - 0.05, z - 0.05 * mira + 0.05)
    if abierto:
        zb = z - mira * 0.12                                   # bisagra atrás
        ang = -0.25 * mira
        z0, z1 = (zb, zb + 0.015) if mira > 0 else (zb - 0.015, zb)
        caja("pc", x - 0.17, x + 0.17, y + 0.02, y + 0.26, z0, z1, rot_x=ang, pivote=(0, y + 0.02, zb))
        zs = z1 + 0.001 if mira > 0 else z0 - 0.002
        caja("pantalla_pc", x - 0.15, x + 0.15, y + 0.04, y + 0.24, zs, zs + 0.001, rot_x=ang, pivote=(0, y + 0.02, zb))


def pc_abierto(esc, x, z, y):
    """Torre sin la tapa lateral: chasis, tarjeta madre, memorias, disipador y fuente."""
    caja = esc.caja
    caja("metal", x - 0.1, x + 0.1, y, y + 0.02, z - 0.22, z + 0.22)
    caja("metal", x - 0.1, x + 0.1, y + 0.43, y + 0.45, z - 0.22, z + 0.22)
    caja("metal", x - 0.1, x + 0.1, y, y + 0.45, z - 0.22, z - 0.2)
    caja("metal", x - 0.1, x + 0.1, y, y + 0.45, z + 0.2, z + 0.22)
    caja("metal", x + 0.08, x + 0.1, y, y + 0.45, z - 0.22, z + 0.22)                      # tapa del otro lado
    caja("planta", x + 0.06, x + 0.08, y + 0.08, y + 0.4, z - 0.18, z + 0.12)              # tarjeta madre
    caja("pc", x + 0.02, x + 0.06, y + 0.25, y + 0.33, z - 0.08, z)                        # disipador
    for k in range(2):
        caja("libro_azul", x + 0.04, x + 0.06, y + 0.26, y + 0.36, z + 0.03 + k * 0.03, z + 0.045 + k * 0.03)
    caja("pc", x - 0.06, x + 0.06, y + 0.02, y + 0.14, z - 0.2, z - 0.05)                  # fuente
    caja("rojo", x + 0.03, x + 0.06, y + 0.12, y + 0.14, z - 0.15, z + 0.1)                # tarjeta de video


def banco_reparacion(esc, x0, x1, z0, z1, y):
    """Banco de soporte técnico con tapete antiestático, equipos y herramientas."""
    caja = esc.caja
    mesa(esc, x0, x1, z0, z1, y, mat="madera", alto=0.85)
    yt = y + 0.85
    caja("metal", x0, x1, y + 0.2, y + 0.23, z0 + 0.05, z1 - 0.05)                         # repisa baja
    caja("libro_azul", x0 + 0.3, x1 - 1.2, yt, yt + 0.005, z0 + 0.1, z1 - 0.1)             # tapete
    caja("metal", x0, x1, yt + 0.7, yt + 0.73, z0, z0 + 0.3)                               # repisa alta
    for k in range(int((x1 - x0) / 0.35)):                                                 # gavetas
        caja("libro_crema" if k % 2 else "carton", x0 + 0.05 + k * 0.35, x0 + 0.33 + k * 0.35,
             yt + 0.73, yt + 0.95, z0 + 0.02, z0 + 0.28)
    pc_abierto(esc, x0 + 0.6, z0 + 0.35, yt + 0.005)
    computador(esc, x0 + 1.4, z0 + 0.3, yt, (0, 1))
    portatil(esc, x0 + 2.2, z0 + 0.45, yt + 0.005)
    caja("puerta", x0 + 1.0, x0 + 1.12, yt, yt + 0.04, z1 - 0.3, z1 - 0.12)                # multímetro
    caja("pantalla_pc", x0 + 1.02, x0 + 1.1, yt + 0.04, yt + 0.041, z1 - 0.27, z1 - 0.2)
    caja("rojo", x0 + 1.03, x0 + 1.04, yt, yt + 0.01, z1 - 0.12, z1 + 0.05)                # puntas
    caja("pc", x0 + 1.07, x0 + 1.08, yt, yt + 0.01, z1 - 0.12, z1 + 0.04)
    caja("pc", x1 - 0.9, x1 - 0.65, yt, yt + 0.09, z0 + 0.1, z0 + 0.3)                     # cautín
    caja("metal", x1 - 0.6, x1 - 0.58, yt, yt + 0.15, z0 + 0.18, z0 + 0.2)
    caja("rojo", x1 - 0.55, x1 - 0.1, yt, yt + 0.2, z1 - 0.4, z1 - 0.15)                   # herramientas
    caja("metal", x1 - 0.4, x1 - 0.25, yt + 0.2, yt + 0.23, z1 - 0.3, z1 - 0.25)
    caja("metal", x0 + 0.08, x0 + 0.16, yt, yt + 0.02, z0 + 0.1, z0 + 0.25)                # lámpara
    caja("metal", x0 + 0.11, x0 + 0.13, yt + 0.02, yt + 0.5, z0 + 0.16, z0 + 0.18)
    caja("metal", x0 + 0.11, x0 + 0.13, yt + 0.48, yt + 0.5, z0 + 0.16, z0 + 0.5)
    caja("lampara", x0 + 0.05, x0 + 0.19, yt + 0.44, yt + 0.48, z0 + 0.42, z0 + 0.56)
    for k in range(3):                                                                     # cables
        caja(("pc", "libro_azul", "blanco")[k], x0 + 1.6 + k * 0.08, x0 + 1.65 + k * 0.08, yt, yt + 0.015,
             z1 - 0.4, z1 - 0.1)


def rack(esc, x0, x1, z0, z1, y, alto=2.0):
    """Gabinete de red con puerta de rejilla, patch panels y luces (frente hacia +X)."""
    caja = esc.caja
    caja("pc", x0, x1, y, y + alto, z0, z1)
    caja("metal", x1, x1 + 0.01, y + 0.1, y + alto - 0.1, z0 + 0.05, z0 + 0.08)
    caja("metal", x1, x1 + 0.01, y + 0.1, y + alto - 0.1, z1 - 0.08, z1 - 0.05)
    for k in range(9):
        yk = y + 0.25 + k * 0.18
        mat = "blanco" if k % 3 == 0 else "archivador"
        caja(mat, x1, x1 + 0.015, yk, yk + 0.09, z0 + 0.1, z1 - 0.1)
        for j in range(6):
            zl = z0 + 0.15 + j * (z1 - z0 - 0.3) / 5
            caja("led", x1 + 0.015, x1 + 0.02, yk + 0.03, yk + 0.05, zl - 0.01, zl + 0.01)
    caja("metal", x0 + 0.05, x1 - 0.05, y + alto, y + alto + 0.05, z0 + 0.1, z1 - 0.1)    # bandeja de cables


def estanteria_equipos(esc, x0, x1, z0, z1, y, alto=2.0, niveles=5):
    """Estantería de metal con portátiles apilados, cajas de cartón y carretes de cable."""
    caja = esc.caja
    for zz in (z0, z1 - 0.04):
        caja("metal", x0, x1, y, y + alto, zz, zz + 0.04)
    for n in range(niveles):
        yb = y + 0.1 + n * (alto - 0.15) / niveles
        caja("metal", x0, x1, yb - 0.02, yb, z0, z1)
        z = z0 + 0.1
        k = 0
        while z < z1 - 0.45:
            tipo = (n + k) % 3
            if tipo == 0:
                for j in range(3):
                    caja("pc", x0 + 0.05, x1 - 0.05, yb + j * 0.03, yb + j * 0.03 + 0.025, z, z + 0.3)
                z += 0.38
            elif tipo == 1:
                caja("carton", x0 + 0.03, x1 - 0.03, yb, yb + 0.25, z, z + 0.35)
                caja("libro_crema", x0 + 0.03, x1 - 0.03, yb + 0.22, yb + 0.23, z + 0.15, z + 0.2)   # cinta
                z += 0.42
            else:
                cilindro(esc, ("rojo", "libro_azul", "pc")[n % 3], (x0 + x1) / 2, z + 0.13, 0.12, yb, yb + 0.12, n=8)
                z += 0.32
            k += 1


def reloj(esc, x, y, z, r=0.17):
    """Reloj de pared en el plano z (mirando a +Z)."""
    n = 16
    pts = [[x + r * math.cos(2 * math.pi * k / n), y + r * math.sin(2 * math.pi * k / n), z + 0.03] for k in range(n)]
    esc.poligono("pc", [[p[0], p[1], z + 0.02] for p in pts])
    pts2 = [[x + 0.88 * (p[0] - x), y + 0.88 * (p[1] - y), z + 0.03] for p in pts]
    esc.poligono("blanco", pts2)
    esc.caja("pc", x - 0.008, x + 0.008, y, y + 0.11, z + 0.03, z + 0.035)                 # minutero
    esc.caja("pc", x, x + 0.08, y - 0.008, y + 0.008, z + 0.03, z + 0.035)                 # horario


def dispensador(esc, x, z, y):
    esc.caja("blanco", x - 0.16, x + 0.16, y, y + 1.0, z - 0.16, z + 0.16)
    esc.caja("pc", x + 0.16, x + 0.17, y + 0.6, y + 0.8, z - 0.1, z + 0.1)
    esc.caja("rojo", x + 0.17, x + 0.19, y + 0.68, y + 0.72, z - 0.06, z - 0.02)
    esc.caja("libro_azul", x + 0.17, x + 0.19, y + 0.68, y + 0.72, z + 0.02, z + 0.06)
    cilindro(esc, "agua", x, z, 0.14, y + 1.0, y + 1.42)
    cilindro(esc, "libro_azul", x, z, 0.05, y + 1.42, y + 1.47, n=8)


def caneca(esc, x, z, y):
    cilindro(esc, "pc", x, z, 0.14, y, y + 0.35, n=10)


def division(esc, eje, a0, a1, c, puerta=None):
    """División de oficina: zócalo de drywall, vidrio con marcos de aluminio y franja alta.
    eje 'x': a lo largo de X en z = c; 'z': a lo largo de Z en x = c. puerta: vano (p0, p1)."""
    def caja(m, u0, u1, y0, y1, e=0.05):
        if eje == "x":
            esc.caja(m, u0, u1, y0, y1, c - e, c + e)
        else:
            esc.caja(m, c - e, c + e, y0, y1, u0, u1)
    tramos = [(a0, a1)] if not puerta else [(a0, puerta[0]), (puerta[1], a1)]
    for u0, u1 in tramos:
        caja("pared_int", u0, u1, Y0, Y0 + 0.9)
        caja("vidrio", u0, u1, Y0 + 0.9, Y0 + 2.1, 0.01)
        n = max(1, round((u1 - u0) / 1.0))
        for i in range(n + 1):
            u = u0 + (u1 - u0) * i / n
            caja("metal", max(u0, u - 0.025), min(u1, u + 0.025), Y0 + 0.9, Y0 + 2.1, 0.03)
    caja("pared_int", a0, a1, Y0 + 2.1, YT)
    if puerta:
        caja("metal", puerta[0], puerta[1], Y0 + 2.05, Y0 + 2.1, 0.06)


# ---------------- Edificio ----------------
def construir(esc, b, inicio="inicio", terreno=True):
    """Dibuja la oficina en el sistema local de `b` (frente hacia +Z)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    caja = esc.caja
    b.anden(esc, terreno)
    andén(esc, b)

    # Frente (oeste) con su puerta doble abierta
    caja(MURO, X0, X0 + PILASTRA_N, Y0, YT, Z1 - G, Z1)
    caja(MURO, X1 - MACIZO_S, X1, Y0, YT, Z1 - 0.3, Z1)
    puerta = frente_madera(esc, MURO, X0 + PILASTRA_N, X1 - MACIZO_S, Z1 - 0.12, FRENTE,
                           anchos=ANCHOS, abiertas=(0,))[0]
    detalles_frente(esc, b, puerta)

    # Costados armados como frentes en un sistema girado
    with Girado(esc, -math.pi / 2):          # norte: +x del costado = +Z local
        costado(esc, Z0, Z1 - 0.25, -X0, "WVVW")
    with Girado(esc, math.pi / 2):           # sur: +x del costado = -Z local (de frente a fondo)
        costado(esc, -(Z1 - 0.3), -Z0, X1, "WW", macizo=4.2)
    with Girado(esc, math.pi):               # fondo (este): +x del costado = -X local
        costado(esc, -X1, -X0, -Z0, "WWPPWW", anchos=(1, 1, 0.7, 0.7, 1, 1))
    costado_sur(esc, b)

    techo_quiebre(esc, b, P_BAJA, P_ALTA, QUIEBRE, abajo="madera")
    cabios(esc, b, P_BAJA)
    gablete(esc, b)
    canales(esc, b)
    lampara_solar(esc, -2.5, b.RZ0 - 1.8)

    # ---------------- Interior ----------------
    XI0, XI1, ZI0, ZI1 = X0 + G, X1 - G, Z0 + G, Z1 - 0.26
    caja("piso_gris", XI0, XI1, Y0, YP, ZI0, ZI1)
    for x in rejilla(XI0, XI1, 0.6)[:-1]:                                                  # juntas
        caja("concreto", x + 0.3, x + 0.31, YP, YP + 0.002, ZI0, ZI1)
    for z in rejilla(ZI0, ZI1, 0.6)[:-1]:
        caja("concreto", XI0, XI1, YP, YP + 0.002, z + 0.3, z + 0.31)
    for x0, x1, z0, z1 in ((XI0, XI1, ZI0, ZI0 + 0.015), (XI0, XI0 + 0.015, ZI0, ZI1),     # guardaescobas
                           (XI1 - 0.015, XI1, ZI0, ZI1)):
        caja("madera_osc", x0, x1, YP, YP + 0.08, z0, z1)
    caja("blanco", XI0, XI1, YT - 0.04, YT, ZI0, ZI1)                                      # cielo raso
    for x in (-2.8, 0.0, 2.8):
        for z in (-2.7, 0.0, 2.7):
            panel_luz(esc, x, z, YT - 0.04)

    # Sala de espera junto a la entrada (muro norte) y dispensador de agua
    for z in (1.6, 2.25, 2.9):
        silla(esc, XI0 + 0.32, z, YP, (1, 0), mat="silla")
    mesa(esc, XI0 + 0.05, XI0 + 0.55, 3.3, 3.8, YP, alto=0.5)
    planta(esc, XI0 + 0.3, 3.55, YP + 0.5)
    for k in range(3):                                                                     # revistas
        caja(("mural_azul", "rojo", "libro_crema")[k], XI0 + 0.1, XI0 + 0.4, YP + 0.5 + k * 0.01,
             YP + 0.505 + k * 0.01, 3.32 + k * 0.03, 3.5 + k * 0.03)
    dispensador(esc, XI0 + 0.25, 0.75, YP)

    # Recepción frente a la puerta: mostrador alto, escritorio bajo y su silla
    rx0, rx1 = -2.2, -0.4
    caja("madera", rx0, rx1, YP, YP + 1.05, 1.6, 1.75)
    caja("mesa", rx0 - 0.05, rx1 + 0.05, YP + 1.05, YP + 1.1, 1.55, 1.85)
    caja("madera", rx1 - 0.15, rx1, YP, YP + 1.05, 0.9, 1.6)
    mesa(esc, rx0, rx1, 0.95, 1.55, YP)
    computador(esc, -1.6, 1.3, YP + 0.74, (0, -1))
    caja("pc", -0.95, -0.75, YP + 0.74, YP + 0.8, 1.15, 1.35)                              # teléfono
    caja("pc", -0.95, -0.75, YP + 0.8, YP + 0.84, 1.17, 1.22)
    for k in range(4):                                                                     # papeles
        caja("tablero", -2.1, -1.9, YP + 1.1 + k * 0.01, YP + 1.105 + k * 0.01, 1.62, 1.8)
    cilindro(esc, "pc", -0.7, 1.7, 0.04, YP + 1.1, YP + 1.2, n=8)                          # lapicero
    silla(esc, -1.6, 0.6, YP, (0, 1))
    caneca(esc, -0.65, 0.65, YP)

    # Puestos con doble pantalla contra el muro sur y uno en el centro
    for z0 in (1.0, 2.7):
        mesa(esc, XI1 - 0.75, XI1, z0, z0 + 1.3, YP)
        for dz in (0.38, 0.92):
            computador(esc, XI1 - 0.35, z0 + dz, YP + 0.74, (-1, 0))
        caja("pc", XI1 - 0.6, XI1 - 0.4, YP, YP + 0.42, z0 + 0.1, z0 + 0.5)
        archivador(esc, XI1 - 0.6, XI1 - 0.1, z0 + 0.85, z0 + 1.25, YP, alto=0.6)
        silla(esc, XI1 - 1.15, z0 + 0.65, YP, (1, 0))
        caneca(esc, XI1 - 0.3, z0 + 1.45, YP)
    mesa(esc, 0.8, 2.2, 2.3, 3.0, YP)
    computador(esc, 1.5, 2.65, YP + 0.74, (0, -1))
    portatil(esc, 1.0, 2.6, YP + 0.74, mira=-1)
    silla(esc, 1.5, 1.95, YP, (0, 1))

    # Banco de reparación en el fondo, rack en la esquina NE y estantería de equipos al norte
    banco_reparacion(esc, -2.6, 0.9, ZI0, ZI0 + 0.75, YP)
    for x in (-1.8, -0.2):
        silla(esc, x, ZI0 + 1.15, YP, (0, -1))
    rack(esc, XI0, XI0 + 0.65, ZI0 + 0.05, ZI0 + 0.85, YP)
    estanteria_equipos(esc, XI0, XI0 + 0.45, ZI0 + 1.0, 0.25, YP)
    reloj(esc, -0.85, Y0 + 2.6, ZI0)

    # Carro de portátiles para préstamo e impresora junto a la coordinación
    caja("metal", -1.0, 0.0, YP + 0.08, YP + 0.9, -1.2, -0.6)
    for k in range(5):
        caja("pc", -0.95, 0.05 - 0.1, YP + 0.15 + k * 0.14, YP + 0.17 + k * 0.14, -1.15, -0.65)
    for x in (-0.95, -0.05):
        for z in (-1.15, -0.65):
            cilindro(esc, "pc", x, z, 0.04, YP, YP + 0.08, n=6)                            # ruedas
    archivador(esc, 0.35, 1.05, -0.95, -0.4, YP, alto=0.7)
    caja("blanco", 0.4, 1.0, YP + 0.7, YP + 1.15, -0.9, -0.45)                             # impresora
    caja("pc", 0.45, 0.95, YP + 1.15, YP + 1.17, -0.85, -0.5)
    caja("tablero", 0.5, 0.9, YP + 0.85, YP + 0.86, -0.45, -0.3)

    # Coordinación (esquina SE): divisiones de vidrio, escritorio, visitas y biblioteca
    division(esc, "x", DIVISION_X, XI1, DIVISION_Z, puerta=(DIVISION_X + 0.15, DIVISION_X + 1.05))
    division(esc, "z", ZI0, DIVISION_Z + 0.05, DIVISION_X)
    caja("relieve", DIVISION_X - 0.07, DIVISION_X - 0.05, Y0 + 1.0, Y0 + 1.8, -3.2, -1.6)    # cartelera
    for k, (dz, dy) in enumerate(((0.2, 0.5), (0.6, 0.3), (1.0, 0.55), (1.3, 0.2))):
        caja("tablero", DIVISION_X - 0.08, DIVISION_X - 0.07, Y0 + 1.0 + dy, Y0 + 1.2 + dy,
             -3.2 + dz, -3.0 + dz)
    mesa(esc, 2.0, 3.6, -3.2, -2.5, YP, mat="madera")
    computador(esc, 2.8, -2.85, YP + 0.74, (0, -1))
    silla(esc, 2.8, -3.6, YP, (0, 1))
    for x in (2.4, 3.2):
        silla(esc, x, -2.05, YP, (0, -1), mat="silla")
    caja("madera", XI1 - 0.35, XI1, YP, YP + 1.9, -3.9, -1.5)                              # biblioteca
    for k in range(4):
        y = YP + 0.4 + k * 0.4
        caja("madera_osc", XI1 - 0.36, XI1 - 0.34, y, y + 0.02, -3.85, -1.55)
        for j in range(6):
            zz = -3.8 + j * 0.38
            caja(("libro_rojo", "libro_azul", "libro_verde", "carton")[(j + k) % 4],
                 XI1 - 0.33, XI1 - 0.05, y + 0.02, y + 0.3, zz, zz + 0.3)
    archivador(esc, DIVISION_X + 0.1, DIVISION_X + 0.6, ZI0, ZI0 + 0.5, YP)
    planta(esc, DIVISION_X + 0.4, -3.1, YP)
    caja("aire", 2.2, 3.2, YT - 0.6, YT - 0.25, ZI0, ZI0 + 0.25)

    # Aires acondicionados de la sala
    caja("aire", XI0, XI0 + 0.25, YT - 0.6, YT - 0.25, 1.4, 2.4)
    caja("aire", XI1 - 0.25, XI1, YT - 0.6, YT - 0.25, 2.0, 3.0)

    # Partida del recorrido: en el andén, frente a la puerta
    esc.punto(inicio, puerta, b.RZ1 + 2.0)


def colocar(esc, dist, inicio="inicio", terreno=True):
    b, cx, cz, frente = dist[OFICINA_TEC]
    esc.colocar(cx, cz, frente)
    construir(esc, b, inicio, terreno)
    esc.punto(nombre_centro(OFICINA_TEC), 0.0, (b.RZ0 + b.RZ1) / 2, y=8.0, extras={"nombre": OFICINA_TEC})


if __name__ == "__main__":
    b, *_ = distribucion()[OFICINA_TEC]
    esc = Escena()
    construir(esc, b)
    esc.guardar(sys.argv[1], "Oficina de Asesoría y Orientación Tecnológica")
