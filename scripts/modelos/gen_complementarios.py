"""Genera los modelos 3D de las estructuras existentes que no tenían modelo propio
(estado "terminado" en data/edifcios.json), sin dependencias.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_complementarios.py static/modelos

Escribe un .glb por estructura (ver ESTRUCTURAS al final). Los bloques que comparten techo
en el mapa (las hileras al este del Auditorio y de la Dirección) van en un solo archivo.
gen_recorrido.py usa colocar_todos() para meterlas en el mundo del recorrido.

Son modelos de exterior, más sencillos que los demás generadores:
- Ubicación y tamaño salen de los polígonos del mapa; los colores, el tipo de techo y las
  ventanas, de las fotos de static/fotos-edificios/.
- Sin foto (pendiente de verificar en el campus): Secretaría de Sede, Oficina 3, Adquisición
  de Bienes y Servicios, Baños 2, Cafetería y Bienestar llevan el estilo de los bloques
  vecinos. Cancha y Parqueadero tampoco tienen foto: siguen el dibujo del plano.
- El lado hacia donde mira cada fachada es aproximado cuando la foto no lo deja claro.
- Los interiores quedan vacíos (piso y cielo raso), pendientes de fotos de adentro.
"""
import math
import sys
from pathlib import Path

from comun import (ALERO_LADO, CUMBRERA, G, M_POR_LNG, PLAZOLETA_LNG, MARQUESINA_EXT, MARQUESINA_INT, PISO, RAIZ, Y0, YT, Bloque, Escena,
                   a_metros, distribucion, faldones, huella, nombre_centro, nombre_inicio, techo_caseta)

# ---------------- Vanos (letras de los patrones de fachada) ----------------
#   P puerta de madera   D puerta doble     V ventana con vidrio   L persiana de madera
#   G ventanal de piso a techo              A ventana alta (baños) H persiana alta (cocina)
#   M panel mostaza (Alojamientos)          -  tramo de muro ciego
# Un patrón reparte la pared en tramos iguales, uno por letra, con el vano centrado.
ALTOS = {"P": (0.0, 2.1), "D": (0.0, 2.2), "V": (0.95, 2.3), "L": (0.95, 2.3), "G": (0.0, 2.6),
         "A": (1.9, 2.5), "H": (3.6, 6.0), "M": (0.0, 2.4)}
ANCHOS = {"P": 0.95, "D": 1.8, "V": 2.0, "L": 1.8, "G": 9.0, "A": 1.0, "H": 1.4, "M": 1.6}


def proyectar(esc, eje):
    """caja(m, a0, a1, y0, y1, c0, c1) con 'a' a lo largo del muro y 'c' en su grosor."""
    if eje == "x":
        return lambda m, a0, a1, y0, y1, c0, c1: esc.caja(m, a0, a1, y0, y1, c0, c1)
    return lambda m, a0, a1, y0, y1, c0, c1: esc.caja(m, c0, c1, y0, y1, a0, a1)


def repartir(a0, a1, patron):
    """Vanos (inicio, fin, letra) de un patrón a lo largo de a0..a1."""
    if not patron:
        return []
    w = (a1 - a0) / len(patron)
    vanos = []
    for i, letra in enumerate(patron):
        if letra == "-":
            continue
        ancho = w - 0.2 if letra == "G" else min(ANCHOS[letra], w - 0.5)
        if ancho < 0.4:
            continue
        c = a0 + w * (i + 0.5)
        vanos.append((c - ancho / 2, c + ancho / 2, letra))
    return vanos


def relleno(caja, letra, va, vb, ya, yb, c0, c1):
    """Marco y hoja (puerta, vidrio o tablillas) de un vano."""
    cm, m, e0, e1 = (c0 + c1) / 2, 0.06, c0 - 0.03, c1 + 0.03
    if letra == "M":
        caja("amarillo_muro", va, vb, ya, yb, c0 + 0.02, c1 - 0.02)
        return
    caja("madera", va, vb, yb - m, yb, e0, e1)
    caja("madera", va, va + m, ya, yb, e0, e1)
    caja("madera", vb - m, vb, ya, yb, e0, e1)
    if ya > Y0 + 0.01:
        caja("madera", va, vb, ya, ya + m, e0, e1)
    if letra in "PD":
        caja("madera", va + m, vb - m, ya, yb - m, cm - 0.03, cm + 0.03)
        if letra == "D":
            mid = (va + vb) / 2
            caja("madera_osc", mid - 0.02, mid + 0.02, ya, yb - m, cm - 0.05, cm + 0.05)
    elif letra in "LH":
        y = ya + 0.08
        while y < yb - 0.12:
            caja("madera", va + m, vb - m, y, y + 0.07, cm - 0.05, cm + 0.05)
            y += 0.13
    else:                                                     # V, G, A: vidrio con parales
        caja("vidrio", va + m, vb - m, ya + m, yb - m, cm - 0.015, cm + 0.015)
        n = max(1, round((vb - va) / 0.9))
        for i in range(1, n):
            a = va + (vb - va) * i / n
            caja("madera", a - 0.03, a + 0.03, ya, yb, cm - 0.04, cm + 0.04)
        if letra == "G":
            caja("madera", va, vb, Y0 + 2.05, Y0 + 2.1, cm - 0.04, cm + 0.04)


def muro(esc, eje, a0, a1, c0, c1, y_top, mat, patron=""):
    """Muro macizo de Y0 a y_top con los vanos del patrón. Devuelve los vanos."""
    caja = proyectar(esc, eje)
    vanos = repartir(a0, a1, patron)
    a = a0
    for va, vb, letra in vanos:
        ya = Y0 + ALTOS[letra][0]
        yb = min(Y0 + ALTOS[letra][1], y_top - 0.15)
        if va > a:
            caja(mat, a, va, Y0, y_top, c0, c1)
        if ya > Y0:
            caja(mat, va, vb, Y0, ya, c0, c1)
        caja(mat, va, vb, yb, y_top, c0, c1)
        relleno(caja, letra, va, vb, ya, yb, c0, c1)
        a = vb
    if a1 > a:
        caja(mat, a, a1, Y0, y_top, c0, c1)
    return vanos


def edificio(esc, b, pared, frente, atras="", izq="", der="", techo="dos_aguas", mat_techo="techo",
             alto=3.4, grosor_techo=0.25, pend=0.6, divisiones=(), columnas=None, piso="piso_gris",
             toldos=False, vigas=False):
    """Bloque genérico en el sistema local de `b` (frente hacia +Z).

    frente: patrón de la fachada o lista de tramos (x0, x1, patrón), uno por local.
    techo: "dos_aguas" / "cuatro_aguas" (el Bloque debe tener cuatro_aguas_*), "caseta"
    (cuatro aguas de bloque pequeño) o "plano" (losa a la altura `alto`).
    columnas: material de los postes bajo el alero del frente (None: sin postes).
    toldos: tejadillo de policarbonato sobre cada vano del frente.
    Devuelve la altura más alta del techo (para la etiqueta de la vista aérea).
    """
    X0, X1, Z0, Z1 = b.X0, b.X1, b.Z0, b.Z1
    b.anden(esc, terreno=False)
    inclinado = techo in ("dos_aguas", "cuatro_aguas", "caseta")
    y_top = YT if inclinado else Y0 + alto

    tramos = [(X0, X1, frente)] if isinstance(frente, str) else frente
    vanos_frente = []
    for a0, a1, patron in tramos:
        vanos_frente += muro(esc, "x", a0, a1, Z1 - G, Z1, y_top, pared, patron)
    muro(esc, "x", X0, X1, Z0, Z0 + G, y_top, pared, atras)
    muro(esc, "z", Z0 + G, Z1 - G, X0, X0 + G, y_top, pared, izq)
    muro(esc, "z", Z0 + G, Z1 - G, X1 - G, X1, y_top, pared, der)
    for x in divisiones:                                      # muros entre locales
        esc.caja(pared, x - 0.1, x + 0.1, Y0, y_top, Z0 + G, Z1 - G)
    esc.caja(piso, X0 + G, X1 - G, Y0, Y0 + 0.02, Z0 + G, Z1 - G)

    if techo in ("dos_aguas", "cuatro_aguas"):
        b.cubierta(esc, mat_pared=pared, mat_techo=mat_techo)
        n = max(1, int((X1 - X0) / 3.5))
        b.cielo_raso(esc, [X0 + (X1 - X0) * (i + 0.5) / n for i in range(n)], plano=b.hip_izq or b.hip_der)
        y_alto = CUMBRERA
        alto_en = lambda z: CUMBRERA - b.pend * abs(z - b.ZC)
    elif techo == "caseta":
        techo_caseta(esc, b, YT, pend, mat=mat_techo, abajo="madera")
        esc.caja("cielo", X0 + G, X1 - G, YT - 0.06, YT - 0.02, Z0 + G, Z1 - G)
        a = b.X0 - b.RX0
        y_alto = YT - pend * a + pend * min(b.RX1 - b.RX0, b.RZ1 - b.RZ0) / 2
        alto_en = lambda z: YT - pend * (z - Z1)
    else:
        esc.caja(mat_techo, b.RX0, b.RX1, y_top, y_top + grosor_techo, b.RZ0, b.RZ1)
        if vigas:
            n = max(1, round((b.RX1 - b.RX0) / 1.5))
            for i in range(n + 1):
                x = b.RX0 + 0.1 + (b.RX1 - b.RX0 - 0.2) * i / n
                esc.caja("madera_osc", x - 0.07, x + 0.07, y_top - 0.22, y_top, b.RZ0, b.RZ1)
        y_alto = y_top + grosor_techo
        alto_en = lambda z: y_top

    if columnas:
        z = b.RZ1 - 0.45
        n = max(1, round((X1 - X0 - 0.4) / 3.2))
        for i in range(n + 1):
            x = X0 + 0.2 + (X1 - X0 - 0.4) * i / n
            esc.caja(columnas, x - 0.13, x + 0.13, Y0, alto_en(z), z - 0.13, z + 0.13)
    if toldos:
        for va, vb, letra in vanos_frente:
            esc.caja("policarbonato", va - 0.15, vb + 0.15, Y0 + 2.55, Y0 + 2.59, Z1, Z1 + 0.9)
            for x in (va - 0.1, vb + 0.1):
                esc.caja("madera", x - 0.03, x + 0.03, Y0 + 2.5, Y0 + 2.55, Z1, Z1 + 0.9)
    return y_alto


# ---------------- Ubicación según el mapa ----------------
def rect_mapa(lat0, lat1, lng0, lng1):
    """Rectángulo del mapa (lat_min, lat_max, lng_min, lng_max) -> (x0, x1, z0, z1) en metros."""
    x0, z1 = a_metros(lat0, lng0)
    x1, z0 = a_metros(lat1, lng1)
    return x0, x1, z0, z1


def rect(nombre):
    """Rectángulo (x0, x1, z0, z1) en metros del techo de un lugar (ver huella())."""
    return rect_mapa(*huella(nombre))


def bloque_en(x0, x1, z0, z1, frente, **kw):
    """Bloque cuyo techo cubre el rectángulo del mundo dado, con el frente hacia ese lado."""
    ex, ez = x1 - x0, z1 - z0
    largo, fondo = (ez, ex) if frente in ("este", "oeste") else (ex, ez)
    return Bloque(largo, fondo, **kw), (x0 + x1) / 2, (z0 + z1) / 2


def a_local(frente, cx, cz, wx, wz):
    """Posición a lo largo de la fachada (X local) de un punto del mundo."""
    return {"sur": wx - cx, "norte": cx - wx, "este": cz - wz, "oeste": wz - cz}[frente]


def aleros(a):
    return dict(alero_izq=a, alero_der=a, alero_frente=a, alero_atras=a)


def fila(esc, nombres, frente, patrones, bk=None, partes=1, **kw):
    """Uno o varios lugares seguidos bajo un mismo techo (cada uno con su tramo de fachada y
    un muro entre ellos). partes: locales iguales en que se divide cada lugar (ej. salones A, B, C).
    Deja los puntos inicio_/centro_ de cada lugar. Devuelve el Bloque (la escena queda colocada en él)."""
    rs = [rect(n) for n in nombres]
    prom = lambda i: sum(r[i] for r in rs) / len(rs)
    if frente in ("norte", "sur"):
        x0, x1, z0, z1 = min(r[0] for r in rs), max(r[1] for r in rs), prom(2), prom(3)
    else:
        x0, x1, z0, z1 = prom(0), prom(1), min(r[2] for r in rs), max(r[3] for r in rs)
    b, cx, cz = bloque_en(x0, x1, z0, z1, frente, **(bk or {}))
    esc.colocar(cx, cz, frente)

    tramos = sorted((min(a, c), max(a, c), n) for n, r in zip(nombres, rs)
                    for a, c in [(a_local(frente, cx, cz, r[0], r[2]), a_local(frente, cx, cz, r[1], r[3]))])
    cortes = [(tramos[i][1] + tramos[i + 1][0]) / 2 for i in range(len(tramos) - 1)]
    bordes = [b.X0] + cortes + [b.X1]
    patron_de = dict(zip(nombres, patrones))
    segs, divs = [], list(cortes)
    for i, (_, _, n) in enumerate(tramos):
        t0, t1 = bordes[i], bordes[i + 1]
        paso = (t1 - t0) / partes
        segs += [(t0 + paso * k, t0 + paso * (k + 1), patron_de[n]) for k in range(partes)]
        divs += [t0 + paso * k for k in range(1, partes)]
    y_alto = edificio(esc, b, frente=segs, divisiones=divs, **kw)
    for i, (_, _, n) in enumerate(tramos):
        xm = (bordes[i] + bordes[i + 1]) / 2
        esc.punto(nombre_inicio(n), xm, b.RZ1 + 3.0)
        esc.punto(nombre_centro(n), xm, (b.RZ0 + b.RZ1) / 2, y=y_alto + 1.5, extras={"nombre": n})
    return b


def puntos(esc, nombre, x, z, y_etiqueta, giro=0.0, etiqueta=None):
    """Partida del recorrido en (x, z) local y etiqueta en `etiqueta` (x, z) o en el mismo sitio."""
    esc.punto(nombre_inicio(nombre), x, z, giro=giro)
    ex, ez = etiqueta or (x, z)
    esc.punto(nombre_centro(nombre), ex, ez, y=y_etiqueta, extras={"nombre": nombre})


def boveda(esc, mat, x0, x1, y_base, flecha, z0, z1, n=12):
    """Cubierta curva (como la entrada del laboratorio de ecología), visible por los dos lados."""
    pts = [(x0 + (x1 - x0) * i / n, y_base + flecha * math.sin(math.pi * i / n)) for i in range(n + 1)]
    for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
        q = [[xa, ya, z0], [xb, yb, z0], [xb, yb, z1], [xa, ya, z1]]
        esc.poligono(mat, q)
        esc.poligono(mat, q[::-1])


def suelo(esc, mat, pts, y):
    """Polígono plano (x, z) mirando hacia arriba, sea cual sea el orden de los puntos."""
    area = sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))
    if area < 0:
        pts = pts[::-1]
    esc.poligono(mat, [[x, y, z] for x, z in pts])


# ---------------- Estructuras ----------------
def fila_admision(esc):
    """Bloque 13 del Plan Maestro: Admisión y Secretaría, seguidas al este del Auditorio
    (hilera norte), frente al norte. Foto sarita.png: muros verdes, teja asfáltica gris y alero
    sobre postes de madera. Al este va el CUERPO B, el Archivo (ficha 13 y planta de la pág. 80
    del Anexo 1): más angosto, con teja sándwich sobre estructura metálica y una salida de
    emergencia en la punta. Ventanas del Archivo: pendientes de verificar."""
    # El techo sigue hacia el oeste sobre la plazoleta hasta donde acaba el del Auditorio
    # (PLAZOLETA_LNG); las columnas de ese tramo van en gen_auditorio.plazoleta().
    vuelo = ALERO_LADO + (PLAZOLETA_LNG[1] - huella("Admisión y Matrícula")[2]) * M_POR_LNG
    fila(esc, ["Admisión y Matrícula", "Secretaría de Sede"], "norte", ["VPV", "VPVV"],
         bk=dict(alero_izq=0.3, alero_der=vuelo), pared="verde_claro", mat_techo="teja_gris",
         atras="LL-LL-LL-LL", izq="L", der="L", columnas="madera_osc")
    # Archivo: 5,65 x 8,81 m en el plano; arranca contra el muro este de la Secretaría
    b, cx, cz = bloque_en(*rect_mapa(141.4, 153.8, 788.7, 816.1), "norte",
                          alero_izq=0.3, alero_der=0.0, alero_frente=0.3, alero_atras=0.3)
    esc.colocar(cx, cz, "norte")
    edificio(esc, b, "verde_claro", "L-L", atras="L-L", izq="P", der="-", techo="plano", alto=3.2,
             grosor_techo=0.15, mat_techo="metal")


def gestion_bienes(esc):
    """Al final de la hilera norte. Foto bloque_7.png: muros mostaza, ventanas con reja de
    madera y lámina verde. El polígono tiene en L: un anexo bajo al sureste."""
    # Bloque 15 del plano: 9,73 x 13,69 m a cuatro aguas. La ficha dice teja de asbesto
    # cemento, pero la foto (más reciente) muestra lámina verde: se deja la de la foto.
    b, cx, cz = bloque_en(*rect("Gestión de Bienes"), "norte", cuatro_aguas_izq=True,
                          cuatro_aguas_der=True, **aleros(0.9))
    esc.colocar(cx, cz, "norte")
    y = edificio(esc, b, "amarillo_muro", "VPV-", atras="V-V", izq="L", der="-", mat_techo="lamina_verde")
    puntos(esc, "Gestión de Bienes", 0.0, b.RZ1 + 3.0, y + 1.5, etiqueta=(0.0, 0.0))
    y_borde = CUMBRERA - b.pend * (b.RZ1 - b.ZC)                # alto del borde del alero
    esc.colocar(0.0, 0.0, "sur")
    # Cobertizos de zinc sobre estructura de madera a los dos lados largos (ficha 15: "las áreas
    # exteriores se han ido poblando con cubiertas de zinc"); medidas del plano.
    for la0, la1, lado in ((158.2, 169.1, "norte"), (125.9, 136.9, "sur")):
        x0, x1, z0, z1 = rect_mapa(la0, la1, 864.0, 898.2)
        y_hi, y_lo = y_borde - 0.12, Y0 + 2.3
        z_hi, z_lo = (z1, z0) if lado == "norte" else (z0, z1)    # alto contra el edificio
        cara = [[x0, y_lo, z_lo], [x1, y_lo, z_lo], [x1, y_hi, z_hi], [x0, y_hi, z_hi]]
        esc.poligono("metal", cara)
        esc.poligono("metal", cara[::-1])
        esc.caja("concreto", x0, x1, 0.0, PISO, z0, z1)
        zp = z_lo + (0.15 if z_lo < z_hi else -0.15)            # postes en el borde bajo
        n = max(1, round((x1 - x0) / 3.0))
        for i in range(n + 1):
            x = x0 + 0.15 + (x1 - x0 - 0.3) * i / n
            esc.caja("madera", x - 0.08, x + 0.08, PISO, y_lo, zp - 0.08, zp + 0.08)
        esc.caja("madera_osc", x0, x1, y_lo - 0.15, y_lo, zp - 0.07, zp + 0.07)
    # Anexo bajo del polígono del mapa (no sale en el plano; se deja por la foto), al este del techo
    x0, x1, z0, z1 = rect_mapa(136.5, 143.75, 901.7, 908.25)
    esc.caja("concreto", x0, x1, 0.0, PISO, z0, z1)
    esc.caja("amarillo_muro", x0 + 0.2, x1 - 0.2, PISO, 3.0, z0 + 0.2, z1 - 0.2)
    esc.caja("metal", x0, x1, 3.0, 3.08, z0, z1)


def ugi(esc):
    """Primera de la hilera sur al este de la Dirección. Foto oficinas.png: muro salmón,
    persianas de madera y teja asfáltica oscura.
    Bloque 12 del Plan Maestro: la Dirección y la UGÍ son dos cuerpos bajo un solo techo
    (ficha 12), con un paso cubierto sobre columnas entre los dos (planta de la pág. 80 del
    Anexo 1); el techo termina a cuatro aguas en la punta este."""
    fila(esc, ["UGÍ - Unidad de Gestión e Integral"], "norte", ["LLPLL"],
         bk=dict(alero_der=0.0, cuatro_aguas_izq=True), pared="salmon", atras="LLLL", izq="L", der="L")
    # Paso cubierto: del alero este de la Dirección al muro oeste de la UGÍ, con el mismo fondo
    # (y por tanto la misma pendiente y cumbrera) que la hilera de la Dirección.
    bd, cxd, czd, _ = distribucion()["Dirección"]
    x_dir = cxd + (bd.RX1 - bd.RX0) / 2                       # borde este del techo de la Dirección
    x_ugi = rect("UGÍ - Unidad de Gestión e Integral")[0]
    b = Bloque(x_ugi - x_dir, bd.RZ1 - bd.RZ0, alero_izq=0.0, alero_der=0.0)
    esc.colocar((x_dir + x_ugi) / 2, czd, "norte")
    b.anden(esc, terreno=False)
    b.cubierta(esc, hastiales=False)
    for z in (b.Z0 + 0.15, b.Z1 - 0.15):                      # cuatro columnas en la línea de los muros
        for x in (b.X0 + (b.X1 - b.X0) * 0.25, b.X0 + (b.X1 - b.X0) * 0.75):
            esc.caja("concreto", x - 0.15, x + 0.15, PISO, YT, z - 0.15, z + 0.15)
    esc.caja("madera_osc", b.X0, b.X1, YT - 0.25, YT, b.Z0 + 0.05, b.Z0 + 0.25)
    esc.caja("madera_osc", b.X0, b.X1, YT - 0.25, YT, b.Z1 - 0.25, b.Z1 - 0.05)


def fila_oficinas(esc):
    """Resto de la hilera sur, bajo un solo techo. Fotos laboratorio.png y
    sala2_videoconferencia.jpeg: muros rojos, puertas y persianas de madera, lámina verde."""
    fila(esc, ["Oficina 3", "Sala 2 Videoconferencia", "Laboratorio - Innovación y Sostenibilidad",
               "Adquisición de Bienes y Servicios", "Baños 2"], "norte",
         ["LPLL", "LP", "LPL", "PL", "AP"], bk=dict(cuatro_aguas_izq=True, cuatro_aguas_der=True),
         pared="rojo_muro", mat_techo="lamina_verde", atras="L-" * 9, izq="L", der="A")


def bloque13(esc):
    """Foto bloque_13.png: caseta mostaza con ventanales y techo de teja oscura a cuatro aguas."""
    fila(esc, ["Bloque 13"], "oeste", ["VDV"], bk=aleros(1.3), pared="amarillo_muro",
         techo="caseta", mat_techo="teja_osc", pend=0.75, atras="V-V", izq="VP", der="V")


def salones3(esc):
    """Foto salones_3A_B_C.png: tres salones con fachada de ventanales entre muros mostaza
    y teja oscura a dos aguas."""
    fila(esc, ["Salones 3A,B y C"], "este", ["-GGPGG"], partes=3, pared="amarillo_muro",
         atras="-V-V-V-V-", izq="-", der="-")


def lab_ecologia(esc):
    """Foto bloque_17.png: muros mostaza altos, puertas y ventanal de madera en la entrada,
    bajo una bóveda de policarbonato."""
    b = fila(esc, ["Laboratorio - Ecología y Conservación de Flora y Fauna Silvestre"], "oeste",
             ["-DDD-"], bk=aleros(0.4), pared="amarillo_muro", techo="plano", alto=4.2,
             mat_techo="concreto", atras="V-V", izq="V-V", der="V-V")
    x0, x1, z0, z1 = -3.4, 3.4, b.Z1, b.RZ1 + 3.5
    boveda(esc, "policarbonato", x0, x1, Y0 + 3.0, 1.2, z0, z1)
    for x in (x0, x1):
        esc.caja("madera", x - 0.08, x + 0.08, Y0 + 2.85, Y0 + 3.0, z0, z1)
        esc.caja("madera", x - 0.1, x + 0.1, Y0, Y0 + 2.85, z1 - 0.2, z1)
    esc.caja("vidrio", -2.7, 2.7, Y0 + 2.3, Y0 + 3.9, b.Z1 - 0.13, b.Z1 - 0.11)   # ventanal sobre las puertas


def cocina(esc):
    """Foto cocina.png: torre roja de techo plano con persianas altas y un tejadillo sobre la puerta."""
    b = fila(esc, ["Cocina"], "oeste", ["HP"], bk=aleros(0.0), pared="magenta", techo="plano",
             alto=6.5, grosor_techo=0.15, mat_techo="magenta", atras="-", izq="-", der="-")
    esc.caja("metal", b.X0, b.X1, Y0 + 2.6, Y0 + 2.65, b.Z1, b.Z1 + 1.6)


def salones4(esc):
    """Foto salones_4A_B_C.png: muro rojo alto que esconde el techo, ventanas de madera con
    tejadillos de policarbonato."""
    fila(esc, ["Salones 4A, B y C"], "este", ["VVP"], partes=3, bk=aleros(0.3), pared="magenta",
         techo="plano", alto=4.6, mat_techo="metal", toldos=True, atras="-V-V-V-", izq="-", der="-")


def cafeteria(esc):
    """Bloque 34 del Plan Maestro (ficha y plano del Anexo 1): dos pisos, la mayor parte a doble
    altura, muros de fibrocemento pintado, carpintería de madera y cubierta de teja sándwich a
    una sola agua sobre estructura metálica, sin aleros. Sin foto: el color, los vanos y hacia
    qué lado baja el agua están por verificar. La ficha lo describe con vestíbulo, salón
    (gimnasio) y oficinas; el uso de "Cafetería" viene del mapa de la app.
    Faltan el volumen de la escalera y el de los baños (losa plana), que la ficha menciona."""
    alto = 6.4                                                # dos pisos
    b = fila(esc, ["Cafetería"], "sur", ["VVGGDGGVV"], bk=aleros(0.0), pared="pared", techo="plano",
             alto=alto, grosor_techo=0.12, mat_techo="metal", atras="L-L-P-L-L", izq="VP", der="V")
    y = Y0 + alto + 0.12
    caida = 0.08 * (b.RZ1 - b.RZ0)                            # agua del 8 % hacia el frente
    techo = [[b.RX0, y, b.RZ1], [b.RX1, y, b.RZ1], [b.RX1, y + caida, b.RZ0], [b.RX0, y + caida, b.RZ0]]
    esc.poligono("metal", techo)
    esc.poligono("metal", techo[::-1])
    for x in (b.RX0, b.RX1):                                  # remate triangular de los muros
        tri = [[x, y, b.RZ1], [x, y, b.RZ0], [x, y + caida, b.RZ0]]
        esc.poligono("pared", tri)
        esc.poligono("pared", tri[::-1])
    for z in (b.RZ1, b.RZ0):                                  # línea del entrepiso
        esc.caja("pared_int", b.RX0, b.RX1, Y0 + 3.2, Y0 + 3.35, z - 0.02, z + 0.02)
    n = max(1, round((b.RX1 - b.RX0) / 3.0))                  # ventanas del segundo piso
    for i in range(n):
        xm = b.RX0 + (b.RX1 - b.RX0) * (i + 0.5) / n
        for z in (b.RZ1 + 0.02, b.RZ0 - 0.02):
            esc.caja("madera", xm - 0.8, xm + 0.8, Y0 + 4.05, Y0 + 5.45, z - 0.03, z + 0.03)
            esc.caja("vidrio", xm - 0.72, xm + 0.72, Y0 + 4.13, Y0 + 5.37, z - 0.04, z + 0.04)


def medialab(esc):
    """Foto centro_soporte_y_recursos_tecnologicos.png: muros verdes, techo plano con
    cornisa ancha y cubierta de policarbonato al frente."""
    b = fila(esc, ["MediaLab - Laboratorio de Medios Audiovisuales"], "sur", ["VV-VP"],
             bk=aleros(0.3), pared="verde_claro", techo="plano", alto=3.4, grosor_techo=0.6,
             mat_techo="verde_claro", atras="V-V", izq="-", der="-")
    y = Y0 + 3.4
    z0, z1 = b.RZ1, b.RZ1 + 2.8
    esc.caja("policarbonato", b.RX0, b.RX1, y + 0.3, y + 0.33, z0, z1)
    for k in range(9):
        x = b.RX0 + 0.05 + (b.RX1 - b.RX0 - 0.1) * k / 8
        esc.caja("madera_osc", x - 0.04, x + 0.04, y + 0.2, y + 0.3, z0, z1)
    for x in (b.RX0 + 0.1, b.RX1 - 0.1):
        esc.caja("madera_osc", x - 0.06, x + 0.06, Y0, y + 0.3, z1 - 0.15, z1 - 0.03)


def bienestar(esc):
    """Sin foto (pendiente): bloque largo de muros claros con teja oscura, como sus vecinos."""
    fila(esc, ["Bienestar"], "este", ["VPVVPVVPV"], pared="pared", atras="V" * 8, izq="V", der="V")


def salones5(esc):
    """Foto salones_5A_B_C.png: muros mostaza con pilastras blancas, corredor bajo el alero
    y lámina verde a cuatro aguas."""
    fila(esc, ["Salones 5A, B y C"], "este", ["PV"], partes=3,
         bk=dict(cuatro_aguas_izq=True, cuatro_aguas_der=True, alero_frente=2.2),
         techo="cuatro_aguas", pared="amarillo_muro", mat_techo="lamina_verde", columnas="blanco",
         atras="-V-V-V", izq="-", der="-")


def edificio_apartado1(esc):
    """Foto image.png: muros de listones de madera y techo plano de lámina sobre vigas."""
    fila(esc, ["Edificio apartado 1"], "sur", ["L-DL-L"], bk=aleros(1.0), pared="madera",
         techo="plano", alto=2.9, grosor_techo=0.1, mat_techo="metal", vigas=True,
         columnas="madera_osc", atras="LL-LL", izq="L-L", der="L-L")


def alojamientos(esc):
    """Foto piscina.png: alas bajas de madera con paneles mostaza alrededor de la piscina,
    techo de lámina sobre vigas. Las alas siguen los tramos del polígono de "Alojamientos"
    (en coordenadas del mapa), con las puertas hacia el patio."""
    alas = (  # lat_min, lat_max, lng_min, lng_max, frente (hacia la piscina)
        (355.6, 428.25, 126.67, 153.71, "este"),
        (412.22, 428.25, 153.71, 230.58, "sur"),
        (390.3, 412.22, 205.52, 230.58, "oeste"),
        (355.6, 373.05, 153.71, 183.27, "norte"),
    )
    for la0, la1, lg0, lg1, frente in alas:
        b, cx, cz = bloque_en(*rect_mapa(la0, la1, lg0, lg1), frente, alero_frente=1.2, alero_atras=0.6,
                              alero_izq=0.4, alero_der=0.4)
        esc.colocar(cx, cz, frente)
        n = max(1, round((b.X1 - b.X0) / 3.2))
        edificio(esc, b, "madera_osc", "PM" * n, atras="A-" * n, techo="plano", alto=2.8,
                 grosor_techo=0.1, mat_techo="metal", vigas=True, piso="piso_claro")
    esc.colocar(0.0, 0.0, "sur")
    puntos(esc, "Alojamientos", *a_metros(381.17, 192.29), 4.5, giro=math.pi / 2,
           etiqueta=a_metros(391.32, 144.41))


def piscina(esc):
    """Foto piscina.png: piscina con borde de concreto y cerca de malla azul."""
    x0, x1, z0, z1 = rect("Piscina")
    esc.colocar(0.0, 0.0, "sur")
    d = 1.0                                                   # andén alrededor
    for a in ((x0 - d, x1 + d, z0 - d, z0), (x0 - d, x1 + d, z1, z1 + d),
              (x0 - d, x0, z0, z1), (x1, x1 + d, z0, z1)):
        esc.caja("concreto", a[0], a[1], 0.0, 0.3, a[2], a[3])
    esc.caja("porcelana", x0, x1, -0.05, 0.02, z0, z1)
    esc.caja("agua_piscina", x0 + 0.05, x1 - 0.05, 0.02, 0.12, z0 + 0.05, z1 - 0.05)
    # Cerca: postes y dos barandas azules sobre el borde del andén
    fx0, fx1, fz0, fz1 = x0 - d + 0.1, x1 + d - 0.1, z0 - d + 0.1, z1 + d - 0.1
    for (ax, az), (bx, bz) in (((fx0, fz0), (fx1, fz0)), ((fx1, fz0), (fx1, fz1)),
                               ((fx1, fz1), (fx0, fz1)), ((fx0, fz1), (fx0, fz0))):
        L = math.hypot(bx - ax, bz - az)
        n = max(1, round(L / 1.8))
        for i in range(n + 1):
            px, pz = ax + (bx - ax) * i / n, az + (bz - az) * i / n
            esc.caja("malla_azul", px - 0.03, px + 0.03, 0.3, 1.5, pz - 0.03, pz + 0.03)
        for y in (0.35, 1.45):
            esc.caja("malla_azul", min(ax, bx) - 0.02, max(ax, bx) + 0.02, y, y + 0.04,
                     min(az, bz) - 0.02, max(az, bz) + 0.02)
    puntos(esc, "Piscina", (x0 + x1) / 2, z1 + 0.8, 2.5, etiqueta=((x0 + x1) / 2, (z0 + z1) / 2))


def casa_hija(esc):
    """Foto casa-hija.jpg: maloca de tablas de madera con techo de palma muy alto en punta.
    En el mapa es un cuadrado girado 45°, por eso se coloca en diagonal."""
    x0, x1, z0, z1 = rect("Casa hija")
    lado = math.hypot(x1 - x0, z1 - z0) / 2                   # lado del cuadrado (diagonales del mapa)
    esc.colocar((x0 + x1) / 2, (z0 + z1) / 2, math.pi / 4)
    h, a, muro_alto, pend = lado / 2, 0.5, 3.0, 1.45
    m = h - a                                                 # medio lado de los muros
    y_top, zoc = Y0 + muro_alto, Y0 + 0.25

    def caja(eje, mat, a0, a1, y0, y1, c0, c1):
        if eje == "x":
            esc.caja(mat, a0, a1, y0, y1, c0, c1)
        else:
            esc.caja(mat, c0, c1, y0, y1, a0, a1)

    def tablas(eje, a0, a1, c0, c1, y0, y1):
        """Tablas verticales de ~28 cm con rendijas, tonos alternos y algunas salidas."""
        n = max(1, round((a1 - a0) / 0.28))
        w = (a1 - a0) / n
        for i in range(n):
            mat = "madera_osc" if i % 3 == 0 else "madera"
            s = 0.0 if i % 2 else 0.03
            caja(eje, mat, a0 + i * w + 0.015, a0 + (i + 1) * w - 0.015, y0, y1, c0 - s, c1 + s)

    puerta = 1.25                                             # media luz de la puerta doble
    for eje, c0, c1, frente in (("x", m - G, m, True), ("x", -m, -m + G, False),
                                ("z", -m, -m + G, False), ("z", m - G, m, False)):
        esc.caja("concreto", *((-m, m, 0.0, zoc, c0 - 0.05, c1 + 0.05) if eje == "x"
                               else (c0 - 0.05, c1 + 0.05, 0.0, zoc, -m, m)))   # zócalo bajo
        caja(eje, "madera_osc", -m, m, y_top - 0.12, y_top, c0 - 0.06, c1 + 0.06)  # solera alta
        if frente:
            tablas(eje, -m, -puerta, c0, c1, zoc, y_top - 0.12)
            tablas(eje, puerta, m, c0, c1, zoc, y_top - 0.12)
            tablas(eje, -puerta, puerta, c0, c1, Y0 + 2.5, y_top - 0.12)
            # Puerta doble de listones verticales separados, con travesaños
            caja(eje, "madera_osc", -puerta, puerta, Y0 + 2.4, Y0 + 2.5, c0 - 0.05, c1 + 0.05)
            for x in (-puerta, -0.04, puerta - 0.08):
                caja(eje, "madera_osc", x, x + 0.08, Y0, Y0 + 2.4, c0 - 0.05, c1 + 0.05)
            x = -puerta + 0.12
            while x < puerta - 0.12:
                caja(eje, "madera", x, x + 0.07, Y0, Y0 + 2.4, c0, c1)
                x += 0.17
            for y in (Y0 + 0.3, Y0 + 1.25, Y0 + 2.2):
                caja(eje, "madera_osc", -puerta, puerta, y, y + 0.08, c1, c1 + 0.04)
        else:
            tablas(eje, -m, m, c0, c1, zoc, y_top - 0.12)
        # Calados (rombos, lunas) en las tablas: marcas oscuras a la altura de los ojos
        for x in (-m * 0.75, -m * 0.4, m * 0.4, m * 0.75):
            if frente and abs(x) < puerta + 0.3:
                continue
            caja(eje, "madera_osc", x - 0.06, x + 0.06, Y0 + 1.55, Y0 + 1.7, c0 - 0.05, c1 + 0.05)
    for sx in (-1, 1):                                        # postes de esquina
        for sz in (-1, 1):
            px, pz = sx * (m - 0.08), sz * (m - 0.08)
            esc.caja("madera_osc", px - 0.12, px + 0.12, 0.0, y_top, pz - 0.12, pz + 0.12)
    esc.caja("tierra", -m + G, m - G, 0.0, Y0 + 0.01, -m + G, m - G)
    # Sendero de tablas de madera hacia la puerta
    for i in range(6):
        z = m + 0.6 + i * 0.9
        esc.caja("madera", -0.35, 0.35, 0.0, 0.05, z, z + 0.75)
    y_alero = 2.6
    cima = y_alero + pend * h
    faldones(esc, "paja", "madera_osc", (-h, h, -h, h), y_alero, (0.0, 0.0, 0.0, 0.0), cima, T=0.35)
    puntos(esc, "Casa hija", 0.0, h + 4.0, cima + 1.5, etiqueta=(0.0, 0.0))


def marquesina(esc):
    """Marquesina alrededor de la plaza del tanque (bloque M5, la "Cocina" de la app).
    Plano del Anexo 1 (pág. 2): techo en anillo a cuatro aguas por fuera y por dentro, borde
    exterior de 25,62 m y patio abierto de 16,41 m, con la torre M5 dentro del patio. La foto
    cocina.png deja ver un tramo: lámina metálica sobre vigas y postes de madera.
    No tiene polígono ni ficha propia en el mapa, por eso no lleva etiqueta ni partida.
    Pendiente de verificar en el campus: alturas, separación de los postes y el piso de la plaza."""
    esc.colocar(0.0, 0.0, "sur")
    ex = rect_mapa(*MARQUESINA_EXT)
    ix = rect_mapa(*MARQUESINA_INT)
    y_alero, pend = Y0 + 2.6, 0.25
    m = ((ix[0] - ex[0]) + (ex[1] - ix[1]) + (ix[2] - ex[2]) + (ex[3] - ix[3])) / 8   # media anchura del anillo
    cum = (ex[0] + m, ex[1] - m, ex[2] + m, ex[3] - m)        # cumbrera en la mitad del anillo
    y_cum = y_alero + pend * m
    esc.caja("concreto", ex[0], ex[1], 0.0, PISO, ex[2], ex[3])      # plaza
    faldones(esc, "metal", "metal", ex, y_alero, cum, y_cum, T=0.06)  # agua hacia afuera
    faldones(esc, "metal", "metal", cum, y_cum, ix, y_alero, T=0.06)  # agua hacia el patio
    # Postes y vigas de madera en dos anillos, 0,5 m adentro de cada alero
    for d in (0.5, -0.5):
        r = (ex[0] + d, ex[1] - d, ex[2] + d, ex[3] - d) if d > 0 else (ix[0] + d, ix[1] - d, ix[2] + d, ix[3] - d)
        y_p = y_alero + pend * 0.5                            # bajo la lámina
        x0, x1, z0, z1 = r
        for a0, a1, fijo, eje in ((x0, x1, z0, "x"), (x0, x1, z1, "x"), (z0, z1, x0, "z"), (z0, z1, x1, "z")):
            n = max(1, round((a1 - a0) / 3.0))
            for i in range(n + 1):
                a = a0 + (a1 - a0) * i / n
                px, pz = (a, fijo) if eje == "x" else (fijo, a)
                esc.caja("madera", px - 0.1, px + 0.1, PISO, y_p, pz - 0.1, pz + 0.1)
            if eje == "x":
                esc.caja("madera_osc", a0 - 0.1, a1 + 0.1, y_p - 0.2, y_p, fijo - 0.08, fijo + 0.08)
            else:
                esc.caja("madera_osc", fijo - 0.08, fijo + 0.08, y_p - 0.2, y_p, a0 - 0.1, a1 + 0.1)
    # Vigas que cruzan el anillo de poste a poste, bajo la lámina
    for a in [ex[0] + 0.5 + k * 3.0 for k in range(int((ex[1] - ex[0] - 1.0) / 3.0) + 1)]:
        for z_a, z_b in ((ex[2] + 0.5, ix[2] - 0.5), (ix[3] + 0.5, ex[3] - 0.5)):
            esc.caja("madera_osc", a - 0.06, a + 0.06, y_alero - 0.05, y_alero + 0.1, z_a, z_b)
    for a in [ex[2] + 0.5 + k * 3.0 for k in range(int((ex[3] - ex[2] - 1.0) / 3.0) + 1)]:
        for x_a, x_b in ((ex[0] + 0.5, ix[0] - 0.5), (ix[1] + 0.5, ex[1] - 0.5)):
            esc.caja("madera_osc", x_a, x_b, y_alero - 0.05, y_alero + 0.1, a - 0.06, a + 0.06)


def cancha(esc):
    """Sin foto: cancha de baloncesto como en el plano (placa gris con líneas y dos tableros)."""
    x0, x1, z0, z1 = rect("Cancha")
    cx, cz, L, W = (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0
    esc.colocar(cx, cz, "sur")
    esc.caja("cancha_piso", -L / 2, L / 2, 0.0, 0.08, -W / 2, W / 2)
    y, t = 0.08, 0.06
    linea = lambda a0, a1, b0, b1: esc.caja("linea", a0, a1, y, y + 0.01, b0, b1)
    lx, lz = L / 2 - 0.6, W / 2 - 0.6                         # borde de juego
    linea(-lx, lx, -lz - t, -lz + t); linea(-lx, lx, lz - t, lz + t)
    linea(-lx - t, -lx + t, -lz, lz); linea(lx - t, lx + t, -lz, lz)
    linea(-t, t, -lz, lz)                                     # línea central
    for i in range(24):                                       # círculo central
        a0, a1 = 2 * math.pi * i / 24, 2 * math.pi * (i + 1) / 24
        suelo(esc, "linea", [(1.8 * math.cos(a0), 1.8 * math.sin(a0)), (1.8 * math.cos(a1), 1.8 * math.sin(a1)),
                             (1.68 * math.cos(a1), 1.68 * math.sin(a1)), (1.68 * math.cos(a0), 1.68 * math.sin(a0))],
              y + 0.012)
    for s in (-1, 1):                                         # zonas y tableros
        xb = s * lx
        xl = xb - s * 5.8
        linea(min(xb, xl), max(xb, xl), -2.45 - t, -2.45 + t)
        linea(min(xb, xl), max(xb, xl), 2.45 - t, 2.45 + t)
        linea(xl - t, xl + t, -2.45, 2.45)
        xp = s * (L / 2 - 0.15)
        esc.caja("metal", xp - 0.08, xp + 0.08, 0.08, 3.9, -0.08, 0.08)          # poste
        xt = xb - s * 1.2
        esc.caja("metal", min(xp, xt), max(xp, xt), 3.3, 3.38, -0.05, 0.05)       # brazo
        esc.caja("pantalla", xt - 0.03, xt + 0.03, 2.9, 3.95, -0.9, 0.9)          # tablero
        xa = xt - s * 0.25
        for a0, a1, b0, b1 in ((xa - 0.23, xa + 0.23, -0.25, -0.21), (xa - 0.23, xa + 0.23, 0.21, 0.25),
                               (xa - 0.25, xa - 0.21, -0.23, 0.23), (xa + 0.21, xa + 0.25, -0.23, 0.23)):
            esc.caja("rojo", a0, a1, 3.05, 3.08, b0, b1)                          # aro
    puntos(esc, "Cancha", 0.0, W / 2 + 2.5, 5.0, etiqueta=(0.0, 0.0))


def parqueadero(esc):
    """Sin foto: zona en L de asfalto con puestos marcados, como en el plano. Los dos
    rectángulos salen de los puntos del polígono de "Parqueadero" (en coordenadas del mapa)."""
    esc.colocar(0.0, 0.0, "sur")
    zonas = (rect_mapa(65.61, 97.68, 744.8, 820.55), rect_mapa(89.15, 98.69, 706.5, 744.8))
    for x0, x1, z0, z1 in zonas:
        esc.caja("asfalto", x0, x1, 0.0, 0.05, z0, z1)
    x0, x1, z0, z1 = zonas[0]
    n = int((x1 - x0 - 1.0) / 2.5)
    for i in range(n + 1):                                    # puestos al norte y al sur
        x = x0 + 0.5 + i * 2.5
        esc.caja("linea", x - 0.05, x + 0.05, 0.05, 0.06, z0 + 0.3, z0 + 5.3)
        esc.caja("linea", x - 0.05, x + 0.05, 0.05, 0.06, z1 - 5.3, z1 - 0.3)
    xp, zp = a_metros(102.14, 780.84)
    puntos(esc, "Parqueadero", xp, zp, 3.0, giro=math.pi, etiqueta=a_metros(81.85, 780.84))


# archivo, lugares que lo usan como modelo3d, función que los dibuja en el mundo
ESTRUCTURAS = (
    ("fila_admision.glb", ["Admisión y Matrícula", "Secretaría de Sede"], fila_admision),
    ("gestion_bienes.glb", ["Gestión de Bienes"], gestion_bienes),
    ("ugi.glb", ["UGÍ - Unidad de Gestión e Integral"], ugi),
    ("fila_oficinas.glb", ["Oficina 3", "Sala 2 Videoconferencia", "Laboratorio - Innovación y Sostenibilidad",
                           "Adquisición de Bienes y Servicios", "Baños 2"], fila_oficinas),
    ("bloque13.glb", ["Bloque 13"], bloque13),
    ("salones3.glb", ["Salones 3A,B y C"], salones3),
    ("lab_ecologia.glb", ["Laboratorio - Ecología y Conservación de Flora y Fauna Silvestre"], lab_ecologia),
    ("cocina.glb", ["Cocina"], cocina),
    ("salones4.glb", ["Salones 4A, B y C"], salones4),
    ("cafeteria.glb", ["Cafetería"], cafeteria),
    ("medialab.glb", ["MediaLab - Laboratorio de Medios Audiovisuales"], medialab),
    ("bienestar.glb", ["Bienestar"], bienestar),
    ("salones5.glb", ["Salones 5A, B y C"], salones5),
    ("edificio_apartado1.glb", ["Edificio apartado 1"], edificio_apartado1),
    ("alojamientos.glb", ["Alojamientos"], alojamientos),
    ("piscina.glb", ["Piscina"], piscina),
    ("casa_hija.glb", ["Casa hija"], casa_hija),
    ("cancha.glb", ["Cancha"], cancha),
    ("parqueadero.glb", ["Parqueadero"], parqueadero),
)


def extension(nombres):
    """Rectángulo del mundo que cubren los polígonos de esos lugares."""
    rs = [rect(n) for n in nombres]
    return (min(r[0] for r in rs), max(r[1] for r in rs), min(r[2] for r in rs), max(r[3] for r in rs))


def extensiones():
    return [extension(nombres) for _, nombres, _ in ESTRUCTURAS]


def colocar_todos(esc):
    """Dibuja todas las estructuras en el mundo del recorrido."""
    for _, _, dibujar in ESTRUCTURAS:
        dibujar(esc)
    marquesina(esc)


if __name__ == "__main__":
    carpeta = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "static" / "modelos"
    for archivo, nombres, dibujar in ESTRUCTURAS:
        x0, x1, z0, z1 = extension(nombres)
        esc = Escena(origen=((x0 + x1) / 2, (z0 + z1) / 2))    # el modelo suelto queda centrado
        esc.caja("pasto", x0 - 5, x1 + 5, -0.05, 0.0, z0 - 5, z1 + 5)
        dibujar(esc)
        esc.guardar(carpeta / archivo, " / ".join(nombres))
