import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { AllowWithoutSubscription } from '../tenancy/plan.decorators';
import { BillingService } from './billing.service';

export class IniciarCheckoutDto {
  @IsIn(['BASICO', 'PROFESIONAL', 'EMPRESARIAL'])
  codigoPlan: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  meses?: number;
}

/**
 * Pago de la suscripción (la tienda le paga a la plataforma). Solo el ADMIN de la empresa.
 * Se permite sin suscripción vigente: justamente es para pagar o renovar.
 */
@ApiTags('Pago de suscripción (SaaS)')
@ApiBearerAuth()
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@AllowWithoutSubscription()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /** Crea la sesión de pago del plan elegido y devuelve la URL a la que hay que ir. */
  @Post('checkout')
  checkout(@Request() req: any, @Body() dto: IniciarCheckoutDto) {
    return this.billing.iniciarCheckout(
      req.user,
      dto.codigoPlan,
      dto.meses ?? 1,
    );
  }

  @Get('pagos')
  historial(@Request() req: any) {
    return this.billing.historial(req.user);
  }

  /** Estado de un pago: la página de éxito lo consulta hasta que el webhook lo confirma. */
  @Get('pagos/:referencia')
  consultar(@Request() req: any, @Param('referencia') referencia: string) {
    return this.billing.consultar(req.user, referencia);
  }

  @Post('pagos/:referencia/cancelar')
  @HttpCode(200)
  cancelar(@Request() req: any, @Param('referencia') referencia: string) {
    return this.billing.cancelar(req.user, referencia);
  }

  /** Solo con la pasarela simulada (sin claves de Stripe o en las pruebas). */
  @Post('simulado/:referencia/pagar')
  @HttpCode(200)
  pagarSimulado(@Request() req: any, @Param('referencia') referencia: string) {
    return this.billing.pagarSimulado(req.user, referencia);
  }
}

/**
 * Webhook de Stripe: sin sesión (lo llama Stripe). La autenticidad se comprueba con la
 * firma `Stripe-Signature` sobre el cuerpo crudo, por eso main.ts activa `rawBody`.
 */
@Controller('billing/stripe')
@AllowWithoutSubscription()
export class StripeWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post('webhook')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  webhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('stripe-signature') firma: string | undefined,
  ) {
    return this.billing.procesarWebhook(req.rawBody, firma);
  }
}
