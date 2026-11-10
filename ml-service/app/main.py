"""
API del microservicio de ML (FastAPI).

Solo la llama el backend NestJS (nunca el navegador): cada petición trae la cabecera
`X-ML-Key` con una clave compartida (ML_API_KEY). El id de la empresa va en la ruta y lo
pone NestJS a partir del JWT del usuario; cada empresa tiene su propio archivo de modelo.

Ejecutar:  uvicorn app.main:app --port 8001
Documentación interactiva: http://localhost:8001/docs
"""
from __future__ import annotations

import logging
import os
import secrets
import time
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Annotated

import joblib
import pandas as pd
from fastapi import Depends, FastAPI, Header, HTTPException, Path as PathParam, Query

from . import anomalias, demanda, segmentos
from .schemas import PeticionEntrenamiento
from .sintetico import generar_clientes, generar_ventas

log = logging.getLogger("ml-service")
CLAVE = os.environ.get("ML_API_KEY") or "dev-ml-key"
DIRECTORIO = Path(os.environ.get("ML_MODELOS_DIR") or Path(__file__).resolve().parent.parent / "modelos")
if CLAVE == "dev-ml-key":
    log.warning("ML_API_KEY no definida: se usa la clave de desarrollo 'dev-ml-key'.")

app = FastAPI(
    title="FashionStore ML",
    version="1.0.0",
    description="Predicción de demanda (supervisado) y segmentación de clientes (no supervisado) por empresa.",
)


def verificar_clave(x_ml_key: Annotated[str | None, Header()] = None):
    if not x_ml_key or not secrets.compare_digest(x_ml_key, CLAVE):
        raise HTTPException(status_code=401, detail="Clave del servicio de ML inválida.")


Empresa = Annotated[int, PathParam(gt=0, le=10_000_000, description="id de la empresa (lo pone NestJS)")]


def _archivo(tid: int) -> Path:
    return DIRECTORIO / f"empresa-{tid}.joblib"


def _cargar(tid: int) -> dict:
    ruta = _archivo(tid)
    if not ruta.exists():
        raise HTTPException(status_code=404, detail="La empresa todavía no tiene modelos entrenados.")
    return joblib.load(ruta)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/tenants/{tid}/train", dependencies=[Depends(verificar_clave)])
def entrenar(tid: Empresa, p: PeticionEntrenamiento):
    inicio = time.perf_counter()
    ventas, resumen, inyectadas = generar_ventas(p)

    categorias = sorted({(x.categoria or "Sin categoría") for x in p.productos})
    cod_categoria = {c: i for i, c in enumerate(categorias)}
    productos = pd.DataFrame([
        {"idProducto": x.idProducto, "nombre": x.nombre, "categoriaNombre": x.categoria or "Sin categoría",
         "categoria": float(cod_categoria[x.categoria or "Sin categoría"]), "precio": x.precio}
        for x in p.productos
    ])
    cod_sucursal = {s.idSucursal: i for i, s in enumerate(p.sucursales)}
    nombres_sucursal = {s.idSucursal: s.nombre for s in p.sucursales}
    # 1) Anomalías primero: las semanas atípicas no se usan para entrenar la demanda.
    anom = anomalias.detectar(ventas, nombres_sucursal, inyectadas, p.semilla)
    atipicas = {(date.fromisoformat(a["semana"]), a["idSucursal"]) for a in anom["alertas"]}
    modelo, m_demanda = demanda.entrenar(ventas, productos, cod_sucursal, p.semilla, atipicas)

    clientes = generar_clientes(p.clientesSinteticos, p.semilla, p.clientes)
    seg = segmentos.segmentar(clientes, p.semilla)

    meta = {
        "idEmpresa": tid,
        "entrenadoEn": datetime.now(timezone.utc).isoformat(),
        "hoy": p.hoy.isoformat(),
        "semilla": p.semilla,
        "datos": resumen,
        "sucursales": [{"idSucursal": s.idSucursal, "nombre": s.nombre} for s in p.sucursales],
        "duracionSegundos": round(time.perf_counter() - inicio, 2),
    }
    DIRECTORIO.mkdir(parents=True, exist_ok=True)
    joblib.dump({
        "meta": meta, "modeloDemanda": modelo, "metricasDemanda": m_demanda, "segmentacion": seg, "anomalias": anom,
        "ventas": ventas, "productos": productos, "codSucursal": cod_sucursal,
        "sucursales": nombres_sucursal,
    }, _archivo(tid), compress=3)
    return {"meta": meta, "demanda": m_demanda, "segmentacion": seg["metricas"], "anomalias": anom["metricas"]}


@app.get("/tenants/{tid}/metrics", dependencies=[Depends(verificar_clave)])
def metricas(tid: Empresa):
    m = _cargar(tid)
    return {"meta": m["meta"], "demanda": m["metricasDemanda"], "segmentacion": m["segmentacion"]["metricas"],
            "anomalias": m["anomalias"]["metricas"]}


@app.get("/tenants/{tid}/demand", dependencies=[Depends(verificar_clave)])
def pronostico(
    tid: Empresa,
    semanas: Annotated[int, Query(ge=1, le=12)] = 4,
    idSucursal: Annotated[int | None, Query(gt=0)] = None,
    idProducto: Annotated[int | None, Query(gt=0)] = None,
    top: Annotated[int, Query(ge=1, le=50)] = 10,
    historial: Annotated[int, Query(ge=4, le=52)] = 12,
):
    m = _cargar(tid)
    if idSucursal and idSucursal not in m["codSucursal"]:
        raise HTTPException(status_code=422, detail="Sucursal desconocida para el modelo; vuelve a entrenar.")
    productos = m["productos"]
    if idProducto and idProducto not in set(productos["idProducto"]):
        raise HTTPException(status_code=422, detail="Producto desconocido para el modelo; vuelve a entrenar.")
    hist, pron = demanda.predecir(m["modeloDemanda"], m["ventas"], productos, m["codSucursal"], semanas, idSucursal, idProducto)

    # Totales por semana (historia reciente + pronóstico) para el gráfico.
    h = hist.groupby("semana", as_index=False)["unidades"].sum().tail(historial)
    t = pron.groupby("semana", as_index=False)[["prediccion", "p10", "p90"]].sum()
    serie = [{"semana": s.isoformat(), "historia": round(float(u), 1)} for s, u in zip(h["semana"], h["unidades"])]
    serie += [{"semana": s.isoformat(), "prediccion": round(float(a), 1), "p10": round(float(b), 1), "p90": round(float(c), 1)}
              for s, a, b, c in zip(t["semana"], t["prediccion"], t["p10"], t["p90"])]

    # Productos con más demanda esperada, comparados con sus últimas semanas.
    nombres = productos.set_index("idProducto")
    por_prod = pron.groupby("idProducto")["prediccion"].sum()
    reciente = hist[hist["semana"] > max(hist["semana"]) - pd.Timedelta(weeks=semanas)].groupby("idProducto")["unidades"].sum()
    ranking = []
    for idp, total in por_prod.sort_values(ascending=False).head(top).items():
        antes = float(reciente.get(idp, 0))
        ranking.append({
            "idProducto": int(idp),
            "producto": nombres.at[idp, "nombre"],
            "categoria": nombres.at[idp, "categoriaNombre"],
            "prediccion": round(float(total), 1),
            "ultimasSemanas": round(antes, 1),
            "variacion": round(100 * (float(total) / antes - 1), 1) if antes else None,
        })
    return {
        "semanas": semanas,
        "sucursal": m["sucursales"].get(idSucursal) if idSucursal else None,
        "serie": serie,
        "productos": ranking,
        "nota": "Pronóstico recursivo; la banda p10–p90 muestra la dispersión entre los árboles del modelo.",
    }


@app.get("/tenants/{tid}/segments", dependencies=[Depends(verificar_clave)])
def segmentos_clientes(tid: Empresa):
    return _cargar(tid)["segmentacion"]


@app.get("/tenants/{tid}/anomalies", dependencies=[Depends(verificar_clave)])
def anomalias_ventas(tid: Empresa, idSucursal: Annotated[int | None, Query(gt=0)] = None):
    a = _cargar(tid)["anomalias"]
    if idSucursal is None:
        return a
    return {**a, "alertas": [x for x in a["alertas"] if x["idSucursal"] == idSucursal],
            "serie": [x for x in a["serie"] if x["idSucursal"] == idSucursal]}


@app.delete("/tenants/{tid}", dependencies=[Depends(verificar_clave)], status_code=204)
def borrar(tid: Empresa):
    _archivo(tid).unlink(missing_ok=True)
