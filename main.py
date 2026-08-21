""" .\.venv\Scripts\activate.bat """
""" uvicorn main:app --reload """
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, Request
# pyrefly: ignore [missing-import]
from fastapi.staticfiles import StaticFiles
# pyrefly: ignore [missing-import]
from fastapi.templating import Jinja2Templates
# pyrefly: ignore [missing-import]
from fastapi.responses import FileResponse
from pathlib import Path
import json


app = FastAPI()

# Montar carpetas estáticas para offline
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/data", StaticFiles(directory="data"), name="data")

templates = Jinja2Templates(directory="templates")

@app.get("/")
def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
    )


""" @app.get("/lugares")
def obtener_lugares():
    return lugares


@app.get("/plantas")
def obtener_plantas():
    return plantas """
