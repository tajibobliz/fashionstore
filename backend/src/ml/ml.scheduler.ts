import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { DataSource } from 'typeorm';
import { TenantContext } from '../tenancy/tenant-context';
import { MlService } from './ml.service';

/**
 * Reentrenamiento automático (como un SaaS real: nadie tiene que pulsar "Entrenar").
 *
 * Una tarea programada (cron) recorre cada noche las empresas ACTIVAS con suscripción vigente
 * y un plan que incluye ML, y entrena sus modelos con los datos del día. Cada empresa se
 * entrena dentro de `TenantContext.run({ idEmpresa })`, así las consultas pasan por RLS igual
 * que en una petición de esa empresa. Si una falla, se registra y se sigue con la siguiente.
 *
 * Configuración: `ML_CRON` (por defecto "0 3 * * *" = 03:00 hora de la empresa);
 * `ML_CRON=off` lo desactiva (por ejemplo en las pruebas).
 */
@Injectable()
export class MlScheduler implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger(MlScheduler.name);
  private corriendo = false;

  constructor(
    private readonly ml: MlService,
    private readonly db: DataSource,
    private readonly registry: SchedulerRegistry,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const expr = this.config.get<string>('ML_CRON') ?? '0 3 * * *';
    if (!expr || expr === 'off') return;
    const zona = this.config.get<string>('APP_TIMEZONE') || 'America/La_Paz';
    const job = CronJob.from({ cronTime: expr, onTick: () => void this.entrenarTodas(), timeZone: zona });
    this.registry.addCronJob('ml-reentrenamiento', job);
    job.start();
    this.log.log(`Reentrenamiento de ML programado: "${expr}" (${zona})`);
  }

  onApplicationShutdown() {
    if (this.registry.doesExist('cron', 'ml-reentrenamiento')) this.registry.deleteCronJob('ml-reentrenamiento');
  }

  /** Empresas que deben tener modelos: activas, con suscripción vigente y plan con ML. */
  empresasConMl(): Promise<number[]> {
    return TenantContext.runAsPlatform(async () => {
      const filas: { id: number }[] = await this.db.query(
        `SELECT DISTINCT e.id_empresa AS id
           FROM empresa e
           JOIN suscripcion s ON s.id_empresa = e.id_empresa AND s.estado = 'ACTIVA' AND s.fecha_vencimiento >= CURRENT_DATE
           JOIN plan p ON p.id_plan = s.id_plan
          WHERE e.estado = 'ACTIVA' AND COALESCE((p.features ->> 'ml')::boolean, false)
          ORDER BY 1`,
      );
      return filas.map((f) => Number(f.id));
    });
  }

  /** Entrena todas las empresas una tras otra. Devuelve el resumen (también para pruebas). */
  async entrenarTodas() {
    if (this.corriendo) return { omitido: true, ok: [] as number[], fallidas: [] as number[] };
    this.corriendo = true;
    const ok: number[] = [];
    const fallidas: number[] = [];
    try {
      for (const idEmpresa of await this.empresasConMl()) {
        try {
          await TenantContext.run({ idEmpresa }, () => this.ml.entrenar(idEmpresa));
          ok.push(idEmpresa);
        } catch (e) {
          fallidas.push(idEmpresa);
          this.log.warn(`No se pudo reentrenar la empresa ${idEmpresa}: ${(e as Error).message}`);
        }
      }
      this.log.log(`Reentrenamiento nocturno: ${ok.length} empresas listas, ${fallidas.length} con error.`);
      return { omitido: false, ok, fallidas };
    } finally {
      this.corriendo = false;
    }
  }
}
