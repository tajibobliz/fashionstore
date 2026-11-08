import { useLiveQuery } from 'dexie-react-hooks'
import { offlineDb } from './db'
import type { CarritoLocal, ItemCarrito } from './db'

/**
 * Carrito sin conexión (CU15 / RF-026). Se guarda en IndexedDB por usuario y sucursal, así que
 * sigue ahí al cerrar y reabrir el navegador. Al confirmarlo se convierte en un pedido con pago
 * diferido (ORDEN_PAGO_DIFERIDO, CU16). Precio y stock son los del catálogo guardado: referenciales.
 */
interface Dueño { idEmpresa: number; idUsuario: number; idSucursal: number }
const claveCarrito = (d: Dueño) => `${d.idEmpresa}:${d.idUsuario}:${d.idSucursal}`
export const MAX_POR_PRENDA = 20

export function useCarrito(d: Partial<Dueño>) {
  const listo = !!(d.idEmpresa && d.idUsuario && d.idSucursal)
  return useLiveQuery(
    async () => (listo ? (await offlineDb.carritos.get(claveCarrito(d as Dueño)))?.items ?? [] : []),
    [d.idEmpresa, d.idUsuario, d.idSucursal],
  )
}

async function modificar(d: Dueño, cambio: (items: ItemCarrito[]) => ItemCarrito[]) {
  await offlineDb.transaction('rw', offlineDb.carritos, async () => {
    const clave = claveCarrito(d)
    const actual = await offlineDb.carritos.get(clave)
    const items = cambio(actual?.items ?? []).filter(i => i.cantidad > 0)
    if (!items.length) return offlineDb.carritos.delete(clave)
    const carrito: CarritoLocal = { clave, ...d, items, actualizadoEn: new Date().toISOString() }
    await offlineDb.carritos.put(carrito)
  })
}

/** Suma una unidad (o la agrega). */
export const agregarAlCarrito = (d: Dueño, item: Omit<ItemCarrito, 'cantidad'>) =>
  modificar(d, items => items.some(i => i.idVariante === item.idVariante)
    ? items.map(i => i.idVariante === item.idVariante ? { ...i, cantidad: Math.min(MAX_POR_PRENDA, i.cantidad + 1) } : i)
    : [...items, { ...item, cantidad: 1 }])

export const cambiarCantidad = (d: Dueño, idVariante: number, cantidad: number) =>
  modificar(d, items => items.map(i => i.idVariante === idVariante ? { ...i, cantidad: Math.max(0, Math.min(MAX_POR_PRENDA, cantidad)) } : i))

export const vaciarCarrito = (d: Dueño) => offlineDb.carritos.delete(claveCarrito(d))

export const totalCarrito = (items: ItemCarrito[]) => Math.round(items.reduce((t, i) => t + i.precioUnitario * i.cantidad, 0) * 100) / 100
