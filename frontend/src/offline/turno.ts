import type { TurnoCaja } from '../types/pos'

/**
 * Turno abierto del cajero, guardado para poder vender sin conexión (la venta offline
 * se asocia a este turno). Se actualiza cada vez que el POS abre con internet.
 */
export interface TurnoLocal {
  idTurno: number
  idCaja: number
  caja: string
  idSucursal: number
  sucursal: string
  cajero: string
  guardadoEn: string
}

const key = (idUsuario: number) => `fashionstore.turno.${idUsuario}`

export const turnoLocal = {
  get(idUsuario: number): TurnoLocal | null {
    try { return JSON.parse(localStorage.getItem(key(idUsuario)) ?? 'null') as TurnoLocal | null } catch { return null }
  },
  guardar(idUsuario: number, turno: TurnoCaja) {
    if (!turno.caja.sucursal) return
    const valor: TurnoLocal = {
      idTurno: turno.idTurno,
      idCaja: turno.caja.idCaja,
      caja: turno.caja.nombre,
      idSucursal: turno.caja.sucursal.idSucursal,
      sucursal: turno.caja.sucursal.nombre,
      cajero: [turno.cajero?.nombre, turno.cajero?.apellido].filter(Boolean).join(' '),
      guardadoEn: new Date().toISOString(),
    }
    try { localStorage.setItem(key(idUsuario), JSON.stringify(valor)) } catch { /* sin almacenamiento */ }
  },
  borrar(idUsuario: number) {
    try { localStorage.removeItem(key(idUsuario)) } catch { /* sin almacenamiento */ }
  },
}
