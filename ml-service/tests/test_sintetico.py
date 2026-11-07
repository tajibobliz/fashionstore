from datetime import date

from app.schemas import PeticionEntrenamiento
from app.sintetico import generar_clientes, generar_ventas, lunes
from conftest import peticion


def test_misma_semilla_mismos_datos_y_otra_semilla_cambia():
    a, _, _ = generar_ventas(PeticionEntrenamiento(**peticion()))
    b, _, _ = generar_ventas(PeticionEntrenamiento(**peticion()))
    c, _, _ = generar_ventas(PeticionEntrenamiento(**peticion(semilla=7)))
    assert a.equals(b)
    assert not a["unidades"].equals(c["unidades"])


def test_semanas_completas_antes_de_hoy_y_sin_negativos():
    df, r, _ = generar_ventas(PeticionEntrenamiento(**peticion(semanasHistoria=52)))
    assert r["semanas"] == 52 and r["series"] == 8 and len(df) == 52 * 8
    assert all(s.weekday() == 0 for s in df["semana"])
    assert max(df["semana"]) < lunes(date(2026, 11, 6))
    assert (df["unidades"] >= 0).all()


def test_estacionalidad_botas_en_invierno_y_poleras_en_verano():
    df, _, _ = generar_ventas(PeticionEntrenamiento(**peticion()))
    df["mes"] = df["semana"].map(lambda s: s.month)
    medias = df.groupby(["idProducto", "mes"])["unidades"].mean()
    assert medias[1, 7] > medias[1, 3] * 1.25   # botas: julio > marzo
    assert medias[2, 1] > medias[2, 7] * 1.2    # poleras: enero > julio


def test_las_ventas_reales_reemplazan_a_las_simuladas():
    real = [{"semana": "2026-10-28", "idProducto": 1, "idSucursal": 3, "unidades": 999}]  # miércoles → semana del lunes 26
    df, r, _ = generar_ventas(PeticionEntrenamiento(**peticion(ventasSemanales=real)))
    fila = df[(df["semana"] == date(2026, 10, 26)) & (df["idProducto"] == 1) & (df["idSucursal"] == 3)]
    assert fila["unidades"].item() == 999 and fila["real"].item()
    assert r["filasReales"] == 1


def test_clientes_sinteticos_y_reales():
    reales = PeticionEntrenamiento(**peticion(clientes=[{"idCliente": 5, "nombre": "Ana", "recenciaDias": 3, "frecuencia": 9, "monto": 2000}])).clientes
    df = generar_clientes(200, 42, reales)
    assert len(df) == 201 and df["real"].sum() == 1
    assert (df["frecuencia"] >= 1).all() and (df["recenciaDias"] >= 0).all()


def test_anomalias_simuladas_fuera_de_festivos_y_de_la_prueba():
    from app.sintetico import factores_calendario
    df, r, iny = generar_ventas(PeticionEntrenamiento(**peticion()))
    assert r["anomaliasInyectadas"] == len(iny) == 3 * 2
    ultimas = sorted(df["semana"].unique())[-12:]
    for a in iny:
        assert a["tipo"] in ("pico", "caida")
        assert not any(factores_calendario(a["semana"]).values())
        assert a["semana"] not in ultimas
