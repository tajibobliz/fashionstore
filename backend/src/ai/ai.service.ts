import { ReportsService } from '../reports/reports.service';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import { Categoria } from '../catalog/entities/categoria.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InteraccionCliente } from '../ar/entities/interaccion-cliente.entity';
import { Producto } from '../catalog/entities/producto.entity';
import { DetalleVenta } from '../sales/entities/detalle-venta.entity';

@Injectable()
export class AiService {
  // Subquery: ids de producto con stock disponible > 0 en al menos una variante/almacén.
  // Se usa como filtro WHERE (no JOIN) para no inflar los SUM() de las queries que agregan.
  private static readonly PRODUCTOS_CON_STOCK_SQL = `
    SELECT vp.id_producto FROM variante_producto vp
    INNER JOIN inventario inv ON inv.id_variante = vp.id_variante
    GROUP BY vp.id_producto
    HAVING SUM(inv.stock_disponible) > 0
  `;

  constructor(
    @InjectRepository(InteraccionCliente)
    private readonly interaccionRepo: Repository<InteraccionCliente>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(DetalleVenta)
    private readonly detalleVentaRepo: Repository<DetalleVenta>,
    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,
    private readonly config: ConfigService,
    private readonly reportsService: ReportsService,
  ) {}

  /**
   * Recomendaciones personalizadas para un usuario.
   * Lógica: buscar las categorías de productos con las que el usuario ha interactuado más,
   * y devolver otros productos de esas categorías que aún no ha visto.
   */
  async recomendarParaUsuario(idUsuario: number, limit: number = 8) {
    // 1. Obtener las categorías con las que más ha interactuado el usuario
    const categoriasFavoritas = await this.interaccionRepo
      .createQueryBuilder('i')
      .select('p.id_categoria', 'idCategoria')
      .addSelect('COUNT(*)', 'total')
      .innerJoin('i.producto', 'p')
      .where('i.id_usuario = :idUsuario', { idUsuario })
      .groupBy('p.id_categoria')
      .orderBy('total', 'DESC')
      .limit(3)
      .getRawMany();

    if (categoriasFavoritas.length === 0) {
      // Usuario sin historial → devolver populares
      return this.productosPopulares(limit);
    }

    const idsCategorias = categoriasFavoritas.map((c) => c.idCategoria);

    // 2. Obtener los productos con los que YA interactuó (para excluirlos)
    const yaInteractuados = await this.interaccionRepo
      .createQueryBuilder('i')
      .select('DISTINCT i.id_producto', 'idProducto')
      .where('i.id_usuario = :idUsuario', { idUsuario })
      .getRawMany();

    const idsExcluir = yaInteractuados.map((i) => i.idProducto);

    // 3. Buscar productos de esas categorías que no haya interactuado
    const query = this.productoRepo
      .createQueryBuilder('p')
      .where('p.id_categoria IN (:...idsCategorias)', { idsCategorias })
      .andWhere('p.estado = :estado', { estado: true });

    if (idsExcluir.length > 0) {
      query.andWhere('p.id_producto NOT IN (:...idsExcluir)', { idsExcluir });
    }

    return query.limit(limit).getMany();
  }

  /**
   * Productos más populares (basado en cantidad vendida).
   * Se usa como fallback si el usuario no tiene historial.
   */
  async productosPopulares(limit: number = 8) {
    const result = await this.detalleVentaRepo
      .createQueryBuilder('dv')
      .select('p.id_producto', 'idProducto')
      .addSelect('SUM(dv.cantidad)', 'totalVendido')
      .innerJoin('dv.variante', 'v')
      .innerJoin('v.producto', 'p')
      .where('p.estado = :estado', { estado: true })
      .andWhere(`p.id_producto IN (${AiService.PRODUCTOS_CON_STOCK_SQL})`)
      .groupBy('p.id_producto')
      .orderBy('"totalVendido"', 'DESC')
      .limit(limit)
      .getRawMany();

    if (result.length === 0) {
      // Si no hay ventas, devolver los últimos productos activos con stock
      return this.productoRepo
        .createQueryBuilder('p')
        .where('p.estado = :estado', { estado: true })
        .andWhere(`p.id_producto IN (${AiService.PRODUCTOS_CON_STOCK_SQL})`)
        .orderBy('p.id_producto', 'DESC')
        .limit(limit)
        .getMany();
    }

    const ids = result.map((r) => r.idProducto);
    return this.productoRepo
      .createQueryBuilder('p')
      .where('p.id_producto IN (:...ids)', { ids })
      .getMany();
  }

  /**
   * Productos similares a uno dado.
   * Lógica: misma categoría, precio parecido (±30%), excluyendo el mismo producto.
   */
  async productosSimilares(idProducto: number, limit: number = 6) {
    const producto = await this.productoRepo.findOne({
      where: { idProducto },
    });
    if (!producto) return [];

    const precio = Number(producto.precio);
    const precioMin = precio * 0.7;
    const precioMax = precio * 1.3;

    return this.productoRepo
      .createQueryBuilder('p')
      .where('p.id_categoria = :idCategoria', { idCategoria: producto.categoria.idCategoria })
      .andWhere('p.id_producto != :idProducto', { idProducto })
      .andWhere('p.precio BETWEEN :precioMin AND :precioMax', { precioMin, precioMax })
      .andWhere('p.estado = :estado', { estado: true })
      .andWhere(`p.id_producto IN (${AiService.PRODUCTOS_CON_STOCK_SQL})`)
      .limit(limit)
      .getMany();
  }

  /**
   * "Clientes que compraron X también compraron..."
   * Lógica de filtrado colaborativo simple: busca otros productos que aparecen en las mismas ventas.
   */
  async tambienCompraron(idProducto: number, limit: number = 6) {
    const result = await this.detalleVentaRepo.manager
      .createQueryBuilder()
      .select('otros.id_producto', 'idProducto')
      .addSelect('COUNT(*)', 'coincidencias')
      .from('detalle_venta', 'dv1')
      .innerJoin('variante_producto', 'v1', 'v1.id_variante = dv1.id_variante')
      .innerJoin('detalle_venta', 'dv2', 'dv2.id_venta = dv1.id_venta')
      .innerJoin('variante_producto', 'v2', 'v2.id_variante = dv2.id_variante')
      .innerJoin('producto', 'otros', 'otros.id_producto = v2.id_producto')
      .where('v1.id_producto = :idProducto', { idProducto })
      .andWhere('v2.id_producto != :idProducto', { idProducto })
      .andWhere('otros.estado = true')
      .andWhere(`otros.id_producto IN (${AiService.PRODUCTOS_CON_STOCK_SQL})`)
      .groupBy('otros.id_producto')
      .orderBy('"coincidencias"', 'DESC')
      .limit(limit)
      .getRawMany();

    if (result.length === 0) return [];

    const ids = result.map((r) => r.idProducto);
    return this.productoRepo
      .createQueryBuilder('p')
      .where('p.id_producto IN (:...ids)', { ids })
      .getMany();
  }

  /**
   * Productos de una temporada (Producto -> Coleccion -> Temporada).
   * "Más recientes" se aproxima por id_producto DESC: la entidad Producto no tiene
   * columna de fecha de creación, y no podemos agregarla sin migración.
   */
  async recomendarPorTemporada(temporada: string, limit: number = 10) {
    if (!temporada?.trim()) return [];
    return this.productoRepo
      .createQueryBuilder('p')
      .innerJoin('p.coleccion', 'c')
      .innerJoin('c.temporada', 't')
      .where('LOWER(t.nombre) = LOWER(:temporada)', { temporada: temporada.trim() })
      .andWhere('p.estado = :estado', { estado: true })
      .orderBy('p.id_producto', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Productos con variantes en las tallas más frecuentes de las últimas 5 compras
   * PAGADAS del usuario. Sin historial de compras pagadas -> array vacío.
   */
  async recomendarPorTalla(idUsuario: number, limit: number = 10) {
    const ventasRecientes = await this.detalleVentaRepo.manager
      .createQueryBuilder()
      .select('v.id_venta', 'idVenta')
      .from('venta', 'v')
      .where('v.id_usuario = :idUsuario', { idUsuario })
      .andWhere("v.estado = 'PAGADA'")
      .orderBy('v.fecha', 'DESC')
      .limit(5)
      .getRawMany();

    if (ventasRecientes.length === 0) return [];
    const idsVenta = ventasRecientes.map((v) => v.idVenta);

    const tallas = await this.detalleVentaRepo
      .createQueryBuilder('dv')
      .select('vp.id_talla', 'idTalla')
      .addSelect('COUNT(*)', 'frecuencia')
      .innerJoin('dv.variante', 'vp')
      .where('dv.id_venta IN (:...idsVenta)', { idsVenta })
      .andWhere('vp.id_talla IS NOT NULL')
      .groupBy('vp.id_talla')
      .orderBy('frecuencia', 'DESC')
      .limit(3)
      .getRawMany();

    if (tallas.length === 0) return [];
    const idsTalla = tallas.map((t) => t.idTalla);

    return this.productoRepo
      .createQueryBuilder('p')
      .innerJoin('variante_producto', 'vp', 'vp.id_producto = p.id_producto')
      .innerJoin('inventario', 'inv', 'inv.id_variante = vp.id_variante')
      .where('vp.id_talla IN (:...idsTalla)', { idsTalla })
      .andWhere('p.estado = :estado', { estado: true })
      .groupBy('p.id_producto')
      .having('SUM(inv.stock_disponible) > 0')
      .limit(limit)
      .getMany();
  }

  /**
 * Asistente virtual con Claude (Anthropic).
 * Recibe consultas en lenguaje natural y responde con recomendaciones
 * basadas en el catálogo real de la tienda.
 */
async asistenteChat(idUsuario: number, consulta: string) {
  const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY no configurada en el .env');
  }

  // Obtener catálogo actual como contexto
  const productos = await this.productoRepo.find({
    where: { estado: true },
    take: 30,
  });

  const categorias = await this.categoriaRepo.find();

  const contexto = {
    tienda: 'FashionStore - Tienda de ropa',
    categoriasDisponibles: categorias.map((c) => c.nombre),
    productosDisponibles: productos.map((p) => ({
      id: p.idProducto,
      nombre: p.nombre,
      categoria: p.categoria?.nombre,
      descripcion: p.descripcion,
      precio: Number(p.precio),
    })),
  };

  const systemPrompt = `Eres un asistente virtual de FashionStore, una tienda de ropa.
Ayudas a los clientes con recomendaciones y consultas sobre el catálogo.

REGLAS ESTRICTAS:
- Solo recomienda productos del catálogo actual (usa exactamente sus nombres).
- Si el cliente pregunta algo fuera de moda/tienda, responde amablemente que solo puedes ayudar con temas de la tienda.
- Sé breve: máximo 3 párrafos.
- Cuando recomiendes, menciona nombre y precio.
- Responde siempre en español.

CATÁLOGO ACTUAL:
${JSON.stringify(contexto, null, 2)}`;

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      { role: 'user', content: consulta },
    ],
  });

  // Extraer el texto de la respuesta
  const respuesta = response.content
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('\n');

  return {
    consulta,
    respuesta,
    fecha: new Date(),
    modelo: response.model,
    tokensUsados: {
      entrada: response.usage.input_tokens,
      salida: response.usage.output_tokens,
    },
  };
}
/**
 * Reporte generativo por voz/texto.
 * Recibe una consulta en lenguaje natural sobre el negocio y responde
 * con datos reales del sistema, usando Claude para interpretar.
 */
async reporteVoz(consulta: string) {
  const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY no configurada en el .env');
  }

  // Obtener datos actuales del sistema en paralelo
  const [
    resumen,
    topProductos,
    ventasPorSucursal,
    inventarioCritico,
    reservasPorEstado,
    ventasPorDia,
  ] = await Promise.all([
    this.reportsService.getResumenGeneral(),
    this.reportsService.getTopProductosVendidos(5),
    this.reportsService.getVentasPorSucursal(),
    this.reportsService.getInventarioCritico(5),
    this.reportsService.getReservasPorEstado(),
    this.reportsService.getVentasPorDia(),
  ]);

  const datosDelSistema = {
    resumenGeneral: resumen,
    top5ProductosMasVendidos: topProductos,
    ventasPorSucursal,
    inventarioCriticoStockBajo: inventarioCritico,
    reservasPorEstado,
    ventasUltimos30Dias: ventasPorDia,
    fechaConsulta: new Date().toISOString(),
  };

  const systemPrompt = `Eres un asistente ejecutivo de FashionStore que responde consultas sobre el negocio.
Tienes acceso a datos reales y actualizados del sistema.

REGLAS:
- Usa SOLO los datos proporcionados abajo. No inventes cifras.
- Sé conciso y directo. Máximo 4 oraciones a menos que pidan un análisis detallado.
- Usa números específicos cuando sea relevante (ej: "hoy se vendieron 8 productos").
- Habla en español, tono profesional pero cercano.
- Si el usuario pregunta algo que no puedes responder con estos datos, dilo claramente.
- Formato apto para ser leído en voz alta (evita bullets, tablas, código).

DATOS ACTUALES DEL SISTEMA:
${JSON.stringify(datosDelSistema, null, 2)}`;

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 400,
    system: systemPrompt,
    messages: [
      { role: 'user', content: consulta },
    ],
  });

  const respuesta = response.content
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('\n');

  return {
    consulta,
    respuesta,
    fecha: new Date(),
    modelo: response.model,
    tokensUsados: {
      entrada: response.usage.input_tokens,
      salida: response.usage.output_tokens,
    },
  };
}
}