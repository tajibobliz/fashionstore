# ml-service — Analítica con ML (FashionStore SaaS, Fase 3 · tarea 3.3)

Microservicio en **Python + FastAPI** con dos modelos por empresa:

| Modelo | Tipo | Qué hace | Métricas |
|---|---|---|---|
| `RandomForestRegressor` | **Supervisado** | Predice las unidades vendidas por semana, producto y sucursal | MAE, RMSE, R² sobre las últimas 12 semanas (no vistas) y comparación con una línea base ingenua |
| `K-Means` sobre RFM | **No supervisado** | Agrupa clientes por recencia, frecuencia y monto | Silhouette (se prueba k = 2…6 y se elige el mejor) |

Como una tienda nueva tiene poca historia, `app/sintetico.py` genera **datos sintéticos** a partir del
catálogo real (precios, categorías, sucursales) con estacionalidad de Bolivia (invierno, verano,
Carnaval, Día de la Madre, Black Friday, Navidad). Las ventas y clientes **reales** que envía el
backend reemplazan o se suman a los simulados.

El navegador nunca llama a este servicio: lo llama **NestJS** (`/ml/*`) con la cabecera `X-ML-Key`
y el id de la empresa sacado del JWT. Cada empresa tiene su archivo `modelos/empresa-<id>.joblib`.

## Instalar y ejecutar (Windows, PowerShell)

```powershell
cd ml-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # si da error de permisos: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements-dev.txt
uvicorn app.main:app --port 8001 --reload
```

- Documentación interactiva: http://localhost:8001/docs
- Pruebas: `python -m pytest -q`

## Variables de entorno

| Variable | Por defecto | Uso |
|---|---|---|
| `ML_API_KEY` | `dev-ml-key` | Clave compartida con el backend (`ML_API_KEY` en `backend/.env`). Cámbiala en producción. |
| `ML_MODELOS_DIR` | `ml-service/modelos` | Carpeta donde se guardan los modelos entrenados. |

En `backend/.env`: `ML_SERVICE_URL=http://localhost:8001` y la misma `ML_API_KEY`.

## Endpoints (todos con `X-ML-Key`, salvo `/health`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado |
| POST | `/tenants/{id}/train` | Genera datos sintéticos + reales y entrena ambos modelos |
| GET | `/tenants/{id}/metrics` | Métricas, importancia de variables y resumen de datos |
| GET | `/tenants/{id}/demand?semanas=4&idSucursal=&idProducto=&top=10` | Pronóstico recursivo con banda p10–p90 |
| GET | `/tenants/{id}/segments` | Segmentos con nombre, tamaño, centro RFM, acción sugerida y clientas reales |
| DELETE | `/tenants/{id}` | Borra los modelos de la empresa |
