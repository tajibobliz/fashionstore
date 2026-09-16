import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThanOrEqual, Repository } from 'typeorm';
import { Venta } from '../sales/entities/venta.entity';
import { DetalleVenta } from '../sales/entities/detalle-venta.entity';
import { Reserva } from '../reservations/entities/reserva.entity';
import { Inventario } from '../inventory/entities/inventario.entity';
import { Producto } from '../catalog/entities/producto.entity';
import { Usuario } from '../users/entities/user.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Venta) private readonly ventaRepo: Repository<Venta>,
    @InjectRepository(DetalleVenta) private readonly detalleVentaRepo: Repository<DetalleVenta>,
    @InjectRepository(Reserva) private readonly reservaRepo: Repository<Reserva>,
    @InjectRepository(Inventario) private readonly inventarioRepo: Repository<Inventario>,
    @InjectRepository(Producto) private readonly productoRepo: Repository<Producto>,
    @InjectRepository(Usuario) private readonly usuarioRepo: Repository<Usuario>,
  ) {}

  // Resumen general para el dashboard principal
  async getResumenGeneral() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const [
      totalUsuarios,
      totalProductos,
      ventasHoy,
      ventasMes,
      reservasActivas,
      productosSinStock,
    ] = await Promise.all([
      this.usuarioRepo.count({ where: { estado: true } }),
      this.productoRepo.count({ where: { estado: true } }),
      this.ventaRepo.count({
        where: { fecha: MoreThanOrEqual(hoy), estado: 'PAGADA' },
      }),
      this.ventaRepo
        .createQueryBuilder('v')
        .select('COALESCE(SUM(v.total), 0)', 'total')
        .where('v.fecha >= :inicio', { inicio: inicioMes })
        .andWhere('v.estado = :estado', { estado: 'PAGADA' })
        .getRawOne(),
      this.reservaRepo.count({ where: { estado: 'PENDIENTE' } }),
      this.inventarioRepo.count({ where: { stockDisponible: 0 } }),
    ]);

    return {
      totalUsuarios,
      totalProductos,
      ventasHoy,
      montoVentasMes: Number(ventasMes?.total ?? 0),
      reservasActivas,
      productosSinStock,
    };
  }

  // Ventas por día en un rango (para gráficos de línea)
  async getVentasPorDia(desde?: string, hasta?: string) {
    const fechaDesde = desde ? new Date(desde) : this.hace30Dias();
    const fechaHasta = hasta ? new Date(hasta) : new Date();

    const result = await this.ventaRepo
      .createQueryBuilder('v')
      .select("DATE(v.fecha)", 'fecha')
      .addSelect('COUNT(*)', 'cantidad')
      .addSelect('SUM(v.total)', 'monto')
      .where('v.fecha BETWEEN :desde AND :hasta', { desde: fechaDesde, hasta: fechaHasta })
      .andWhere('v.estado = :estado', { estado: 'PAGADA' })
      .groupBy('DATE(v.fecha)')
      .orderBy('DATE(v.fecha)', 'ASC')
      .getRawMany();

    return result.map((r) => ({
      fecha: r.fecha,
      cantidad: Number(r.cantidad),
      monto: Number(r.monto),
    }));
  }

  // Productos más vendidos
  async getTopProductosVendidos(limit: number = 10) {
    const result = await this.detalleVentaRepo
      .createQueryBuilder('dv')
      .select('p.id_producto', 'idProducto')
      .addSelect('p.nombre', 'nombre')
      .addSelect('SUM(dv.cantidad)', 'unidadesVendidas')
      .addSelect('SUM(dv.subtotal)', 'montoTotal')
      .innerJoin('dv.variante', 'v')
      .innerJoin('v.producto', 'p')
      .innerJoin('dv.venta', 've')
      .where("ve.estado = 'PAGADA'")
      .groupBy('p.id_producto')
      .addGroupBy('p.nombre')
      .orderBy('"unidadesVendidas"', 'DESC')
      .limit(limit)
      .getRawMany();

    return result.map((r) => ({
      idProducto: r.idProducto,
      nombre: r.nombre,
      unidadesVendidas: Number(r.unidadesVendidas),
      montoTotal: Number(r.montoTotal),
    }));
  }

  // Ventas por sucursal
  async getVentasPorSucursal() {
    const result = await this.ventaRepo
      .createQueryBuilder('v')
      .select('s.id_sucursal', 'idSucursal')
      .addSelect('s.nombre', 'nombre')
      .addSelect('COUNT(v.id_venta)', 'cantidadVentas')
      .addSelect('COALESCE(SUM(v.total), 0)', 'montoTotal')
      .innerJoin('v.sucursal', 's')
      .where("v.estado = 'PAGADA'")
      .groupBy('s.id_sucursal')
      .addGroupBy('s.nombre')
      .orderBy('"montoTotal"', 'DESC')
      .getRawMany();

    return result.map((r) => ({
      idSucursal: r.idSucursal,
      nombre: r.nombre,
      cantidadVentas: Number(r.cantidadVentas),
      montoTotal: Number(r.montoTotal),
    }));
  }

  // Inventario crítico: productos con stock bajo o cero
  async getInventarioCritico(umbral: number = 5) {
    const result = await this.inventarioRepo
      .createQueryBuilder('i')
      .innerJoinAndSelect('i.variante', 'v')
      .innerJoinAndSelect('v.producto', 'p')
      .innerJoinAndSelect('i.sucursal', 's')
      .where('i.stock_disponible <= :umbral', { umbral })
      .orderBy('i.stock_disponible', 'ASC')
      .getMany();

    return result.map((inv) => ({
      idInventario: inv.idInventario,
      producto: inv.variante.producto.nombre,
      sku: inv.variante.sku,
      sucursal: inv.sucursal.nombre,
      stockDisponible: inv.stockDisponible,
      stockReservado: inv.stockReservado,
    }));
  }

  // Reservas por estado (para dashboard de encargado)
  async getReservasPorEstado() {
    const result = await this.reservaRepo
      .createQueryBuilder('r')
      .select('r.estado', 'estado')
      .addSelect('COUNT(*)', 'cantidad')
      .groupBy('r.estado')
      .getRawMany();

    return result.map((r) => ({
      estado: r.estado,
      cantidad: Number(r.cantidad),
    }));
  }

  // Utilidad: fecha 30 días atrás
  private hace30Dias(): Date {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }
}