import { moneda } from '../../common/monedas';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  validate,
} from 'class-validator';
import { Repository } from 'typeorm';
import { Categoria } from '../../catalog/entities/categoria.entity';
import { Color } from '../../catalog/entities/color.entity';
import { Talla } from '../../catalog/entities/talla.entity';
import {
  DIMENSIONES_INVENTARIO, DIMENSIONES_VENTAS, MAX_FILAS_FLEXIBLE, METRICAS_INVENTARIO, METRICAS_VENTAS, PERIODOS,
  type DefinicionColumna, type OpcionesFlexibles,
} from '../../reports/consulta-flexible';
import {
  InventoryReportFiltersDto,
  ReportFiltersDto,
  ReservationReportFiltersDto,
} from '../../reports/dto/report-filters.dto';
import { ReportScope, ReportsService } from '../../reports/reports.service';
import type { DefinicionHerramienta } from './llm/llm.types';

/**
 * Herramientas de reportes (Fase 3, tarea 3.1) — "lista cerrada".
 *
 * El modelo de lenguaje NO escribe SQL ni elige tablas: solo puede pedir una de estas
 * herramientas con parámetros en JSON. El backend:
 *   1. valida los parámetros (class-validator, igual que un DTO de un endpoint),
 *   2. comprueba que la sucursal pedida sea una de las permitidas al usuario,
 *   3. ejecuta la consulta ya existente de ReportsService con el alcance del usuario.
 * La empresa (tenant) nunca es un parámetro: la pone el JWT y la aplica RLS.
 */

// ---------------------------------------------------------------- Tipos del resultado

export type FormatoColumna = 'texto' | 'numero' | 'moneda' | 'fecha' | 'porcentaje';
export interface ColumnaReporte {
  clave: string;
  etiqueta: string;
  formato: FormatoColumna;
}
export interface GraficoReporte {
  tipo: 'linea' | 'barras' | 'torta';
  x: string;
  y: string[];
}
export interface ReporteGenerado {
  herramienta: string;
  titulo: string;
  columnas: ColumnaReporte[];
  filas: Record<string, string | number | null>[];
  grafico: GraficoReporte | null;
  /** Filtros ya validados, en texto legible (para mostrar y para el PDF). */
  filtros: Record<string, string>;
  /** Totales que la narrativa puede citar (calculados por el backend, no por el modelo). */
  resumen: Record<string, number>;
  /** Moneda de los montos (la de la empresa, ISO 4217). */
  moneda: string;
}

/** Contexto que pone el backend; el modelo no lo puede cambiar. */
export interface ContextoHerramientas {
  scope: ReportScope;
  /** Sucursales que el usuario puede consultar (ya filtradas por empresa y asignación). */
  sucursales: { idSucursal: number; nombre: string }[];
  /** Fecha de hoy en la zona horaria de la empresa, YYYY-MM-DD. */
  hoy: string;
  /** Moneda de la empresa (ISO 4217): las columnas de montos llevan su símbolo. */
  moneda: string;
}

export class ErrorHerramienta extends Error {}

// ------------------------------------------------------------ Parámetros (validación)

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MSG_FECHA = 'debe tener el formato AAAA-MM-DD';

class RangoFechas {
  @IsOptional() @IsString() @Matches(FECHA, { message: `desde ${MSG_FECHA}` })
  desde?: string;

  @IsOptional() @IsString() @Matches(FECHA, { message: `hasta ${MSG_FECHA}` })
  hasta?: string;
}

class ConSucursal extends RangoFechas {
  @IsOptional() @IsInt() @Min(1)
  idSucursal?: number;
}

class VentasPorPeriodo extends ConSucursal {
  @IsOptional() @IsIn(['dia', 'semana', 'mes'])
  agrupar?: 'dia' | 'semana' | 'mes';

  @IsOptional() @IsIn(['DIGITAL', 'PRESENCIAL'])
  tipoVenta?: 'DIGITAL' | 'PRESENCIAL';
}

class VentasPorSucursal extends RangoFechas {
  @IsOptional() @IsIn(['DIGITAL', 'PRESENCIAL'])
  tipoVenta?: 'DIGITAL' | 'PRESENCIAL';
}

class TopProductos extends ConSucursal {
  @IsOptional() @IsInt() @Min(1) @Max(50)
  limite?: number;

  /** true = un ranking por cada sucursal (los N más vendidos de cada una), en una sola tabla. */
  @IsOptional() @IsBoolean()
  porSucursal?: boolean;

  @IsOptional() @IsString() @Length(1, 100)
  categoria?: string;
}

class StockBajo {
  @IsOptional() @IsInt() @Min(0) @Max(100)
  umbral?: number;

  @IsOptional() @IsInt() @Min(1)
  idSucursal?: number;

  @IsOptional() @IsString() @Length(1, 100)
  categoria?: string;
}

class DevolucionesYCambios extends ConSucursal {
  @IsOptional() @IsInt() @Min(1) @Max(50)
  limite?: number;

  @IsOptional() @IsString() @Length(1, 100)
  categoria?: string;
}

class MotivosDevolucionCambio extends ConSucursal {
  @IsOptional() @IsIn(['devoluciones', 'cambios', 'ambos'])
  tipo?: 'devoluciones' | 'cambios' | 'ambos';
}

// Reportes a medida: columnas, métricas, filtros y orden de un menú cerrado (consulta-flexible.ts).
const DIMS_V = Object.keys(DIMENSIONES_VENTAS);
const METS_V = Object.keys(METRICAS_VENTAS);
const DIMS_I = Object.keys(DIMENSIONES_INVENTARIO);
const METS_I = Object.keys(METRICAS_INVENTARIO);

class FiltrosFlexibles {
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @Length(1, 60, { each: true })
  categorias?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @Length(1, 30, { each: true })
  tallas?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @Length(1, 40, { each: true })
  colores?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @Length(2, 60, { each: true })
  productos?: string[];

  @IsOptional() @IsString() @Length(1, 40)
  ordenarPor?: string;

  @IsOptional() @IsIn(['asc', 'desc'])
  direccion?: 'asc' | 'desc';

  @IsOptional() @IsInt() @Min(1) @Max(MAX_FILAS_FLEXIBLE)
  limite?: number;
}

class ConsultaVentas extends FiltrosFlexibles {
  @IsOptional() @IsString() @Matches(FECHA, { message: `desde ${MSG_FECHA}` })
  desde?: string;

  @IsOptional() @IsString() @Matches(FECHA, { message: `hasta ${MSG_FECHA}` })
  hasta?: string;

  @IsOptional() @IsInt() @Min(1)
  idSucursal?: number;

  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsIn(DIMS_V, { each: true })
  agrupar?: string[];

  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(4) @IsIn(METS_V, { each: true })
  metricas?: string[];

  @IsOptional() @IsIn(['DIGITAL', 'PRESENCIAL'])
  canal?: 'DIGITAL' | 'PRESENCIAL';
}

class ConsultaInventario extends FiltrosFlexibles {
  @IsOptional() @IsInt() @Min(1)
  idSucursal?: number;

  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsIn(DIMS_I, { each: true })
  agrupar?: string[];

  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3) @IsIn(METS_I, { each: true })
  metricas?: string[];

  @IsOptional() @IsInt() @Min(0)
  stockMinimo?: number;

  @IsOptional() @IsInt() @Min(0)
  stockMaximo?: number;
}

class PedirAclaracion {
  @IsString() @Length(3, 300)
  pregunta: string;
}

// ------------------------------------------------- Definiciones que ve el modelo (JSON)

const rango = {
  desde: { type: 'string', description: 'Fecha inicial AAAA-MM-DD (incluida). Por defecto: hace 29 días.' },
  hasta: { type: 'string', description: 'Fecha final AAAA-MM-DD (incluida). Por defecto: hoy.' },
};
const sucursal = {
  idSucursal: { type: 'integer', description: 'Id de UNA sucursal de la lista del sistema. Omitir = todas las permitidas.' },
};
const tipoVenta = {
  tipoVenta: { type: 'string', enum: ['DIGITAL', 'PRESENCIAL'], description: 'DIGITAL = tienda online/app, PRESENCIAL = caja (POS).' },
};
const objeto = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

export const HERRAMIENTAS: DefinicionHerramienta[] = [
  {
    nombre: 'ventas_por_periodo',
    descripcion: 'Total vendido, cantidad de ventas y unidades agrupadas por día, semana o mes. Para tendencias y evolución de ventas.',
    parametros: objeto({ ...rango, ...sucursal, ...tipoVenta, agrupar: { type: 'string', enum: ['dia', 'semana', 'mes'] } }),
  },
  {
    nombre: 'ventas_por_sucursal',
    descripcion: 'Total vendido, cantidad de ventas y unidades por sucursal. Para comparar sucursales.',
    parametros: objeto({ ...rango, ...tipoVenta }),
  },
  {
    nombre: 'top_productos',
    descripcion:
      'Productos más vendidos (por unidades) con el ingreso que generaron. Se puede filtrar por nombre de categoría. ' +
      'Si piden el ranking "por sucursal" o "agrupado por sucursal", usa porSucursal=true en UNA sola llamada (no una llamada por sucursal).',
    parametros: objeto({
      ...rango,
      ...sucursal,
      limite: { type: 'integer', minimum: 1, maximum: 50, description: 'Cuántos productos (por sucursal si porSucursal=true). Por defecto 10.' },
      porSucursal: { type: 'boolean', description: 'true = los más vendidos de CADA sucursal, en una tabla con la columna Sucursal.' },
      categoria: { type: 'string', description: 'Nombre de la categoría (p. ej. "Vestidos").' },
    }),
  },
  {
    nombre: 'ingresos_por_categoria',
    descripcion: 'Ingresos, ventas y unidades por categoría de producto.',
    parametros: objeto({ ...rango, ...sucursal }),
  },
  {
    nombre: 'stock_bajo',
    descripcion: 'Variantes (producto, talla, color) con stock disponible menor o igual al umbral, por sucursal y almacén. No usa fechas.',
    parametros: objeto({
      ...sucursal,
      umbral: { type: 'integer', minimum: 0, maximum: 100, description: 'Por defecto 5.' },
      categoria: { type: 'string', description: 'Nombre de la categoría.' },
    }),
  },
  {
    nombre: 'reservas_por_estado',
    descripcion: 'Cantidad de reservas por estado (pendiente, preparada, atendida, cancelada).',
    parametros: objeto({ ...rango, ...sucursal }),
  },
  {
    nombre: 'ventas_por_metodo_pago',
    descripcion: 'Monto cobrado y cantidad de pagos aprobados por método (efectivo, tarjeta, QR, transferencia, contrapago).',
    parametros: objeto({ ...rango, ...sucursal }),
  },
  {
    nombre: 'devoluciones_y_cambios_por_producto',
    descripcion: 'Prendas devueltas y cambiadas por producto: unidades vendidas, devueltas y cambiadas, y tasa de devolución y de cambio. Para "prendas más cambiadas", "más devueltas" o "tasa de devoluciones".',
    parametros: objeto({
      ...rango,
      ...sucursal,
      limite: { type: 'integer', minimum: 1, maximum: 50, description: 'Cuántos productos. Por defecto 15.' },
      categoria: { type: 'string', description: 'Nombre de la categoría.' },
    }),
  },
  {
    nombre: 'motivos_devolucion_y_cambio',
    descripcion: 'Motivos registrados al devolver o cambiar prendas (talla, falla, color...), con cantidad de operaciones y unidades.',
    parametros: objeto({
      ...rango,
      ...sucursal,
      tipo: { type: 'string', enum: ['devoluciones', 'cambios', 'ambos'], description: 'Por defecto ambos.' },
    }),
  },
  {
    nombre: 'consulta_ventas',
    descripcion:
      'Reporte de VENTAS A MEDIDA. Úsala cuando el usuario pida columnas concretas, filtros por talla, color, categoría o nombre de producto, ' +
      'un orden (ascendente/descendente) o combinaciones que las otras herramientas no cubren. Pon en "agrupar" y "metricas" SOLO las columnas ' +
      'que pidió, en el orden en que deben mostrarse (p. ej. "solo la cantidad" = metricas ["unidades"]). Los filtros aceptan varios valores.',
    parametros: objeto({
      ...rango,
      ...sucursal,
      agrupar: { type: 'array', items: { type: 'string', enum: DIMS_V }, description: 'Columnas para agrupar, en orden (máx. 4). Solo una de dia/semana/mes. Vacío = una fila de totales.' },
      metricas: { type: 'array', items: { type: 'string', enum: METS_V }, description: 'Métricas a mostrar (1 a 4). Por defecto ["unidades","ingreso"].' },
      categorias: { type: 'array', items: { type: 'string' }, description: 'Nombres de categoría (p. ej. "Vestidos").' },
      tallas: { type: 'array', items: { type: 'string' }, description: 'Tallas (p. ej. "M", "36").' },
      colores: { type: 'array', items: { type: 'string' }, description: 'Colores (p. ej. "Negro", "Blanco").' },
      productos: { type: 'array', items: { type: 'string' }, description: 'Texto que debe contener el nombre del producto.' },
      canal: { type: 'string', enum: ['DIGITAL', 'PRESENCIAL'], description: 'DIGITAL = tienda online/app, PRESENCIAL = caja (POS).' },
      ordenarPor: { type: 'string', description: 'Clave de UNA de las columnas elegidas (de agrupar o metricas). Por defecto la primera métrica.' },
      direccion: { type: 'string', enum: ['asc', 'desc'], description: 'asc = de menor a mayor / A-Z; desc = de mayor a menor. Por defecto desc.' },
      limite: { type: 'integer', minimum: 1, maximum: MAX_FILAS_FLEXIBLE, description: 'Máximo de filas. Por defecto 100.' },
    }),
  },
  {
    nombre: 'consulta_inventario',
    descripcion:
      'Reporte de INVENTARIO (stock actual) A MEDIDA: elige las columnas, filtra por talla, color, categoría, producto, sucursal o rango de stock ' +
      'y ordena por cualquier columna. No usa fechas. Pon solo las columnas que pidió el usuario.',
    parametros: objeto({
      ...sucursal,
      agrupar: { type: 'array', items: { type: 'string', enum: DIMS_I }, description: 'Columnas para agrupar, en orden (máx. 4). Vacío = una fila de totales.' },
      metricas: { type: 'array', items: { type: 'string', enum: METS_I }, description: 'Métricas (1 a 3). Por defecto ["stockDisponible"].' },
      categorias: { type: 'array', items: { type: 'string' }, description: 'Nombres de categoría.' },
      tallas: { type: 'array', items: { type: 'string' }, description: 'Tallas.' },
      colores: { type: 'array', items: { type: 'string' }, description: 'Colores.' },
      productos: { type: 'array', items: { type: 'string' }, description: 'Texto que debe contener el nombre del producto.' },
      stockMinimo: { type: 'integer', minimum: 0, description: 'Solo filas con stock disponible >= este valor.' },
      stockMaximo: { type: 'integer', minimum: 0, description: 'Solo filas con stock disponible <= este valor.' },
      ordenarPor: { type: 'string', description: 'Clave de UNA de las columnas elegidas. Por defecto la primera métrica.' },
      direccion: { type: 'string', enum: ['asc', 'desc'], description: 'asc = de menor a mayor; desc = de mayor a menor. Por defecto desc.' },
      limite: { type: 'integer', minimum: 1, maximum: MAX_FILAS_FLEXIBLE, description: 'Máximo de filas. Por defecto 100.' },
    }),
  },
  {
    nombre: 'pedir_aclaracion',
    descripcion: 'Usar SOLO si la pregunta es ambigua o no se puede responder con las otras herramientas. Hace una pregunta corta al usuario.',
    parametros: objeto({ pregunta: { type: 'string', description: 'Pregunta corta en español.' } }, ['pregunta']),
  },
];

export const NOMBRES_HERRAMIENTAS = HERRAMIENTAS.map((h) => h.nombre);
export const HERRAMIENTA_ACLARACION = 'pedir_aclaracion';

const CLASES: Record<string, new () => object> = {
  ventas_por_periodo: VentasPorPeriodo,
  ventas_por_sucursal: VentasPorSucursal,
  top_productos: TopProductos,
  ingresos_por_categoria: ConSucursal,
  stock_bajo: StockBajo,
  reservas_por_estado: ConSucursal,
  ventas_por_metodo_pago: ConSucursal,
  devoluciones_y_cambios_por_producto: DevolucionesYCambios,
  motivos_devolucion_y_cambio: MotivosDevolucionCambio,
  consulta_ventas: ConsultaVentas,
  consulta_inventario: ConsultaInventario,
  pedir_aclaracion: PedirAclaracion,
};

const MAX_DIAS = 731;
const ETIQUETA_AGRUPAR = { dia: 'Día', semana: 'Semana', mes: 'Mes' } as const;

// ------------------------------------------------------------------------- Ejecución

@Injectable()
export class ReportToolsService {
  constructor(
    private readonly reports: ReportsService,
    @InjectRepository(Categoria)
    private readonly categorias: Repository<Categoria>,
    @InjectRepository(Talla)
    private readonly tallas: Repository<Talla>,
    @InjectRepository(Color)
    private readonly colores: Repository<Color>,
  ) {}

  /**
   * Valida los parámetros que propuso el modelo. Lanza ErrorHerramienta con un mensaje
   * claro: se le devuelve al modelo para que corrija (cuenta como una iteración).
   */
  async validar<T extends object>(nombre: string, entrada: unknown): Promise<T> {
    const Clase = CLASES[nombre];
    if (!Clase) throw new ErrorHerramienta(`La herramienta "${nombre}" no existe. Usa una de: ${NOMBRES_HERRAMIENTAS.join(', ')}.`);
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada))
      throw new ErrorHerramienta('Los parámetros deben ser un objeto JSON.');
    const permitidos = Object.keys(
      (HERRAMIENTAS.find((h) => h.nombre === nombre)!.parametros as { properties: object }).properties,
    );
    const extra = Object.keys(entrada).filter((k) => !permitidos.includes(k));
    if (extra.length) throw new ErrorHerramienta(`Parámetros no permitidos: ${extra.join(', ')}.`);
    const dto = plainToInstance(Clase, entrada);
    const errores = await validate(dto);
    if (errores.length)
      throw new ErrorHerramienta(
        'Parámetros inválidos: ' + errores.flatMap((e) => Object.values(e.constraints ?? {})).join('; '),
      );
    return dto as T;
  }

  /** Ejecuta la herramienta y pone la moneda de la empresa en el reporte y en las columnas de montos. */
  async ejecutar(nombre: string, entrada: unknown, ctx: ContextoHerramientas): Promise<ReporteGenerado> {
    const r = await this.despachar(nombre, entrada, ctx);
    const { simbolo } = moneda(ctx.moneda);
    return {
      ...r,
      moneda: ctx.moneda,
      columnas: r.columnas.map((c) => (c.formato === 'moneda' ? { ...c, etiqueta: `${c.etiqueta} (${simbolo})` } : c)),
    };
  }

  private async despachar(nombre: string, entrada: unknown, ctx: ContextoHerramientas): Promise<ReporteGenerado> {
    if (!CLASES[nombre])
      throw new ErrorHerramienta(`La herramienta "${nombre}" no existe. Usa una de: ${NOMBRES_HERRAMIENTAS.join(', ')}.`);
    switch (nombre) {
      case 'ventas_por_periodo': return this.ventasPorPeriodo(await this.validar(nombre, entrada), ctx);
      case 'ventas_por_sucursal': return this.ventasPorSucursal(await this.validar(nombre, entrada), ctx);
      case 'top_productos': return this.topProductos(await this.validar(nombre, entrada), ctx);
      case 'ingresos_por_categoria': return this.ingresosPorCategoria(await this.validar(nombre, entrada), ctx);
      case 'stock_bajo': return this.stockBajo(await this.validar(nombre, entrada), ctx);
      case 'reservas_por_estado': return this.reservasPorEstado(await this.validar(nombre, entrada), ctx);
      case 'ventas_por_metodo_pago': return this.ventasPorMetodo(await this.validar(nombre, entrada), ctx);
      case 'devoluciones_y_cambios_por_producto': return this.devolucionesYCambios(await this.validar(nombre, entrada), ctx);
      case 'motivos_devolucion_y_cambio': return this.motivos(await this.validar(nombre, entrada), ctx);
      case 'consulta_ventas': return this.consultaVentas(await this.validar(nombre, entrada), ctx);
      case 'consulta_inventario': return this.consultaInventario(await this.validar(nombre, entrada), ctx);
      default: throw new ErrorHerramienta(`La herramienta "${nombre}" no genera reportes.`);
    }
  }

  // --------------------------------------------------------------- herramientas

  private async ventasPorPeriodo(p: VentasPorPeriodo, ctx: ContextoHerramientas) {
    const agrupar = p.agrupar ?? 'dia';
    const { f, filtros } = this.filtrosVentas(p, ctx);
    if (p.tipoVenta) { f.tipoVenta = p.tipoVenta; filtros['Canal'] = p.tipoVenta === 'DIGITAL' ? 'Digital' : 'Presencial'; }
    filtros['Agrupado por'] = ETIQUETA_AGRUPAR[agrupar].toLowerCase();
    const filas = await this.reports.salesByPeriod(f, ctx.scope, agrupar);
    return this.reporte('ventas_por_periodo', `Ventas por ${ETIQUETA_AGRUPAR[agrupar].toLowerCase()}`, [
      { clave: 'periodo', etiqueta: ETIQUETA_AGRUPAR[agrupar], formato: 'fecha' },
      { clave: 'cantidadVentas', etiqueta: 'Ventas', formato: 'numero' },
      { clave: 'unidadesVendidas', etiqueta: 'Unidades', formato: 'numero' },
      { clave: 'totalVendido', etiqueta: 'Total', formato: 'moneda' },
    ], filas, { tipo: 'linea', x: 'periodo', y: ['totalVendido'] }, filtros, this.sumas(filas, ['totalVendido', 'cantidadVentas', 'unidadesVendidas']));
  }

  private async ventasPorSucursal(p: VentasPorSucursal, ctx: ContextoHerramientas) {
    const { f, filtros } = this.filtrosVentas(p, ctx);
    if (p.tipoVenta) { f.tipoVenta = p.tipoVenta; filtros['Canal'] = p.tipoVenta === 'DIGITAL' ? 'Digital' : 'Presencial'; }
    const filas = (await this.reports.salesByBranch(f, ctx.scope)).map((x) => ({
      sucursal: x.sucursal ?? 'Sin sucursal', cantidadVentas: x.cantidadVentas, unidadesVendidas: x.unidadesVendidas, totalVendido: x.totalVendido,
    }));
    return this.reporte('ventas_por_sucursal', 'Ventas por sucursal', [
      { clave: 'sucursal', etiqueta: 'Sucursal', formato: 'texto' },
      { clave: 'cantidadVentas', etiqueta: 'Ventas', formato: 'numero' },
      { clave: 'unidadesVendidas', etiqueta: 'Unidades', formato: 'numero' },
      { clave: 'totalVendido', etiqueta: 'Total', formato: 'moneda' },
    ], filas, { tipo: 'barras', x: 'sucursal', y: ['totalVendido'] }, filtros, this.sumas(filas, ['totalVendido', 'cantidadVentas', 'unidadesVendidas']));
  }

  private async topProductos(p: TopProductos, ctx: ContextoHerramientas) {
    const { f, filtros } = this.filtrosVentas(p, ctx);
    const limite = p.limite ?? 10;
    const cat = p.categoria ? await this.categoria(p.categoria) : undefined;
    if (cat) filtros['Categoría'] = cat.nombre;
    filtros['Límite'] = String(limite);
    if (p.porSucursal) return this.topProductosPorSucursal(f, filtros, limite, cat?.idCategoria, ctx);
    const filas = (await this.reports.topProducts(f, ctx.scope, limite, cat?.idCategoria)).map((x) => ({
      producto: x.nombre, categoria: x.categoria ?? 'Sin categoría', cantidadVendida: x.cantidadVendida, totalGenerado: x.totalGenerado,
    }));
    return this.reporte('top_productos', 'Productos más vendidos', [
      { clave: 'producto', etiqueta: 'Producto', formato: 'texto' },
      { clave: 'categoria', etiqueta: 'Categoría', formato: 'texto' },
      { clave: 'cantidadVendida', etiqueta: 'Unidades', formato: 'numero' },
      { clave: 'totalGenerado', etiqueta: 'Ingreso', formato: 'moneda' },
    ], filas, { tipo: 'barras', x: 'producto', y: ['cantidadVendida'] }, filtros, this.sumas(filas, ['cantidadVendida', 'totalGenerado']));
  }

  /**
   * Ranking de cada sucursal permitida (o solo la pedida), con la MISMA consulta de /reports
   * filtrada por sucursal: las cifras coinciden con el reporte de cada sucursal.
   */
  private async topProductosPorSucursal(
    f: ReportFiltersDto,
    filtros: Record<string, string>,
    limite: number,
    idCategoria: number | undefined,
    ctx: ContextoHerramientas,
  ) {
    filtros['Agrupado por'] = 'sucursal';
    filtros['Límite'] = `${limite} por sucursal`;
    const sucursales = f.idSucursal ? ctx.sucursales.filter((s) => s.idSucursal === f.idSucursal) : ctx.sucursales;
    const filas: Record<string, string | number>[] = [];
    for (const s of sucursales) {
      const ranking = await this.reports.topProducts(Object.assign(new ReportFiltersDto(), f, { idSucursal: s.idSucursal }), ctx.scope, limite, idCategoria);
      ranking.forEach((x, i) =>
        filas.push({
          sucursal: s.nombre, puesto: i + 1, producto: x.nombre, categoria: x.categoria ?? 'Sin categoría',
          cantidadVendida: x.cantidadVendida, totalGenerado: x.totalGenerado,
        }),
      );
    }
    return this.reporte('top_productos', 'Productos más vendidos por sucursal', [
      { clave: 'sucursal', etiqueta: 'Sucursal', formato: 'texto' },
      { clave: 'puesto', etiqueta: 'N.º', formato: 'numero' },
      { clave: 'producto', etiqueta: 'Producto', formato: 'texto' },
      { clave: 'categoria', etiqueta: 'Categoría', formato: 'texto' },
      { clave: 'cantidadVendida', etiqueta: 'Unidades', formato: 'numero' },
      { clave: 'totalGenerado', etiqueta: 'Ingreso', formato: 'moneda' },
    ], filas, null, filtros, { ...this.sumas(filas, ['cantidadVendida', 'totalGenerado']), sucursales: sucursales.length });
  }

  private async ingresosPorCategoria(p: ConSucursal, ctx: ContextoHerramientas) {
    const { f, filtros } = this.filtrosVentas(p, ctx);
    const filas = (await this.reports.salesByCategory(f, ctx.scope)).map((x) => ({
      categoria: x.categoria, cantidadVentas: x.cantidadVentas, unidadesVendidas: x.unidadesVendidas, totalVendido: x.totalVendido,
    }));
    return this.reporte('ingresos_por_categoria', 'Ingresos por categoría', [
      { clave: 'categoria', etiqueta: 'Categoría', formato: 'texto' },
      { clave: 'cantidadVentas', etiqueta: 'Ventas', formato: 'numero' },
      { clave: 'unidadesVendidas', etiqueta: 'Unidades', formato: 'numero' },
      { clave: 'totalVendido', etiqueta: 'Total', formato: 'moneda' },
    ], filas, { tipo: 'torta', x: 'categoria', y: ['totalVendido'] }, filtros, this.sumas(filas, ['totalVendido', 'unidadesVendidas']));
  }

  private async stockBajo(p: StockBajo, ctx: ContextoHerramientas) {
    const umbral = p.umbral ?? 5;
    const filtros: Record<string, string> = { 'Stock menor o igual a': String(umbral) };
    const f = Object.assign(new InventoryReportFiltersDto(), { stockCritico: true, threshold: umbral, limit: 100, page: 1 });
    if (p.idSucursal) { f.idSucursal = this.sucursalPermitida(p.idSucursal, ctx); filtros['Sucursal'] = this.nombreSucursal(p.idSucursal, ctx); }
    else filtros['Sucursal'] = this.todasLasSucursales(ctx);
    if (p.categoria) { const cat = await this.categoria(p.categoria); f.idCategoria = cat.idCategoria; filtros['Categoría'] = cat.nombre; }
    const r = await this.reports.inventory(f, ctx.scope);
    const filas = r.items.map((x) => ({
      producto: x.producto, talla: x.talla ?? '—', color: x.color ?? '—', sucursal: x.sucursal, almacen: x.almacen, stockDisponible: x.stockDisponible,
    }));
    return this.reporte('stock_bajo', 'Stock bajo', [
      { clave: 'producto', etiqueta: 'Producto', formato: 'texto' },
      { clave: 'talla', etiqueta: 'Talla', formato: 'texto' },
      { clave: 'color', etiqueta: 'Color', formato: 'texto' },
      { clave: 'sucursal', etiqueta: 'Sucursal', formato: 'texto' },
      { clave: 'almacen', etiqueta: 'Almacén', formato: 'texto' },
      { clave: 'stockDisponible', etiqueta: 'Stock', formato: 'numero' },
    ], filas, null, filtros, { variantes: r.total, agotadas: filas.filter((x) => x.stockDisponible === 0).length });
  }

  /** Ventas a medida: solo las columnas, filtros y orden que se pidieron. */
  private async consultaVentas(p: ConsultaVentas, ctx: ContextoHerramientas) {
    const { f, filtros } = this.filtrosVentas(p, ctx);
    const o = await this.opcionesFlexibles(p, DIMENSIONES_VENTAS, METRICAS_VENTAS, ['unidades', 'ingreso'], filtros);
    if (p.canal) filtros['Canal'] = p.canal === 'DIGITAL' ? 'Digital' : 'Presencial';
    const r = await this.reports.ventasFlexibles(f, ctx.scope, { ...o, canal: p.canal });
    return this.reporteFlexible('consulta_ventas', 'Ventas', o, r, filtros, DIMENSIONES_VENTAS, METRICAS_VENTAS);
  }

  /** Inventario a medida (stock actual): sin fechas. */
  private async consultaInventario(p: ConsultaInventario, ctx: ContextoHerramientas) {
    const filtros: Record<string, string> = {};
    const idSucursal = p.idSucursal ? this.sucursalPermitida(p.idSucursal, ctx) : undefined;
    filtros['Sucursal'] = p.idSucursal ? this.nombreSucursal(p.idSucursal, ctx) : this.todasLasSucursales(ctx);
    if (p.stockMinimo !== undefined && p.stockMaximo !== undefined && p.stockMinimo > p.stockMaximo)
      throw new ErrorHerramienta('"stockMinimo" no puede ser mayor que "stockMaximo".');
    if (p.stockMinimo !== undefined) filtros['Stock desde'] = String(p.stockMinimo);
    if (p.stockMaximo !== undefined) filtros['Stock hasta'] = String(p.stockMaximo);
    const o = await this.opcionesFlexibles(p, DIMENSIONES_INVENTARIO, METRICAS_INVENTARIO, ['stockDisponible'], filtros);
    const r = await this.reports.inventarioFlexible(ctx.scope, { ...o, idSucursal, stockMinimo: p.stockMinimo, stockMaximo: p.stockMaximo });
    return this.reporteFlexible('consulta_inventario', 'Inventario', o, r, filtros, DIMENSIONES_INVENTARIO, METRICAS_INVENTARIO);
  }

  /** Valida la combinación de columnas y orden, y resuelve los nombres de los filtros contra el catálogo. */
  private async opcionesFlexibles(
    p: FiltrosFlexibles & { agrupar?: string[]; metricas?: string[] },
    dims: Record<string, DefinicionColumna>, mets: Record<string, DefinicionColumna>, porDefecto: string[], filtros: Record<string, string>,
  ): Promise<OpcionesFlexibles> {
    const agrupar = [...new Set(p.agrupar ?? [])];
    const metricas = [...new Set(p.metricas ?? porDefecto)];
    const periodos = agrupar.filter((k) => PERIODOS.includes(k));
    if (periodos.length > 1) throw new ErrorHerramienta('Agrupa por un solo periodo: dia, semana o mes.');
    const columnas = [...agrupar, ...metricas];
    const ordenarPor = p.ordenarPor ?? (periodos[0] ?? metricas[0]);
    if (!columnas.includes(ordenarPor))
      throw new ErrorHerramienta(`"ordenarPor" debe ser una de las columnas elegidas: ${columnas.join(', ')}.`);
    const direccion = p.direccion ? (p.direccion.toUpperCase() as 'ASC' | 'DESC') : ordenarPor in mets ? 'DESC' : 'ASC';
    const limite = p.limite ?? 100;

    const categorias = await this.resolverNombres('la categoría', p.categorias, () => this.categorias.find({ order: { nombre: 'ASC' }, take: 300 }));
    const tallas = await this.resolverNombres('la talla', p.tallas, () => this.tallas.find({ order: { nombre: 'ASC' }, take: 300 }));
    const colores = await this.resolverNombres('el color', p.colores, () => this.colores.find({ order: { nombre: 'ASC' }, take: 300 }));
    if (categorias?.length) filtros['Categorías'] = categorias.join(', ');
    if (tallas?.length) filtros['Tallas'] = tallas.join(', ');
    if (colores?.length) filtros['Colores'] = colores.join(', ');
    if (p.productos?.length) filtros['Producto contiene'] = p.productos.join(', ');
    const etiqueta = (dims[ordenarPor] ?? mets[ordenarPor]).etiqueta;
    filtros['Orden'] = `${etiqueta} (${direccion === 'ASC' ? 'ascendente' : 'descendente'})`;
    filtros['Límite'] = `${limite} filas`;
    return { agrupar, metricas, categorias, tallas, colores, productos: p.productos, ordenarPor, direccion, limite };
  }

  /** "negro" → "Negro" (nombre exacto del catálogo). Un valor inexistente se rechaza listando los disponibles. */
  private async resolverNombres(tipo: string, valores: string[] | undefined, lista: () => Promise<{ nombre: string }[]>) {
    if (!valores?.length) return undefined;
    const disponibles = (await lista()).map((x) => x.nombre);
    return [...new Set(valores.map((v) => {
      const buscado = normalizar(v);
      const exacto = disponibles.find((n) => normalizar(n) === buscado) ?? disponibles.find((n) => normalizar(n).includes(buscado));
      if (!exacto)
        throw new ErrorHerramienta(`No existe ${tipo} "${v}". Disponibles: ${disponibles.slice(0, 40).join(', ') || 'ninguna'}.`);
      return exacto;
    }))];
  }

  private reporteFlexible(
    herramienta: string, base: string, o: OpcionesFlexibles, r: { filas: Record<string, unknown>[]; recortado: boolean },
    filtros: Record<string, string>, dims: Record<string, DefinicionColumna>, mets: Record<string, DefinicionColumna>,
  ) {
    const columnas: ColumnaReporte[] = [
      ...o.agrupar.map((k) => ({ clave: k, etiqueta: dims[k].etiqueta, formato: dims[k].formato })),
      ...o.metricas.map((k) => ({ clave: k, etiqueta: mets[k].etiqueta, formato: mets[k].formato })),
    ];
    const titulo = o.agrupar.length
      ? `${base} por ${unirConY(o.agrupar.map((k) => dims[k].etiqueta.toLowerCase()))}`
      : `${base}: totales`;
    if (r.recortado) filtros['Aviso'] = `Se muestran las primeras ${o.limite} filas; agrega filtros para ver el resto.`;
    let grafico: GraficoReporte | null = null;
    if (o.agrupar.length === 1 && r.filas.length > 1) {
      const x = o.agrupar[0];
      if (PERIODOS.includes(x)) grafico = { tipo: 'linea', x, y: [o.metricas[0]] };
      else if (r.filas.length <= 30) grafico = { tipo: 'barras', x, y: [o.metricas[0]] };
    }
    const sumables = o.metricas.filter((k) => k !== 'precioPromedio');
    const resumen = { ...this.sumas(r.filas, sumables), recortado: r.recortado ? 1 : 0 };
    return this.reporte(herramienta, titulo, columnas, r.filas, grafico, filtros, resumen);
  }

  private async reservasPorEstado(p: ConSucursal, ctx: ContextoHerramientas) {
    const { desde, hasta, filtros } = this.rango(p, ctx);
    const f = Object.assign(new ReservationReportFiltersDto(), { desde, hasta, limit: 1, page: 1 });
    this.aplicarSucursal(p.idSucursal, f, filtros, ctx);
    const r = await this.reports.reservations(f, ctx.scope);
    const filas = [
      { estado: 'Pendiente', cantidad: r.pendientes },
      { estado: 'Preparada', cantidad: r.preparadas },
      { estado: 'Atendida', cantidad: r.atendidas },
      { estado: 'Cancelada', cantidad: r.canceladas },
    ];
    return this.reporte('reservas_por_estado', 'Reservas por estado', [
      { clave: 'estado', etiqueta: 'Estado', formato: 'texto' },
      { clave: 'cantidad', etiqueta: 'Reservas', formato: 'numero' },
    ], filas, { tipo: 'torta', x: 'estado', y: ['cantidad'] }, filtros, { total: r.total });
  }

  private async ventasPorMetodo(p: ConSucursal, ctx: ContextoHerramientas) {
    const { f, filtros } = this.filtrosVentas(p, ctx);
    const filas = await this.reports.paymentsByMethod(f, ctx.scope);
    return this.reporte('ventas_por_metodo_pago', 'Cobros por método de pago', [
      { clave: 'metodo', etiqueta: 'Método', formato: 'texto' },
      { clave: 'cantidad', etiqueta: 'Pagos', formato: 'numero' },
      { clave: 'monto', etiqueta: 'Monto', formato: 'moneda' },
    ], filas, { tipo: 'torta', x: 'metodo', y: ['monto'] }, filtros, this.sumas(filas, ['monto', 'cantidad']));
  }

  private async devolucionesYCambios(p: DevolucionesYCambios, ctx: ContextoHerramientas) {
    const { f, filtros } = this.filtrosVentas(p, ctx);
    const limite = p.limite ?? 15;
    const cat = p.categoria ? await this.categoria(p.categoria) : undefined;
    if (cat) filtros['Categoría'] = cat.nombre;
    filtros['Límite'] = String(limite);
    const filas = (await this.reports.returnsAndExchangesByProduct(f, ctx.scope, limite, cat?.idCategoria)).map((x) => ({
      producto: x.producto, categoria: x.categoria, unidadesVendidas: x.unidadesVendidas,
      unidadesDevueltas: x.unidadesDevueltas, tasaDevolucion: x.tasaDevolucion,
      unidadesCambiadas: x.unidadesCambiadas, tasaCambio: x.tasaCambio,
    }));
    const suma = this.sumas(filas, ['unidadesVendidas', 'unidadesDevueltas', 'unidadesCambiadas']);
    const tasa = (a: number) => (suma.unidadesVendidas ? Math.round((a / suma.unidadesVendidas) * 1000) / 10 : 0);
    return this.reporte('devoluciones_y_cambios_por_producto', 'Prendas devueltas y cambiadas', [
      { clave: 'producto', etiqueta: 'Producto', formato: 'texto' },
      { clave: 'categoria', etiqueta: 'Categoría', formato: 'texto' },
      { clave: 'unidadesVendidas', etiqueta: 'Vendidas', formato: 'numero' },
      { clave: 'unidadesDevueltas', etiqueta: 'Devueltas', formato: 'numero' },
      { clave: 'tasaDevolucion', etiqueta: '% devolución', formato: 'porcentaje' },
      { clave: 'unidadesCambiadas', etiqueta: 'Cambiadas', formato: 'numero' },
      { clave: 'tasaCambio', etiqueta: '% cambio', formato: 'porcentaje' },
    ], filas, { tipo: 'barras', x: 'producto', y: ['unidadesDevueltas', 'unidadesCambiadas'] }, filtros,
    { ...suma, tasaDevolucion: tasa(suma.unidadesDevueltas), tasaCambio: tasa(suma.unidadesCambiadas) });
  }

  private async motivos(p: MotivosDevolucionCambio, ctx: ContextoHerramientas) {
    const { f, filtros } = this.filtrosVentas(p, ctx);
    const tipo = p.tipo ?? 'ambos';
    filtros['Tipo'] = { ambos: 'Devoluciones y cambios', devoluciones: 'Devoluciones', cambios: 'Cambios' }[tipo];
    const filas = await this.reports.returnAndExchangeReasons(f, ctx.scope, tipo);
    return this.reporte('motivos_devolucion_y_cambio', 'Motivos de devolución y cambio', [
      { clave: 'motivo', etiqueta: 'Motivo', formato: 'texto' },
      { clave: 'tipo', etiqueta: 'Tipo', formato: 'texto' },
      { clave: 'operaciones', etiqueta: 'Operaciones', formato: 'numero' },
      { clave: 'unidades', etiqueta: 'Unidades', formato: 'numero' },
    ], filas, { tipo: 'barras', x: 'motivo', y: ['operaciones'] }, filtros, this.sumas(filas, ['operaciones', 'unidades']));
  }

  // ------------------------------------------------------------------ ayudas

  private reporte(
    herramienta: string, titulo: string, columnas: ColumnaReporte[], filas: Record<string, any>[],
    grafico: GraficoReporte | null, filtros: Record<string, string>, resumen: Record<string, number>,
  ): ReporteGenerado {
    return { herramienta, titulo, columnas, filas, grafico: filas.length ? grafico : null, filtros, resumen, moneda: '' };
  }

  private sumas(filas: Record<string, any>[], claves: string[]) {
    const r: Record<string, number> = { filas: filas.length };
    for (const k of claves) r[k] = Math.round(filas.reduce((s, x) => s + Number(x[k] ?? 0), 0) * 100) / 100;
    return r;
  }

  /** Rango de fechas validado: por defecto los últimos 30 días; máximo 2 años. */
  private rango(p: RangoFechas, ctx: ContextoHerramientas) {
    const hasta = p.hasta ?? ctx.hoy;
    const desde = p.desde ?? sumarDias(hasta, -29);
    if (!fechaValida(desde) || !fechaValida(hasta)) throw new ErrorHerramienta('Fecha inexistente (revisa día y mes).');
    if (desde > hasta) throw new ErrorHerramienta('"desde" no puede ser posterior a "hasta".');
    if (diasEntre(desde, hasta) > MAX_DIAS) throw new ErrorHerramienta(`El rango máximo es de ${MAX_DIAS} días.`);
    return { desde, hasta, filtros: { Desde: desde, Hasta: hasta } as Record<string, string> };
  }

  private filtrosVentas(p: RangoFechas & { idSucursal?: number }, ctx: ContextoHerramientas) {
    const { desde, hasta, filtros } = this.rango(p, ctx);
    const f = Object.assign(new ReportFiltersDto(), { desde, hasta });
    this.aplicarSucursal(p.idSucursal, f, filtros, ctx);
    return { f, filtros };
  }

  private aplicarSucursal(id: number | undefined, f: { idSucursal?: number }, filtros: Record<string, string>, ctx: ContextoHerramientas) {
    if (id) { f.idSucursal = this.sucursalPermitida(id, ctx); filtros['Sucursal'] = this.nombreSucursal(id, ctx); }
    else filtros['Sucursal'] = this.todasLasSucursales(ctx);
  }

  /** Una sucursal de otra empresa o no asignada al usuario se rechaza (no solo "da vacío"). */
  private sucursalPermitida(id: number, ctx: ContextoHerramientas) {
    if (!ctx.sucursales.some((s) => s.idSucursal === id))
      throw new ErrorHerramienta(
        `La sucursal ${id} no está permitida. Sucursales válidas: ${ctx.sucursales.map((s) => `${s.idSucursal} (${s.nombre})`).join(', ') || 'ninguna'}.`,
      );
    return id;
  }

  private nombreSucursal(id: number, ctx: ContextoHerramientas) {
    return ctx.sucursales.find((s) => s.idSucursal === id)?.nombre ?? String(id);
  }

  private todasLasSucursales(ctx: ContextoHerramientas) {
    return ctx.scope.branchIds === null ? 'Todas' : `Mis sucursales (${ctx.sucursales.map((s) => s.nombre).join(', ')})`;
  }

  private async categoria(nombre: string) {
    const lista = await this.categorias.find({ order: { nombre: 'ASC' }, take: 200 });
    const buscado = normalizar(nombre);
    const cat = lista.find((c) => normalizar(c.nombre) === buscado) ?? lista.find((c) => normalizar(c.nombre).includes(buscado));
    if (!cat)
      throw new ErrorHerramienta(
        `No existe la categoría "${nombre}". Categorías disponibles: ${lista.slice(0, 40).map((c) => c.nombre).join(', ') || 'ninguna'}.`,
      );
    return cat;
  }
}

// --------------------------------------------------------------------- fechas

export function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function diasEntre(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
function fechaValida(f: string) {
  const d = new Date(`${f}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
}
/** ["producto", "talla", "color"] → "producto, talla y color". */
function unirConY(partes: string[]) {
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : partes[0];
}

export function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
