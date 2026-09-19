import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { PaymentsService } from './payments.service';
import { Role } from '../auth/enums/role.enum';

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentsService],
    }).useMocker(() => ({})).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('registra EFECTIVO aprobado para una venta presencial ya pagada sin confirmar otra vez', async () => {
    const venta = { idVenta: 9, tipoVenta: 'PRESENCIAL', estado: 'PAGADA', total: 450, sucursal: { idSucursal: 4 } };
    const pagoRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ idPago: 12, ...value })),
    };
    const ventaRepo = { findOne: jest.fn().mockResolvedValue(venta) };
    const sales = { confirmarEnTransaccion: jest.fn() };
    const access = { assertCanAccess: jest.fn() };
    const cashService = new PaymentsService(pagoRepo as never, ventaRepo as never, sales as never, {} as never, access as never);

    const result = await cashService.create({ idVenta: 9, metodo: 'EFECTIVO', monto: 450, clientRequestId: '550e8400-e29b-41d4-a716-446655440000' }, { idUsuario: 8, rol: Role.CAJERO });

    expect(result).toMatchObject({ idPago: 12, metodo: 'EFECTIVO', estado: 'APROBADO', monto: 450 });
    expect(sales.confirmarEnTransaccion).not.toHaveBeenCalled();
    expect(access.assertCanAccess).toHaveBeenCalledWith(expect.anything(), 4);
  });

  it.each(['QR', 'TARJETA', 'TRANSFERENCIA', 'CONTRAPAGO'])('registra %s pendiente para una venta presencial ya pagada', async (metodo) => {
    const venta = { idVenta: 9, tipoVenta: 'PRESENCIAL', estado: 'PAGADA', total: 450, sucursal: { idSucursal: 4 } };
    const pagoRepo = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn((value) => value), save: jest.fn(async (value) => ({ idPago: 12, ...value })) };
    const cashService = new PaymentsService(pagoRepo as never, { findOne: jest.fn().mockResolvedValue(venta) } as never, { confirmarEnTransaccion: jest.fn() } as never, {} as never, { assertCanAccess: jest.fn() } as never);

    const result = await cashService.create({ idVenta: 9, metodo, monto: 450 }, { idUsuario: 8, rol: Role.CAJERO });

    expect(result).toMatchObject({ metodo, estado: 'PENDIENTE', monto: 450 });
  });

  it('no vuelve a confirmar una venta presencial ya pagada al aprobar su pago pendiente', async () => {
    const pago = { idPago: 12, estado: 'PENDIENTE', venta: { idVenta: 9, tipoVenta: 'PRESENCIAL', estado: 'PAGADA', sucursal: { idSucursal: 4 } } };
    const manager = { createQueryBuilder: jest.fn(() => ({ setLock: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn() })), findOne: jest.fn().mockResolvedValue(pago), save: jest.fn(async (value) => value) };
    const sales = { confirmarEnTransaccion: jest.fn() };
    const serviceWithPendingPosPayment = new PaymentsService({} as never, {} as never, sales as never, { transaction: jest.fn(async (handler) => handler(manager)) } as never, { assertCanAccess: jest.fn() } as never);

    const result = await serviceWithPendingPosPayment.updateEstado(12, { estado: 'APROBADO' }, { idUsuario: 8, rol: Role.CAJERO });

    expect(result.estado).toBe('APROBADO');
    expect(sales.confirmarEnTransaccion).not.toHaveBeenCalled();
  });
});
