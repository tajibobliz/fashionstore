"""
Generador de datos SINTÉTICOS (Fase 3, tarea 3.3).

Una tienda nueva tiene pocas ventas reales; para entrenar y evaluar modelos hace falta
historia. Aquí se "simula" la historia a partir del catálogo REAL de la empresa
(productos, categorías, precios y sucursales) con patrones de negocio de moda en Bolivia:

- precio: lo barato rota más que lo caro;
- popularidad distinta por producto y tamaño distinto por sucursal;
- tendencia (crecimiento o caída lenta);
- estacionalidad: invierno (jun–ago) para abrigos y botas, verano (nov–feb) para poleras y
  vestidos, Carnaval (feb), Día de la Madre (27 de mayo), Black Friday (fin de noviembre),
  Navidad (diciembre) y vuelta a clases (feb) para mochilas;
- ruido de Poisson (las ventas son conteos enteros).

Con la misma semilla genera siempre los mismos datos (reproducible).
Las ventas REALES que existan reemplazan a las simuladas en esas semanas.
"""
from __future__ import annotations

import unicodedata
from datetime import date, timedelta

import numpy as np
import pandas as pd

from .schemas import ClienteRfm, PeticionEntrenamiento

INVIERNO = ("abrigo", "chompa", "bota", "buzo", "chaqueta", "casaca", "parka", "sueter", "bufanda", "polar")
VERANO = ("polera", "short", "vestido", "sandalia", "falda", "bikini", "top", "blusa", "dry-fit")
ESCOLAR = ("mochila", "zapatilla")


def _norm(s: str | None) -> str:
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()


def lunes(d: date) -> date:
    return d - timedelta(days=d.weekday())


def semanas_hasta(hoy: date, n: int) -> list[date]:
    """Las `n` semanas completas anteriores a la semana de `hoy` (cada una empieza en lunes)."""
    actual = lunes(hoy)
    return [actual - timedelta(weeks=i) for i in range(n, 0, -1)]


def factores_calendario(semana: date) -> dict[str, float]:
    """Indicadores de fechas especiales para una semana (lunes a domingo)."""
    dias = [semana + timedelta(days=i) for i in range(7)]
    meses = {d.month for d in dias}
    return {
        "navidad": float(any(d.month == 12 and 8 <= d.day <= 24 for d in dias)),
        "madre": float(any(d.month == 5 and 20 <= d.day <= 27 for d in dias)),
        "blackfriday": float(any(d.month == 11 and d.day >= 22 for d in dias)),
        "carnaval": float(2 in meses and any(d.day <= 20 for d in dias if d.month == 2)),
        "clases": float(any((d.month == 1 and d.day >= 20) or (d.month == 2 and d.day <= 10) for d in dias)),
    }


def estacionalidad(categoria: str, nombre: str, semana: date) -> float:
    texto = _norm(f"{categoria} {nombre}")
    s = semana.isocalendar()[1]
    f = 1.0
    if any(k in texto for k in INVIERNO):
        f *= 1.0 + 0.8 * np.exp(-((s - 29) ** 2) / (2 * 4.5**2))  # pico a mediados de julio
    if any(k in texto for k in VERANO):
        dist = min(abs(s - 1), 52 - abs(s - 1))  # pico en enero (verano en Bolivia)
        f *= 1.0 + 0.6 * np.exp(-(dist**2) / (2 * 6**2))
    c = factores_calendario(semana)
    f *= 1 + 0.8 * c["navidad"] + 0.5 * c["madre"] + 0.4 * c["blackfriday"] + 0.15 * c["carnaval"]
    if any(k in texto for k in ESCOLAR):
        f *= 1 + 0.6 * c["clases"]
    return float(f)


def generar_ventas(p: PeticionEntrenamiento) -> tuple[pd.DataFrame, dict, list[dict]]:
    """DataFrame semanal (semana, idProducto, idSucursal, unidades, real), resumen y anomalías simuladas."""
    rng = np.random.default_rng(p.semilla)
    semanas = semanas_hasta(p.hoy, p.semanasHistoria)
    tam_sucursal = {s.idSucursal: rng.uniform(0.6, 1.4) for s in p.sucursales}
    filas = []
    for prod in p.productos:
        popularidad = rng.lognormal(0, 0.45)
        base = float(np.clip(28 / (prod.precio / 100) ** 0.6, 1.0, 40.0)) * popularidad
        tendencia = rng.uniform(-0.10, 0.30) / 52
        for suc in p.sucursales:
            for t, sem in enumerate(semanas):
                lam = base * tam_sucursal[suc.idSucursal] * (1 + tendencia * t) * estacionalidad(prod.categoria or "", prod.nombre, sem)
                filas.append((sem, prod.idProducto, suc.idSucursal, float(rng.poisson(max(lam, 0.05)))))
    df = pd.DataFrame(filas, columns=["semana", "idProducto", "idSucursal", "unidades"])
    df["real"] = False
    df, inyectadas = inyectar_anomalias(df, semanas, [s.idSucursal for s in p.sucursales], rng)

    reales = 0
    if p.ventasSemanales:
        r = pd.DataFrame([v.model_dump() for v in p.ventasSemanales])
        r["semana"] = r["semana"].map(lunes)
        r = r.groupby(["semana", "idProducto", "idSucursal"], as_index=False)["unidades"].sum()
        validos = set(df["idProducto"]), set(df["idSucursal"])
        r = r[r["idProducto"].isin(validos[0]) & r["idSucursal"].isin(validos[1]) & r["semana"].isin(set(semanas))]
        if len(r):
            df = df.merge(r, on=["semana", "idProducto", "idSucursal"], how="left", suffixes=("", "_real"))
            mask = df["unidades_real"].notna()
            df.loc[mask, "unidades"] = df.loc[mask, "unidades_real"]
            df.loc[mask, "real"] = True
            df = df.drop(columns="unidades_real")
            reales = int(mask.sum())
            # Una anomalía simulada deja de contar si esa semana tiene datos reales.
            con_reales = set(zip(df.loc[mask, "semana"], df.loc[mask, "idSucursal"]))
            inyectadas = [a for a in inyectadas if (a["semana"], a["idSucursal"]) not in con_reales]
    resumen = {
        "semanas": len(semanas),
        "desde": semanas[0].isoformat(),
        "hasta": (semanas[-1] + timedelta(days=6)).isoformat(),
        "series": len(p.productos) * len(p.sucursales),
        "filas": int(len(df)),
        "filasReales": reales,
        "filasSinteticas": int(len(df) - reales),
        "unidadesTotales": int(df["unidades"].sum()),
        "semanasConDatosReales": int(df.loc[df["real"], "semana"].nunique()),
        "anomaliasInyectadas": len(inyectadas),
    }
    return df, resumen, inyectadas


def inyectar_anomalias(df: pd.DataFrame, semanas: list[date], sucursales: list[int], rng: np.random.Generator, por_sucursal: int = 3):
    """
    Simula semanas atípicas (para poder EVALUAR el detector de anomalías): en algunas
    semanas una sucursal vende 2,2–3 veces lo normal (pico) o solo el 15–35 % (caída: cierre,
    corte de luz, error de carga...). Se evitan las fechas festivas, donde un pico es esperado,
    y las últimas 12 semanas (son las de prueba del modelo de demanda).
    """
    candidatas = [s for s in semanas[8:-12] if not any(factores_calendario(s).values())]
    inyectadas = []
    for ids in sucursales:
        for sem in rng.choice(len(candidatas), size=min(por_sucursal, len(candidatas)), replace=False):
            semana = candidatas[int(sem)]
            pico = bool(rng.random() < 0.5)
            factor = rng.uniform(2.2, 3.0) if pico else rng.uniform(0.15, 0.35)
            m = (df["semana"] == semana) & (df["idSucursal"] == ids)
            df.loc[m, "unidades"] = np.round(df.loc[m, "unidades"] * factor)
            inyectadas.append({"semana": semana, "idSucursal": ids, "tipo": "pico" if pico else "caida"})
    return df, inyectadas


# ----------------------------------------------------------------------------- clientes

# Perfiles de clientes simulados: (peso, recencia media en días, compras medias, ticket medio Bs)
PERFILES = [
    (0.12, 12, 14, 380),  # compran seguido y gastan mucho
    (0.25, 30, 6, 260),   # habituales
    (0.20, 20, 1.5, 220), # recién llegados
    (0.18, 150, 5, 240),  # antes compraban, ahora no
    (0.25, 260, 1.4, 150),  # compraron una vez hace mucho
]


def generar_clientes(n: int, semilla: int, reales: list[ClienteRfm]) -> pd.DataFrame:
    rng = np.random.default_rng(semilla + 7)
    pesos = np.array([p[0] for p in PERFILES])
    tipo = rng.choice(len(PERFILES), size=n, p=pesos / pesos.sum())
    filas = []
    for i, k in enumerate(tipo):
        _, rec, freq, ticket = PERFILES[k]
        f = max(1, int(round(rng.gamma(2.0, freq / 2.0))))
        filas.append({
            "idCliente": -(i + 1),
            "nombre": "",
            "recenciaDias": float(np.clip(rng.gamma(2.0, rec / 2.0), 0, 730)),
            "frecuencia": float(f),
            "monto": float(round(f * rng.lognormal(np.log(ticket), 0.35), 2)),
            "real": False,
        })
    filas += [{**c.model_dump(), "real": True} for c in reales]
    return pd.DataFrame(filas)
