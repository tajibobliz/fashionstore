import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Carrito } from './entities/carrito.entity';
import { DetalleCarrito } from './entities/detalle-carrito.entity';
import { VarianteProducto } from '../catalog/entities/variante-producto.entity';
import { Producto } from '../catalog/entities/producto.entity';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Carrito)
    private readonly carritoRepo: Repository<Carrito>,
    @InjectRepository(DetalleCarrito)
    private readonly detalleRepo: Repository<DetalleCarrito>,
    @InjectRepository(VarianteProducto)
    private readonly varianteRepo: Repository<VarianteProducto>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
  ) {}

  // Devuelve el carrito activo del usuario. Si no tiene, lo crea.
  async getMyCart(idUsuario: number): Promise<Carrito> {
    let carrito = await this.carritoRepo.findOne({
      where: { usuario: { idUsuario }, estado: 'ACTIVO' },
    });

    if (!carrito) {
      carrito = this.carritoRepo.create({
        usuario: { idUsuario } as any,
        estado: 'ACTIVO',
        detalles: [],
      });
      await this.carritoRepo.save(carrito);
    }

    return carrito;
  }

  // Agrega un item al carrito. Si ya existe, actualiza la cantidad.
  async addItem(idUsuario: number, dto: AddItemDto) {
    const variante = await this.varianteRepo.findOne({
      where: { idVariante: dto.idVariante },
    });
    if (!variante) {
      throw new NotFoundException(`Variante ${dto.idVariante} no encontrada`);
    }

    // El precio se toma del producto de la variante
    const producto = await this.productoRepo.findOne({
      where: { idProducto: variante.producto.idProducto },
    });
    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    const carrito = await this.getMyCart(idUsuario);

    // Buscar si esa variante ya está en el carrito
    const detalleExistente = carrito.detalles.find(
      (d) => d.variante.idVariante === dto.idVariante,
    );

    if (detalleExistente) {
      detalleExistente.cantidad += dto.cantidad;
      await this.detalleRepo.save(detalleExistente);
    } else {
      const nuevoDetalle = this.detalleRepo.create({
        carrito,
        variante,
        cantidad: dto.cantidad,
        precio: producto.precio,
      });
      await this.detalleRepo.save(nuevoDetalle);
    }

    // Recargar el carrito para devolverlo actualizado
    return this.getMyCart(idUsuario);
  }

  // Actualiza la cantidad de un item específico
  async updateItem(idUsuario: number, idDetalle: number, dto: UpdateItemDto) {
    const carrito = await this.getMyCart(idUsuario);

    const detalle = carrito.detalles.find(
      (d) => d.idDetalleCarrito === idDetalle,
    );
    if (!detalle) {
      throw new NotFoundException(`Item ${idDetalle} no está en tu carrito`);
    }

    detalle.cantidad = dto.cantidad;
    await this.detalleRepo.save(detalle);

    return this.getMyCart(idUsuario);
  }

  // Elimina un item del carrito
  async removeItem(idUsuario: number, idDetalle: number) {
    const carrito = await this.getMyCart(idUsuario);

    const detalle = carrito.detalles.find(
      (d) => d.idDetalleCarrito === idDetalle,
    );
    if (!detalle) {
      throw new NotFoundException(`Item ${idDetalle} no está en tu carrito`);
    }

    await this.detalleRepo.remove(detalle);
    return this.getMyCart(idUsuario);
  }

  // Vacía el carrito completo
  async clear(idUsuario: number) {
    const carrito = await this.getMyCart(idUsuario);
    if (carrito.detalles.length > 0) {
      await this.detalleRepo.remove(carrito.detalles);
    }
    return this.getMyCart(idUsuario);
  }

  // Calcula el total del carrito
  async getTotal(idUsuario: number): Promise<number> {
    const carrito = await this.getMyCart(idUsuario);
    return carrito.detalles.reduce(
      (sum, d) => sum + Number(d.precio) * d.cantidad,
      0,
    );
  }
}
