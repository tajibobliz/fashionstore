"""
Detección de anomalías en las ventas semanales por sucursal — NO SUPERVISADO.

IsolationForest construye árboles que cortan los datos al azar: un punto "raro" queda
aislado con muy pocos cortes, uno normal necesita muchos. Así detecta semanas atípicas
sin que nadie le diga antes cuáles lo son.

Para cada sucursal y semana se compara lo vendido con una LÍNEA BASE LOCAL: la mediana de las
4 semanas anteriores y las 4 siguientes (sin contar esa semana). Las características son:
- log(vendido / línea base): cuánto se aleja, en escala simétrica (×2 y ÷2 pesan igual),
- la misma razón estandarizada dentro de la sucursal (z),
- si la semana es festiva (Navidad, Día de la Madre...).
Un pico en una semana festiva se marca como "esperado por temporada" y no se cuenta como
anomalía. Como los datos sintéticos traen anomalías simuladas conocidas, se puede medir
precisión y exhaustividad (recall) del detector.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from .sintetico import factores_calendario

CONTAMINACION = 0.04  # se espera ~4 % de semanas atípicas
VENTANA = 4


def detectar(ventas: pd.DataFrame, sucursales: dict[int, str], inyectadas: list[dict], semilla: int):
    semanal = ventas.groupby(["idSucursal", "semana"], as_index=False)["unidades"].sum().sort_values(["idSucursal", "semana"])

    def base_local(s: pd.Series) -> pd.Series:
        vals = s.to_numpy(dtype=float)
        out = np.empty_like(vals)
        for i in range(len(vals)):
            vecinos = np.r_[vals[max(0, i - VENTANA):i], vals[i + 1:i + 1 + VENTANA]]
            out[i] = np.median(vecinos) if len(vecinos) else vals[i]
        return pd.Series(out, index=s.index)

    semanal["esperado"] = semanal.groupby("idSucursal")["unidades"].transform(base_local)
    semanal["log_razon"] = np.log((semanal["unidades"] + 1) / (semanal["esperado"] + 1))
    semanal["z"] = semanal.groupby("idSucursal")["log_razon"].transform(lambda x: (x - x.mean()) / (x.std(ddof=0) or 1))
    semanal["festivo"] = [float(any(factores_calendario(s).values())) for s in semanal["semana"]]

    X = semanal[["log_razon", "z", "festivo"]].to_numpy()
    modelo = IsolationForest(n_estimators=200, contamination=CONTAMINACION, random_state=semilla).fit(X)
    semanal["anomala"] = modelo.predict(X) == -1
    semanal["puntaje"] = -modelo.score_samples(X)  # más alto = más raro
    semanal["estacional"] = semanal["anomala"] & (semanal["festivo"] == 1) & (semanal["log_razon"] > 0)
    semanal["alerta"] = semanal["anomala"] & ~semanal["estacional"]

    # Evaluación contra las anomalías simuladas (solo semanas no festivas).
    reales = {(a["semana"], a["idSucursal"]) for a in inyectadas}
    detectadas = set(zip(semanal.loc[semanal["alerta"], "semana"], semanal.loc[semanal["alerta"], "idSucursal"]))
    acierto = len(reales & detectadas)
    metricas = {
        "algoritmo": "IsolationForest (200 árboles) sobre la desviación de cada semana frente a su línea base local",
        "contaminacion": CONTAMINACION,
        "semanasAnalizadas": int(len(semanal)),
        "alertas": int(semanal["alerta"].sum()),
        "picosEstacionales": int(semanal["estacional"].sum()),
        "anomaliasSimuladas": len(reales),
        "precision": round(acierto / len(detectadas), 3) if detectadas else None,
        "recall": round(acierto / len(reales), 3) if reales else None,
    }

    def fila(r) -> dict:
        desv = (r.unidades / r.esperado - 1) * 100 if r.esperado else None
        return {
            "semana": r.semana.isoformat(),
            "idSucursal": int(r.idSucursal),
            "sucursal": sucursales.get(int(r.idSucursal), str(r.idSucursal)),
            "unidades": round(float(r.unidades), 1),
            "esperado": round(float(r.esperado), 1),
            "desviacion": round(float(desv), 1) if desv is not None else None,
            "tipo": "pico" if r.log_razon > 0 else "caida",
            "puntaje": round(float(r.puntaje), 3),
        }

    alertas = [fila(r) for r in semanal[semanal["alerta"]].sort_values("puntaje", ascending=False).itertuples()]
    serie = [
        {"semana": r.semana.isoformat(), "idSucursal": int(r.idSucursal), "unidades": round(float(r.unidades), 1),
         "esperado": round(float(r.esperado), 1), "alerta": bool(r.alerta), "estacional": bool(r.estacional)}
        for r in semanal.itertuples()
    ]
    return {"metricas": metricas, "alertas": alertas, "serie": serie}
