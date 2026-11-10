import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("ML_API_KEY", "clave-de-prueba")


@pytest.fixture()
def cliente(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    from app import main

    monkeypatch.setattr(main, "DIRECTORIO", tmp_path)
    monkeypatch.setattr(main, "CLAVE", "clave-de-prueba")
    return TestClient(main.app)


H = {"X-ML-Key": "clave-de-prueba"}

PRODUCTOS = [
    {"idProducto": i, "nombre": n, "categoria": c, "precio": p}
    for i, (n, c, p) in enumerate([
        ("Bota Trekking", "Botas", 650), ("Polera Dry-Fit", "Ropa deportiva", 120),
        ("Zapatilla Runner Pro", "Zapatillas", 520), ("Mochila Urbana", "Accesorios", 210),
    ], 1)
]
SUCURSALES = [{"idSucursal": 3, "nombre": "Centro"}, {"idSucursal": 4, "nombre": "Norte"}]


def peticion(**extra):
    return {"productos": PRODUCTOS, "sucursales": SUCURSALES, "hoy": "2026-11-06", **extra}
