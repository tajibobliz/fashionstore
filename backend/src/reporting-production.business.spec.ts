import 'reflect-metadata';
import { jest } from '@jest/globals';
import { getMetadataArgsStorage } from 'typeorm';
import { ReportsService } from './reports/reports.service';
import { ReportFiltersDto } from './reports/dto/report-filters.dto';
import { validateEnvironment, databaseSsl } from './config/environment';
import { Usuario } from './users/entities/user.entity';
import { AppController } from './app.controller';

const fluent = (rows: any[] = []) => {
  const calls: Array<[string, unknown, unknown]> = [];
  const qb: any = { calls };
  for (const method of ['leftJoin','innerJoin','select','addSelect','where','andWhere','groupBy','addGroupBy','having','orderBy','offset','limit']) {
    qb[method] = jest.fn((a: unknown, b: unknown) => { calls.push([method, a, b]); return qb; });
  }
  qb.clone = jest.fn(() => qb); qb.getRawMany = jest.fn(async () => rows); qb.getRawOne = jest.fn(async () => rows[0] ?? {});
  qb.getMany = jest.fn(async () => rows); qb.getCount = jest.fn(async () => rows.length);
  return qb;
};

const serviceWith = (qb: any) => new ReportsService(
  { createQueryBuilder: () => qb } as any, { createQueryBuilder: () => qb } as any,
  { createQueryBuilder: () => qb } as any, { createQueryBuilder: () => qb } as any,
  {} as any, {} as any, { createQueryBuilder: () => qb } as any, { createQueryBuilder: () => qb } as any,
);

describe('reportes y producción', () => {
  it('hasta con fecha simple incluye el fin completo del día UTC', () => {
    const { to } = (serviceWith(fluent()) as any).dateBounds(undefined, '2026-09-16');
    expect(to.toISOString()).toBe('2026-09-16T23:59:59.999Z');
  });

  it('combina rango, sucursal, canal, modalidad, cajero, caja, turno y pago', () => {
    const qb = fluent();
    (serviceWith(qb) as any).applySalesFilters(qb, Object.assign(new ReportFiltersDto(), {
      desde: '2026-09-01', hasta: '2026-09-16', idSucursal: 2, tipoVenta: 'PRESENCIAL', modalidadComercial: 'MAYORISTA',
      metodoPago: 'QR', idCajero: 4, idCaja: 3, idTurno: 8,
    }), { branchIds: null });
    const sql = qb.calls.map((x: any[]) => String(x[1])).join(' ');
    expect(sql).toContain('v.fecha >='); expect(sql).toContain('v.id_sucursal'); expect(sql).toContain('v.tipo_venta');
    expect(sql).toContain('v.modalidad_comercial'); expect(sql).toContain('v.id_cajero'); expect(sql).toContain('t.id_caja');
    expect(sql).toContain('v.id_turno'); expect(sql).toContain('pf.metodo');
  });

  it.each([
    ['ADMIN nacional', null, false], ['ENCARGADO nacional', null, false], ['ENCARGADO_SUCURSAL limitado', [3], true],
  ])('%s aplica el alcance esperado', (_name, branchIds, restricted) => {
    const qb = fluent(); (serviceWith(qb) as any).applySalesFilters(qb, new ReportFiltersDto(), { branchIds });
    expect(qb.calls.some((x: any[]) => String(x[1]).includes('branchIds'))).toBe(restricted);
  });

  it('CAJERO queda limitado por su propio id', () => {
    const qb = fluent(); (serviceWith(qb) as any).applySalesFilters(qb, new ReportFiltersDto(), { branchIds: [1], cashierId: 9 });
    expect(qb.calls.some((x: any[]) => String(x[1]).includes('scopeCashier'))).toBe(true);
  });

  it('ventas por sucursal devuelve agregados numéricos', async () => {
    const result = await serviceWith(fluent([{ idSucursal: 1, cantidadVentas: '2', unidadesVendidas: '4', totalVendido: '500' }])).salesByBranch(new ReportFiltersDto(), { branchIds: null });
    expect(result[0]).toMatchObject({ cantidadVentas: 2, unidadesVendidas: 4, totalVendido: 500 });
  });

  it('ventas por almacén identifica almacén y sucursal', async () => {
    const result = await serviceWith(fluent([{ idAlmacen: 4, almacen: 'Principal', idSucursal: 1, sucursal: 'Centro', cantidadVentas: '1', unidadesVendidas: '2', totalVendido: '90' }])).salesByWarehouse(new ReportFiltersDto(), { branchIds: null });
    expect(result[0]).toMatchObject({ idAlmacen: 4, idSucursal: 1, totalVendido: 90 });
  });

  it.each(['DIGITAL','PRESENCIAL'])('filtra canal %s', (tipoVenta) => {
    const qb = fluent(); (serviceWith(qb) as any).applySalesFilters(qb, Object.assign(new ReportFiltersDto(), { tipoVenta }), { branchIds: null });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('tipo_venta'), { tipoVenta });
  });

  it.each(['MINORISTA','MAYORISTA'])('filtra modalidad %s', (modalidadComercial) => {
    const qb = fluent(); (serviceWith(qb) as any).applySalesFilters(qb, Object.assign(new ReportFiltersDto(), { modalidadComercial }), { branchIds: null });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('modalidad_comercial'), { modalidad: modalidadComercial });
  });

  it.each(['QR','TARJETA','CONTRAPAGO'])('filtra pagos aprobados por %s', (metodoPago) => {
    const qb = fluent(); (serviceWith(qb) as any).applySalesFilters(qb, Object.assign(new ReportFiltersDto(), { metodoPago }), { branchIds: null });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining("pf.estado='APROBADO'"), { metodoPago });
  });

  it('excluye ventas canceladas y descuenta devoluciones una sola vez', () => {
    const service: any = serviceWith(fluent());
    expect(service.validStates).not.toContain('CANCELADA');
    expect(service.returnedQty).toContain('SUM(dd.cantidad)');
    expect((service.returnedQty.match(/detalle_devolucion/g) ?? [])).toHaveLength(1);
  });

  it('exportación CSV escapa comillas y conserva encabezados', async () => {
    const service: any = serviceWith(fluent());
    service.sales = jest.fn(async () => ({ items: [{ idVenta: 1, sucursal: 'Tienda "Centro"', total: 10 }] }));
    const csv = await service.salesCsv(new ReportFiltersDto(), { branchIds: null });
    expect(csv).toContain('idVenta,fecha,comprobante'); expect(csv).toContain('Tienda ""Centro""');
  });

  it('passwordHash continúa con select:false', () => {
    const column = getMetadataArgsStorage().columns.find((x) => x.target === Usuario && x.propertyName === 'passwordHash');
    expect(column?.options.select).toBe(false);
  });

  it('health comprueba PostgreSQL y responde ok', async () => {
    const query = jest.fn(async () => [{ '?column?': 1 }]);
    await expect(new AppController({ getHello: () => 'ok' } as any, { query } as any).health()).resolves.toEqual({ status: 'ok' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('SSL de Azure mantiene validación TLS', () => expect(databaseSsl('true')).toEqual({ rejectUnauthorized: true }));
  it('SSL local puede permanecer desactivado', () => expect(databaseSsl('false')).toBe(false));

  it('producción falla con variables críticas faltantes', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production', DB_PORT: '5432' })).toThrow('Faltan variables');
  });

  it('configuración completa de producción es aceptada', () => {
    const config = { NODE_ENV:'production', DB_HOST:'h', DB_PORT:'5432', DB_USER:'u', DB_PASSWORD:'p', DB_NAME:'d', JWT_SECRET:'s', CORS_ORIGINS:'https://app.test', ADMIN_EMAIL:'a@b.c', ADMIN_PASSWORD:'x' };
    expect(validateEnvironment(config)).toBe(config);
  });
});
