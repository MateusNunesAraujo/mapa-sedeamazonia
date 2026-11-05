"""Genera el modelo 3D de la Sala de profesores (static/modelos/sala_profesores.glb) sin dependencias.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_sala_profesores.py static/modelos/sala_profesores.glb

Bloque suelto al norte de la Biblioteca, largo de norte a sur (~28,6 x 11,1 m de techo según
el polígono del mapa), con techo a cuatro aguas y el frente hacia el este, al corredor cubierto.
Por fuera sigue la foto static/fotos/profesores.png: muros verdes, teja café, columnas de
madera con ventanales y celosía, y la puerta de vidrio cerca de la punta sur.
Adentro: cafetería junto a la entrada (sur), zona de trabajo con puestos para los docentes
(centro) y sala de reuniones cerrada (norte).

En el sistema local: -X = sur, +X = norte, +Z = frente (este), -Z = atrás (oeste).
"""
import sys

from comun import CUMBRERA, G, Y0, YT, Escena, distribucion, nombre_centro
from muebles import (archivador, computador, estante, mesa, muro_ventanas, panel_luz, planta,
                     rejilla, silla)

MURO = "pared_verde"
YP = Y0 + 0.02
Y_ANTE, Y_DINTEL = Y0 + 0.9, Y0 + 2.4
YC = YT - 0.06            # cielo raso plano (techo a cuatro aguas)


def fachada(esc, X0, X1, Z1, xd, ancho_puerta=1.8):
    """Frente (+Z): tramo macizo en la punta sur, puerta doble de vidrio y ventanales hasta el norte."""
    caja = esc.caja
    p0, p1 = xd - ancho_puerta / 2, xd + ancho_puerta / 2
    macizo_sur = X0 + 3.0
    macizo_norte = X1 - 1.5

    # Tramos macizos verdes
    caja(MURO, X0, macizo_sur, Y0, YT, Z1 - G, Z1)
    caja(MURO, macizo_norte, X1, Y0, YT, Z1 - G, Z1)
    caja("mural", X0 + 1.2, X0 + 1.6, Y0 + 1.9, Y0 + 2.2, Z1, Z1 + 0.02)            # placa del número
    # Entre el tramo sur y la puerta, y de la puerta a los ventanales: columnas macizas
    caja(MURO, macizo_sur, p0 - 0.1, Y0, YT, Z1 - G, Z1)
    caja(MURO, p1 + 0.1, p1 + 0.6, Y0, YT, Z1 - G, Z1)

    # Puerta doble: marco de madera, vidrio fijo arriba y hojas abiertas hacia adentro
    caja("madera", p0 - 0.1, p0, Y0, YT, Z1 - 0.3, Z1 + 0.05)
    caja("madera", p1, p1 + 0.1, Y0, YT, Z1 - 0.3, Z1 + 0.05)
    caja("madera", p0, p1, Y_DINTEL, Y_DINTEL + 0.1, Z1 - 0.3, Z1 + 0.05)
    caja("vidrio", p0, p1, Y_DINTEL + 0.1, YT, Z1 - 0.15, Z1 - 0.1)
    for x, s in ((p0, 1), (p1, -1)):                                                 # hojas abiertas
        hx0, hx1 = (x, x + 0.06) if s > 0 else (x - 0.06, x)
        caja("madera", hx0, hx1, Y0, Y_DINTEL - 0.02, Z1 - G - 0.9, Z1 - G)
        caja("vidrio", hx0 - 0.01, hx1 + 0.01, Y0 + 0.3, Y_DINTEL - 0.2, Z1 - G - 0.8, Z1 - G - 0.1)

    # Ventanales: antepecho verde, columnas de madera, vidrio y celosía arriba
    xa, xb = p1 + 0.6, macizo_norte
    caja(MURO, xa, xb, Y0, Y_ANTE, Z1 - G, Z1)
    n = max(1, round((xb - xa) / 1.5))
    w = (xb - xa) / n
    for i in range(n + 1):
        x = xa + i * w
        caja("madera", x - 0.1, x + 0.1, Y0, YT, Z1 - 0.3, Z1 + 0.05)
    for i in range(n):
        va, vb = xa + i * w + 0.1, xa + (i + 1) * w - 0.1
        vm = (va + vb) / 2
        caja("vidrio", va, vb, Y_ANTE, Y_DINTEL, Z1 - 0.15, Z1 - 0.1)
        caja("madera", vm - 0.03, vm + 0.03, Y_ANTE, Y_DINTEL, Z1 - 0.12, Z1 - 0.05)
        caja("madera_osc", va, vb, Y_DINTEL, YT, Z1 - 0.2, Z1 - 0.15)
        for k in range(5):
            y = Y_DINTEL + 0.1 + k * 0.18
            caja("madera", va, vb, y, y + 0.07, Z1 - 0.15, Z1 - 0.05)
    caja("madera", xa, xb, Y_ANTE - 0.04, Y_ANTE, Z1 - 0.3, Z1 + 0.05)               # alféizar


def sofa(esc, x0, x1, z0, z1, y):
    """Sofá con el espaldar en el lado z1 (contra la pared)."""
    esc.caja("madera_osc", x0, x1, y, y + 0.2, z0, z1)
    esc.caja("cojin", x0 + 0.05, x1 - 0.05, y + 0.2, y + 0.45, z0, z1 - 0.15)
    esc.caja("cojin", x0 + 0.05, x1 - 0.05, y + 0.2, y + 0.85, z1 - 0.18, z1)
    for x in (x0, x1 - 0.12):
        esc.caja("cojin", x, x + 0.12, y + 0.2, y + 0.6, z0, z1)


def construir(esc, b, inicio="inicio", terreno=True):
    """Dibuja la sala en el sistema local de `b` (frente hacia +Z, norte hacia +X)."""
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    caja = esc.caja
    b.anden(esc, terreno)

    xd = X0 + 4.0                                                                    # puerta principal
    fachada(esc, X0, X1, Z1, xd)
    muro_ventanas(esc, MURO, X0, X1, Z0, Z0 + G, "x")                                # atrás (oeste)
    caja(MURO, X0, X0 + G, Y0, YT, Z0 + G, Z1 - G)                                   # punta sur
    caja(MURO, X1 - G, X1, Y0, YT, Z0 + G, Z1 - G)                                   # punta norte
    b.cubierta(esc, MURO, mat_techo="techo_cafe")

    # ---------------- Interior ----------------
    XI0, XI1, ZI0, ZI1 = X0 + G, X1 - G, Z0 + G, Z1 - G
    caja("piso", XI0, XI1, Y0, YP, ZI0, ZI1)
    caja("pared_int", XI0, XI0 + 0.01, YP, YT, ZI0, ZI1)
    caja("pared_int", XI1 - 0.01, XI1, YP, YT, ZI0, ZI1)
    b.cielo_raso(esc, rejilla(XI0, XI1, 2.6), plano=True)

    # Cafetería (sur, junto a la entrada): mesón con lavaplatos, nevera, mesa y sofá
    caja("madera", XI0, XI0 + 0.6, YP, YP + 0.88, ZI0 + 0.2, ZI0 + 3.0)
    caja("mesa", XI0, XI0 + 0.65, YP + 0.88, YP + 0.92, ZI0 + 0.15, ZI0 + 3.05)
    caja("metal", XI0 + 0.1, XI0 + 0.5, YP + 0.85, YP + 0.93, ZI0 + 1.2, ZI0 + 1.8)  # lavaplatos
    caja("pc", XI0 + 0.05, XI0 + 0.5, YP + 0.92, YP + 1.2, ZI0 + 0.4, ZI0 + 0.9)     # microondas
    caja("pc", XI0 + 0.15, XI0 + 0.4, YP + 0.92, YP + 1.25, ZI0 + 2.4, ZI0 + 2.65)   # cafetera
    caja("madera", XI0, XI0 + 0.35, YP + 1.5, YP + 2.2, ZI0 + 0.2, ZI0 + 3.0)        # alacena
    caja("nevera", XI0, XI0 + 0.7, YP, YP + 1.8, ZI0 + 3.15, ZI0 + 3.85)
    caja("metal", XI0 + 0.7, XI0 + 0.72, YP + 0.9, YP + 1.4, ZI0 + 3.7, ZI0 + 3.75)
    xt, zt = XI0 + 3.0, ZI0 + 1.6
    mesa(esc, xt - 0.5, xt + 0.5, zt - 0.5, zt + 0.5, YP, mat="madera")
    silla(esc, xt - 0.8, zt, YP, (1, 0), mat="silla")
    silla(esc, xt + 0.8, zt, YP, (-1, 0), mat="silla")
    silla(esc, xt, zt - 0.8, YP, (0, 1), mat="silla")
    silla(esc, xt, zt + 0.8, YP, (0, -1), mat="silla")
    sofa(esc, XI0 + 0.3, XI0 + 2.3, ZI1 - 0.85, ZI1 - 0.05, YP)
    mesa(esc, XI0 + 0.8, XI0 + 1.8, ZI1 - 1.7, ZI1 - 1.2, YP, mat="madera", alto=0.42)
    planta(esc, XI0 + 5.2, ZI0 + 0.4, YP)

    # Sala de reuniones (norte), separada por una división con su puerta hacia el frente
    xr = XI1 - 7.0
    zp0, zp1 = ZI1 - 2.0, ZI1 - 1.0
    caja("pared_int", xr - 0.05, xr + 0.05, YP, YC, ZI0, zp0)
    caja("pared_int", xr - 0.05, xr + 0.05, YP, YC, zp1, ZI1)
    caja("pared_int", xr - 0.05, xr + 0.05, YP + 2.2, YC, zp0, zp1)
    caja("madera_osc", xr - 0.07, xr + 0.07, YP, YP + 2.2, zp0 - 0.05, zp0)
    caja("madera_osc", xr - 0.07, xr + 0.07, YP, YP + 2.2, zp1, zp1 + 0.05)
    caja("puerta", xr + 0.05, xr + 0.95, YP, YP + 2.15, zp0, zp0 + 0.05)            # hoja abierta

    zc = (ZI0 + ZI1) / 2 - 0.3
    m0, m1 = xr + 1.2, XI1 - 1.4
    mesa(esc, m0, m1, zc - 0.6, zc + 0.6, YP, mat="madera")
    for x in rejilla(m0, m1, 0.8):
        silla(esc, x, zc - 0.95, YP, (0, 1), mat="silla")
        silla(esc, x, zc + 0.95, YP, (0, -1), mat="silla")
    silla(esc, m1 + 0.4, zc, YP, (-1, 0), mat="silla")
    # Tablero y pantalla en la punta norte
    caja("metal", XI1 - 0.05, XI1 - 0.01, 0.95, 2.25, zc - 1.55, zc + 1.55)
    caja("tablero", XI1 - 0.07, XI1 - 0.05, 1.0, 2.2, zc - 1.5, zc + 1.5)
    caja("metal", XI1 - 0.12, XI1 - 0.07, 0.95, 0.98, zc - 1.5, zc + 1.5)
    estante(esc, xr + 0.6, XI1 - 0.4, ZI0, ZI0 + 0.35, YP, alto=1.8, niveles=4)
    caja("aire", xr + 0.06, xr + 0.31, 2.55, 2.9, zc - 0.5, zc + 0.5)
    planta(esc, XI1 - 0.5, ZI1 - 0.5, YP)

    # Zona de trabajo (centro): puestos contra el muro de atrás y una isla de escritorios
    w0, w1 = XI0 + 6.2, xr - 0.9
    for x in rejilla(w0, w1, 1.6):
        mesa(esc, x - 0.7, x + 0.7, ZI0 + 0.1, ZI0 + 0.8, YP)
        computador(esc, x, ZI0 + 0.4, YP + 0.74, (0, 1))
        silla(esc, x, ZI0 + 1.25, YP, (0, -1))
    zi = ZI0 + 3.6                                                                    # eje de la isla
    for x in rejilla(w0 + 0.6, w1 - 0.6, 1.5):
        for s in (-1, 1):
            z0, z1 = (zi - 0.7, zi) if s < 0 else (zi, zi + 0.7)
            mesa(esc, x - 0.7, x + 0.7, z0, z1, YP)
            computador(esc, x, zi + s * 0.3, YP + 0.74, (0, s))
            silla(esc, x, zi + s * 1.15, YP, (0, -s))
        caja("madera_osc", x - 0.7, x + 0.7, YP + 0.74, YP + 1.15, zi - 0.02, zi + 0.02)   # separador
    # Casilleros de los docentes contra la división de la sala de reuniones
    for z in rejilla(ZI0 + 0.2, zp0 - 0.3, 0.6):
        archivador(esc, xr - 0.6, xr - 0.05, z - 0.27, z + 0.27, YP, alto=1.8)

    for x in rejilla(XI0, XI1, 2.6):
        for z in rejilla(ZI0, ZI1, 2.4):
            panel_luz(esc, x, z, YC)

    # Partida del recorrido: en el corredor del frente, mirando a la puerta
    esc.punto(inicio, xd, Z1 + 6.5)


def colocar(esc, dist, inicio="inicio", terreno=True):
    b, cx, cz, frente = dist["Sala de profesores"]
    esc.colocar(cx, cz, frente)
    construir(esc, b, inicio, terreno)
    esc.punto(nombre_centro("Sala de profesores"), 0.0, b.ZC, y=CUMBRERA + 1.5,
              extras={"nombre": "Sala de profesores"})


if __name__ == "__main__":
    b, *_ = distribucion()["Sala de profesores"]
    esc = Escena()
    construir(esc, b)
    esc.guardar(sys.argv[1], "Sala de profesores")
