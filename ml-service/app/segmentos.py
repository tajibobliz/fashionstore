"""
Segmentación de clientes — aprendizaje NO SUPERVISADO.

No supervisado = no hay una "respuesta correcta"; el algoritmo descubre grupos parecidos.
Cada cliente se describe con RFM:
- Recencia: días desde su última compra (menos = mejor),
- Frecuencia: cuántas compras hizo,
- Monto: cuánto gastó en total.

Pasos:
1. Escalado: logaritmo a frecuencia y monto (pocos clientes gastan muchísimo) y
   StandardScaler para que las tres variables pesen igual.
2. K-Means con k = 2…6 grupos; se elige el k con mejor coeficiente *silhouette*
   (de −1 a 1: qué tan separado está cada cliente de los otros grupos frente al suyo).
3. Cada grupo recibe un nombre de negocio según su centro (p. ej. "Campeones") y una
   acción sugerida para marketing.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

ACCIONES = {
    "Campeones": "Premiarlos: acceso anticipado a colecciones y beneficios exclusivos.",
    "Leales": "Mantener el vínculo: puntos o descuentos por volver a comprar.",
    "Nuevos": "Darles la bienvenida: cupón para la segunda compra.",
    "En riesgo": "Recuperarlos ya: ofertas personalizadas con lo que compraban.",
    "Dormidos": "Campaña de reactivación de bajo costo o dejarlos fuera de campañas caras.",
    "Ocasionales": "Mostrarles novedades y promociones por temporada.",
}


def _matriz(df: pd.DataFrame) -> np.ndarray:
    return np.column_stack([df["recenciaDias"], np.log1p(df["frecuencia"]), np.log1p(df["monto"])])


def _nombrar(centros: pd.DataFrame) -> list[str]:
    """Nombre por posición del centro respecto del promedio (z) en recencia, frecuencia y monto."""
    z = (centros - centros.mean()) / centros.std(ddof=0).replace(0, 1)
    nombres = []
    for _, c in z.iterrows():
        valor = (c["frecuencia"] + c["monto"]) / 2
        if c["recenciaDias"] < 0 and valor > 0.6:
            n = "Campeones"
        elif c["recenciaDias"] < 0 and valor > -0.2:
            n = "Leales"
        elif c["recenciaDias"] < 0:
            n = "Nuevos"
        elif valor > 0:
            n = "En riesgo"
        elif c["recenciaDias"] > 0.8:
            n = "Dormidos"
        else:
            n = "Ocasionales"
        nombres.append(n)
    # Si dos grupos caen en la misma categoría, se numeran para distinguirlos.
    vistos: dict[str, int] = {}
    salida = []
    for n in nombres:
        vistos[n] = vistos.get(n, 0) + 1
        salida.append(n if nombres.count(n) == 1 else f"{n} {vistos[n]}")
    return salida


def segmentar(clientes: pd.DataFrame, semilla: int):
    escalador = StandardScaler().fit(_matriz(clientes))
    X = escalador.transform(_matriz(clientes))
    pruebas = []
    mejor = None
    for k in range(2, 7):
        km = KMeans(n_clusters=k, n_init=10, random_state=semilla).fit(X)
        muestra = min(len(X), 2000)
        s = float(silhouette_score(X, km.labels_, sample_size=muestra, random_state=semilla))
        pruebas.append({"k": k, "silhouette": round(s, 3), "inercia": round(float(km.inertia_), 1)})
        if mejor is None or s > mejor[1]:
            mejor = (km, s)
    km, sil = mejor
    df = clientes.assign(grupo=km.labels_)
    centros = df.groupby("grupo")[["recenciaDias", "frecuencia", "monto"]].mean()
    nombres = dict(zip(centros.index, _nombrar(centros)))
    df["segmento"] = df["grupo"].map(nombres)

    segmentos = []
    for g, c in centros.iterrows():
        nombre = nombres[g]
        miembros = df[df["grupo"] == g]
        segmentos.append({
            "nombre": nombre,
            "clientes": int(len(miembros)),
            "clientesReales": int(miembros["real"].sum()),
            "porcentaje": round(100 * len(miembros) / len(df), 1),
            "recenciaMedia": round(float(c["recenciaDias"]), 1),
            "frecuenciaMedia": round(float(c["frecuencia"]), 1),
            "montoMedio": round(float(c["monto"]), 2),
            "accion": ACCIONES[nombre.rsplit(" ", 1)[0] if nombre[-1].isdigit() else nombre],
        })
    segmentos.sort(key=lambda s: -s["montoMedio"])

    rng = np.random.default_rng(semilla)
    idx = rng.choice(len(df), size=min(len(df), 300), replace=False)
    puntos = [
        {"recenciaDias": round(float(r.recenciaDias), 1), "frecuencia": float(r.frecuencia),
         "monto": round(float(r.monto), 2), "segmento": r.segmento, "real": bool(r.real)}
        for r in df.iloc[np.sort(idx)].itertuples()
    ]
    reales = [
        {"idCliente": int(r.idCliente), "nombre": r.nombre, "segmento": r.segmento,
         "recenciaDias": round(float(r.recenciaDias), 1), "frecuencia": float(r.frecuencia), "monto": round(float(r.monto), 2)}
        for r in df[df["real"]].sort_values("monto", ascending=False).itertuples()
    ]
    metricas = {
        "algoritmo": "K-Means sobre RFM (recencia, log frecuencia, log monto, escalados)",
        "k": int(km.n_clusters),
        "silhouette": round(sil, 3),
        "pruebasK": pruebas,
        "clientes": int(len(df)),
        "clientesReales": int(df["real"].sum()),
    }
    return {"metricas": metricas, "segmentos": segmentos, "puntos": puntos, "clientesReales": reales}
