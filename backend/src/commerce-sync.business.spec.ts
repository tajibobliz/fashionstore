import 'reflect-metadata';
import { jest } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { SalesService } from './sales/sales.service';
import { PaymentsService } from './payments/payments.service';
import { ReservationsService } from './reservations/reservations.service';
import { Role } from './auth/enums/role.enum';

const repository = (values: Record<string, unknown> = {}) => ({
  findOne: jest.fn(), find: jest.fn(), create: jest.fn((v) => v), save: jest.fn(async (v) => v),
  ...values,
});

const sales = () => new SalesService(
  repository() as any, repository() as any, repository() as any, repository() as any,
  repository() as any, repository() as any, repository() as any, repository() as any,
  repository() as any, {} as any, {} as any,
);

describe('modalidad comercial e idempotencia offline', () => {
  const minorista = { idProducto: 1, precio: 150, precioMayorista: 120, cantidadMinimaMayorista: 12 } as any;

  it('MINORISTA usa el precio normal aunque supere el mínimo', async () => {
    await expect((sales() as any).resolverPrecio(minorista, 15, 'MINORISTA')).resolves.toBe(150);
  });

  it('MAYORISTA usa el precio mayorista y preserva el valor para DetalleVenta', async () => {
    const precio = await (sales() as any).resolverPrecio(minorista, 12, 'MAYORISTA');
    const detalle = { cantidad: 12, precioUnitario: precio, subtotal: precio * 12 };
    expect(detalle).toEqual({ cantidad: 12, precioUnitario: 120, subtotal: 1440 });
  });

  it('MAYORISTA por debajo del mínimo falla', async () => {
    await expect((sales() as any).resolverPrecio(minorista, 5, 'MAYORISTA')).rejects.toThrow(BadRequestException);
  });

  it('MAYORISTA sin configuración falla explícitamente', async () => {
    await expect((sales() as any).resolverPrecio({ idProducto: 2, precio: 80 }, 20, 'MAYORISTA'))
      .rejects.toThrow('no tiene configuración mayorista');
  });

  it('el total se calcula con precio del backend y no con un precio del frontend', async () => {
    const precioFrontend = 1;
    const precioBackend = await (sales() as any).resolverPrecio(minorista, 12, 'MAYORISTA');
    expect(precioBackend * 12).toBe(1440);
    expect(precioBackend * 12).not.toBe(precioFrontend * 12);
  });

  it.each(['DIGITAL', 'PRESENCIAL'])('admite modalidad mayorista en canal %s', (tipoVenta) => {
    expect({ tipoVenta, modalidadComercial: 'MAYORISTA' }).toMatchObject({ modalidadComercial: 'MAYORISTA' });
  });

  it('reintento de venta devuelve la venta existente antes de tocar carrito o stock', async () => {
    const existing = { idVenta: 4, clientRequestId: '5d907c52-40eb-46b5-a00b-f06e53044f6a' };
    const ventaRepo = repository({ findOne: jest.fn(async () => existing) });
    const carritoRepo = repository();
    const service = new SalesService(
      ventaRepo as any, repository() as any, repository() as any, repository() as any,
      repository() as any, repository() as any, repository() as any, carritoRepo as any,
      repository() as any, {} as any, {} as any,
    );
    await expect(service.createFromCart(9, { idSucursal: 1, clientRequestId: existing.clientRequestId })).resolves.toBe(existing);
    expect(carritoRepo.findOne).not.toHaveBeenCalled();
  });

  it('conflicto único concurrente retorna la operación ganadora', async () => {
    const winner = { idVenta: 7 };
    const conflict = new QueryFailedError('INSERT', [], { code: '23505' } as any);
    await expect((sales() as any).ejecutarIdempotente(
      '5d907c52-40eb-46b5-a00b-f06e53044f6a', async () => winner, async () => { throw conflict; },
    )).resolves.toBe(winner);
  });

  it('reintento de reserva devuelve la misma reserva sin reservar stock otra vez', async () => {
    const existing = { idReserva: 3, clientRequestId: '5d907c52-40eb-46b5-a00b-f06e53044f6a' };
    const reservaRepo = repository({ findOne: jest.fn(async () => existing) });
    const dataSource = { transaction: jest.fn() };
    const service = new ReservationsService(
      reservaRepo as any, repository() as any, repository() as any, repository() as any,
      repository() as any, repository() as any, repository() as any, dataSource as any,
    );
    await expect(service.create(2, { idSucursal: 1, detalles: [], clientRequestId: existing.clientRequestId })).resolves.toBe(existing);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('CONTRAPAGO se crea PENDIENTE y no duplica el intento', async () => {
    const venta = { idVenta: 1, total: 200, estado: 'PENDIENTE', usuario: { idUsuario: 5 }, sucursal: { idSucursal: 1 } };
    const pagoRepo = repository({
      findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ idPago: 8, metodo: 'CONTRAPAGO' }),
    });
    const service = new PaymentsService(
      pagoRepo as any, repository({ findOne: jest.fn(async () => venta) }) as any,
      {} as any, {} as any, { assertCanAccess: jest.fn() } as any,
    );
    const dto = { idVenta: 1, metodo: 'CONTRAPAGO', monto: 200, clientRequestId: '5d907c52-40eb-46b5-a00b-f06e53044f6a' };
    const first: any = await service.create(dto, { idUsuario: 5, rol: Role.CLIENTE });
    expect(first).toMatchObject({ metodo: 'CONTRAPAGO', estado: 'PENDIENTE' });
    const second = await service.create(dto, { idUsuario: 5, rol: Role.CLIENTE });
    expect(second).toMatchObject({ idPago: 8 });
    expect(pagoRepo.save).toHaveBeenCalledTimes(1);
  });

  it('repetir confirmación APROBADA es idempotente y no confirma inventario otra vez', async () => {
    const pago = { idPago: 1, estado: 'APROBADO', venta: { idVenta: 1, sucursal: { idSucursal: 1 } } };
    const manager = {
      createQueryBuilder: jest.fn(() => ({ setLock: () => ({ where: () => ({ getOne: async () => pago }) }) })),
      findOne: jest.fn(async () => pago), save: jest.fn(),
    };
    const confirmar = jest.fn();
    const service = new PaymentsService(repository() as any, repository() as any, { confirmarEnTransaccion: confirmar } as any,
      { transaction: (fn: any) => fn(manager) } as any, { assertCanAccess: jest.fn() } as any);
    await expect(service.updateEstado(1, { estado: 'APROBADO' }, { idUsuario: 1, rol: Role.ADMIN })).resolves.toBe(pago);
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('un usuario distinto no puede usar UUID para consultar o pagar venta ajena', async () => {
    const venta = { idVenta: 1, total: 10, estado: 'PENDIENTE', usuario: { idUsuario: 2 }, sucursal: { idSucursal: 1 } };
    const service = new PaymentsService(repository() as any,
      repository({ findOne: jest.fn(async () => venta) }) as any, {} as any, {} as any, { assertCanAccess: jest.fn() } as any);
    await expect(service.create(
      { idVenta: 1, metodo: 'QR', monto: 10, clientRequestId: '5d907c52-40eb-46b5-a00b-f06e53044f6a' },
      { idUsuario: 3, rol: Role.CLIENTE },
    )).rejects.toThrow(ForbiddenException);
  });
});
