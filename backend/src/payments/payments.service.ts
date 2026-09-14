import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pago, EstadoPago, MetodoPago } from './entities/pago.entity';
import { Venta } from '../sales/entities/venta.entity';
import { SalesService } from '../sales/sales.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { UpdateEstadoPagoDto } from './dto/update-estado-pago.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
    @InjectRepository(Venta)
    private readonly ventaRepo: Repository<Venta>,
    private readonly salesService: SalesService,
  ) {}

  // Registra un intento de pago para una venta
  async create(dto: CreatePagoDto) {
    const venta = await this.ventaRepo.findOne({
      where: { idVenta: dto.idVenta },
    });
    if (!venta) throw new NotFoundException(`Venta ${dto.idVenta} no encontrada`);

    if (venta.estado !== 'PENDIENTE') {
      throw new BadRequestException(
        `No se puede pagar una venta en estado ${venta.estado}`,
      );
    }

    // Validar que el monto coincida con el total de la venta
    if (Number(dto.monto) !== Number(venta.total)) {
      throw new BadRequestException(
        `El monto (${dto.monto}) no coincide con el total de la venta (${venta.total})`,
      );
    }

    const pago = this.pagoRepo.create({
      venta,
      metodo: dto.metodo as MetodoPago,
      monto: dto.monto,
      estado: 'PENDIENTE',
      referenciaPasarela: dto.referenciaPasarela,
    });

    return this.pagoRepo.save(pago);
  }

  // Actualiza el estado del pago. Si es APROBADO, confirma la venta.
  async updateEstado(id: number, dto: UpdateEstadoPagoDto) {
    const pago = await this.findOne(id);

    if (pago.estado !== 'PENDIENTE') {
      throw new BadRequestException(
        `El pago ya está en estado ${pago.estado}`,
      );
    }

    pago.estado = dto.estado as EstadoPago;
    if (dto.referenciaPasarela) {
      pago.referenciaPasarela = dto.referenciaPasarela;
    }

    await this.pagoRepo.save(pago);

    // Si el pago fue aprobado, confirmar la venta (descontar stock)
    if (dto.estado === 'APROBADO') {
      await this.salesService.confirmar(pago.venta.idVenta);
    }

    return pago;
  }

  findAll() {
    return this.pagoRepo.find({ order: { fecha: 'DESC' } });
  }

  findByVenta(idVenta: number) {
    return this.pagoRepo.find({
      where: { venta: { idVenta } },
      order: { fecha: 'DESC' },
    });
  }

  async findOne(id: number) {
    const pago = await this.pagoRepo.findOne({ where: { idPago: id } });
    if (!pago) throw new NotFoundException(`Pago ${id} no encontrado`);
    return pago;
  }
}