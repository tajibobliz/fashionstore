import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DemandaQueryDto } from './dto/ml.dto';
import { MlClient } from './ml.client';

const SEMANAS_HISTORIA = 104;
const ESTADOS_VALIDOS = ['PAGADA', 'DEVUELTA_PARCIAL', 'DEVUELTA'];
const DEVUELTAS = `COALESCE((SELECT SUM(dd.cantidad) FROM detalle_devolucion dd WHERE dd.id_detalle_venta = dv.id_detalle_venta), 0)`;

/**
 * Analítica con ML (Fase 3, tarea 3.3). El backend arma los datos REALES de la empresa
 * (catálogo, sucursales, ventas semanales y RFM de clientes) y el ml-service los completa
 * con datos sintéticos para entrenar. La empresa sale del JWT (nunca del cliente) y las
 * consultas pasan por RLS y además filtran por id_empresa.
 */
@Injectable()
export class MlService {
  private readonly zona: string;

  constructor(
    private readonly ml: MlClient,
    private readonly db: DataSource,
    config: ConfigService,
  ) {
    this.zona = config.get<string>('APP_TIMEZONE') || 'America/La_Paz';
  }

  /** Empresas que están entrenando ahora (evita dos entrenamientos simultáneos de la misma empresa). */
  private readonly entrenando = new Set<number>();

  estaEntrenando(idEmpresa: number) {
    return this.entrenando.has(idEmpresa);
  }

  async entrenar(idEmpresa: number) {
    if (this.entrenando.has(idEmpresa))
      throw new ConflictException('Ya se está actualizando el análisis de tu empresa. Espera unos segundos.');
    this.entrenando.add(idEmpresa);
    try {
      return await this.entrenarAhora(idEmpresa);
    } finally {
      this.entrenando.delete(idEmpresa);
    }
  }

  private async entrenarAhora(idEmpresa: number) {
    const [productos, sucursales, ventasSemanales, clientes] = await Promise.all([
      this.productos(idEmpresa),
      this.sucursales(idEmpresa),
      this.ventasSemanales(idEmpresa),
      this.clientesRfm(idEmpresa),
    ]);
    if (!productos.length || !sucursales.length)
      throw new BadRequestException(
        'Para entrenar se necesita al menos un producto activo y una sucursal activa.',
      );
    return this.ml.post(`/tenants/${idEmpresa}/train`, {
      productos,
      sucursales,
      ventasSemanales,
      clientes,
      hoy: hoyEn(this.zona),
      semanasHistoria: SEMANAS_HISTORIA,
      semilla: idEmpresa,
    });
  }

  metricas(idEmpresa: number) {
    return this.ml.get(`/tenants/${idEmpresa}/metrics`);
  }

  demanda(idEmpresa: number, q: DemandaQueryDto) {
    const params = new URLSearchParams({ semanas: String(q.semanas), top: String(q.top) });
    if (q.idSucursal) params.set('idSucursal', String(q.idSucursal));
    if (q.idProducto) params.set('idProducto', String(q.idProducto));
    return this.ml.get(`/tenants/${idEmpresa}/demand?${params}`);
  }

  segmentos(idEmpresa: number) {
    return this.ml.get(`/tenants/${idEmpresa}/segments`);
  }

  anomalias(idEmpresa: number, idSucursal?: number) {
    return this.ml.get(`/tenants/${idEmpresa}/anomalies${idSucursal ? `?idSucursal=${idSucursal}` : ''}`);
  }

  // ------------------------------------------------------------ datos reales

  private async productos(idEmpresa: number) {
    const filas: { idProducto: number; nombre: string; categoria: string | null; precio: string }[] = await this.db.query(
      `SELECT p.id_producto AS "idProducto", p.nombre, c.nombre AS categoria, p.precio
         FROM producto p LEFT JOIN categoria c ON c.id_categoria = p.id_categoria
        WHERE p.id_empresa = $1 AND p.estado = true AND p.precio > 0
        ORDER BY p.id_producto LIMIT 500`,
      [idEmpresa],
    );
    return filas.map((f) => ({ ...f, precio: Number(f.precio) }));
  }

  private sucursales(idEmpresa: number): Promise<{ idSucursal: number; nombre: string }[]> {
    return this.db.query(
      `SELECT id_sucursal AS "idSucursal", nombre FROM sucursal
        WHERE id_empresa = $1 AND estado = true ORDER BY id_sucursal LIMIT 50`,
      [idEmpresa],
    );
  }

  /** Unidades netas (sin devoluciones) por semana (lunes), producto y sucursal. */
  private async ventasSemanales(idEmpresa: number) {
    const filas: { semana: string; idProducto: number; idSucursal: number; unidades: string }[] = await this.db.query(
      `SELECT TO_CHAR(DATE_TRUNC('week', v.fecha), 'YYYY-MM-DD') AS semana, vp.id_producto AS "idProducto",
              v.id_sucursal AS "idSucursal", SUM(dv.cantidad - ${DEVUELTAS}) AS unidades
         FROM venta v
         JOIN detalle_venta dv ON dv.id_venta = v.id_venta
         JOIN variante_producto vp ON vp.id_variante = dv.id_variante
        WHERE v.id_empresa = $1 AND v.estado = ANY($2) AND v.id_sucursal IS NOT NULL
          AND v.fecha >= now() - ($3 || ' weeks')::interval
        GROUP BY 1, 2, 3`,
      [idEmpresa, ESTADOS_VALIDOS, SEMANAS_HISTORIA + 1],
    );
    return filas.map((f) => ({ ...f, unidades: Math.max(0, Number(f.unidades)) }));
  }

  /** RFM de las clientas registradas: recencia (días), frecuencia (compras) y monto (Bs). */
  private async clientesRfm(idEmpresa: number) {
    const filas: { idCliente: number; nombre: string; recenciaDias: string; frecuencia: string; monto: string }[] = await this.db.query(
      `SELECT u.id_usuario AS "idCliente", TRIM(CONCAT_WS(' ', u.nombre, u.apellido)) AS nombre,
              EXTRACT(EPOCH FROM (now() - MAX(v.fecha))) / 86400 AS "recenciaDias",
              COUNT(DISTINCT v.id_venta) AS frecuencia,
              COALESCE(SUM(dv.precio_unitario * (dv.cantidad - ${DEVUELTAS})), 0) AS monto
         FROM venta v
         JOIN usuario u ON u.id_usuario = v.id_usuario
         JOIN rol r ON r.id_rol = u.id_rol AND r.nombre = 'CLIENTE'
         JOIN detalle_venta dv ON dv.id_venta = v.id_venta
        WHERE v.id_empresa = $1 AND v.estado = ANY($2)
        GROUP BY u.id_usuario LIMIT 50000`,
      [idEmpresa, ESTADOS_VALIDOS],
    );
    return filas.map((f) => ({
      idCliente: f.idCliente,
      nombre: f.nombre,
      recenciaDias: Math.max(0, Number(f.recenciaDias)),
      frecuencia: Math.max(1, Number(f.frecuencia)),
      monto: Math.max(0, Number(f.monto)),
    }));
  }
}

function hoyEn(zona: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
