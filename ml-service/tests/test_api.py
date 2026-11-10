from conftest import H, peticion


def test_sin_clave_o_clave_incorrecta_401(cliente):
    assert cliente.post("/tenants/1/train", json=peticion()).status_code == 401
    assert cliente.get("/tenants/1/metrics", headers={"X-ML-Key": "otra"}).status_code == 401


def test_validacion_de_entrada(cliente):
    assert cliente.post("/tenants/1/train", json={**peticion(), "productos": []}, headers=H).status_code == 422
    assert cliente.post("/tenants/0/train", json=peticion(), headers=H).status_code == 422
    malo = peticion()
    malo["productos"] = [{**malo["productos"][0], "precio": -5}]
    assert cliente.post("/tenants/1/train", json=malo, headers=H).status_code == 422


def test_entrena_evalua_y_supera_la_linea_base(cliente):
    r = cliente.post("/tenants/1/train", json=peticion(), headers=H)
    assert r.status_code == 200
    d = r.json()["demanda"]
    assert d["filasPrueba"] > 0 and d["semanasPrueba"] == 12
    # El R² depende de cuánto varían las ventas en las semanas de prueba; lo importante es que
    # el modelo se equivoque menos que la línea base ingenua.
    assert d["modelo"]["mae"] < d["lineaBase"]["mae"]
    assert d["modelo"]["r2"] > d["lineaBase"]["r2"]
    assert d["filasAtipicasExcluidas"] > 0  # se limpiaron las semanas atípicas antes de entrenar
    assert d["mejoraMaeVsBase"] > 0
    assert {x["caracteristica"] for x in d["importancia"]} >= {"lag1", "media4", "navidad"}
    s = r.json()["segmentacion"]
    assert 2 <= s["k"] <= 6 and s["silhouette"] > 0.25


def test_pronostico_con_banda_y_filtros(cliente):
    cliente.post("/tenants/1/train", json=peticion(), headers=H)
    r = cliente.get("/tenants/1/demand?semanas=6&top=3", headers=H).json()
    futuras = [x for x in r["serie"] if "prediccion" in x]
    assert len(futuras) == 6 and len(r["productos"]) == 3
    assert all(x["p10"] <= x["prediccion"] <= x["p90"] for x in futuras)
    solo = cliente.get("/tenants/1/demand?semanas=2&idSucursal=3&idProducto=1", headers=H).json()
    assert solo["sucursal"] == "Centro" and [p["idProducto"] for p in solo["productos"]] == [1]
    assert cliente.get("/tenants/1/demand?idSucursal=99", headers=H).status_code == 422
    assert cliente.get("/tenants/1/demand?semanas=40", headers=H).status_code == 422


def test_cada_empresa_tiene_su_propio_modelo(cliente):
    cliente.post("/tenants/1/train", json=peticion(), headers=H)
    otra = peticion(productos=[{"idProducto": 50, "nombre": "Vestido Gala", "categoria": "Vestidos", "precio": 900}])
    cliente.post("/tenants/2/train", json=otra, headers=H)
    p1 = {p["idProducto"] for p in cliente.get("/tenants/1/demand", headers=H).json()["productos"]}
    p2 = {p["idProducto"] for p in cliente.get("/tenants/2/demand", headers=H).json()["productos"]}
    assert p1 == {1, 2, 3, 4} and p2 == {50}
    assert cliente.get("/tenants/3/metrics", headers=H).status_code == 404
    assert cliente.delete("/tenants/2", headers=H).status_code == 204
    assert cliente.get("/tenants/2/metrics", headers=H).status_code == 404


def test_segmentos_con_nombre_accion_y_clientes_reales(cliente):
    clientes = [
        {"idCliente": 1, "nombre": "Fiel", "recenciaDias": 4, "frecuencia": 20, "monto": 9000},
        {"idCliente": 2, "nombre": "Perdida", "recenciaDias": 500, "frecuencia": 1, "monto": 90},
    ]
    cliente.post("/tenants/1/train", json=peticion(clientes=clientes), headers=H)
    s = cliente.get("/tenants/1/segments", headers=H).json()
    assert sum(x["clientes"] for x in s["segmentos"]) == s["metricas"]["clientes"] == 402
    assert all(x["accion"] for x in s["segmentos"])
    seg = {c["nombre"]: c["segmento"] for c in s["clientesReales"]}
    assert seg["Fiel"] != seg["Perdida"]
    assert seg["Fiel"].startswith(("Campeones", "Leales"))
    assert len(s["puntos"]) == 300


def test_anomalias_detecta_las_simuladas_y_filtra_por_sucursal(cliente):
    r = cliente.post("/tenants/1/train", json=peticion(), headers=H).json()
    m = r["anomalias"]
    assert m["anomaliasSimuladas"] == 6
    assert m["recall"] >= 0.66 and m["precision"] >= 0.5
    a = cliente.get("/tenants/1/anomalies", headers=H).json()
    assert len(a["alertas"]) == m["alertas"]
    assert all(x["tipo"] in ("pico", "caida") and x["esperado"] > 0 for x in a["alertas"])
    centro = cliente.get("/tenants/1/anomalies?idSucursal=3", headers=H).json()
    assert {x["idSucursal"] for x in centro["serie"]} == {3}
    assert all(x["sucursal"] == "Centro" for x in centro["alertas"])
    assert r["meta"]["sucursales"] == [{"idSucursal": 3, "nombre": "Centro"}, {"idSucursal": 4, "nombre": "Norte"}]
