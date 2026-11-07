"""
Predicción de demanda semanal por producto y sucursal — aprendizaje SUPERVISADO.

Supervisado = el modelo aprende de ejemplos con la respuesta conocida: para cada semana pasada
sabemos cuántas unidades se vendieron (la "etiqueta") y qué pasaba antes (las "características").

Características de cada fila (producto × sucursal × semana):
- ventas de 1, 2 y 4 semanas antes y promedios de las últimas 4 y 12 (memoria reciente),
- calendario: semana del año en forma circular (seno/coseno, para que la semana 52 quede
  cerca de la 1), mes y fechas especiales (Navidad, Día de la Madre, Black Friday...),
- precio, categoría y sucursal (codificadas como números).

Modelo: RandomForestRegressor (muchos árboles de decisión; cada uno vota y se promedia).
Evaluación honesta: se entrena con el pasado y se mide en las ÚLTIMAS 12 semanas, que el
modelo no vio (división temporal, no aleatoria). Se compara con una línea base ingenua
("se venderá lo mismo que la semana pasada") para mostrar que el modelo aporta.
"""
from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from .sintetico import factores_calendario

SEMANAS_PRUEBA = 12
LAGS = (1, 2, 4)
FESTIVOS = ("navidad", "madre", "blackfriday", "carnaval", "clases")
CARACTERISTICAS = [
    *(f"lag{k}" for k in LAGS), "media4", "media12",
    "sem_sin", "sem_cos", "mes", *FESTIVOS,
    "precio", "categoria", "sucursal",
]


def _calendario(semana: date) -> dict[str, float]:
    s = semana.isocalendar()[1]
    return {
        "sem_sin": float(np.sin(2 * np.pi * s / 52)),
        "sem_cos": float(np.cos(2 * np.pi * s / 52)),
        "mes": float(semana.month),
        **factores_calendario(semana),
    }


def construir_dataset(ventas: pd.DataFrame, productos: pd.DataFrame, cod_sucursal: dict[int, int]) -> pd.DataFrame:
    """Agrega las características a cada fila; quita las primeras 12 semanas (sin historia suficiente)."""
    df = ventas.sort_values(["idProducto", "idSucursal", "semana"]).copy()
    g = df.groupby(["idProducto", "idSucursal"])["unidades"]
    for k in LAGS:
        df[f"lag{k}"] = g.shift(k)
    df["media4"] = g.transform(lambda s: s.shift(1).rolling(4).mean())
    df["media12"] = g.transform(lambda s: s.shift(1).rolling(12).mean())
    cal = pd.DataFrame([_calendario(s) for s in df["semana"]], index=df.index)
    df = pd.concat([df, cal], axis=1)
    df = df.merge(productos[["idProducto", "precio", "categoria"]], on="idProducto", how="left")
    df["sucursal"] = df["idSucursal"].map(cod_sucursal).astype(float)
    return df.dropna(subset=["media12"]).reset_index(drop=True)


def _metricas(real: np.ndarray, pred: np.ndarray) -> dict[str, float]:
    return {
        "mae": round(float(mean_absolute_error(real, pred)), 3),
        "rmse": round(float(np.sqrt(mean_squared_error(real, pred))), 3),
        "r2": round(float(r2_score(real, pred)), 3),
    }


def entrenar(ventas: pd.DataFrame, productos: pd.DataFrame, cod_sucursal: dict[int, int], semilla: int):
    """Evalúa con las últimas 12 semanas y luego reentrena con todo. Devuelve (modelo, métricas)."""
    data = construir_dataset(ventas, productos, cod_sucursal)
    corte = sorted(data["semana"].unique())[-SEMANAS_PRUEBA]
    train, test = data[data["semana"] < corte], data[data["semana"] >= corte]

    def nuevo():
        return RandomForestRegressor(n_estimators=150, max_depth=14, min_samples_leaf=3, n_jobs=-1, random_state=semilla)

    modelo = nuevo().fit(train[CARACTERISTICAS], train["unidades"])
    pred = np.clip(modelo.predict(test[CARACTERISTICAS]), 0, None)
    m_modelo = _metricas(test["unidades"].to_numpy(), pred)
    m_base = _metricas(test["unidades"].to_numpy(), test["lag1"].to_numpy())
    mejora = round(100 * (1 - m_modelo["mae"] / m_base["mae"]), 1) if m_base["mae"] else 0.0

    final = nuevo().fit(data[CARACTERISTICAS], data["unidades"])
    importancia = sorted(
        ({"caracteristica": c, "importancia": round(float(v), 4)} for c, v in zip(CARACTERISTICAS, final.feature_importances_)),
        key=lambda x: -x["importancia"],
    )
    metricas = {
        "algoritmo": "RandomForestRegressor (150 árboles)",
        "objetivo": "unidades vendidas por semana, producto y sucursal",
        "filasEntrenamiento": int(len(train)),
        "filasPrueba": int(len(test)),
        "semanasPrueba": SEMANAS_PRUEBA,
        "pruebaDesde": pd.Timestamp(corte).date().isoformat(),
        "modelo": m_modelo,
        "lineaBase": {**m_base, "descripcion": "repetir las ventas de la semana anterior"},
        "mejoraMaeVsBase": mejora,
        "importancia": importancia,
    }
    return final, metricas


def predecir(modelo: RandomForestRegressor, ventas: pd.DataFrame, productos: pd.DataFrame,
             cod_sucursal: dict[int, int], semanas: int, filtro_sucursal: int | None, filtro_producto: int | None):
    """
    Pronóstico RECURSIVO: predice la semana 1, la agrega a la historia y con eso predice la 2...
    El intervalo (p10–p90) sale de la dispersión entre los árboles del bosque.
    """
    hist = ventas.copy()
    if filtro_sucursal:
        hist = hist[hist["idSucursal"] == filtro_sucursal]
    if filtro_producto:
        hist = hist[hist["idProducto"] == filtro_producto]
    prods = productos.set_index("idProducto")
    ultima = max(hist["semana"])
    futuras = [ultima + timedelta(weeks=i) for i in range(1, semanas + 1)]
    series = {k: list(g.sort_values("semana")["unidades"]) for k, g in hist.groupby(["idProducto", "idSucursal"])}

    filas = []
    for sem in futuras:
        cal = _calendario(sem)
        claves, X = [], []
        for (idp, ids), s in series.items():
            X.append([
                *(s[-k] for k in LAGS), float(np.mean(s[-4:])), float(np.mean(s[-12:])),
                cal["sem_sin"], cal["sem_cos"], cal["mes"], *(cal[f] for f in FESTIVOS),
                float(prods.at[idp, "precio"]), float(prods.at[idp, "categoria"]), float(cod_sucursal[ids]),
            ])
            claves.append((idp, ids))
        X = pd.DataFrame(X, columns=CARACTERISTICAS)
        por_arbol = np.stack([t.predict(X.to_numpy()) for t in modelo.estimators_])
        media = np.clip(por_arbol.mean(axis=0), 0, None)
        p10 = np.clip(np.percentile(por_arbol, 10, axis=0), 0, None)
        p90 = np.clip(np.percentile(por_arbol, 90, axis=0), 0, None)
        for i, (idp, ids) in enumerate(claves):
            series[(idp, ids)].append(float(media[i]))
            filas.append((sem, idp, ids, float(media[i]), float(p10[i]), float(p90[i])))
    pron = pd.DataFrame(filas, columns=["semana", "idProducto", "idSucursal", "prediccion", "p10", "p90"])
    return hist, pron
