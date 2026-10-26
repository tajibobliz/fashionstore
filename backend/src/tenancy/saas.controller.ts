import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Ip,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../auth/decorators/public.decorator';
import { AuthService } from '../auth/auth.service';
import { Plan } from './entities/plan.entity';
import { Empresa } from './entities/empresa.entity';
import { SubscriptionsService } from './subscriptions.service';
import { CreateEmpresaDto } from './dto/platform.dto';
import { AllowWithoutSubscription } from './plan.decorators';
import { TenantContext } from './tenant-context';

/** Máximo de registros de empresa por IP y hora (evita abusos del formulario público). */
const REGISTROS_POR_HORA = 5;

/**
 * Endpoints públicos de la página del SaaS: planes y contratación (auto-registro).
 * La contratación es simulada (sin cobro real), como permite el enunciado §9.5.
 */
@ApiTags('SaaS público')
@Controller('saas')
@Public()
@AllowWithoutSubscription()
export class SaasController {
  private readonly intentos = new Map<string, number[]>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly subscriptions: SubscriptionsService,
    private readonly auth: AuthService,
  ) {}

  /** Planes activos para la página de precios (salen de la BD: configurables). */
  @Get('planes')
  async planes() {
    const planes = await this.dataSource
      .getRepository(Plan)
      .find({ where: { activo: true }, order: { precioReferencia: 'ASC' } });
    return planes.map((p) => ({
      codigo: p.codigo,
      nombre: p.nombre,
      maxSucursales: p.maxSucursales,
      maxUsuarios: p.maxUsuarios,
      features: p.features,
      precioReferencia: Number(p.precioReferencia),
    }));
  }

  /** ¿Está libre este slug? Lo usa el formulario mientras se escribe. */
  @Get('slug-disponible')
  async slugDisponible(@Query('slug') slug = '') {
    const limpio = slug.trim().toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(limpio) || limpio.length < 3)
      return { slug: limpio, disponible: false, motivo: 'formato' };
    const existe = await this.dataSource
      .getRepository(Empresa)
      .exists({ where: { slug: limpio } });
    return {
      slug: limpio,
      disponible: !existe && !this.subscriptions.esReservado(limpio),
    };
  }

  /** Contratar un plan: crea la empresa, su suscripción y su administrador, y deja la sesión iniciada. */
  @Post('registro')
  async registro(@Body() dto: CreateEmpresaDto, @Ip() ip: string) {
    this.limitarIntentos(ip);
    return TenantContext.runAsPlatform(async () => {
      await this.subscriptions.crearEmpresa(dto);
      const user = await this.auth.validateUser(
        dto.admin.email,
        dto.admin.password,
        dto.slug.toLowerCase(),
      );
      return this.auth.login(user);
    });
  }

  private limitarIntentos(ip: string) {
    const ahora = Date.now();
    const recientes = (this.intentos.get(ip) ?? []).filter(
      (t) => ahora - t < 3_600_000,
    );
    if (recientes.length >= REGISTROS_POR_HORA) {
      throw new HttpException(
        'Demasiados registros desde esta conexión. Intenta más tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.intentos.set(ip, [...recientes, ahora]);
  }
}
