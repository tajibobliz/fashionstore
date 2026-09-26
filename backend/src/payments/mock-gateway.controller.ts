import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pago } from './entities/pago.entity';
import { PaymentsService } from './payments.service';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Simulador local de pasarela de pago (Stripe/QR) para demos de la defensa.
 * No representa ninguna integración real. Aislado a propósito: se puede
 * eliminar este archivo (y su registro en payments.module.ts) sin tocar
 * ninguna otra parte del sistema de pagos.
 */
@Controller('mock-gateway')
export class MockGatewayController {
  constructor(
    @InjectRepository(Pago) private readonly pagoRepo: Repository<Pago>,
    private readonly paymentsService: PaymentsService,
  ) {}

  // Simula el redirect a la pasarela + el tiempo de procesamiento + el resultado.
  // Público: en la vida real, quien "llama" a esto es el navegador del cliente
  // volviendo de Stripe/QR, no un usuario autenticado de este sistema.
  @Public()
  @Post('process/:idPago')
  @HttpCode(HttpStatus.OK)
  async process(@Param('idPago', ParseIntPipe) idPago: number) {
    const pago = await this.pagoRepo.findOne({ where: { idPago } });
    if (!pago) throw new NotFoundException(`Pago ${idPago} no encontrado`);
    if (pago.estado !== 'PENDIENTE') {
      throw new BadRequestException(`El pago ya fue procesado (estado actual: ${pago.estado})`);
    }

    const delayMs = 1000 + Math.floor(Math.random() * 2000); // 1-3s
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const resultado = Math.random() < 0.9 ? 'APROBADO' : 'RECHAZADO';
    const referenciaPasarela = `MOCK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // Reutiliza la lógica real (lock + transacción + confirmación de venta/inventario si aplica).
    // Si el pago cambió de estado mientras esperábamos el delay simulado, updateEstado lo rechaza solo.
    await this.paymentsService.updateEstado(idPago, { estado: resultado, referenciaPasarela });

    return { idPago, resultado, referenciaPasarela };
  }

  // Endpoint que "recibiría" el POST real de Stripe/PayPal si algún día se integra de verdad.
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(@Body() body: { idPago?: number; resultado?: string; referenciaPasarela?: string }) {
    if (!body?.idPago || (body.resultado !== 'APROBADO' && body.resultado !== 'RECHAZADO')) {
      throw new BadRequestException('Body inválido: se espera { idPago, resultado: "APROBADO"|"RECHAZADO", referenciaPasarela? }');
    }
    await this.paymentsService.updateEstado(body.idPago, {
      estado: body.resultado,
      referenciaPasarela: body.referenciaPasarela,
    });
    return { idPago: body.idPago, resultado: body.resultado, referenciaPasarela: body.referenciaPasarela };
  }
}
