import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { InteraccionCliente } from '../ar/entities/interaccion-cliente.entity';
import { Producto } from '../catalog/entities/producto.entity';
import { DetalleVenta } from '../sales/entities/detalle-venta.entity';
import { Categoria } from '../catalog/entities/categoria.entity';
import { ReportsModule } from '../reports/reports.module';
import { ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { Sucursal } from '../branches/entities/sucursal.entity';
import { Empresa } from '../tenancy/entities/empresa.entity';
import { ConsultaIa } from './reports/entities/consulta-ia.entity';
import { AiReportsController } from './reports/ai-reports.controller';
import { AiReportsService } from './reports/ai-reports.service';
import { ReportToolsService } from './reports/report-tools';
import { PROVEEDOR_LLM } from './reports/llm/llm.types';
import { crearProveedorLlm } from './reports/llm/proveedor.factory';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InteraccionCliente,
      Producto,
      DetalleVenta,
      Categoria,
      ConsultaIa,
      Sucursal,
      Empresa,
    ]),
    ReportsModule,
    UsersModule,
  ],
  controllers: [AiController, AiReportsController],
  providers: [
    AiService,
    AiReportsService,
    ReportToolsService,
    {
      provide: PROVEEDOR_LLM,
      inject: [ConfigService],
      useFactory: crearProveedorLlm,
    },
  ],
})
export class AiModule {}