"""Genera el mundo del recorrido a pie y de la vista aérea (static/modelos/recorrido.glb):
todos los edificios con modelo, cada uno en su sitio según el mapa y con sus medidas.

Uso (desde la raíz del proyecto):
    python scripts/modelos/gen_recorrido.py static/modelos/recorrido.glb

Cada edificio deja un punto de partida "inicio_<nombre>" (espacios -> "_"), para que
el botón "Caminar" de su tarjeta empiece frente a él ("inicio" es el de por defecto),
y un punto "centro_<nombre>" sobre el techo para su etiqueta en la vista aérea.
Para agregar otro edificio: escribe su generador, ubícalo en comun.distribucion()
y añádelo abajo.
"""
import sys

import gen_apaporis
import gen_arawana
import gen_aula_tic2
import gen_auditorio
import gen_banos
import gen_biblioteca
import gen_complementarios
import gen_direccion
import gen_imani
import gen_lab_humedales
import gen_maloca
import gen_oficina_tec
import gen_sala_posgrado
import gen_sala_profesores
import gen_sala_sistemas1
import gen_sala_sistemas2
import gen_tienda
from comun import CUMBRERA, HUMEDALES, OFICINA_TEC, Escena, distribucion, nombre_centro, nombre_inicio

esc = Escena()
dist = distribucion()

# Un solo pasto bajo todo
xs, zs = [], []
for b, cx, cz, _ in dist.values():
    r = max(b.RX1 - b.RX0, b.RZ1 - b.RZ0) / 2
    xs += [cx - r, cx + r]
    zs += [cz - r, cz + r]
for x0, x1, z0, z1 in gen_complementarios.extensiones():
    xs += [x0, x1]
    zs += [z0, z1]
esc.caja("pasto", min(xs) - 10, max(xs) + 10, -0.05, 0.0, min(zs) - 12, max(zs) + 12)

# Bloques sencillos: un construir() en el sistema local del bloque
for nombre, construir in (("Auditorio", gen_auditorio.construir),
                          ("Sala de sistemas 2", gen_sala_sistemas2.construir)):
    b, cx, cz, frente = dist[nombre]
    esc.colocar(cx, cz, frente)
    construir(esc, b, inicio=nombre_inicio(nombre), terreno=False)
    esc.punto(nombre_centro(nombre), 0.0, b.ZC, y=CUMBRERA + 1.5, extras={"nombre": nombre})

# Edificios que se ubican solos (la biblioteca tiene varias partes)
gen_direccion.colocar(esc, dist, inicio=nombre_inicio("Dirección"), terreno=False)
gen_biblioteca.colocar(esc, dist, inicio=nombre_inicio("Biblioteca"), terreno=False)
gen_sala_profesores.colocar(esc, dist, inicio=nombre_inicio("Sala de profesores"), terreno=False)
gen_arawana.colocar(esc, dist, inicio=nombre_inicio("Arawana"), terreno=False)
gen_maloca.colocar(esc, dist, inicio=nombre_inicio("Maloca"), terreno=False)
gen_banos.colocar(esc, dist, "hombres", inicio=nombre_inicio("Baños para hombres"), terreno=False)
gen_banos.colocar(esc, dist, "mujeres", inicio=nombre_inicio("Baño para mujeres"), terreno=False)
gen_tienda.colocar(esc, dist, inicio=nombre_inicio("Bloque para tienda"), terreno=False)
gen_aula_tic2.colocar(esc, dist, inicio=nombre_inicio("Aula tic 2"), terreno=False)
gen_lab_humedales.colocar(esc, dist, inicio=nombre_inicio(HUMEDALES), terreno=False)
gen_imani.colocar(esc, dist, inicio=nombre_inicio("IMANI"), terreno=False)
gen_apaporis.colocar(esc, dist, inicio=nombre_inicio("APAPORIS"), terreno=False)
gen_sala_sistemas1.colocar(esc, dist, inicio=nombre_inicio("Sala de sistemas 1"), terreno=False)
gen_sala_posgrado.colocar(esc, dist, inicio=nombre_inicio("Sala de posgrado"), terreno=False)
gen_oficina_tec.colocar(esc, dist, inicio=nombre_inicio(OFICINA_TEC), terreno=False)

# Estructuras más sencillas (solo exterior), ver gen_complementarios.py
gen_complementarios.colocar_todos(esc)
esc.colocar(0.0, 0.0, "sur")

# Partida por defecto: la del auditorio
inicio_def = dict(next(n for n in esc.nodos if n["name"] == nombre_inicio("Auditorio")))
inicio_def["name"] = "inicio"
esc.nodos.append(inicio_def)

esc.guardar(sys.argv[1], "Recorrido")
