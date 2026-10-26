import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../auth/enums/role.enum';
import { Sucursal } from '../branches/entities/sucursal.entity';
import { VarianteProducto } from '../catalog/entities/variante-producto.entity';
import { Inventario } from '../inventory/entities/inventario.entity';
import { ReservationsService } from '../reservations/reservations.service';
import { SalesService } from '../sales/sales.service';
import { BranchAccessService } from '../users/branch-access.service';
import { Almacen } from '../warehouses/entities/almacen.entity';
import { OperacionDto, SyncOperationsDto } from './dto/sync.dto';
import {
  DetalleOperacionSync,
  EstadoOperacionSync,
  OperacionSync,
  TipoConflictoSync,
} from './entities/operacion-sync.entity';

/** Lo que el servidor responde por cada operación (contrato §6.2 del plan). */
export interface ResultadoOperacion {
  operationId: string;
  status: EstadoOperacionSync;
  serverId: number | null;
  conflictos: TipoConflictoSync[];
  reason: string | null;
  /** true si la operación ya había llegado antes (reintento): se devuelve el resultado guardado. */
  duplicada: boolean;
  alternativas?: DetalleOperacionSync['alternativas'];
}

type Evaluacion = Pick<
  OperacionSync,
  'estado' | 'serverId' | 'motivo' | 'detalle'
> & {
  conflictos: TipoConflictoSync[];
};

const ROLES_VENTA = [
  Role.CAJERO,
  Role.ENCARGADO_SUCURSAL,
  Role.ENCARGADO,
  Role.ADMIN,
];

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(OperacionSync)
    private readonly operaciones: Repository<OperacionSync>,
    @InjectRepository(Sucursal)
    private readonly sucursales: Repository<Sucursal>,
    @InjectRepository(Almacen) private readonly almacenes: Repository<Almacen>,
    @InjectRepository(VarianteProducto)
    private readonly variantes: Repository<VarianteProducto>,
    @InjectRepository(Inventario)
    private readonly inventarios: Repository<Inventario>,
    private readonly sales: SalesService,
    private readonly reservations: ReservationsService,
    private readonly access: BranchAccessService,
    private readonly config: ConfigService,
  ) {}

  // ---------------------------------------------------------------- catálogo offline

  /**
   * Foto del catálogo de una sucursal para trabajar sin conexión: productos activos, variantes,
   * precio vigente y stock disponible del almacén principal. `serverTime` se guarda en el
   * dispositivo y se reenvía con cada venta para saber con qué precios se vendió.
   */
  async catalogo(idSucursal: number) {
    const sucursal = await this.sucursales.findOne({ where: { idSucursal } });
    if (!sucursal || !sucursal.estado)
      throw new NotFoundException('Sucursal no encontrada');
    const almacen = await this.almacenes.findOne({
      where: { sucursal: { idSucursal }, codigo: 'PRINCIPAL', estado: true },
    });
    const serverTime = new Date().toISOString();

    const variantes = await this.variantes
      .createQueryBuilder('v')
      .innerJoinAndSelect('v.producto', 'p')
      .leftJoinAndSelect('p.categoria', 'cat')
      .leftJoinAndSelect('v.talla', 't')
      .leftJoinAndSelect('v.color', 'c')
      .where('p.estado = true')
      .orderBy('p.nombre', 'ASC')
      .addOrderBy('v.id_variante', 'ASC')
      .getMany();
    const stock = new Map<number, number>();
    if (almacen) {
      const filas = await this.inventarios.find({
        where: { almacen: { idAlmacen: almacen.idAlmacen } },
      });
      for (const f of filas)
        stock.set(f.variante.idVariante, f.stockDisponible);
    }

    const productos = new Map<number, any>();
    for (const v of variantes) {
      const p = v.producto;
      if (!productos.has(p.idProducto)) {
        productos.set(p.idProducto, {
          idProducto: p.idProducto,
          nombre: p.nombre,
          categoria: p.categoria?.nombre ?? null,
          imagenUrl: p.imagenUrl ?? null,
          precio: Number(p.precio),
          precioFinal: await this.sales.precioVigente(p),
          variantes: [],
        });
      }
      productos.get(p.idProducto).variantes.push({
        idVariante: v.idVariante,
        sku: v.sku,
        talla: v.talla?.nombre ?? null,
        color: v.color?.nombre ?? null,
        stockDisponible: stock.get(v.idVariante) ?? 0,
      });
    }
    return {
      serverTime,
      sucursal: { idSucursal: sucursal.idSucursal, nombre: sucursal.nombre },
      productos: [...productos.values()],
    };
  }

  // ---------------------------------------------------------------- operaciones offline

  /**
   * Procesa las operaciones de un dispositivo en el orden en que se crearon en él.
   * Cada una es independiente: si una falla, las demás siguen. Un error inesperado
   * (p. ej. la BD cae) corta el lote; el dispositivo reintenta y las ya procesadas
   * devuelven su resultado guardado (idempotencia).
   */
  async sincronizar(actor: AuthenticatedUser, dto: SyncOperationsDto) {
    if (actor.rol === Role.SUPER_ADMIN || !actor.idEmpresa) {
      throw new ForbiddenException(
        'La sincronización es para usuarios de una empresa',
      );
    }
    const ordenadas = [...dto.operations].sort(
      (a, b) =>
        new Date(a.createdAtLocal).getTime() -
        new Date(b.createdAtLocal).getTime(),
    );
    const results: ResultadoOperacion[] = [];
    for (const op of ordenadas)
      results.push(await this.procesar(actor, dto.deviceId, op));
    return { serverTime: new Date().toISOString(), results };
  }

  private async procesar(
    actor: AuthenticatedUser,
    deviceId: string,
    op: OperacionDto,
  ): Promise<ResultadoOperacion> {
    const previa = await this.operaciones.findOne({
      where: { operationId: op.operationId },
    });
    if (previa) return this.reintento(previa);

    let evaluacion: Evaluacion;
    try {
      evaluacion =
        op.type === 'VENTA'
          ? await this.procesarVenta(actor, op)
          : await this.procesarReserva(actor, op);
    } catch (error) {
      // Errores de negocio (403/404/400) = la operación no es válida → RECHAZADA, queda en el panel.
      if (!(error instanceof HttpException)) throw error;
      evaluacion = {
        estado: 'RECHAZADA',
        serverId: null,
        conflictos: [],
        motivo: this.mensaje(error),
        detalle: {
          items: op.payload.detalles.map(({ idVariante, cantidad }) => ({
            idVariante,
            cantidad,
          })),
        },
      };
    }

    const registro = this.operaciones.create({
      operationId: op.operationId,
      deviceId,
      tipo: op.type,
      estado: evaluacion.estado,
      conflictos: evaluacion.conflictos.length
        ? evaluacion.conflictos.join(',')
        : null,
      motivo: evaluacion.motivo?.slice(0, 300) ?? null,
      serverId: evaluacion.serverId,
      sucursal: { idSucursal: op.idSucursal } as Sucursal,
      usuario: { idUsuario: actor.idUsuario } as any,
      creadaLocalEn: new Date(op.createdAtLocal),
      detalle: evaluacion.detalle,
    });
    try {
      await this.operaciones.save(registro);
    } catch (error) {
      // Dos envíos simultáneos de la misma operación: gana el que se guardó primero.
      if (
        error instanceof QueryFailedError &&
        (error as any).driverError?.code === '23505'
      ) {
        const existente = await this.operaciones.findOne({
          where: { operationId: op.operationId },
        });
        if (existente) return this.reintento(existente);
      }
      throw error;
    }
    this.logger.log(
      `sync ${op.type} ${op.operationId} → ${registro.estado}${registro.conflictos ? ` (${registro.conflictos})` : ''}`,
    );
    return this.resultado(registro, false);
  }

  private async procesarVenta(
    actor: AuthenticatedUser,
    op: OperacionDto,
  ): Promise<Evaluacion> {
    if (!ROLES_VENTA.includes(actor.rol))
      throw new ForbiddenException('Tu rol no puede registrar ventas');
    await this.access.assertCanAccess(actor, op.idSucursal);
    const p = op.payload;
    const r = await this.sales.registrarVentaOffline(actor, {
      operationId: op.operationId,
      idSucursal: op.idSucursal,
      idCaja: p.idCaja,
      idTurno: p.idTurno,
      idUsuario: p.idUsuario,
      modalidadComercial: p.modalidadComercial,
      metodoPago: p.metodoPago,
      referenciaPago: p.referenciaPago,
      detalles: p.detalles,
    });

    // El precio local se acepta sin aviso si el catálogo era reciente (ventana configurable).
    const precios = this.preciosDentroDeVentana(op) ? [] : r.precios;
    const conflictos: TipoConflictoSync[] = [];
    const motivos: string[] = [];
    if (r.faltantes.length) {
      conflictos.push('STOCK');
      motivos.push(
        `Faltó stock: ${r.faltantes.map((f) => `variante ${f.idVariante} (${f.faltante})`).join(', ')}. Revisa el inventario físico y haz un ajuste`,
      );
    }
    if (precios.length) {
      conflictos.push('PRECIO');
      motivos.push(
        'Se cobró un precio distinto al vigente; se registró el precio cobrado',
      );
    }
    if (r.turnoCerrado) {
      conflictos.push('TURNO_CERRADO');
      motivos.push('El turno ya estaba cerrado: revisa el arqueo de caja');
    }
    const faltante = new Map(
      r.faltantes.map((f) => [f.idVariante, f.faltante]),
    );
    const precio = new Map(r.precios.map((x) => [x.idVariante, x]));
    return {
      estado: conflictos.length ? 'CONFLICTO' : 'CONFIRMADA',
      serverId: r.venta.idVenta,
      conflictos,
      motivo: motivos.length ? motivos.join('. ') : null,
      detalle: {
        items: p.detalles.map(({ idVariante, cantidad, precioUnitario }) => ({
          idVariante,
          cantidad,
          precioLocal: precioUnitario,
          precioServidor: precio.get(idVariante)?.precioServidor,
          faltante: faltante.get(idVariante),
        })),
      },
    };
  }

  private async procesarReserva(
    actor: AuthenticatedUser,
    op: OperacionDto,
  ): Promise<Evaluacion> {
    const items = op.payload.detalles.map(({ idVariante, cantidad }) => ({
      idVariante,
      cantidad,
    }));
    // Lo que hace inválida la operación se rechaza antes de intentar reservar.
    const sucursal = await this.sucursales.findOne({
      where: { idSucursal: op.idSucursal },
    });
    if (!sucursal || !sucursal.estado)
      throw new NotFoundException('Sucursal no encontrada');
    const encontradas = await this.variantes.find({
      where: { idVariante: In(items.map((i) => i.idVariante)) },
    });
    for (const i of items) {
      const v = encontradas.find((x) => x.idVariante === i.idVariante);
      if (!v)
        throw new NotFoundException(`Variante ${i.idVariante} no encontrada`);
      if (!v.producto.estado)
        throw new BadRequestException(
          `El producto de la variante ${i.idVariante} ya no está activo`,
        );
    }

    try {
      const reserva = await this.reservations.create(actor.idUsuario, {
        clientRequestId: op.operationId,
        idSucursal: op.idSucursal,
        detalles: items,
      });
      return {
        estado: 'CONFIRMADA',
        serverId: reserva.idReserva,
        conflictos: [],
        motivo: null,
        detalle: { items },
      };
    } catch (error) {
      // Aquí solo queda la falta de stock: la reserva no se crea y se ofrecen otras sucursales.
      if (!(
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ))
        throw error;
      return {
        estado: 'CONFLICTO',
        serverId: null,
        conflictos: ['SIN_STOCK'],
        motivo: `No se pudo reservar: ${this.mensaje(error)}`,
        detalle: {
          items,
          alternativas: await this.alternativas(op.idSucursal, items),
        },
      };
    }
  }

  /** Otras sucursales de la empresa con stock suficiente para cada prenda. */
  private async alternativas(
    idSucursal: number,
    items: { idVariante: number; cantidad: number }[],
  ) {
    const filas = await this.inventarios
      .createQueryBuilder('i')
      .innerJoinAndSelect('i.almacen', 'a')
      .innerJoinAndSelect('a.sucursal', 's')
      .innerJoinAndSelect('i.variante', 'v')
      .where('v.id_variante IN (:...ids)', {
        ids: items.map((i) => i.idVariante),
      })
      .andWhere(
        "a.codigo = 'PRINCIPAL' AND a.estado = true AND s.estado = true",
      )
      .andWhere('s.id_sucursal <> :idSucursal', { idSucursal })
      .getMany();
    return filas
      .filter(
        (f) =>
          f.stockDisponible >=
          (items.find((i) => i.idVariante === f.variante.idVariante)
            ?.cantidad ?? 1),
      )
      .map((f) => ({
        idSucursal: f.almacen.sucursal.idSucursal,
        sucursal: f.almacen.sucursal.nombre,
        idVariante: f.variante.idVariante,
        stock: f.stockDisponible,
      }));
  }

  private preciosDentroDeVentana(op: OperacionDto) {
    const desde = op.payload.catalogoDescargadoEn;
    if (!desde) return false;
    const horas = Number(this.config.get('SYNC_VENTANA_PRECIO_HORAS') ?? 24);
    const venta = Math.min(new Date(op.createdAtLocal).getTime(), Date.now());
    return venta - new Date(desde).getTime() <= horas * 3_600_000;
  }

  private async reintento(previa: OperacionSync) {
    await this.operaciones.increment(
      { idOperacionSync: previa.idOperacionSync },
      'intentos',
      1,
    );
    return this.resultado(previa, true);
  }

  private resultado(o: OperacionSync, duplicada: boolean): ResultadoOperacion {
    return {
      operationId: o.operationId,
      status: o.estado,
      serverId: o.serverId,
      conflictos: (o.conflictos?.split(',') ?? []) as TipoConflictoSync[],
      reason: o.motivo,
      duplicada,
      ...(o.detalle?.alternativas
        ? { alternativas: o.detalle.alternativas }
        : {}),
    };
  }

  private mensaje(error: HttpException) {
    const r = error.getResponse() as string | { message?: string | string[] };
    const m = typeof r === 'string' ? r : r.message;
    return Array.isArray(m) ? m.join('. ') : (m ?? error.message);
  }

  // ---------------------------------------------------------------- panel de conflictos

  /**
   * Operaciones sincronizadas, para el panel del encargado. `pendientes` = conflictos y rechazos
   * que nadie revisó todavía. El encargado de sucursal solo ve las de sus sucursales.
   */
  async listar(actor: AuthenticatedUser, pendientes: boolean) {
    const qb = this.operaciones
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.sucursal', 's')
      .leftJoinAndSelect('o.usuario', 'u')
      .orderBy('o.recibidaEn', 'DESC')
      .take(200);
    const ids = await this.access.accessibleBranchIds(actor);
    if (ids !== null) {
      if (!ids.length) return [];
      qb.andWhere('s.id_sucursal IN (:...ids)', { ids });
    }
    if (pendientes)
      qb.andWhere(
        "o.estado IN ('CONFLICTO','RECHAZADA') AND o.resuelta = false",
      );
    return (await qb.getMany()).map((o) => this.vista(o));
  }

  async resumen(actor: AuthenticatedUser) {
    const todas = await this.listar(actor, false);
    const desde = Date.now() - 24 * 3_600_000;
    const recientes = todas.filter((o) => o.recibidaEn.getTime() >= desde);
    const contar = (estado: EstadoOperacionSync) =>
      recientes.filter((o) => o.estado === estado).length;
    return {
      pendientes: todas.filter((o) => o.estado !== 'CONFIRMADA' && !o.resuelta)
        .length,
      ultimas24h: {
        confirmadas: contar('CONFIRMADA'),
        conflictos: contar('CONFLICTO'),
        rechazadas: contar('RECHAZADA'),
      },
    };
  }

  async resolver(actor: AuthenticatedUser, id: number, nota: string) {
    const o = await this.operaciones.findOne({
      where: { idOperacionSync: id },
    });
    if (!o) throw new NotFoundException('Operación no encontrada');
    if (o.sucursal)
      await this.access.assertCanAccess(actor, o.sucursal.idSucursal);
    if (o.estado === 'CONFIRMADA')
      throw new BadRequestException(
        'La operación se confirmó sin problemas: no hay nada que resolver',
      );
    if (o.resuelta)
      throw new BadRequestException('El conflicto ya fue resuelto');
    o.resuelta = true;
    o.resueltaEn = new Date();
    o.resueltaPor = { idUsuario: actor.idUsuario } as any;
    o.notaResolucion = nota.trim();
    return this.vista(await this.operaciones.save(o));
  }

  /** Datos para la pantalla, sin exponer la entidad Usuario completa. */
  private vista(o: OperacionSync) {
    return {
      idOperacionSync: o.idOperacionSync,
      operationId: o.operationId,
      tipo: o.tipo,
      estado: o.estado,
      conflictos: (o.conflictos?.split(',') ?? []) as TipoConflictoSync[],
      motivo: o.motivo,
      serverId: o.serverId,
      deviceId: o.deviceId,
      sucursal: o.sucursal
        ? { idSucursal: o.sucursal.idSucursal, nombre: o.sucursal.nombre }
        : null,
      usuario: o.usuario
        ? {
            idUsuario: o.usuario.idUsuario,
            nombre: `${o.usuario.nombre} ${o.usuario.apellido ?? ''}`.trim(),
            rol: o.usuario.rol?.nombre ?? null,
          }
        : null,
      creadaLocalEn: o.creadaLocalEn,
      recibidaEn: o.recibidaEn,
      intentos: o.intentos,
      detalle: o.detalle,
      resuelta: o.resuelta,
      resueltaEn: o.resueltaEn,
      notaResolucion: o.notaResolucion,
    };
  }
}
