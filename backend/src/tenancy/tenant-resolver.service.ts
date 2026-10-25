import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Empresa } from './entities/empresa.entity';
import { DEFAULT_TENANT_SLUG, TenantContext } from './tenant-context';

/**
 * Resuelve qué empresa (tenant) corresponde a una petición.
 * - Por slug: lo que viene en la URL pública `/t/:slug` (el frontend lo envía en `X-Tenant`).
 * - Por defecto: la Empresa A (`fashionstore`), para que las rutas y apps actuales sigan funcionando.
 */
@Injectable()
export class TenantResolverService {
  private readonly logger = new Logger(TenantResolverService.name);
  private defaultId: number | null = null;

  constructor(
    @InjectRepository(Empresa) private readonly empresas: Repository<Empresa>,
  ) {}

  async defaultTenantId(): Promise<number> {
    if (this.defaultId != null) return this.defaultId;
    const empresa = await this.empresas.findOne({
      where: { slug: DEFAULT_TENANT_SLUG },
    });
    if (!empresa) {
      throw new Error(
        `No existe la empresa por defecto "${DEFAULT_TENANT_SLUG}". Ejecuta las migraciones.`,
      );
    }
    this.defaultId = empresa.idEmpresa;
    return this.defaultId;
  }

  /** Empresa por slug (sin importar estado). `null` si no existe. */
  findBySlug(slug: string): Promise<Empresa | null> {
    return this.empresas.findOne({
      where: { slug: slug.trim().toLowerCase() },
    });
  }

  findById(idEmpresa: number): Promise<Empresa | null> {
    return this.empresas.findOne({ where: { idEmpresa } });
  }

  /**
   * Ejecuta `fn` como si fuera una petición de la empresa por defecto (seeds de arranque).
   * Si la empresa por defecto aún no existe (migraciones sin correr), avisa y no ejecuta.
   */
  async runInDefault<T>(fn: () => Promise<T>): Promise<T | undefined> {
    let idEmpresa: number;
    try {
      idEmpresa = await this.defaultTenantId();
    } catch (error) {
      this.logger.warn(`Datos iniciales omitidos: ${(error as Error).message}`);
      return undefined;
    }
    return TenantContext.run({ idEmpresa }, fn);
  }

  /** Tenant de la petición actual o, si no hay, la empresa por defecto. */
  async currentOrDefault(): Promise<number> {
    return TenantContext.currentTenantId() ?? this.defaultTenantId();
  }
}
