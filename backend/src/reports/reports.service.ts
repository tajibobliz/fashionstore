import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { Venta } from '../sales/entities/venta.entity';
import { DetalleVenta } from '../sales/entities/detalle-venta.entity';
import { Reserva } from '../reservations/entities/reserva.entity';
import { Inventario } from '../inventory/entities/inventario.entity';
import { Producto } from '../catalog/entities/producto.entity';
import { Usuario } from '../users/entities/user.entity';
import { Pago } from '../payments/entities/pago.entity';
import { TurnoCaja } from '../pos/entities/turno-caja.entity';
import { ReportFiltersDto, InventoryReportFiltersDto, ReservationReportFiltersDto, TurnReportFiltersDto } from './dto/report-filters.dto';

export type ReportScope = { branchIds: number[] | null; cashierId?: number };

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Venta) private readonly ventaRepo: Repository<Venta>,
    @InjectRepository(DetalleVenta) private readonly detalleVentaRepo: Repository<DetalleVenta>,
    @InjectRepository(Reserva) private readonly reservaRepo: Repository<Reserva>,
    @InjectRepository(Inventario) private readonly inventarioRepo: Repository<Inventario>,
    @InjectRepository(Producto) private readonly productoRepo: Repository<Producto>,
    @InjectRepository(Usuario) private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(Pago) private readonly pagoRepo: Repository<Pago>,
    @InjectRepository(TurnoCaja) private readonly turnoRepo: Repository<TurnoCaja>,
  ) {}

  private readonly validStates = ['PAGADA', 'DEVUELTA_PARCIAL', 'DEVUELTA'];
  private readonly returnedQty = `COALESCE((SELECT SUM(dd.cantidad) FROM detalle_devolucion dd JOIN devolucion de ON de.id_devolucion=dd.id_devolucion WHERE dd.id_detalle_venta=dv.id_detalle_venta),0)`;

  private dateBounds(desde?: string, hasta?: string) {
    const from = desde ? new Date(desde) : undefined;
    const to = hasta ? new Date(hasta) : undefined;
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(hasta!)) to.setUTCHours(23, 59, 59, 999);
    return { from, to };
  }

  private applySalesFilters<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, f: ReportFiltersDto, scope: ReportScope, alias = 'v') {
    const { from, to } = this.dateBounds(f.desde, f.hasta);
    qb.andWhere(`${alias}.estado IN (:...validStates)`, { validStates: this.validStates });
    if (from) qb.andWhere(`${alias}.fecha >= :from`, { from });
    if (to) qb.andWhere(`${alias}.fecha <= :to`, { to });
    if (scope.branchIds !== null) {
      if (scope.branchIds.length) qb.andWhere(`${alias}.id_sucursal IN (:...branchIds)`, { branchIds: scope.branchIds });
      else qb.andWhere('1=0');
    }
    if (scope.cashierId) qb.andWhere(`${alias}.id_cajero=:scopeCashier`, { scopeCashier: scope.cashierId });
    if (f.idSucursal) qb.andWhere(`${alias}.id_sucursal=:idSucursal`, { idSucursal: f.idSucursal });
    if (f.idAlmacen) qb.andWhere(`${alias}.id_almacen=:idAlmacen`, { idAlmacen: f.idAlmacen });
    if (f.tipoVenta) qb.andWhere(`${alias}.tipo_venta=:tipoVenta`, { tipoVenta: f.tipoVenta });
    if (f.modalidadComercial) qb.andWhere(`${alias}.modalidad_comercial=:modalidad`, { modalidad: f.modalidadComercial });
    if (f.idCajero) qb.andWhere(`${alias}.id_cajero=:idCajero`, { idCajero: f.idCajero });
    if (f.idTurno) qb.andWhere(`${alias}.id_turno=:idTurno`, { idTurno: f.idTurno });
    if (f.idCaja) qb.andWhere('t.id_caja=:idCaja', { idCaja: f.idCaja });
    if (f.metodoPago) qb.andWhere(`EXISTS (SELECT 1 FROM pago pf WHERE pf.id_venta=${alias}.id_venta AND pf.metodo=:metodoPago AND pf.estado='APROBADO')`, { metodoPago: f.metodoPago });
    return qb;
  }

  private salesBase(f: ReportFiltersDto, scope: ReportScope) {
    return this.applySalesFilters(this.ventaRepo.createQueryBuilder('v').leftJoin('v.sucursal', 's').leftJoin('v.almacen', 'a')
      .leftJoin('v.cajero', 'u').leftJoin('v.turno', 't').leftJoin('t.caja', 'c'), f, scope);
  }

  async dashboard(f: ReportFiltersDto, scope: ReportScope) {
    const summary = await this.salesBase(f, scope).leftJoin('v.detalles', 'dv')
      .select(`COALESCE(SUM(dv.precio_unitario*(dv.cantidad-${this.returnedQty})),0)`, 'totalVentas')
      .addSelect('COUNT(DISTINCT v.id_venta)', 'cantidadVentas').addSelect(`COALESCE(SUM(dv.cantidad-${this.returnedQty}),0)`, 'unidadesVendidas')
      .addSelect(`COALESCE(SUM(CASE WHEN v.tipo_venta='DIGITAL' THEN dv.precio_unitario*(dv.cantidad-${this.returnedQty}) ELSE 0 END),0)`, 'ventasDigitales')
      .addSelect(`COALESCE(SUM(CASE WHEN v.tipo_venta='PRESENCIAL' THEN dv.precio_unitario*(dv.cantidad-${this.returnedQty}) ELSE 0 END),0)`, 'ventasPresenciales')
      .addSelect(`COALESCE(SUM(CASE WHEN v.modalidad_comercial='MINORISTA' THEN dv.precio_unitario*(dv.cantidad-${this.returnedQty}) ELSE 0 END),0)`, 'ventasMinoristas')
      .addSelect(`COALESCE(SUM(CASE WHEN v.modalidad_comercial='MAYORISTA' THEN dv.precio_unitario*(dv.cantidad-${this.returnedQty}) ELSE 0 END),0)`, 'ventasMayoristas').getRawOne();
    const rq = this.reservaRepo.createQueryBuilder('r').where("r.estado='PENDIENTE'");
    const iq = this.inventarioRepo.createQueryBuilder('i').innerJoin('i.almacen', 'ia', 'ia.id_sucursal=i.id_sucursal').where('i.stock_disponible<=5');
    this.applyBranchScope(rq, 'r', f.idSucursal, scope); this.applyBranchScope(iq, 'i', f.idSucursal, scope);
    if (f.idAlmacen) iq.andWhere('i.id_almacen=:idAlmacen', { idAlmacen: f.idAlmacen });
    const total = Number(summary?.totalVentas ?? 0), count = Number(summary?.cantidadVentas ?? 0);
    const [reservasPendientes, stockCritico, ventasPorDia, ventasPorSucursal, productosMasVendidos, metodosPago] = await Promise.all([
      rq.getCount(), iq.getCount(), this.salesByDay(f, scope), this.salesByBranch(f, scope), this.topProducts(f, scope, 10), this.paymentsByMethod(f, scope),
    ]);
    return { totalVentas: total, cantidadVentas: count, unidadesVendidas: Number(summary?.unidadesVendidas ?? 0), ticketPromedio: count ? total / count : 0,
      ventasDigitales: Number(summary?.ventasDigitales ?? 0), ventasPresenciales: Number(summary?.ventasPresenciales ?? 0),
      ventasMinoristas: Number(summary?.ventasMinoristas ?? 0), ventasMayoristas: Number(summary?.ventasMayoristas ?? 0), reservasPendientes, stockCritico,
      ventasPorDia, ventasPorSucursal, productosMasVendidos, metodosPago };
  }

  async sales(f: ReportFiltersDto, scope: ReportScope, paginate = true) {
    const qb = this.salesBase(f, scope).leftJoin('v.detalles', 'dv')
      .select('v.id_venta', 'idVenta').addSelect('v.fecha', 'fecha').addSelect('v.numero_comprobante', 'comprobante')
      .addSelect('v.tipo_venta', 'tipoVenta').addSelect('v.modalidad_comercial', 'modalidadComercial').addSelect('v.estado', 'estado')
      .addSelect('s.id_sucursal', 'idSucursal').addSelect('s.nombre', 'sucursal').addSelect('a.id_almacen', 'idAlmacen').addSelect('a.nombre', 'almacen')
      .addSelect('u.id_usuario', 'idCajero').addSelect("CONCAT_WS(' ',u.nombre,u.apellido)", 'cajero').addSelect('c.id_caja', 'idCaja')
      .addSelect('c.nombre', 'caja').addSelect('t.id_turno', 'idTurno').addSelect(`COALESCE(SUM(dv.precio_unitario*(dv.cantidad-${this.returnedQty})),0)`, 'total')
      .addSelect(`(SELECT STRING_AGG(DISTINCT pp.metodo, ',') FROM pago pp WHERE pp.id_venta=v.id_venta AND pp.estado NOT IN ('RECHAZADO','ANULADO'))`, 'metodosPago')
      .groupBy('v.id_venta').addGroupBy('s.id_sucursal').addGroupBy('a.id_almacen').addGroupBy('u.id_usuario').addGroupBy('c.id_caja').addGroupBy('t.id_turno').orderBy('v.fecha', 'DESC');
    if (paginate) qb.offset((f.page - 1) * f.limit).limit(f.limit);
    const items = await qb.getRawMany();
    const total = Number((await this.salesBase(f, scope).select('COUNT(DISTINCT v.id_venta)', 'count').getRawOne())?.count ?? 0);
    return { items: items.map((x) => ({ ...x, total: Number(x.total) })), total, page: paginate ? f.page : 1, limit: paginate ? f.limit : total };
  }

  async salesByDay(f: ReportFiltersDto, scope: ReportScope) {
    const rows = await this.salesBase(f, scope).leftJoin('v.detalles', 'dv').select('DATE(v.fecha)', 'fecha').addSelect('COUNT(DISTINCT v.id_venta)', 'cantidad')
      .addSelect(`COALESCE(SUM(dv.precio_unitario*(dv.cantidad-${this.returnedQty})),0)`, 'monto').groupBy('DATE(v.fecha)').orderBy('DATE(v.fecha)', 'ASC').limit(60).getRawMany();
    return rows.map((x) => ({ fecha: x.fecha, cantidad: Number(x.cantidad), monto: Number(x.monto) }));
  }

  async salesByBranch(f: ReportFiltersDto, scope: ReportScope) {
    const rows = await this.salesBase(f, scope).leftJoin('v.detalles', 'dv').select('s.id_sucursal', 'idSucursal').addSelect('s.nombre', 'sucursal')
      .addSelect('COUNT(DISTINCT v.id_venta)', 'cantidadVentas').addSelect(`COALESCE(SUM(dv.cantidad-${this.returnedQty}),0)`, 'unidadesVendidas')
      .addSelect(`COALESCE(SUM(dv.precio_unitario*(dv.cantidad-${this.returnedQty})),0)`, 'totalVendido').groupBy('s.id_sucursal').orderBy('"totalVendido"', 'DESC').getRawMany();
    return rows.map(this.numericSalesRow);
  }

  async salesByWarehouse(f: ReportFiltersDto, scope: ReportScope) {
    const rows = await this.salesBase(f, scope).leftJoin('v.detalles', 'dv').select('a.id_almacen', 'idAlmacen').addSelect('a.nombre', 'almacen')
      .addSelect('s.id_sucursal', 'idSucursal').addSelect('s.nombre', 'sucursal').addSelect('COUNT(DISTINCT v.id_venta)', 'cantidadVentas')
      .addSelect(`COALESCE(SUM(dv.cantidad-${this.returnedQty}),0)`, 'unidadesVendidas').addSelect(`COALESCE(SUM(dv.precio_unitario*(dv.cantidad-${this.returnedQty})),0)`, 'totalVendido')
      .groupBy('a.id_almacen').addGroupBy('s.id_sucursal').orderBy('"totalVendido"', 'DESC').getRawMany();
    return rows.map(this.numericSalesRow);
  }

  async topProducts(f: ReportFiltersDto, scope: ReportScope, limit = 20) {
    const qb = this.detalleVentaRepo.createQueryBuilder('dv').innerJoin('dv.venta', 'v').innerJoin('dv.variante', 'vr').innerJoin('vr.producto', 'p')
      .leftJoin('p.categoria', 'cat').leftJoin('v.turno', 't').select('p.id_producto', 'idProducto').addSelect('p.nombre', 'nombre').addSelect('cat.nombre', 'categoria')
      .addSelect(`SUM(dv.cantidad-${this.returnedQty})`, 'cantidadVendida').addSelect(`SUM(dv.precio_unitario*(dv.cantidad-${this.returnedQty}))`, 'totalGenerado');
    this.applySalesFilters(qb, f, scope);
    return (await qb.groupBy('p.id_producto').addGroupBy('cat.id_categoria').having(`SUM(dv.cantidad-${this.returnedQty})>0`).orderBy('"cantidadVendida"', 'DESC').limit(Math.min(limit, 100)).getRawMany())
      .map((x) => ({ ...x, cantidadVendida: Number(x.cantidadVendida), totalGenerado: Number(x.totalGenerado) }));
  }

  async topVariants(f: ReportFiltersDto, scope: ReportScope) {
    const qb = this.detalleVentaRepo.createQueryBuilder('dv').innerJoin('dv.venta', 'v').innerJoin('dv.variante', 'vr').innerJoin('vr.producto', 'p')
      .leftJoin('vr.talla', 'ta').leftJoin('vr.color', 'co').leftJoin('v.turno', 't').select('p.nombre', 'producto').addSelect('vr.sku', 'sku')
      .addSelect('ta.nombre', 'talla').addSelect('co.nombre', 'color').addSelect(`SUM(dv.cantidad-${this.returnedQty})`, 'cantidadVendida')
      .addSelect(`SUM(dv.precio_unitario*(dv.cantidad-${this.returnedQty}))`, 'totalGenerado');
    this.applySalesFilters(qb, f, scope);
    return (await qb.groupBy('vr.id_variante').addGroupBy('p.id_producto').addGroupBy('ta.id_talla').addGroupBy('co.id_color')
      .having(`SUM(dv.cantidad-${this.returnedQty})>0`).orderBy('"cantidadVendida"', 'DESC').limit(100).getRawMany())
      .map((x) => ({ ...x, cantidadVendida: Number(x.cantidadVendida), totalGenerado: Number(x.totalGenerado) }));
  }

  async inventory(f: InventoryReportFiltersDto, scope: ReportScope) {
    const qb = this.inventarioRepo.createQueryBuilder('i').innerJoin('i.variante', 'v').innerJoin('v.producto', 'p').leftJoin('v.talla', 'ta').leftJoin('v.color', 'co')
      .innerJoin('i.sucursal', 's').innerJoin('i.almacen', 'a', 'a.id_sucursal=s.id_sucursal').select('p.nombre', 'producto').addSelect('v.id_variante', 'idVariante').addSelect('v.sku', 'sku')
      .addSelect('ta.nombre', 'talla').addSelect('co.nombre', 'color').addSelect('s.id_sucursal', 'idSucursal').addSelect('s.nombre', 'sucursal')
      .addSelect('a.id_almacen', 'idAlmacen').addSelect('a.nombre', 'almacen').addSelect('i.stock_disponible', 'stockDisponible')
      .addSelect('i.stock_reservado', 'stockReservado').addSelect('i.stock_disponible+i.stock_reservado', 'stockTotal');
    this.applyBranchScope(qb, 'i', f.idSucursal, scope);
    if (f.idAlmacen) qb.andWhere('i.id_almacen=:idAlmacen', { idAlmacen: f.idAlmacen }); if (f.idCategoria) qb.andWhere('p.id_categoria=:idCategoria', { idCategoria: f.idCategoria });
    if (f.stockCritico) qb.andWhere('i.stock_disponible<=:threshold', { threshold: f.threshold });
    const total = await qb.clone().getCount(); const items = await qb.orderBy('i.stock_disponible', 'ASC').offset((f.page - 1) * f.limit).limit(f.limit).getRawMany();
    return { items: items.map((x) => ({ ...x, stockDisponible: Number(x.stockDisponible), stockReservado: Number(x.stockReservado), stockTotal: Number(x.stockTotal) })), total, page: f.page, limit: f.limit };
  }

  async reservations(f: ReservationReportFiltersDto, scope: ReportScope) {
    const qb = this.reservaRepo.createQueryBuilder('r').leftJoin('r.sucursal', 's'); this.applyBranchScope(qb, 'r', f.idSucursal, scope);
    const { from, to } = this.dateBounds(f.desde, f.hasta); if (from) qb.andWhere('r.fecha_reserva>=:from', { from }); if (to) qb.andWhere('r.fecha_reserva<=:to', { to });
    if (f.estado) qb.andWhere('r.estado=:estado', { estado: f.estado });
    const stats = await qb.clone().select('r.estado', 'estado').addSelect('COUNT(*)', 'cantidad').groupBy('r.estado').getRawMany();
    const counts = Object.fromEntries(stats.map((x) => [x.estado, Number(x.cantidad)])); const total = Object.values(counts).reduce<number>((s, x) => s + Number(x), 0);
    const items = await qb.select(['r.idReserva','r.codigo','r.fechaReserva','r.estado','s.idSucursal','s.nombre']).orderBy('r.fecha_reserva', 'DESC').offset((f.page - 1) * f.limit).limit(f.limit).getMany();
    return { total, pendientes: counts.PENDIENTE ?? 0, preparadas: counts.PREPARADA ?? 0, atendidas: counts.ATENDIDA ?? 0, canceladas: counts.CANCELADA ?? 0, items, page: f.page, limit: f.limit };
  }

  async turns(f: TurnReportFiltersDto, scope: ReportScope) {
    const qb = this.turnoRepo.createQueryBuilder('t').innerJoin('t.caja', 'c').innerJoin('c.sucursal', 's').innerJoin('t.cajero', 'u')
      .leftJoin('venta', 'v', 'v.id_turno=t.id_turno AND v.estado IN (:...validStates)', { validStates: this.validStates }).leftJoin('detalle_venta', 'dv', 'dv.id_venta=v.id_venta')
      .select('t.id_turno', 'turno').addSelect('c.nombre', 'caja').addSelect('s.nombre', 'sucursal').addSelect("CONCAT_WS(' ',u.nombre,u.apellido)", 'cajero')
      .addSelect('t.fecha_apertura', 'fechaApertura').addSelect('t.fecha_cierre', 'fechaCierre').addSelect('t.monto_apertura', 'montoApertura')
      .addSelect('COUNT(DISTINCT v.id_venta)', 'ventas').addSelect(`COALESCE(SUM(dv.precio_unitario*(dv.cantidad-${this.returnedQty})),0)`, 'totalVentas').addSelect('t.monto_cierre_esperado', 'montoCierreEsperado')
      .addSelect('t.monto_cierre_declarado', 'montoCierreDeclarado').addSelect('t.diferencia', 'diferencia').addSelect('t.estado', 'estado');
    this.applyBranchScope(qb, 'c', f.idSucursal, scope); const { from, to } = this.dateBounds(f.desde, f.hasta);
    if (from) qb.andWhere('t.fecha_apertura>=:from', { from }); if (to) qb.andWhere('t.fecha_apertura<=:to', { to }); if (scope.cashierId) qb.andWhere('t.id_cajero=:scopeCashier', { scopeCashier: scope.cashierId });
    if (f.idCaja) qb.andWhere('t.id_caja=:idCaja', { idCaja: f.idCaja }); if (f.idCajero) qb.andWhere('t.id_cajero=:idCajero', { idCajero: f.idCajero }); if (f.estadoTurno) qb.andWhere('t.estado=:estadoTurno', { estadoTurno: f.estadoTurno });
    qb.groupBy('t.id_turno').addGroupBy('c.id_caja').addGroupBy('s.id_sucursal').addGroupBy('u.id_usuario');
    const total = await qb.clone().getCount(); const items = await qb.orderBy('t.fecha_apertura', 'DESC').offset((f.page - 1) * f.limit).limit(f.limit).getRawMany();
    return { items: items.map((x) => ({ ...x, ventas: Number(x.ventas), totalVentas: Number(x.totalVentas) })), total, page: f.page, limit: f.limit };
  }

  async paymentsByMethod(f: ReportFiltersDto, scope: ReportScope) {
    const refunded = `COALESCE((SELECT SUM(dd.cantidad*dv2.precio_unitario) FROM detalle_devolucion dd JOIN devolucion de ON de.id_devolucion=dd.id_devolucion JOIN detalle_venta dv2 ON dv2.id_detalle_venta=dd.id_detalle_venta WHERE de.id_venta=v.id_venta),0)`;
    const qb = this.pagoRepo.createQueryBuilder('p').innerJoin('p.venta', 'v').leftJoin('v.turno', 't').select('p.metodo', 'metodo').addSelect('COUNT(*)', 'cantidad').addSelect(`SUM(p.monto-${refunded})`, 'monto').where("p.estado='APROBADO'");
    this.applySalesFilters(qb, f, scope);
    return (await qb.groupBy('p.metodo').orderBy('"monto"', 'DESC').getRawMany()).map((x) => ({ metodo: x.metodo, cantidad: Number(x.cantidad), monto: Number(x.monto) }));
  }

  async salesCsv(f: ReportFiltersDto, scope: ReportScope) {
    const { items } = await this.sales(f, scope, false); const columns = ['idVenta','fecha','comprobante','tipoVenta','modalidadComercial','estado','sucursal','almacen','cajero','caja','idTurno','metodosPago','total'];
    const escape = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    return [columns.join(','), ...items.map((row: any) => columns.map((key) => escape(row[key])).join(','))].join('\r\n');
  }

  private applyBranchScope<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, alias: string, requested: number | undefined, scope: ReportScope) {
    if (scope.branchIds !== null) {
      if (scope.branchIds.length) qb.andWhere(`${alias}.id_sucursal IN (:...branchIds)`, { branchIds: scope.branchIds });
      else qb.andWhere('1=0');
    }
    if (requested) qb.andWhere(`${alias}.id_sucursal=:requestedBranch`, { requestedBranch: requested }); return qb;
  }
  private numericSalesRow(row: any) { return { ...row, cantidadVentas: Number(row.cantidadVentas), unidadesVendidas: Number(row.unidadesVendidas), totalVendido: Number(row.totalVendido) }; }

  getResumenGeneral() { return this.dashboard(new ReportFiltersDto(), { branchIds: null }); }
  getVentasPorDia(desde?: string, hasta?: string) { return this.salesByDay(Object.assign(new ReportFiltersDto(), { desde, hasta }), { branchIds: null }); }
  getTopProductosVendidos(limit = 10) { return this.topProducts(new ReportFiltersDto(), { branchIds: null }, limit); }
  getVentasPorSucursal() { return this.salesByBranch(new ReportFiltersDto(), { branchIds: null }); }
  async getInventarioCritico(umbral = 5) { return (await this.inventory(Object.assign(new InventoryReportFiltersDto(), { stockCritico: true, threshold: umbral, limit: 100 }), { branchIds: null })).items; }
  async getReservasPorEstado() { const r = await this.reservations(new ReservationReportFiltersDto(), { branchIds: null }); return [{ estado:'PENDIENTE',cantidad:r.pendientes },{ estado:'PREPARADA',cantidad:r.preparadas },{ estado:'ATENDIDA',cantidad:r.atendidas },{ estado:'CANCELADA',cantidad:r.canceladas }]; }
}
