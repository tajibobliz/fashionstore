import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../auth/enums/role.enum';
import { Sucursal } from '../branches/entities/sucursal.entity';
import { VarianteProducto } from '../catalog/entities/variante-producto.entity';
import { Inventario } from '../inventory/entities/inventario.entity';
import { MovimientoInventario } from '../inventory/entities/movimiento-inventario.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { BranchAccessService } from '../users/branch-access.service';
import { Almacen } from '../warehouses/entities/almacen.entity';
import {
  CancelarTraspasoDto,
  CreateTraspasoDto,
  RecibirTraspasoDto,
} from './dto/transfers.dto';
import { DetalleTraspaso } from './entities/detalle-traspaso.entity';
import { EstadoTraspaso, Traspaso } from './entities/traspaso.entity';

/** Empresa del usuario; el administrador de la plataforma (sin empresa) no opera traspasos. */
function emp(actor: AuthenticatedUser): number {
  if (actor.idEmpresa == null)
    throw new ForbiddenException(
      'Los traspasos se gestionan dentro de una empresa',
    );
  return actor.idEmpresa;
}

export const ROLES_TRASPASO = [
  Role.ADMIN,
  Role.ENCARGADO,
  Role.ENCARGADO_SUCURSAL,
];

/**
 * Traspasos de inventario entre sucursales (CU14, RF-025, RN-013).
 *
 * Flujo: el origen envía → el stock sale de su almacén y el traspaso queda EN_TRANSITO →
 * el destino recibe (todo, una parte o nada) → lo recibido entra a su almacén y la
 * diferencia queda como merma. Mientras está en tránsito el origen puede cancelarlo y
 * el stock vuelve. Cada paso es una transacción con bloqueo de filas, así dos personas
 * no pueden recibir o cancelar el mismo traspaso a la vez ni vender stock que ya salió.
 */
@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    @InjectRepository(Traspaso)
    private readonly traspasos: Repository<Traspaso>,
    @InjectRepository(Sucursal)
    private readonly sucursales: Repository<Sucursal>,
    private readonly access: BranchAccessService,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------ stock por sucursal

  /** "El sistema muestra el stock por sucursal": variantes con su stock disponible en cada sucursal. */
  async stock(actor: AuthenticatedUser, q?: string) {
    const sucursales = await this.sucursales.find({
      where: { idEmpresa: emp(actor), estado: true },
      order: { nombre: 'ASC' },
    });
    const texto = q?.trim() ? `%${q.trim()}%` : null;
    const filas: Array<{
      id_variante: number;
      sku: string;
      producto: string;
      talla: string | null;
      color: string | null;
      id_sucursal: number | null;
      disponible: number | null;
    }> = await this.dataSource.query(
      `WITH par AS (SELECT $1::int AS emp, $2::text AS texto),
       variantes AS (
         SELECT v.id_variante, v.sku, p.nombre AS producto, t.nombre AS talla, c.nombre AS color,
                COALESCE((SELECT SUM(i.stock_disponible) FROM inventario i WHERE i.id_variante = v.id_variante), 0) AS total
         FROM variante_producto v
         JOIN producto p ON p.id_producto = v.id_producto
         LEFT JOIN talla t ON t.id_talla = v.id_talla
         LEFT JOIN color c ON c.id_color = v.id_color
         CROSS JOIN par
         WHERE v.id_empresa = par.emp AND p.estado
           AND (par.texto IS NULL OR p.nombre ILIKE par.texto OR v.sku ILIKE par.texto)
         ORDER BY total DESC, p.nombre, v.sku
         LIMIT 60)
       SELECT va.id_variante, va.sku, va.producto, va.talla, va.color,
              i.id_sucursal, SUM(i.stock_disponible)::int AS disponible
       FROM variantes va
       LEFT JOIN inventario i ON i.id_variante = va.id_variante
       GROUP BY va.id_variante, va.sku, va.producto, va.talla, va.color, va.total, i.id_sucursal
       ORDER BY va.total DESC, va.producto, va.sku`,
      [emp(actor), texto],
    );
    const porVariante = new Map<
      number,
      {
        idVariante: number;
        sku: string;
        producto: string;
        talla: string | null;
        color: string | null;
        stock: Record<number, number>;
      }
    >();
    for (const f of filas) {
      const v = porVariante.get(f.id_variante) ?? {
        idVariante: f.id_variante,
        sku: f.sku,
        producto: f.producto,
        talla: f.talla,
        color: f.color,
        stock: {},
      };
      if (f.id_sucursal != null)
        v.stock[f.id_sucursal] = Number(f.disponible ?? 0);
      porVariante.set(f.id_variante, v);
    }
    return {
      sucursales: sucursales.map((s) => ({
        idSucursal: s.idSucursal,
        nombre: s.nombre,
      })),
      // Para que la pantalla ofrezca como origen solo las sucursales que el usuario opera.
      origenesPermitidos:
        (await this.access.accessibleBranchIds(actor)) ??
        sucursales.map((s) => s.idSucursal),
      variantes: [...porVariante.values()],
    };
  }

  // ------------------------------------------------------------ consultas

  async listar(actor: AuthenticatedUser, estado?: string) {
    const qb = this.traspasos
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.sucursalOrigen', 'so')
      .leftJoinAndSelect('t.sucursalDestino', 'sd')
      .leftJoinAndSelect('t.usuarioEnvia', 'ue')
      .leftJoinAndSelect('t.usuarioCierra', 'uc')
      .leftJoinAndSelect('t.detalles', 'd')
      .leftJoinAndSelect('d.variante', 'v')
      .leftJoinAndSelect('v.producto', 'p')
      .leftJoinAndSelect('v.talla', 'ta')
      .leftJoinAndSelect('v.color', 'co')
      .where('t.id_empresa = :emp', { emp: emp(actor) })
      .orderBy('t.fechaEnvio', 'DESC')
      .addOrderBy('d.idDetalleTraspaso', 'ASC')
      .take(100);
    if (estado) qb.andWhere('t.estado = :estado', { estado });
    const ids = await this.access.accessibleBranchIds(actor);
    if (ids !== null) {
      if (!ids.length) return [];
      qb.andWhere(
        '(so.id_sucursal IN (:...ids) OR sd.id_sucursal IN (:...ids))',
        { ids },
      );
    }
    return (await qb.getMany()).map((t) => this.vista(t, ids));
  }

  /** Cuántos traspasos esperan ser recibidos en las sucursales del usuario (aviso al destino). */
  async pendientes(actor: AuthenticatedUser) {
    const ids = await this.access.accessibleBranchIds(actor);
    if (ids !== null && !ids.length) return { porRecibir: 0 };
    const qb = this.traspasos
      .createQueryBuilder('t')
      .where('t.id_empresa = :emp AND t.estado = :e', {
        emp: emp(actor),
        e: 'EN_TRANSITO',
      });
    if (ids !== null)
      qb.andWhere('t.id_sucursal_destino IN (:...ids)', { ids });
    return { porRecibir: await qb.getCount() };
  }

  async uno(actor: AuthenticatedUser, idTraspaso: number) {
    const t = await this.traspasos.findOne({
      where: { idTraspaso, idEmpresa: emp(actor) },
    });
    if (!t) throw new NotFoundException(`Traspaso ${idTraspaso} no encontrado`);
    const ids = await this.access.accessibleBranchIds(actor);
    if (
      ids !== null &&
      !ids.includes(t.sucursalOrigen.idSucursal) &&
      !ids.includes(t.sucursalDestino.idSucursal)
    ) {
      throw new ForbiddenException('El traspaso no involucra a tus sucursales');
    }
    return this.vista(t, ids);
  }

  // ------------------------------------------------------------ enviar

  async crear(actor: AuthenticatedUser, dto: CreateTraspasoDto) {
    this.exigirRol(actor);
    if (dto.idSucursalOrigen === dto.idSucursalDestino) {
      throw new BadRequestException(
        'La sucursal de destino debe ser distinta a la de origen',
      );
    }
    // Quien envía debe operar la sucursal de origen; el destino solo debe ser de la empresa.
    await this.access.assertCanAccess(actor, dto.idSucursalOrigen);
    const origen = await this.sucursalActiva(
      actor,
      dto.idSucursalOrigen,
      'origen',
    );
    const destino = await this.sucursalActiva(
      actor,
      dto.idSucursalDestino,
      'destino',
    );

    // Misma variante repetida en varias líneas → se suma.
    const pedido = new Map<number, number>();
    for (const l of dto.detalles)
      pedido.set(l.idVariante, (pedido.get(l.idVariante) ?? 0) + l.cantidad);

    const guardado = await this.dataSource.transaction(async (m) => {
      const almacenOrigen = await this.almacenDe(m, origen);
      const almacenDestino = await this.almacenDe(m, destino);

      const variantes = new Map<number, VarianteProducto>();
      for (const idVariante of pedido.keys()) {
        const v = await m.findOne(VarianteProducto, { where: { idVariante } });
        if (!v || v.idEmpresa !== emp(actor))
          throw new NotFoundException(`Variante ${idVariante} no encontrada`);
        variantes.set(idVariante, v);
      }

      // Bloquear el stock de origen en orden de variante (evita deadlocks) y validar todo
      // antes de descontar: si falta algo, se informa cada prenda con lo que hay.
      const filas = new Map<number, Inventario | null>();
      for (const idVariante of [...pedido.keys()].sort((a, b) => a - b)) {
        filas.set(
          idVariante,
          await m
            .createQueryBuilder(Inventario, 'i')
            .setLock('pessimistic_write')
            .where('i.id_almacen = :a AND i.id_variante = :v', {
              a: almacenOrigen.idAlmacen,
              v: idVariante,
            })
            .getOne(),
        );
      }
      const faltantes = [...pedido.entries()]
        .map(([idVariante, cantidad]) => ({
          idVariante,
          prenda: this.nombre(variantes.get(idVariante)!),
          solicitado: cantidad,
          disponible: filas.get(idVariante)?.stockDisponible ?? 0,
        }))
        .filter((f) => f.solicitado > f.disponible);
      if (faltantes.length) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message: `Stock insuficiente en ${origen.nombre}: ${faltantes
            .map(
              (f) =>
                `${f.prenda} tiene ${f.disponible} (pediste ${f.solicitado})`,
            )
            .join('; ')}. Reduce la cantidad.`,
          faltantes,
        });
      }

      const traspaso = await m.save(
        m.create(Traspaso, {
          estado: 'EN_TRANSITO',
          sucursalOrigen: origen,
          almacenOrigen,
          sucursalDestino: destino,
          almacenDestino,
          observacion: dto.observacion?.trim() || null,
          usuarioEnvia: { idUsuario: actor.idUsuario } as any,
          detalles: [...pedido.entries()].map(([idVariante, cantidad]) =>
            m.create(DetalleTraspaso, {
              variante: variantes.get(idVariante)!,
              cantidadEnviada: cantidad,
              cantidadRecibida: null,
            }),
          ),
        }),
      );
      const referencia = `Traspaso #${traspaso.idTraspaso} a ${destino.nombre}`;
      for (const [idVariante, cantidad] of pedido) {
        const inv = filas.get(idVariante)!;
        inv.stockDisponible -= cantidad;
        await m.save(inv);
        await m.save(
          m.create(MovimientoInventario, {
            inventario: inv,
            tipo: 'TRASPASO_SALIDA',
            cantidad,
            referencia,
          }),
        );
      }
      return traspaso;
    });

    void this.avisarDestino(guardado.idTraspaso, origen, destino);
    return this.uno(actor, guardado.idTraspaso);
  }

  // ------------------------------------------------------------ recibir

  async recibir(
    actor: AuthenticatedUser,
    idTraspaso: number,
    dto: RecibirTraspasoDto,
  ) {
    this.exigirRol(actor);
    await this.dataSource.transaction(async (m) => {
      const t = await this.bloquearEnTransito(m, actor, idTraspaso);
      await this.access.assertCanAccess(actor, t.sucursalDestino.idSucursal);

      const recibidas = new Map<number, number>();
      for (const l of dto.detalles) {
        if (recibidas.has(l.idDetalleTraspaso))
          throw new BadRequestException(
            `La línea ${l.idDetalleTraspaso} está repetida`,
          );
        recibidas.set(l.idDetalleTraspaso, l.cantidadRecibida);
      }
      for (const d of t.detalles) {
        const r = recibidas.get(d.idDetalleTraspaso);
        if (r === undefined)
          throw new BadRequestException(
            `Falta indicar cuánto llegó de ${this.nombre(d.variante)}`,
          );
        if (r > d.cantidadEnviada)
          throw new BadRequestException(
            `De ${this.nombre(d.variante)} se enviaron ${d.cantidadEnviada}; no pueden llegar ${r}`,
          );
      }
      if (recibidas.size !== t.detalles.length)
        throw new BadRequestException(
          'Hay líneas que no pertenecen a este traspaso',
        );

      const enviado = t.detalles.reduce((s, d) => s + d.cantidadEnviada, 0);
      const llego = t.detalles.reduce(
        (s, d) => s + recibidas.get(d.idDetalleTraspaso)!,
        0,
      );
      const observacion = dto.observacion?.trim() || null;
      if (llego < enviado && !observacion)
        throw new BadRequestException(
          'Llegó menos de lo enviado: indica el motivo de la merma (prenda dañada, faltante, etc.)',
        );

      const referencia = `Traspaso #${t.idTraspaso} desde ${t.sucursalOrigen.nombre}`;
      for (const d of [...t.detalles].sort(
        (a, b) => a.variante.idVariante - b.variante.idVariante,
      )) {
        const cantidad = recibidas.get(d.idDetalleTraspaso)!;
        d.cantidadRecibida = cantidad;
        await m.update(
          DetalleTraspaso,
          { idDetalleTraspaso: d.idDetalleTraspaso },
          { cantidadRecibida: cantidad },
        );
        if (!cantidad) continue;
        const inv = await this.inventarioDestino(m, t, d.variante);
        inv.stockDisponible += cantidad;
        await m.save(inv);
        await m.save(
          m.create(MovimientoInventario, {
            inventario: inv,
            tipo: 'TRASPASO_ENTRADA',
            cantidad,
            referencia,
          }),
        );
      }
      const estado: EstadoTraspaso =
        llego === enviado
          ? 'RECIBIDO'
          : llego === 0
            ? 'RECHAZADO'
            : 'RECIBIDO_PARCIAL';
      await m.update(
        Traspaso,
        { idTraspaso: t.idTraspaso },
        {
          estado,
          fechaCierre: new Date(),
          usuarioCierra: { idUsuario: actor.idUsuario } as any,
          observacionCierre: observacion,
        },
      );
    });
    return this.uno(actor, idTraspaso);
  }

  // ------------------------------------------------------------ cancelar

  /** Solo mientras está en tránsito y solo el origen: el stock vuelve a su almacén. */
  async cancelar(
    actor: AuthenticatedUser,
    idTraspaso: number,
    dto: CancelarTraspasoDto,
  ) {
    this.exigirRol(actor);
    await this.dataSource.transaction(async (m) => {
      const t = await this.bloquearEnTransito(m, actor, idTraspaso);
      await this.access.assertCanAccess(actor, t.sucursalOrigen.idSucursal);
      const referencia = `Traspaso #${t.idTraspaso} cancelado`;
      for (const d of [...t.detalles].sort(
        (a, b) => a.variante.idVariante - b.variante.idVariante,
      )) {
        const inv = await m
          .createQueryBuilder(Inventario, 'i')
          .setLock('pessimistic_write')
          .where('i.id_almacen = :a AND i.id_variante = :v', {
            a: t.almacenOrigen.idAlmacen,
            v: d.variante.idVariante,
          })
          .getOne();
        if (!inv)
          throw new NotFoundException('No existe el inventario de origen');
        inv.stockDisponible += d.cantidadEnviada;
        await m.save(inv);
        await m.save(
          m.create(MovimientoInventario, {
            inventario: inv,
            tipo: 'TRASPASO_REVERSA',
            cantidad: d.cantidadEnviada,
            referencia,
          }),
        );
      }
      await m.update(
        Traspaso,
        { idTraspaso: t.idTraspaso },
        {
          estado: 'CANCELADO',
          fechaCierre: new Date(),
          usuarioCierra: { idUsuario: actor.idUsuario } as any,
          observacionCierre: dto.motivo?.trim() || null,
        },
      );
    });
    return this.uno(actor, idTraspaso);
  }

  // ------------------------------------------------------------ ayudas

  private exigirRol(actor: AuthenticatedUser) {
    if (!ROLES_TRASPASO.includes(actor.rol))
      throw new ForbiddenException('Tu rol no gestiona traspasos');
  }

  private async sucursalActiva(
    actor: AuthenticatedUser,
    idSucursal: number,
    cual: string,
  ) {
    const s = await this.sucursales.findOne({
      where: { idSucursal, idEmpresa: emp(actor) },
    });
    if (!s) throw new NotFoundException(`Sucursal de ${cual} no encontrada`);
    if (!s.estado)
      throw new BadRequestException(`La sucursal de ${cual} está inactiva`);
    return s;
  }

  /** Almacén que recibe y despacha en la sucursal: el PRINCIPAL o, si no hay, el primero activo. */
  private async almacenDe(m: EntityManager, sucursal: Sucursal) {
    const almacenes = await m.find(Almacen, {
      where: { sucursal: { idSucursal: sucursal.idSucursal }, estado: true },
      order: { idAlmacen: 'ASC' },
    });
    const almacen =
      almacenes.find((a) => a.codigo === 'PRINCIPAL') ?? almacenes[0];
    if (!almacen)
      throw new BadRequestException(
        `${sucursal.nombre} no tiene un almacén activo`,
      );
    return almacen;
  }

  private async bloquearEnTransito(
    m: EntityManager,
    actor: AuthenticatedUser,
    idTraspaso: number,
  ) {
    // Bloqueo de la cabecera: el segundo que intente recibir/cancelar espera y luego ve el estado nuevo.
    const bloqueado = await m
      .createQueryBuilder(Traspaso, 't')
      .setLock('pessimistic_write')
      .where('t.id_traspaso = :id AND t.id_empresa = :emp', {
        id: idTraspaso,
        emp: emp(actor),
      })
      .getOne();
    if (!bloqueado)
      throw new NotFoundException(`Traspaso ${idTraspaso} no encontrado`);
    const t = (await m.findOne(Traspaso, { where: { idTraspaso } }))!;
    if (t.estado !== 'EN_TRANSITO')
      throw new ConflictException(
        `El traspaso #${idTraspaso} ya no está en tránsito (estado: ${t.estado})`,
      );
    return t;
  }

  private async inventarioDestino(
    m: EntityManager,
    t: Traspaso,
    variante: VarianteProducto,
  ) {
    const buscar = () =>
      m
        .createQueryBuilder(Inventario, 'i')
        .setLock('pessimistic_write')
        .where('i.id_almacen = :a AND i.id_variante = :v', {
          a: t.almacenDestino.idAlmacen,
          v: variante.idVariante,
        })
        .getOne();
    const existente = await buscar();
    if (existente) return existente;
    // Primera vez que esta prenda llega al destino: se crea su fila de inventario.
    await m
      .createQueryBuilder()
      .insert()
      .into(Inventario)
      .values({
        idEmpresa: t.idEmpresa,
        stockDisponible: 0,
        stockReservado: 0,
        sucursal: { idSucursal: t.sucursalDestino.idSucursal },
        almacen: { idAlmacen: t.almacenDestino.idAlmacen },
        variante: { idVariante: variante.idVariante },
      })
      .orIgnore()
      .execute();
    return (await buscar())!;
  }

  /** Notificación push a quienes operan el destino (si tienen la app móvil registrada). Nunca falla. */
  private async avisarDestino(
    idTraspaso: number,
    origen: Sucursal,
    destino: Sucursal,
  ) {
    try {
      const filas: Array<{ push_token: string }> = await this.dataSource.query(
        `SELECT DISTINCT u.push_token
         FROM usuario u
         JOIN rol r ON r.id_rol = u.id_rol
         LEFT JOIN usuario_sucursal us ON us.id_usuario = u.id_usuario AND us.estado
         WHERE u.id_empresa = $1 AND u.estado AND u.push_token IS NOT NULL
           AND (r.nombre IN ('ADMIN','ENCARGADO')
                OR (r.nombre = 'ENCARGADO_SUCURSAL' AND us.id_sucursal = $2))`,
        [destino.idEmpresa, destino.idSucursal],
      );
      await this.notifications.enviarPush(
        filas.map((f) => f.push_token),
        'Traspaso en camino',
        `El traspaso #${idTraspaso} sale de ${origen.nombre} hacia ${destino.nombre}. Márcalo como recibido al llegar.`,
        { tipo: 'TRASPASO', idTraspaso },
      );
    } catch (e) {
      this.logger.warn(
        `No se pudo avisar del traspaso ${idTraspaso}: ${(e as Error).message}`,
      );
    }
  }

  private vista(t: Traspaso, ids: number[] | null) {
    const opera = (id: number) => ids === null || ids.includes(id);
    const enTransito = t.estado === 'EN_TRANSITO';
    const usuario = (u: Traspaso['usuarioEnvia'] | null) =>
      u ? `${u.nombre} ${u.apellido ?? ''}`.trim() : null;
    const detalles = [...t.detalles]
      .sort((a, b) => a.idDetalleTraspaso - b.idDetalleTraspaso)
      .map((d) => ({
        idDetalleTraspaso: d.idDetalleTraspaso,
        idVariante: d.variante.idVariante,
        sku: d.variante.sku,
        prenda: this.nombre(d.variante),
        cantidadEnviada: d.cantidadEnviada,
        cantidadRecibida: d.cantidadRecibida,
        merma:
          d.cantidadRecibida === null || t.estado === 'CANCELADO'
            ? 0
            : d.cantidadEnviada - d.cantidadRecibida,
      }));
    return {
      idTraspaso: t.idTraspaso,
      estado: t.estado,
      origen: {
        idSucursal: t.sucursalOrigen.idSucursal,
        nombre: t.sucursalOrigen.nombre,
      },
      destino: {
        idSucursal: t.sucursalDestino.idSucursal,
        nombre: t.sucursalDestino.nombre,
      },
      observacion: t.observacion,
      fechaEnvio: t.fechaEnvio,
      enviadoPor: usuario(t.usuarioEnvia),
      fechaCierre: t.fechaCierre,
      cerradoPor: usuario(t.usuarioCierra),
      observacionCierre: t.observacionCierre,
      unidades: detalles.reduce((s, d) => s + d.cantidadEnviada, 0),
      merma: detalles.reduce((s, d) => s + d.merma, 0),
      detalles,
      puedeRecibir: enTransito && opera(t.sucursalDestino.idSucursal),
      puedeCancelar: enTransito && opera(t.sucursalOrigen.idSucursal),
    };
  }

  private nombre(v: VarianteProducto) {
    const extra = [v.talla?.nombre, v.color?.nombre]
      .filter(Boolean)
      .join(' / ');
    return `${v.producto?.nombre ?? v.sku}${extra ? ` (${extra})` : ''}`;
  }
}
