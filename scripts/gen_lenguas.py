"""Arma data/lenguas.json (palabras en lenguas amazónicas para la ficha de cada edificio
y el saludo del mapa; ver mostrarLenguas() en static/js/index.js).

- Fichas VERIFICADAS de docs/lenguas/Ecoruta_datos.xlsx (hoja Fichas_culturales): se copian tal cual.
- Palabras tikuna del Diccionario ticuna-castellano (ILV 2016): transcritas a mano desde la
  imagen de cada página (la extracción de texto del PDF pierde la tilde sobre la ü), con
  los diacríticos escritos como escapes Unicode. Página = número impreso en el diccionario.
- No se compone ninguna frase: cada lugar recibe palabras sueltas cuyo significado tiene
  que ver con su uso. Para agregar una, verificarla primero contra la página del PDF.

Uso (desde la raíz del proyecto, con la .venv activa; necesita openpyxl):
    python scripts/gen_lenguas.py docs/lenguas/Ecoruta_datos.xlsx data/lenguas.json
"""
import json
import sys
import unicodedata

import openpyxl

T = "̃"   # tilde combinante (sobre ü: ü̃)
M = "̱"   # raya debajo (a̱, u̱, x̱)
A = "́"   # tilde aguda combinante

nfc = lambda s: unicodedata.normalize("NFC", s)

# Diccionario: clave -> (palabra en español, tikuna tal como lo da el diccionario, página impresa)
D = {
    "libro":        ("libro", "libru, orepane, popera", 297),
    "leer":         ("leer", "nüxü" + T + " nadaumatü", 297),
    "papel":        ("papel", "popera", 309),
    "reunion":      ("reunión", "ngutaque" + M + "xe", 320),     # raya bajo la segunda e
    "escuchar":     ("escuchar", "inaxĩnü", 282),
    "hablar":       ("hablar", "nidexa", 290),
    "escuela":      ("escuela", "iscuera, ngúepataü" + T + ", ngúexü" + T + "güchica", 282),
    "estudiante":   ("estudiante", "ngúexü" + T, 283),
    "estudiar":     ("estudiar", "nangu" + M + "x", 283),
    "ensenar":      ("enseñar", "nanangúexẽẽ, nanangu" + M + "xẽẽ", 280),
    "arahuana":     ("arahuana (especie de pez)", "orawana", 251),
    "rio":          ("río", "natü", 320),
    "rio_grande":   ("río grande", "taxtü", 320),
    "conocimiento": ("conocimiento", "cua" + M + "x", 266),
    "trabajo":      ("trabajo", "puracü", 330),
    "trabajar":     ("trabajar", "napuracü", 330),
    "escribir":     ("escribir", "nanawü" + T + A, 282),
    "archivador":   ("archivador (para papeles)", "poperachixü" + T, 251),
    "conversar":    ("conversar", "nidexa", 267),
    "ver":          ("ver", "nüxü" + T + " nadau", 333),
    "pensar":       ("pensar", "nagu narüxĩnü", 311),
    "animal":       ("animal", "naeü" + T, 249),
    "planta":       ("planta", "nanetü", 313),
    "ave":          ("ave", "weri", 253),
    "lago":         ("lago", "naxtaxa", 296),
    "agua":         ("agua", "dexá", 246),
    "musica":       ("música", "paxeta", 304),
    "casa":         ("casa", "ĩ, ĩpata, nachiü" + T, 260),
    "huespedes":    ("casa de huéspedes", "ngugüpata", 260),
    "cocinar":      ("cocinar", "nanamuxra, naxüwemü", 264),
    "comida":       ("comida", "chibü", 265),
    "comer":        ("comer", "nachibü", 265),
    "ducha":        ("ducha", "aiyachica", 277),
    "banarse":      ("bañarse", "naxaiya", 254),
    "tienda":       ("tienda", "taxechica", 329),
    "comprar":      ("comprar", "naxca" + M + "x nataxe", 265),
    "nadar":        ("nadar", "niwẽẽ", 304),
    "dormitorio":   ("dormitorio", "pechica, ucapu", 277),
    "pelota":       ("pelota", "peruta", 311),
    "futbol":       ("jugar fútbol", "nacuxgütae", 295),
    "carro":        ("carro", "autu, caru", 260),
}

AULA = ["escuela", "estudiante", "estudiar"]
OFICINA = ["trabajo", "trabajar", "escribir"]
BANO = ["ducha", "banarse", "agua"]

# Lugar -> (claves del diccionario, fichas de Ecoruta)
LUGARES = {
    "Biblioteca": (["libro", "leer", "papel"], []),
    "Auditorio": (["reunion", "escuchar", "hablar"], []),
    "Sala de sistemas 1": (AULA, []),
    "Sala de sistemas 2": (AULA, []),
    "Aula tic 2": (AULA, []),
    "Sala de posgrado": (AULA, []),
    "Salones 3A,B y C": (AULA, []),
    "Salones 4A, B y C": (AULA, []),
    "Salones 5A, B y C": (AULA, []),
    "Bloque 13": (AULA, []),
    "Sala de profesores": (["ensenar", "estudiante", "trabajar"], []),
    "Arawana": (["arahuana", "estudiar"], []),
    "APAPORIS": (["rio", "estudiar"], ["FIC-05", "FIC-21", "FIC-54"]),
    "IMANI": (["rio_grande", "conocimiento"], ["FIC-37"]),
    "Dirección": (OFICINA, []),
    "UGÍ - Unidad de Gestión e Integral": (OFICINA, []),
    "Oficina 3": (OFICINA, []),
    "Adquisición de Bienes y Servicios": (OFICINA, []),
    "Gestión de Bienes": (OFICINA, []),
    "Oficina de Asesoría y Orientación Tecnológica": (OFICINA, []),
    "Admisión y Matrícula": (["estudiante", "escribir", "papel"], []),
    "Secretaría de Sede": (["archivador", "papel", "escribir"], []),
    "Sala 2 Videoconferencia": (["conversar", "ver", "escuchar"], []),
    "Laboratorio - Innovación y Sostenibilidad": (["conocimiento", "pensar", "trabajar"], []),
    "Laboratorio - Ecología y Conservación de Flora y Fauna Silvestre": (["animal", "planta", "ave"], ["FIC-06"]),
    "Laboratorio - Manejo y gestión de humedales": (["lago", "agua", "planta"], []),
    "MediaLab - Laboratorio de Medios Audiovisuales": (["ver", "escuchar", "musica"], []),
    "Maloca": (["casa"], ["FIC-09", "FIC-26", "FIC-41", "FIC-58"]),
    "Casa hija": (["casa"], []),
    "Cocina": (["cocinar", "comida", "agua"], []),
    "Cafetería": (["comida", "comer"], []),
    "Baños para hombres": (BANO, []),
    "Baño para mujeres": (BANO, []),
    "Baños 2": (BANO, []),
    "Bloque para tienda": (["tienda", "comprar"], []),
    "Piscina": (["nadar", "agua"], []),
    "Alojamientos": (["huespedes", "dormitorio"], []),
    "Cancha": (["pelota", "futbol"], []),
    "Parqueadero": (["carro"], []),
}
BIENVENIDA = ["FIC-01", "FIC-02", "FIC-18", "FIC-33", "FIC-50"]

xlsx, salida = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(xlsx, data_only=True)
lenguas = {}
for r in wb["Lenguas"].iter_rows(min_row=3, values_only=True):
    if r[0] and str(r[0]).startswith("L-"):
        lenguas[r[0]] = {"nombre": r[1], "autodenominacion": nfc(r[2] or ""), "fuente": r[6]}
fichas = {}
cols = [c.value for c in wb["Fichas_culturales"][1]]
for r in wb["Fichas_culturales"].iter_rows(min_row=3, values_only=True):
    f = dict(zip(cols, r))
    if f["id"] and str(f["id"]).startswith("FIC-") and f["estado"] == "VERIFICADA":
        fichas[f["id"]] = f


def ficha(fid):
    f = fichas[fid]   # falla si la ficha no está VERIFICADA
    return {
        "lengua": lenguas[f["lengua_id"]]["nombre"],
        "texto": nfc(str(f["texto_original"]).strip()),
        "significado": str(f["significado_es"]).strip(),
        "fuente": "ecoruta",
        "ficha": fid,
        "atribucion": str(f["comunidad_o_hablante"] or f["fuente"] or "").strip(),
    }


def palabra(clave):
    es, tikuna, pag = D[clave]
    return {"lengua": "Tikuna", "texto": nfc(tikuna), "significado": es, "fuente": "ilv2016", "pagina": pag}


nombres = {l["nombre"] for l in json.load(open("data/edifcios.json", encoding="utf-8"))}
datos = {
    "fuentes": {
        "ilv2016": "Diccionario ticuna–castellano. Serie Lingüística Peruana 57. Instituto Lingüístico de Verano, Lima, 2016. Ortografía ticuna del Perú.",
        "ecoruta": "Ecoruta Conectada, fichas culturales verificadas con hablantes (uso educativo con atribución).",
    },
    "bienvenida": [ficha(f) for f in BIENVENIDA],
    "lugares": {},
}
for lugar, (claves, fids) in LUGARES.items():
    assert lugar in nombres, lugar
    datos["lugares"][lugar] = [ficha(f) for f in fids] + [palabra(c) for c in claves]
with open(salida, "w", encoding="utf-8", newline="\n") as fo:
    json.dump(datos, fo, ensure_ascii=False, indent=2)
    fo.write("\n")
print(len(datos["lugares"]), "lugares;", sum(len(v) for v in datos["lugares"].values()), "entradas")
for x in datos["bienvenida"]:
    print(x)
print(datos["lugares"]["Maloca"])
