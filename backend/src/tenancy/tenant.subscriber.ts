import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntitySubscriberInterface, InsertEvent } from 'typeorm';
import { TenantContext } from './tenant-context';
import { TenantResolverService } from './tenant-resolver.service';

/**
 * Completa `id_empresa` en cada INSERT de una entidad del tenant.
 * Prioridad: valor ya asignado > tenant del request > empresa por defecto.
 * La empresa por defecto mantiene funcionando a producción (sesiones sin `tid`).
 */
@Injectable()
export class TenantSubscriber implements EntitySubscriberInterface {
  constructor(
    @InjectDataSource() dataSource: DataSource,
    private readonly resolver: TenantResolverService,
  ) {
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
    event.entity.idEmpresa = await this.resolver.defaultTenantId();
  }
}
