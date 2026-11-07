import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import {
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
}

/** Contexto que pone el backend; el modelo no lo puede cambiar. */
export interface ContextoHerramientas {
  scope: ReportScope;
  /** Sucursales que el usuario puede consultar (ya filtradas por empresa y asignación). */
  sucursales: { idSucursal: number; nombre: string }[];
  /** Fecha de hoy en la zona horaria de la empresa, YYYY-MM-DD. */
  hoy: string;
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
    descripcion: 'Productos más vendidos (por unidades) con el ingreso que generaron. Se puede filtrar por nombre de categoría.',
    parametros: objeto({
      ...rango,
      ...sucursal,
      limite: { type: 'integer', minimum: 1, maximum: 50, description: 'Cuántos productos. Por defecto 10.' },
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

  async ejecutar(nombre: string, entrada: unknown, ctx: ContextoHerramientas): Promise<ReporteGenerado> {
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
      { clave: 'totalVendido', etiqueta: 'Total (Bs)', formato: 'moneda' },
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
      { clave: 'totalVendido', etiqueta: 'Total (Bs)', formato: 'moneda' },
    ], filas, { tipo: 'barras', x: 'sucursal', y: ['totalVendido'] }, filtros, this.sumas(filas, ['totalVendido', 'cantidadVentas', 'unidadesVendidas']));
  }

  private async topProductos(p: TopProductos, ctx: ContextoHerramientas) {
    const { f, filtros } = this.filtrosVentas(p, ctx);
    const limite = p.limite ?? 10;
    const cat = p.categoria ? await this.categoria(p.categoria) : undefined;
    if (cat) filtros['Categoría'] = cat.nombre;
    filtros['Límite'] = String(limite);
    const filas = (await this.reports.topProducts(f, ctx.scope, limite, cat?.idCategoria)).map((x) => ({
      producto: x.nombre, categoria: x.categoria ?? 'Sin categoría', cantidadVendida: x.cantidadVendida, totalGenerado: x.totalGenerado,
    }));
    return this.reporte('top_productos', 'Productos más vendidos', [
      { clave: 'producto', etiqueta: 'Producto', formato: 'texto' },
      { clave: 'categoria', etiqueta: 'Categoría', formato: 'texto' },
      { clave: 'cantidadVendida', etiqueta: 'Unidades', formato: 'numero' },
      { clave: 'totalGenerado', etiqueta: 'Ingreso (Bs)', formato: 'moneda' },
    ], filas, { tipo: 'barras', x: 'producto', y: ['cantidadVendida'] }, filtros, this.sumas(filas, ['cantidadVendida', 'totalGenerado']));
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
      { clave: 'totalVendido', etiqueta: 'Total (Bs)', formato: 'moneda' },
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
      { clave: 'monto', etiqueta: 'Monto (Bs)', formato: 'moneda' },
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
    return { herramienta, titulo, columnas, filas, grafico: filas.length ? grafico : null, filtros, resumen };
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
export function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
