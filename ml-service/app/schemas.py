"""Contratos de entrada y salida (Pydantic valida tipos y rangos antes de tocar los modelos)."""
from datetime import date

from pydantic import BaseModel, Field


class Producto(BaseModel):
    idProducto: int = Field(gt=0)
    nombre: str = Field(min_length=1, max_length=200)
    categoria: str | None = Field(default=None, max_length=100)
    precio: float = Field(gt=0)


class Sucursal(BaseModel):
    idSucursal: int = Field(gt=0)
    nombre: str = Field(min_length=1, max_length=150)


class VentaSemanal(BaseModel):
    """Unidades vendidas de un producto en una sucursal durante una semana (lunes)."""
    semana: date
    idProducto: int = Field(gt=0)
    idSucursal: int = Field(gt=0)
    unidades: float = Field(ge=0)


class ClienteRfm(BaseModel):
    """Recencia (días desde la última compra), frecuencia (compras) y monto (Bs gastados)."""
    idCliente: int = Field(gt=0)
    nombre: str = Field(default="", max_length=200)
    recenciaDias: float = Field(ge=0)
    frecuencia: float = Field(ge=1)
    monto: float = Field(ge=0)


class PeticionEntrenamiento(BaseModel):
    productos: list[Producto] = Field(min_length=1, max_length=500)
    sucursales: list[Sucursal] = Field(min_length=1, max_length=50)
    ventasSemanales: list[VentaSemanal] = Field(default_factory=list, max_length=200_000)
    clientes: list[ClienteRfm] = Field(default_factory=list, max_length=50_000)
    hoy: date
    semanasHistoria: int = Field(default=104, ge=30, le=260)
    clientesSinteticos: int = Field(default=400, ge=50, le=5000)
    semilla: int = Field(default=42, ge=0)
