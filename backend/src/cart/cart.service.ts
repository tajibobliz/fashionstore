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
import { Sucursal } from '../branches/entities/sucursal.entity';
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
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
  ) {}

  /**
   * La sucursal tiene que ser de la tienda actual (RLS) y estar activa. Antes no se validaba:
   * con una sucursal guardada de otra tienda, "agregar" respondía OK pero la prenda quedaba en un
   * carrito que no se podía leer (el carrito seguía en 0), y con un id inexistente daba error 500.
   */
  private async asegurarSucursal(idSucursal: number) {
    const sucursal = await this.sucursalRepo.findOne({ where: { idSucursal } });
    if (!sucursal || !sucursal.estado)
      throw new NotFoundException('Esa sucursal no está disponible en esta tienda. Elige otra sucursal.');
  }

  /** Detalle del carrito activo del usuario (en cualquiera de sus sucursales). */
  private async detalleMio(idUsuario: number, idDetalle: number) {
    const detalle = await this.detalleRepo.findOne({
      where: { idDetalleCarrito: idDetalle, carrito: { usuario: { idUsuario }, estado: 'ACTIVO' } },
      relations: { carrito: true },
    });
    if (!detalle) throw new NotFoundException(`Item ${idDetalle} no está en tu carrito`);
    return detalle;
  }

  // Devuelve el carrito activo del usuario. Si no tiene, lo crea.
  async getMyCart(idUsuario: number, idSucursal: number): Promise<Carrito> {
    await this.asegurarSucursal(idSucursal);
    let carrito = await this.carritoRepo.findOne({
      where: { usuario: { idUsuario }, sucursal: { idSucursal }, estado: 'ACTIVO' },
    });

    if (!carrito) {
      carrito = this.carritoRepo.create({
        usuario: { idUsuario } as any,
        estado: 'ACTIVO', sucursal: { idSucursal } as any,
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

    const carrito = await this.getMyCart(idUsuario, dto.idSucursal);

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
    return this.getMyCart(idUsuario, dto.idSucursal);
  }

  // Actualiza la cantidad de un item específico
  // (Antes tomaba "cualquier" carrito activo del usuario: con carritos en dos sucursales podía
  // no encontrar el item. Ahora se busca el item entre todos sus carritos activos.)
  async updateItem(idUsuario: number, idDetalle: number, dto: UpdateItemDto) {
    const detalle = await this.detalleMio(idUsuario, idDetalle);
    detalle.cantidad = dto.cantidad;
    await this.detalleRepo.save(detalle);
    return this.carritoRepo.findOne({ where: { idCarrito: detalle.carrito.idCarrito } });
  }

  // Elimina un item del carrito
  async removeItem(idUsuario: number, idDetalle: number) {
    const detalle = await this.detalleMio(idUsuario, idDetalle);
    const idCarrito = detalle.carrito.idCarrito;
    await this.detalleRepo.remove(detalle);
    return this.carritoRepo.findOne({ where: { idCarrito } });
  }

  // Vacía el carrito completo
  async clear(idUsuario: number, idSucursal: number) {
    const carrito = await this.getMyCart(idUsuario, idSucursal);
    if (carrito.detalles.length > 0) {
      await this.detalleRepo.remove(carrito.detalles);
    }
    return this.getMyCart(idUsuario, idSucursal);
  }

  // Calcula el total del carrito
  async getTotal(idUsuario: number, idSucursal: number): Promise<number> {
    const carrito = await this.getMyCart(idUsuario, idSucursal);
    return carrito.detalles.reduce(
      (sum, d) => sum + Number(d.precio) * d.cantidad,
      0,
    );
  }
}
