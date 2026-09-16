import { Controller, Get, Query, Request, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsService, ReportScope } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { BranchAccessService } from '../users/branch-access.service';
import { ReportFiltersDto, InventoryReportFiltersDto, ReservationReportFiltersDto, TurnReportFiltersDto } from './dto/report-filters.dto';

@ApiTags('Reportes')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL, Role.CAJERO)
export class ReportsController {
  constructor(private readonly service: ReportsService, private readonly access: BranchAccessService) {}

  private async scope(user: any): Promise<ReportScope> {
    return { branchIds: await this.access.accessibleBranchIds(user), cashierId: user.rol === Role.CAJERO ? user.idUsuario : undefined };
  }

  @Get('dashboard') async dashboard(@Query() f: ReportFiltersDto, @Request() req: any) { return this.service.dashboard(f, await this.scope(req.user)); }
  @Get('sales') async sales(@Query() f: ReportFiltersDto, @Request() req: any) { return this.service.sales(f, await this.scope(req.user)); }
  @Get('sales/by-branch') async byBranch(@Query() f: ReportFiltersDto, @Request() req: any) { return this.service.salesByBranch(f, await this.scope(req.user)); }
  @Get('sales/by-warehouse') async byWarehouse(@Query() f: ReportFiltersDto, @Request() req: any) { return this.service.salesByWarehouse(f, await this.scope(req.user)); }
  @Get('products/top') async topProducts(@Query() f: ReportFiltersDto, @Request() req: any) { return this.service.topProducts(f, await this.scope(req.user)); }
  @Get('variants/top') async topVariants(@Query() f: ReportFiltersDto, @Request() req: any) { return this.service.topVariants(f, await this.scope(req.user)); }
  @Get('inventory') async inventory(@Query() f: InventoryReportFiltersDto, @Request() req: any) { return this.service.inventory(f, await this.scope(req.user)); }
  @Get('inventory/critical') async critical(@Query() f: InventoryReportFiltersDto, @Request() req: any) { f.stockCritico = true; return this.service.inventory(f, await this.scope(req.user)); }
  @Get('reservations') async reservations(@Query() f: ReservationReportFiltersDto, @Request() req: any) { return this.service.reservations(f, await this.scope(req.user)); }
  @Get('pos/turns') async turns(@Query() f: TurnReportFiltersDto, @Request() req: any) { return this.service.turns(f, await this.scope(req.user)); }
  @Get('payments/by-method') async payments(@Query() f: ReportFiltersDto, @Request() req: any) { return this.service.paymentsByMethod(f, await this.scope(req.user)); }
  @Get('sales/export') async export(@Query() f: ReportFiltersDto, @Query('format') format: string | undefined, @Request() req: any, @Res() res: Response) {
    if (format && format.toLowerCase() !== 'csv') return res.status(400).json({ message: 'Solo se admite format=csv' });
    const csv = await this.service.salesCsv(f, await this.scope(req.user));
    const name = `ventas-${f.desde?.slice(0,10) ?? 'inicio'}-${f.hasta?.slice(0,10) ?? 'hoy'}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${name}"`); return res.send(`\uFEFF${csv}`);
  }

  // Endpoints anteriores conservados.
  @Get('resumen') async resumen(@Query() f: ReportFiltersDto, @Request() req: any) { return this.service.dashboard(f, await this.scope(req.user)); }
  @Get('ventas-por-dia') async ventasDia(@Query() f: ReportFiltersDto, @Request() req: any) { return this.service.salesByDay(f, await this.scope(req.user)); }
  @Get('top-productos') async topAnterior(@Query() f: ReportFiltersDto, @Request() req: any) { return this.service.topProducts(f, await this.scope(req.user)); }
  @Get('ventas-por-sucursal') async sucursalAnterior(@Query() f: ReportFiltersDto, @Request() req: any) { return this.service.salesByBranch(f, await this.scope(req.user)); }
  @Get('inventario-critico') async criticoAnterior(@Query() f: InventoryReportFiltersDto, @Request() req: any) { f.stockCritico = true; return this.service.inventory(f, await this.scope(req.user)); }
  @Get('reservas-por-estado') async reservasAnterior(@Query() f: ReservationReportFiltersDto, @Request() req: any) { return this.service.reservations(f, await this.scope(req.user)); }
}
