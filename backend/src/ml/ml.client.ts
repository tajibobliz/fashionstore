import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Cliente HTTP del microservicio de ML (FastAPI, carpeta `ml-service/`).
 * Envía la clave interna `X-ML-Key`; el id de la empresa lo pone siempre el backend.
 */
@Injectable()
export class MlClient {
  private readonly log = new Logger(MlClient.name);
  private readonly base: string;
  private readonly clave: string;

  constructor(config: ConfigService) {
    this.base = (config.get<string>('ML_SERVICE_URL') || 'http://localhost:8001').replace(/\/$/, '');
    this.clave = config.get<string>('ML_API_KEY') || 'dev-ml-key';
  }

  get<T>(ruta: string, timeoutMs = 20_000) {
    return this.pedir<T>('GET', ruta, undefined, timeoutMs);
  }

  post<T>(ruta: string, cuerpo: unknown, timeoutMs = 180_000) {
    return this.pedir<T>('POST', ruta, cuerpo, timeoutMs);
  }

  private async pedir<T>(metodo: string, ruta: string, cuerpo: unknown, timeoutMs: number): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.base + ruta, {
        method: metodo,
        headers: { 'content-type': 'application/json', 'x-ml-key': this.clave },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      this.log.warn(`ml-service no responde en ${this.base}: ${(e as Error).message}`);
      throw new ServiceUnavailableException(
        'El servicio de analítica (ML) no está disponible. Verifica que ml-service esté en ejecución.',
      );
    }
    const texto = await res.text();
    const datos = texto ? safeJson(texto) : null;
    if (res.ok) return datos as T;
    const detalle = typeof datos?.detail === 'string' ? datos.detail : `Error ${res.status} del servicio de ML`;
    if (res.status === 404) throw new NotFoundException('Todavía no hay modelos entrenados para tu empresa. Pulsa "Entrenar modelos".');
    if (res.status === 422) throw new BadRequestException(detalle === `Error 422 del servicio de ML` ? 'Parámetros inválidos para el servicio de ML.' : detalle);
    if (res.status === 401) this.log.error('ML_API_KEY no coincide entre el backend y ml-service.');
    throw new ServiceUnavailableException('El servicio de analítica (ML) respondió con un error.');
  }
}

function safeJson(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
