import { jest } from '@jest/globals';
import { SalesService } from './sales/sales.service';
import { ReservationsService } from './reservations/reservations.service';
import { PaymentsService } from './payments/payments.service';
import { ReturnsService } from './returns/returns.service';
import { InventoryService } from './inventory/inventory.service';
import { Venta } from './sales/entities/venta.entity';
import { Inventario } from './inventory/entities/inventario.entity';
import { VarianteProducto } from './catalog/entities/variante-producto.entity';
import { Producto } from './catalog/entities/producto.entity';
import { DetalleVenta } from './sales/entities/detalle-venta.entity';
import { Pago } from './payments/entities/pago.entity';
import { DetalleDevolucion } from './returns/entities/detalle-devolucion.entity';
import { Role } from './auth/enums/role.enum';

const repo = (overrides: Record<string, unknown> = {}) => ({
  findOne: jest.fn(), find: jest.fn(), save: jest.fn(async (value) => value),
  create: jest.fn((value) => value), ...overrides,
});

const queryBuilder = () => ({
  setLock: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
  getOne: jest.fn(async () => ({})),
});

function salesService(ventaRepo: any, dataSource: any) {
  return new SalesService(
    ventaRepo, repo() as any, repo() as any, repo() as any, repo() as any,
    repo() as any, repo() as any, repo() as any,
    repo() as any, {} as any, dataSource,
  );
}

function reservationService(dataSource: any, sucursalRepo = repo()) {
  return new ReservationsService(
    repo() as any, repo() as any, sucursalRepo as any, repo() as any,
    repo() as any, repo() as any, repo({ findOne: jest.fn(async () => ({ idAlmacen: 1, sucursal: { idSucursal: 1 } })) }) as any, dataSource,
  );
}

function serialDataSource(manager: any) {
  let queue = Promise.resolve();
  return {
    transaction: jest.fn((callback: (manager: any) => Promise<unknown>) => {
      const result = queue.then(() => callback(manager));
      queue = result.then(() => undefined, () => undefined);
      return result;
    }),
  };
}

describe('Estabilización de integridad y seguridad', () => {
  const variante = { idVariante: 1, producto: { idProducto: 1 } } as VarianteProducto;
  const sucursal = { idSucursal: 1 } as any;
  const almacen = { idAlmacen: 1, sucursal } as any;

  function sharedManager(ventas: Map<number, any>, inventario: any) {
    const manager: any = {
      locks: [] as any[],
      createQueryBuilder: jest.fn((entity: any) => {
        const qb: any = queryBuilder();
        qb.andWhere = jest.fn().mockReturnThis();
        if (entity === Inventario) {
          qb.getOne = jest.fn(async () => {
            manager.locks.push({ mode: 'pessimistic_write' });
            return inventario;
          });
        }
        return qb;
      }),
      findOne: jest.fn(async (entity: any, options: any) => {
        if (entity === Venta) return ventas.get(options.where.idVenta);
        if (entity === Inventario) {
          manager.locks.push(options.lock);
          return inventario;
        }
        if (entity === VarianteProducto) return variante;
        if (entity === Producto) return variante.producto;
        return null;
      }),
      create: jest.fn((_entity: any, value: any) => value),
      save: jest.fn(async (value: any) => value),
    };
    return manager;
  }

  it('dos ventas simultáneas no consumen dos veces la última unidad', async () => {
    const inventory = { stockDisponible: 1, stockReservado: 0 };
    const ventas = new Map([
      [1, { idVenta: 1, estado: 'PENDIENTE', sucursal, almacen, numeroComprobante: 'A', detalles: [{ cantidad: 1, variante }] }],
      [2, { idVenta: 2, estado: 'PENDIENTE', sucursal, almacen, numeroComprobante: 'B', detalles: [{ cantidad: 1, variante }] }],
    ]);
    const manager = sharedManager(ventas, inventory);
    const service = salesService(repo(), serialDataSource(manager) as any);
    const results = await Promise.allSettled([service.confirmar(1), service.confirmar(2)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(inventory.stockDisponible).toBe(0);
    expect(manager.locks).toContainEqual({ mode: 'pessimistic_write' });
  });

  it('venta y reserva simultáneas compiten por el mismo stock', async () => {
    const inventory = { stockDisponible: 1, stockReservado: 0 };
    const ventas = new Map([[1, { idVenta: 1, estado: 'PENDIENTE', sucursal, almacen, numeroComprobante: 'A', detalles: [{ cantidad: 1, variante }] }]]);
    const manager = sharedManager(ventas, inventory);
    const ds = serialDataSource(manager);
    const sale = salesService(repo(), ds as any);
    const reservation = reservationService(ds as any, repo({ findOne: jest.fn(async () => sucursal) }));
    const results = await Promise.allSettled([
      sale.confirmar(1),
      reservation.create(9, { idSucursal: 1, detalles: [{ idVariante: 1, cantidad: 1 }] }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(inventory.stockDisponible + inventory.stockReservado).toBe(0);
  });

  it('dos reservas simultáneas no reservan dos veces la última unidad', async () => {
    const inventory = { stockDisponible: 1, stockReservado: 0 };
    const manager = sharedManager(new Map(), inventory);
    const ds = serialDataSource(manager);
    const service = reservationService(ds as any, repo({ findOne: jest.fn(async () => sucursal) }));
    const dto = { idSucursal: 1, detalles: [{ idVariante: 1, cantidad: 1 }] };
    const results = await Promise.allSettled([service.create(1, dto), service.create(2, dto)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(inventory.stockDisponible).toBe(0);
    expect(inventory.stockReservado).toBe(1);
  });

  it('rechaza una operación que dejaría stock negativo', async () => {
    const inventory = { stockDisponible: 0, stockReservado: 0 };
    const ventas = new Map([[1, { idVenta: 1, estado: 'PENDIENTE', sucursal, almacen, detalles: [{ cantidad: 1, variante }] }]]);
    const service = salesService(repo(), serialDataSource(sharedManager(ventas, inventory)) as any);
    await expect(service.confirmar(1)).rejects.toThrow('Stock insuficiente');
    expect(inventory.stockDisponible).toBe(0);
  });

  it('revierte stock si falla el registro del movimiento manual', async () => {
    const inventory = { idInventario: 1, stockDisponible: 1, stockReservado: 0 };
    const manager: any = {
      createQueryBuilder: jest.fn(() => {
        const qb: any = queryBuilder();
        qb.getOne = jest.fn(async () => inventory);
        return qb;
      }),
      save: jest.fn(async (value: any) => {
        if (value.tipo === 'ENTRADA') throw new Error('fallo movimiento');
        return value;
      }),
      create: jest.fn((_entity: any, value: any) => value),
    };
    const ds = {
      transaction: async (callback: any) => {
        const snapshot = { ...inventory };
        try { return await callback(manager); }
        catch (error) { Object.assign(inventory, snapshot); throw error; }
      },
    };
    const service = new InventoryService(repo() as any, repo() as any, repo() as any, repo() as any, repo() as any, ds as any);
    await expect(service.createMovimiento({ idInventario: 1, tipo: 'ENTRADA', cantidad: 1 })).rejects.toThrow('fallo movimiento');
    expect(inventory.stockDisponible).toBe(1);
  });

  it('POS normal no consume stock reservado de otro cliente', async () => {
    const inventory = { stockDisponible: 0, stockReservado: 1 };
    const manager = sharedManager(new Map(), inventory);
    const service = new SalesService(
      repo() as any, repo() as any, repo({ findOne: jest.fn(async () => sucursal) }) as any,
      repo() as any, repo() as any, repo() as any, repo() as any, repo() as any,
      repo() as any,
      { resolverTurno: jest.fn(async () => ({ caja: { almacenDefault: almacen } })) } as any,
      { transaction: (callback: any) => callback(manager) } as any,
    );
    await expect(service.createPresencial(4, {
      idSucursal: 1, detalles: [{ idVariante: 1, cantidad: 1 }],
    })).rejects.toThrow('Stock insuficiente');
    expect(inventory.stockReservado).toBe(1);
  });

  it('cliente no accede a una venta ajena', async () => {
    const service = salesService(repo({ findOne: jest.fn(async () => ({ usuario: { idUsuario: 2 } })) }), {} as any);
    await expect(service.findOneAuthorized(1, { idUsuario: 1, rol: Role.CLIENTE })).rejects.toThrow('No puedes consultar');
  });

  it('cliente no accede a una reserva ajena', async () => {
    const reservaRepo = repo({ findOne: jest.fn(async () => ({ usuario: { idUsuario: 2 } })) });
    const service = new ReservationsService(reservaRepo as any, repo() as any, repo() as any, repo() as any, repo() as any, repo() as any, repo() as any, {} as any);
    await expect(service.findOneAuthorized(1, { idUsuario: 1, rol: Role.CLIENTE })).rejects.toThrow('No puedes consultar');
  });

  it('cliente no crea un pago para una venta ajena', async () => {
    const ventaRepo = repo({ findOne: jest.fn(async () => ({ estado: 'PENDIENTE', total: 10, usuario: { idUsuario: 2 } })) });
    const service = new PaymentsService(repo() as any, ventaRepo as any, {} as any, {} as any);
    await expect(service.create({ idVenta: 1, metodo: 'QR', monto: 10 }, { idUsuario: 1, rol: Role.CLIENTE })).rejects.toThrow('No puedes crear');
  });

  it('impide que devoluciones parciales acumuladas superen lo vendido', async () => {
    const detalleVenta = { idDetalleVenta: 1, cantidad: 5, variante } as DetalleVenta;
    const venta = { idVenta: 1, estado: 'DEVUELTA_PARCIAL', sucursal, detalles: [detalleVenta] } as Venta;
    const aggregateQb: any = {
      select: jest.fn().mockReturnThis(), addSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(async () => [{ idDetalleVenta: 1, cantidad: 2 }]),
    };
    const manager: any = {
      createQueryBuilder: jest.fn(() => queryBuilder()),
      findOne: jest.fn(async (entity: any) => entity === Venta ? venta : detalleVenta),
      getRepository: jest.fn((entity: any) => {
        expect(entity).toBe(DetalleDevolucion);
        return { createQueryBuilder: () => aggregateQb };
      }),
    };
    const service = new ReturnsService(repo() as any, repo() as any, repo() as any, repo() as any, repo() as any, repo() as any,
      { transaction: (callback: any) => callback(manager) } as any);
    await expect(service.create(4, { idVenta: 1, detalles: [{ idDetalleVenta: 1, cantidad: 4 }] })).rejects.toThrow('supera');
  });

  it('venta digital no queda pagada si falla el inventario', async () => {
    const payment = { idPago: 1, estado: 'PENDIENTE', venta: { idVenta: 8 } } as Pago;
    const manager: any = {
      createQueryBuilder: jest.fn(() => queryBuilder()),
      findOne: jest.fn(async () => payment),
      save: jest.fn(),
    };
    const sales = { confirmarEnTransaccion: jest.fn(async () => { throw new Error('stock'); }) };
    const service = new PaymentsService(repo() as any, repo() as any, sales as any,
      { transaction: (callback: any) => callback(manager) } as any);
    await expect(service.updateEstado(1, { estado: 'APROBADO' })).rejects.toThrow('stock');
    expect(payment.estado).toBe('PENDIENTE');
    expect(manager.save).not.toHaveBeenCalled();
  });
});
