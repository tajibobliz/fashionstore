import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InteraccionCliente, TipoInteraccion } from './entities/interaccion-cliente.entity';
import { Producto } from '../catalog/entities/producto.entity';
import { RegistrarInteraccionDto } from './dto/registrar-interaccion.dto';
import { AsignarRecursoDto } from './dto/asignar-recurso.dto';

@Injectable()
export class ArService {
  constructor(
    @InjectRepository(InteraccionCliente)
    private readonly interaccionRepo: Repository<InteraccionCliente>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
  ) {}

  // Lista productos que tienen recurso RA disponible (para el catálogo del vestidor)
  async getProductosConRA() {
    return this.productoRepo
      .createQueryBuilder('p')
      .where('p.recurso_ra_url IS NOT NULL')
      .andWhere('p.estado = :estado', { estado: true })
      .getMany();
  }

  // Asigna o actualiza el recurso RA de un producto (solo ADMIN)
  async asignarRecurso(dto: AsignarRecursoDto) {
    const producto = await this.productoRepo.findOne({
      where: { idProducto: dto.idProducto },
    });
    if (!producto) throw new NotFoundException(`Producto ${dto.idProducto} no encontrado`);

    producto.recursoRaUrl = dto.recursoRaUrl;
    return this.productoRepo.save(producto);
  }

  // Elimina el recurso RA de un producto
  async eliminarRecurso(idProducto: number) {
    const producto = await this.productoRepo.findOne({
      where: { idProducto: idProducto },
    });
    if (!producto) throw new NotFoundException(`Producto ${idProducto} no encontrado`);

    producto.recursoRaUrl = null as any;
    await this.productoRepo.save(producto);
    return { message: `Recurso RA eliminado del producto ${idProducto}` };
  }

  // Registra una interacción del cliente (visualización, prueba virtual, etc.)
  async registrarInteraccion(idUsuario: number, dto: RegistrarInteraccionDto) {
    const producto = await this.productoRepo.findOne({
      where: { idProducto: dto.idProducto },
    });
    if (!producto) throw new NotFoundException(`Producto ${dto.idProducto} no encontrado`);

    const interaccion = this.interaccionRepo.create({
      usuario: { idUsuario } as any,
      producto,
      tipo: dto.tipo as TipoInteraccion,
    });

    return this.interaccionRepo.save(interaccion);
  }

  // Historial de pruebas virtuales del cliente
  async getMisPruebasVirtuales(idUsuario: number) {
    return this.interaccionRepo.find({
      where: {
        usuario: { idUsuario },
        tipo: 'PRUEBA_VIRTUAL',
      },
      order: { fecha: 'DESC' },
    });
  }

  // Ranking de productos más probados virtualmente (para estadísticas)
  async getTopPruebasVirtuales(limit: number = 10) {
    const result = await this.interaccionRepo
      .createQueryBuilder('i')
      .select('p.id_producto', 'idProducto')
      .addSelect('p.nombre', 'nombreProducto')
      .addSelect('COUNT(i.id_interaccion)', 'totalPruebas')
      .innerJoin('i.producto', 'p')
      .where('i.tipo = :tipo', { tipo: 'PRUEBA_VIRTUAL' })
      .groupBy('p.id_producto')
      .addGroupBy('p.nombre')
      .orderBy('"totalPruebas"', 'DESC')
      .limit(limit)
      .getRawMany();

    return result;
  }
}
