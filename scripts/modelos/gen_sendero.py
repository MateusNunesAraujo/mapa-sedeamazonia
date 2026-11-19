"""Sendero Interpretativo Ambiental y Cultural en el mundo del recorrido.

Usa el mismo trazado y las mismas 14 estaciones que la capa del sendero del mapa 2D
(data/sendero.json). El camino es una franja de tierra apenas sobre el pasto. Cada estación
tiene un letrero de madera a un lado del camino, un punto de partida
"inicio_Estación_<n>_·_<nombre>" un poco antes, mirando a lo largo del sendero, y un punto
"centro_..." para su etiqueta en la vista aérea.

Del sendero real solo se tiene el trazado del mapa: el ancho, el piso de tierra y la forma
de los letreros son supuestos (pendiente de fotos del sendero). Donde el sendero va por la
calle interna (estaciones 1 a 4), el letrero queda por fuera de la calle.

Lo llama gen_recorrido.py; no genera un .glb suelto.
"""
import json
import math

import gen_calles
from comun import RAIZ, a_metros, camino, nombre_centro, nombre_inicio

ANCHO = 1.6      # m (supuesto)
Y = 0.02         # apenas sobre el pasto (su cara de arriba está en y = 0)
ANTES = 5.0      # m antes del letrero donde empieza el recorrido de cada estación


def datos():
    return json.loads((RAIZ / "data" / "sendero.json").read_text(encoding="utf-8"))


def tramos_m(d=None):
    d = d or datos()
    return [[a_metros(*p) for p in tramo] for tramo in d["tramos"]]


def nombre_estacion(e):
    """Nombre que se muestra en la etiqueta. Distinto del de los edificios (hay una
    estación "Maloca" y un edificio Maloca) y sin caracteres que three.js quite de los nodos."""
    return f"Estación {e['numero']} · {e['nombre']}"


def extension():
    """(x0, x1, z0, z1) del sendero, para que el pasto del mundo lo cubra."""
    pts = [p for t in tramos_m() for p in t]
    xs, zs = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), max(xs), min(zs), max(zs)


def mas_cercano(tramos, p):
    """Segmento del sendero más cercano a p: (a, b, t), con t de 0 (en a) a 1 (en b)."""
    mejor = None
    for t in tramos:
        for a, b in zip(t, t[1:]):
            dx, dz = b[0] - a[0], b[1] - a[1]
            l2 = dx * dx + dz * dz or 1e-9
            k = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2))
            d = math.hypot(a[0] + dx * k - p[0], a[1] + dz * k - p[1])
            if mejor is None or d < mejor[0]:
                mejor = (d, a, b, k)
    return mejor[1:]


def distancia(p, linea):
    """Distancia de p (x, z) a una línea de puntos."""
    d = math.inf
    for a, b in zip(linea, linea[1:]):
        dx, dz = b[0] - a[0], b[1] - a[1]
        l2 = dx * dx + dz * dz or 1e-9
        k = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2))
        d = min(d, math.hypot(a[0] + dx * k - p[0], a[1] + dz * k - p[1]))
    return d


def junto_al_camino(en, sx, sz, calles):
    """Punto para el letrero al lado del camino: a 0,9 m del borde del sendero, o, si el
    sendero va por una calle (las estaciones 1 a 4 están sobre la calle interna), por fuera
    del borde de la calle. Prueba los dos lados y se queda con el más cercano.
    Devuelve (x, z, sx, sz) con el lado elegido."""
    margen = gen_calles.ANCHO / 2 + 0.9
    for paso in range(60):
        lado = ANCHO / 2 + 0.9 + paso * 0.25
        for s in (1, -1):
            x, z = en[0] + s * sx * lado, en[1] + s * sz * lado
            if all(distancia((x, z), c) > margen for c in calles):
                return x, z, s * sx, s * sz
    return en[0] + sx * (ANCHO / 2 + 0.9), en[1] + sz * (ANCHO / 2 + 0.9), sx, sz


def letrero(esc, x, z, frente):
    """Letrero de madera con techito sobre dos postes; `frente` es el giro hacia el camino."""
    esc.colocar(x, z, frente)
    caja = esc.caja
    for px in (-0.5, 0.5):
        caja("madera_osc", px - 0.05, px + 0.05, 0.0, 1.55, -0.05, 0.05)              # postes
    caja("madera", -0.62, 0.62, 0.85, 1.5, -0.03, 0.03)                               # tablero
    caja("verde_cartelera", -0.54, 0.54, 0.93, 1.42, 0.03, 0.04)                     # cara
    caja("techo_cafe", -0.72, 0.72, 1.55, 1.6, -0.22, 0.22)                           # techito
    esc.colocar(0.0, 0.0, "sur")


def colocar(esc):
    """Dibuja el sendero y sus estaciones en el mundo (deja la escena en su sistema base)."""
    d = datos()
    tramos = tramos_m(d)
    esc.colocar(0.0, 0.0, "sur")
    for t in tramos:
        camino(esc, t, "sendero", ANCHO, Y)

    calles = [[a_metros(*p) for p in c] for c in gen_calles.TODAS]
    for e in d["estaciones"]:
        p = a_metros(*e["punto"])
        a, b, k = mas_cercano(tramos, p)
        dx, dz = b[0] - a[0], b[1] - a[1]
        largo = math.hypot(dx, dz) or 1e-9
        ux, uz = dx / largo, dz / largo                       # a lo largo del camino
        sx, sz = uz, -ux                                      # hacia un lado
        en = (a[0] + dx * k, a[1] + dz * k)                   # punto del camino junto a la estación
        xl, zl, sx, sz = junto_al_camino(en, sx, sz, calles)
        letrero(esc, xl, zl, math.atan2(-sx, -sz))            # la cara mira al camino
        nombre = nombre_estacion(e)
        esc.punto(nombre_centro(nombre), xl, zl, y=3.0, extras={"nombre": nombre})
        # Partida: sobre el camino, un poco antes del letrero, mirando hacia adelante
        atras = min(ANTES, k * largo)
        esc.punto(nombre_inicio(nombre), en[0] - ux * atras, en[1] - uz * atras,
                  giro=math.atan2(-ux, -uz))
