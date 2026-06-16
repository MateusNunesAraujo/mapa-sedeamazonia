# main.py
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi import Request

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

lugares = [
    {
        "nombre":"Biblioteca",
        "x":335,
        "y":348,
        "descripcion":"Espacio de estudio y consulta de recursos bibliográficos.",
        "horario":"Lunes a viernes: 8:00 AM - 6:00 PM",
        "reglas":"Silencio absoluto, prohibido alimentos y bebidas.",
        "novedades":"Nueva sección de libros digitales disponible."
    },
    {
        "nombre":"Bloque A",
        "x":501,
        "y":487,
        "descripcion":"Aulas de clase para programas académicos.",
        "horario":"Según calendario académico",
        "reglas":"Acceso restringido a estudiantes matriculados.",
        "novedades":"Renovación de equipos audiovisuales completada."
    },
    {
        "nombre":"Auditorio",
        "x":420,
        "y":215,
        "descripcion":"Aulas de clase para programas académicos.",
        "horario":"Según calendario académico",
        "reglas":"Acceso restringido a estudiantes matriculados.",
        "novedades":"Renovación de equipos audiovisuales completada."
    },
    {
        "nombre":"Salón Arawana",
        "x":689,
        "y":215,
        "descripcion":"Aulas de clase para programas académicos.",
        "horario":"Según calendario académico",
        "reglas":"Acceso restringido a estudiantes matriculados.",
        "novedades":"Renovación de equipos audiovisuales completada."
    },
    {
        "nombre":"Parqueadero",
        "x":274,
        "y":581,
        "descripcion":"Aulas de clase para programas académicos.",
        "horario":"Según calendario académico",
        "reglas":"Acceso restringido a estudiantes matriculados.",
        "novedades":"Renovación de equipos audiovisuales completada."
    },
    {
        "nombre":"Cancha",
        "x":247,
        "y":820,
        "descripcion":"Aulas de clase para programas académicos.",
        "horario":"Según calendario académico",
        "reglas":"Acceso restringido a estudiantes matriculados.",
        "novedades":"Renovación de equipos audiovisuales completada."
    },
    {
        "nombre":"Baños 1",
        "x":333,
        "y":834,
        "descripcion":"Aulas de clase para programas académicos.",
        "horario":"Según calendario académico",
        "reglas":"Acceso restringido a estudiantes matriculados.",
        "novedades":"Renovación de equipos audiovisuales completada."
    },
    {
        "nombre":"Baños 2",
        "x":765,
        "y":297.5,
        "descripcion":"Aulas de clase para programas académicos.",
        "horario":"Según calendario académico",
        "reglas":"Acceso restringido a estudiantes matriculados.",
        "novedades":"Renovación de equipos audiovisuales completada."
    },
    {
        "nombre":"Sala de Sistemas",
        "x":594,
        "y":490,
        "descripcion":"Aulas de clase para programas académicos.",
        "horario":"Según calendario académico",
        "reglas":"Acceso restringido a estudiantes matriculados.",
        "novedades":"Renovación de equipos audiovisuales completada."
    },
    {
        "nombre":"Sala de maestros",
        "x":547,
        "y":216,
        "descripcion":"Aulas de clase para programas académicos.",
        "horario":"Según calendario académico",
        "reglas":"Acceso restringido a estudiantes matriculados.",
        "novedades":"Renovación de equipos audiovisuales completada."
    }
]


@app.get("/")
def home(request: Request):
    return templates.TemplateResponse(
    request=request,
    name="index.html"
)

@app.get("/lugares")
def obtener_lugares():
    return lugares