import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { TenantContext } from '../tenancy/tenant-context';
import { SalesService } from './sales.service';

const NOMBRE = 'pago-diferido-vencimiento';

/**
 * Tarea programada del CU16: cada 15 minutos cancela los pedidos hechos sin conexión que no
 * se pagaron a tiempo (todas las empresas). También se revisa al intentar pagar uno, así que
 * aunque la tarea esté apagada (`PAGO_DIFERIDO_CRON=off`) nadie paga un pedido vencido.
 */
@Injectable()
export class PagoDiferidoScheduler
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly log = new Logger(PagoDiferidoScheduler.name);

  constructor(
    private readonly sales: SalesService,
    private readonly registry: SchedulerRegistry,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const expr =
      this.config.get<string>('PAGO_DIFERIDO_CRON') ?? '*/15 * * * *';
    if (!expr || expr === 'off') return;
    const job = CronJob.from({
      cronTime: expr,
      onTick: () => void this.vencer(),
    });
    this.registry.addCronJob(NOMBRE, job);
    job.start();
  }

  onApplicationShutdown() {
    if (this.registry.doesExist('cron', NOMBRE))
      this.registry.deleteCronJob(NOMBRE);
  }

  async vencer() {
    try {
      const ids = await TenantContext.runAsPlatform(() =>
        this.sales.vencerPedidosDiferidos(),
      );
      if (ids.length)
        this.log.log(
          `Pedidos sin conexión vencidos sin pago: ${ids.join(', ')}`,
        );
      return ids;
    } catch (e) {
      this.log.warn(
        `No se pudieron vencer los pedidos diferidos: ${(e as Error).message}`,
      );
      return [];
    }
  }
}
