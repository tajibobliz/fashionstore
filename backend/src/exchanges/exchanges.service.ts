import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../auth/enums/role.enum';
import { Producto } from '../catalog/entities/producto.entity';
import { VarianteProducto } from '../catalog/entities/variante-producto.entity';
import { toMoney } from '../common/utils/money.util';
import { Inventario } from '../inventory/entities/inventario.entity';
import { MovimientoInventario } from '../inventory/entities/movimiento-inventario.entity';
import { Venta } from '../sales/entities/venta.entity';
import { SalesService } from '../sales/sales.service';
import { Empresa } from '../tenancy/entities/empresa.entity';
import { BranchAccessService } from '../users/branch-access.service';
import { Almacen } from '../warehouses/entities/almacen.entity';
import { CreateCambioDto } from './dto/exchanges.dto';
import { Cambio } from './entities/cambio.entity';
import { DetalleCambio } from './entities/detalle-cambio.entity';
import { unidadesProcesadas } from './unidades-procesadas';

const DIA_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ExchangesService {
  constructor(
    @InjectRepository(Cambio) private readonly cambios: Repository<Cambio>,
    @InjectRepository(Venta) private readonly ventas: Repository<Venta>,
    @InjectRepository(Empresa) private readonly empresas: Repository<Empresa>,
    private readonly sales: SalesService,
    private readonly access: BranchAccessService,
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------ política de la empresa

  async politica(idEmpresa: number) {
    const empresa = await this.empresas.findOne({ where: { idEmpresa } });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    return { plazoCambioDias: empresa.plazoCambioDias };
  }

  async actualizarPolitica(idEmpresa: number, plazoCambioDias: number) {
    await this.empresas.update({ idEmpresa }, { plazoCambioDias });
    return this.politica(idEmpresa);
  }

  // ------------------------------------------------------------ consulta para la pantalla

  /** Venta con lo que todavía se puede cambiar y si está dentro del plazo. */
  async elegibilidad(actor: AuthenticatedUser, idVenta: number) {
    const venta = await this.ventaAutorizada(actor, idVenta);
    const { plazoCambioDias } = await this.politica(venta.idEmpresa);
    const venceEl = new Date(
      new Date(venta.fecha).getTime() + plazoCambioDias * DIA_MS,
    );
    const { devueltas, cambiadas } = await unidadesProcesadas(
      this.dataSource.manager,
      idVenta,
    );
    return {
      venta: {
        idVenta: venta.idVenta,
        numeroComprobante: venta.numeroComprobante,
        fecha: venta.fecha,
        estado: venta.estado,
        total: venta.total,
        sucursal: {
          idSucursal: venta.sucursal.idSucursal,
          nombre: venta.sucursal.nombre,
        },
        cliente: venta.usuario
          ? { nombre: venta.usuario.nombre, email: venta.usuario.email }
          : null,
      },
      plazoCambioDias,
      venceEl,
      dentroDelPlazo: plazoCambioDias > 0 && Date.now() <= venceEl.getTime(),
      admiteCambio: ['PAGADA', 'DEVUELTA_PARCIAL'].includes(venta.estado),
      detalles: venta.detalles.map((d) => {
        const dev = devueltas.get(d.idDetalleVenta) ?? 0;
        const cam = cambiadas.get(d.idDetalleVenta) ?? 0;
        return {
          idDetalleVenta: d.idDetalleVenta,
          cantidad: d.cantidad,
          devueltas: dev,
          cambiadas: cam,
          disponibles: Math.max(0, d.cantidad - dev - cam),
          precioUnitario: Number(d.precioUnitario),
          variante: {
            idVariante: d.variante.idVariante,
            sku: d.variante.sku,
            producto: d.variante.producto?.nombre ?? null,
            idProducto: d.variante.producto?.idProducto ?? null,
            talla: d.variante.talla?.nombre ?? null,
            color: d.variante.color?.nombre ?? null,
          },
        };
      }),
      cambios: (await this.porVenta(idVenta)).map((c) => this.vista(c)),
    };
  }

  porVenta(idVenta: number) {
    return this.cambios.find({
      where: { venta: { idVenta } },
      order: { fecha: 'DESC' },
    });
  }

  async listar(actor: AuthenticatedUser) {
    const qb = this.cambios
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.venta', 'v')
      .leftJoinAndSelect('v.sucursal', 's')
      .leftJoinAndSelect('c.usuarioRegistra', 'u')
      .leftJoinAndSelect('c.detalles', 'd')
      .leftJoinAndSelect('d.detalleVenta', 'dv')
      .leftJoinAndSelect('dv.variante', 'vo')
      .leftJoinAndSelect('vo.producto', 'po')
      .leftJoinAndSelect('d.varianteEntregada', 've')
      .leftJoinAndSelect('ve.producto', 'pe')
      .orderBy('c.fecha', 'DESC')
      .take(100);
    const ids = await this.access.accessibleBranchIds(actor);
    if (ids !== null) {
      if (!ids.length) return [];
      qb.andWhere('s.id_sucursal IN (:...ids)', { ids });
    }
    return (await qb.getMany()).map((c) => this.vista(c));
  }

  // ------------------------------------------------------------ registrar el cambio

  async crear(actor: AuthenticatedUser, dto: CreateCambioDto) {
    // Validaciones sin bloqueo (venta de esta empresa y sucursal permitida).
    await this.ventaAutorizada(actor, dto.idVenta);

    const guardado = await this.dataSource.transaction(async (m) => {
      // Bloquear la venta: dos cajas no pueden cambiar la misma prenda a la vez.
      await m
        .createQueryBuilder(Venta, 'v')
        .setLock('pessimistic_write')
        .where('v.id_venta = :id', { id: dto.idVenta })
        .getOne();
      const venta = await m.findOne(Venta, { where: { idVenta: dto.idVenta } });
      if (!venta)
        throw new NotFoundException(`Venta ${dto.idVenta} no encontrada`);
      if (!['PAGADA', 'DEVUELTA_PARCIAL'].includes(venta.estado)) {
        throw new BadRequestException(
          `Solo se cambian prendas de una venta pagada. Estado actual: ${venta.estado}`,
        );
      }

      // Plazo de cambio de la empresa.
      const empresa = await m.findOne(Empresa, {
        where: { idEmpresa: venta.idEmpresa },
      });
      const plazo = empresa?.plazoCambioDias ?? 0;
      const vence = new Date(new Date(venta.fecha).getTime() + plazo * DIA_MS);
      if (plazo <= 0 || Date.now() > vence.getTime()) {
        throw new BadRequestException(
          plazo <= 0
            ? 'La tienda no acepta cambios de prendas'
            : `Fuera de plazo: los cambios se aceptan hasta ${plazo} días después de la compra (venció el ${vence.toLocaleDateString('es-BO')})`,
        );
      }

      // Unidades que todavía se pueden cambiar en cada línea.
      const { devueltas, cambiadas } = await unidadesProcesadas(
        m,
        venta.idVenta,
      );
      const pedidos = new Map<number, number>();
      for (const item of dto.detalles)
        pedidos.set(
          item.idDetalleVenta,
          (pedidos.get(item.idDetalleVenta) ?? 0) + item.cantidad,
        );
      for (const [idDetalleVenta, cantidad] of pedidos) {
        const linea = venta.detalles.find(
          (d) => d.idDetalleVenta === idDetalleVenta,
        );
        if (!linea)
          throw new BadRequestException(
            `La línea ${idDetalleVenta} no pertenece a esta venta`,
          );
        const disponibles =
          linea.cantidad -
          (devueltas.get(idDetalleVenta) ?? 0) -
          (cambiadas.get(idDetalleVenta) ?? 0);
        if (cantidad > disponibles) {
          throw new BadRequestException(
            `Solo quedan ${Math.max(0, disponibles)} unidad(es) por cambiar de ${linea.variante.producto?.nombre ?? linea.variante.sku}`,
          );
        }
      }

      const almacen =
        venta.almacen ??
        (await m.findOne(Almacen, {
          where: {
            sucursal: { idSucursal: venta.sucursal.idSucursal },
            codigo: 'PRINCIPAL',
          },
        }));
      if (!almacen)
        throw new NotFoundException('No existe el almacén de la venta');

      // Variantes nuevas válidas y activas.
      const nuevas = new Map<
        number,
        { variante: VarianteProducto; producto: Producto }
      >();
      for (const item of dto.detalles) {
        if (nuevas.has(item.idVarianteNueva)) continue;
        const variante = await m.findOne(VarianteProducto, {
          where: { idVariante: item.idVarianteNueva },
        });
        if (!variante)
          throw new NotFoundException(
            `Variante ${item.idVarianteNueva} no encontrada`,
          );
        const producto = await m.findOne(Producto, {
          where: { idProducto: variante.producto.idProducto },
        });
        if (!producto || !producto.estado)
          throw new BadRequestException(
            `El producto de la variante ${item.idVarianteNueva} no está activo`,
          );
        nuevas.set(item.idVarianteNueva, { variante, producto });
      }

      // Movimientos de inventario: se bloquean las filas en orden de idVariante (evita deadlocks).
      const variacion = new Map<number, number>();
      for (const item of dto.detalles) {
        const linea = venta.detalles.find(
          (d) => d.idDetalleVenta === item.idDetalleVenta,
        )!;
        variacion.set(
          linea.variante.idVariante,
          (variacion.get(linea.variante.idVariante) ?? 0) + item.cantidad,
        );
        variacion.set(
          item.idVarianteNueva,
          (variacion.get(item.idVarianteNueva) ?? 0) - item.cantidad,
        );
      }
      const referencia = `Cambio venta ${venta.numeroComprobante ?? venta.idVenta}`;
      for (const idVariante of [...variacion.keys()].sort((a, b) => a - b)) {
        const delta = variacion.get(idVariante)!;
        const inventario = await m
          .createQueryBuilder(Inventario, 'i')
          .setLock('pessimistic_write')
          .where('i.id_almacen = :a AND i.id_variante = :v', {
            a: almacen.idAlmacen,
            v: idVariante,
          })
          .getOne();
        if (!inventario) {
          if (delta < 0)
            throw new BadRequestException(
              `La prenda nueva (variante ${idVariante}) no tiene inventario en esta sucursal`,
            );
          throw new NotFoundException(
            `No existe el inventario original de la variante ${idVariante}`,
          );
        }
        if (delta < 0 && inventario.stockDisponible < -delta) {
          throw new BadRequestException(
            `No hay stock suficiente de la prenda nueva (variante ${idVariante}): quedan ${inventario.stockDisponible}`,
          );
        }
        if (delta === 0) continue; // misma talla y color (p. ej. prenda fallada): entra y sale una igual
        inventario.stockDisponible += delta;
        await m.save(inventario);
        await m.save(
          m.create(MovimientoInventario, {
            inventario,
            tipo: delta > 0 ? 'CAMBIO_ENTRADA' : 'CAMBIO_SALIDA',
            cantidad: Math.abs(delta),
            referencia,
          }),
        );
      }

      // Diferencia de precio: precio vigente de la prenda nueva vs. lo que se pagó por la original.
      let diferencia = 0;
      const detalles: DetalleCambio[] = [];
      for (const item of dto.detalles) {
        const linea = venta.detalles.find(
          (d) => d.idDetalleVenta === item.idDetalleVenta,
        )!;
        const { variante, producto } = nuevas.get(item.idVarianteNueva)!;
        const precioOriginal = Number(linea.precioUnitario);
        const precioNuevo = await this.sales.precioVigente(producto);
        diferencia = toMoney(
          diferencia + (precioNuevo - precioOriginal) * item.cantidad,
        );
        detalles.push(
          m.create(DetalleCambio, {
            cantidad: item.cantidad,
            detalleVenta: linea,
            varianteEntregada: variante,
            precioOriginal,
            precioNuevo,
          }),
        );
      }
      if (diferencia > 0 && !dto.metodoPagoDiferencia) {
        throw new BadRequestException(
          `La prenda nueva cuesta Bs ${diferencia.toFixed(2)} más: indica cómo paga la clienta la diferencia`,
        );
      }

      return m.save(
        m.create(Cambio, {
          venta,
          motivo: dto.motivo?.trim() || null,
          usuarioRegistra: { idUsuario: actor.idUsuario } as any,
          diferencia,
          metodoPagoDiferencia:
            diferencia > 0 ? dto.metodoPagoDiferencia! : null,
          detalles,
        }),
      );
    });
    const completo = await this.cambios.findOne({
      where: { idCambio: guardado.idCambio },
    });
    return this.vista(completo!);
  }

  // ------------------------------------------------------------ ayudas

  private async ventaAutorizada(actor: AuthenticatedUser, idVenta: number) {
    if (
      ![
        Role.ADMIN,
        Role.ENCARGADO,
        Role.ENCARGADO_SUCURSAL,
        Role.CAJERO,
      ].includes(actor.rol)
    ) {
      throw new ForbiddenException('Tu rol no registra cambios');
    }
    const venta = await this.ventas.findOne({ where: { idVenta } });
    if (!venta) throw new NotFoundException(`Venta ${idVenta} no encontrada`);
    await this.access.assertCanAccess(actor, venta.sucursal.idSucursal);
    return venta;
  }

  private vista(c: Cambio) {
    return {
      idCambio: c.idCambio,
      fecha: c.fecha,
      motivo: c.motivo,
      diferencia: Number(c.diferencia),
      metodoPagoDiferencia: c.metodoPagoDiferencia,
      venta: {
        idVenta: c.venta.idVenta,
        numeroComprobante: c.venta.numeroComprobante,
        sucursal: c.venta.sucursal?.nombre ?? null,
      },
      registradoPor: c.usuarioRegistra
        ? `${c.usuarioRegistra.nombre} ${c.usuarioRegistra.apellido ?? ''}`.trim()
        : null,
      detalles: c.detalles.map((d) => ({
        cantidad: d.cantidad,
        devuelve: this.nombre(d.detalleVenta.variante),
        entrega: this.nombre(d.varianteEntregada),
        precioOriginal: Number(d.precioOriginal),
        precioNuevo: Number(d.precioNuevo),
      })),
    };
  }

  private nombre(v: VarianteProducto) {
    const extra = [v.talla?.nombre, v.color?.nombre]
      .filter(Boolean)
      .join(' / ');
    return `${v.producto?.nombre ?? v.sku}${extra ? ` (${extra})` : ''}`;
  }
}
