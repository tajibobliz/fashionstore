import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntitySubscriberInterface, InsertEvent } from 'typeorm';
import { DEFAULT_TENANT_SLUG, TenantContext } from './tenant-context';

/**
 * Completa `id_empresa` en cada INSERT de una entidad del tenant.
 * Prioridad: valor ya asignado > tenant del request > empresa por defecto.
 * La empresa por defecto mantiene funcionando a producción (sesiones sin `tid`).
 */
@Injectable()
export class TenantSubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger(TenantSubscriber.name);
  private defaultTenantId: number | null = null;

  constructor(@InjectDataSource() dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  async beforeInsert(event: InsertEvent<any>) {
    const hasTenantColumn = event.metadata.columns.some(
      (c) => c.propertyName === 'idEmpresa',
    );
    if (!hasTenantColumn || !event.entity || event.entity.idEmpresa != null)
      return;

    const fromRequest = TenantContext.currentTenantId();
    if (fromRequest != null) {
      event.entity.idEmpresa = fromRequest;
      return;
    }
    // El usuario SUPER_ADMIN no pertenece a ninguna empresa.
    if (
      event.metadata.tableName === 'usuario' &&
      event.entity.rol?.nombre === 'SUPER_ADMIN'
    )
      return;
    event.entity.idEmpresa = await this.resolveDefaultTenant(event);
  }

  private async resolveDefaultTenant(event: InsertEvent<any>): Promise<number> {
    if (this.defaultTenantId != null) return this.defaultTenantId;
    const rows = await event.manager.query(
      'SELECT id_empresa FROM empresa WHERE slug = $1',
      [DEFAULT_TENANT_SLUG],
    );
    if (!rows.length)
      throw new Error(
        `No existe la empresa por defecto "${DEFAULT_TENANT_SLUG}". Ejecuta las migraciones.`,
      );
    this.defaultTenantId = Number(rows[0].id_empresa);
    this.logger.log(`Empresa por defecto: ${this.defaultTenantId}`);
    return this.defaultTenantId;
  }
}
