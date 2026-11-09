import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Pago, EstadoPago, MetodoPago } from './entities/pago.entity';
import { Venta } from '../sales/entities/venta.entity';
import { SalesService } from '../sales/sales.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { UpdateEstadoPagoDto } from './dto/update-estado-pago.dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../auth/enums/role.enum';
import { BranchAccessService } from '../users/branch-access.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
    @InjectRepository(Venta)
    private readonly ventaRepo: Repository<Venta>,
    private readonly salesService: SalesService,
    private readonly dataSource: DataSource,
    private readonly branchAccess: BranchAccessService,
  ) {}

  // Registra un intento de pago para una venta
  async create(dto: CreatePagoDto, actor: AuthenticatedUser) {
    const venta = await this.ventaRepo.findOne({
      where: { idVenta: dto.idVenta },
    });
    if (!venta) throw new NotFoundException(`Venta ${dto.idVenta} no encontrada`);
    await this.assertCanAccessSale(venta, actor, 'crear un pago para');

    if (dto.clientRequestId) {
      const existing = await this.pagoRepo.findOne({ where: {
        venta: { idVenta: venta.idVenta }, clientRequestId: dto.clientRequestId,
      } });
      if (existing) return existing;
    }

    const isPaidPresentialSale = venta.tipoVenta === 'PRESENCIAL' && venta.estado === 'PAGADA';
    if (venta.estado !== 'PENDIENTE' && !isPaidPresentialSale) {
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
      clientRequestId: dto.clientRequestId ?? null,
      metodo: dto.metodo as MetodoPago,
      monto: dto.monto,
      estado: isPaidPresentialSale && dto.metodo === 'EFECTIVO' ? 'APROBADO' : 'PENDIENTE',
      referenciaPasarela: dto.referenciaPasarela,
    });

    try {
      return await this.pagoRepo.save(pago);
    } catch (error) {
      if (dto.clientRequestId && error instanceof QueryFailedError &&
          (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505') {
        const existing = await this.pagoRepo.findOne({ where: {
          venta: { idVenta: venta.idVenta }, clientRequestId: dto.clientRequestId,
        } });
        if (existing) return existing;
      }
      throw error;
    }
  }

  // Actualiza el estado del pago. Si es APROBADO, confirma la venta.
  async updateEstado(id: number, dto: UpdateEstadoPagoDto, actor?: AuthenticatedUser) {
    let rechazado = false;
    const resultado = await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder(Pago, 'pago')
        .setLock('pessimistic_write')
        .where('pago.id_pago = :id', { id })
        .getOne();
      const pago = await manager.findOne(Pago, { where: { idPago: id } });
      if (!pago) throw new NotFoundException(`Pago ${id} no encontrado`);
      if (actor) await this.assertCanAccessSale(pago.venta, actor, 'actualizar un pago de');
      if (pago.estado !== 'PENDIENTE') {
        if (pago.estado === dto.estado) return pago;
        throw new BadRequestException(`El pago ya está en estado ${pago.estado}`);
      }

      // Confirmar inventario y venta antes de persistir la aprobación.
      // Todo comparte la misma transacción y se revierte ante cualquier error.
      if (dto.estado === 'APROBADO' && pago.venta.tipoVenta !== 'PRESENCIAL') {
        await this.salesService.confirmarEnTransaccion(manager, pago.venta.idVenta);
      }

      pago.estado = dto.estado as EstadoPago;
      if (dto.referenciaPasarela) pago.referenciaPasarela = dto.referenciaPasarela;
      rechazado = dto.estado === 'RECHAZADO';
      return manager.save(pago);
    });
    // Push a la clienta cuando la tienda rechaza su pago (el aprobado ya avisa "Compra confirmada").
    // Después del commit y solo si el estado cambió en esta llamada (no en reintentos idempotentes).
    if (rechazado) this.salesService.notificarPagoRechazado(resultado.venta);
    return resultado;
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

  async findOneAuthorized(id: number, actor: AuthenticatedUser) {
    const pago = await this.findOne(id);
    await this.assertCanAccessSale(pago.venta, actor, 'consultar');
    return pago;
  }

  async findByVentaAuthorized(idVenta: number, actor: AuthenticatedUser) {
    const venta = await this.ventaRepo.findOne({ where: { idVenta } });
    if (!venta) throw new NotFoundException(`Venta ${idVenta} no encontrada`);
    await this.assertCanAccessSale(venta, actor, 'consultar pagos de');
    return this.findByVenta(idVenta);
  }

  /** Dueña de la compra o personal (encargado de sucursal y cajero, solo de sus sucursales). */
  async assertCanAccessSale(venta: Venta, actor: AuthenticatedUser, accion: string) {
    const esPersonal = [Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL, Role.CAJERO].includes(actor.rol);
    if (!esPersonal && venta.usuario?.idUsuario !== actor.idUsuario) {
      throw new ForbiddenException(`No puedes ${accion} esta venta`);
    }
    if ([Role.ENCARGADO_SUCURSAL, Role.CAJERO].includes(actor.rol)) {
      await this.branchAccess.assertCanAccess(actor, venta.sucursal.idSucursal);
    }
  }
}
