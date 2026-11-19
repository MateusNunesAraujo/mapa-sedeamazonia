"""Calles del mundo del recorrido: la vía de afuera y la calle interna de la sede.

No están en ningún JSON: se calcaron de la imagen del mapa (static/Mapa U.png), en
coordenadas del mapa [lat, lng]:
- Vía de afuera: la franja gris recta del borde suroeste, por fuera de la cerca. Su eje se
  midió por el color del asfalto cada 25 unidades de lng (de lng 25 a 790); es una recta
  que en el mapa va de [288,6, 0] a [0, 809,8]. Aquí se alarga un poco más allá del borde
  del mapa para que no se corte de golpe.
- Calle interna: empieza al sur del parqueadero, bordea la cancha por el sur, sube por el costado este en diagonal y termina junto a los bloques
  del norte (lat ~531), donde empieza el andén rayado que sigue hacia el norte (en el mapa
  parece una rampa peatonal, no calle). Puntos tomados sobre la imagen y comprobados
  dibujándolos encima. La entrada en U que el mapa dibuja dentro del parqueadero (desde la vía
  de afuera) no se hace: todavía no existe, es un proyecto a futuro.

Ancho: ~5 m en el mapa para las dos (medido sobre el dibujo). Asfalto con línea central
discontinua en la vía de afuera. Por verificar con fotos: el ancho real, el material y las
líneas pintadas; la calle interna podría ser de concreto.

Lo llama gen_recorrido.py; no genera un .glb suelto.
"""
import math

from comun import a_metros, camino

ANCHO = 5.0
Y = 0.05            # misma altura que el asfalto del parqueadero (y el sendero, a 0,02, queda abajo)

# Recta de la vía de afuera, alargada: lat = 288,6 - 0,3564 * lng
VIA_AFUERA = [[306.4, -50.0], [-30.0, 894.0]]

CALLE_INTERNA = [
    [48, 748], [40, 770], [33, 795], [26, 820], [21, 842], [18, 857], [20, 872],
    [28, 885], [40, 898], [52, 907], [80, 930], [108, 952], [130, 964], [157, 982], [171, 984],
    [185, 972], [235, 892], [285, 818], [317, 781], [339, 768], [375, 769], [403, 776],
    [430, 786], [453, 806], [477, 830], [500, 847], [518, 855], [526, 863], [531, 874],
]

TODAS = [VIA_AFUERA, CALLE_INTERNA]


def extension():
    """(x0, x1, z0, z1) de las calles, para que el pasto del mundo las cubra."""
    pts = [a_metros(*p) for calle in TODAS for p in calle]
    xs, zs = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), max(xs), min(zs), max(zs)


def linea_central(esc, a, b, raya=3.0, hueco=3.0, ancho=0.12):
    """Rayas blancas por el eje de un tramo recto (de a a b, en metros)."""
    dx, dz = b[0] - a[0], b[1] - a[1]
    largo = math.hypot(dx, dz)
    ux, uz = dx / largo, dz / largo
    nx, nz = -uz * ancho / 2, ux * ancho / 2
    y = Y + 0.005
    s = hueco / 2
    while s + raya <= largo:
        p = (a[0] + ux * s, a[1] + uz * s)
        q = (a[0] + ux * (s + raya), a[1] + uz * (s + raya))
        esc.poligono("linea", [[p[0] + nx, y, p[1] + nz], [q[0] + nx, y, q[1] + nz],
                               [q[0] - nx, y, q[1] - nz], [p[0] - nx, y, p[1] - nz]])
        s += raya + hueco


def colocar(esc):
    """Dibuja las dos calles en el mundo (deja la escena en su sistema base)."""
    esc.colocar(0.0, 0.0, "sur")
    for calle in TODAS:
        camino(esc, [a_metros(*p) for p in calle], "asfalto", ANCHO, Y)
    a, b = (a_metros(*p) for p in VIA_AFUERA)
    linea_central(esc, a, b)
