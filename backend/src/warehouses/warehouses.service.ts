import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Almacen } from './entities/almacen.entity';
import { Sucursal } from '../branches/entities/sucursal.entity';
import { CreateAlmacenDto } from './dto/create-almacen.dto';
import { UpdateAlmacenDto } from './dto/update-almacen.dto';
import { BranchAccessService } from '../users/branch-access.service';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Injectable()
export class WarehousesService {
  constructor(@InjectRepository(Almacen) private readonly repo: Repository<Almacen>, @InjectRepository(Sucursal) private readonly branches: Repository<Sucursal>, private readonly access: BranchAccessService) {}
  async create(dto: CreateAlmacenDto) {
    if (dto.codigo?.trim().toUpperCase() === 'PRINCIPAL') throw new BadRequestException('PRINCIPAL está reservado: cada sucursal ya tiene su almacén principal.');
    const sucursal = await this.branches.findOne({ where: { idSucursal: dto.idSucursal } });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');
    return this.repo.save(this.repo.create({ sucursal, codigo: dto.codigo, nombre: dto.nombre, estado: dto.estado ?? true }));
  }
  findAll() { return this.repo.find(); }
  async findAllAuthorized(actor: AuthenticatedUser) {
    const branchIds = await this.access.accessibleBranchIds(actor);
    return branchIds === null ? this.findAll() : this.repo.find({ where: { sucursal: { idSucursal: In(branchIds) } } });
  }
  findBySucursal(idSucursal: number) { return this.repo.find({ where: { sucursal: { idSucursal } } }); }
  async findOne(id: number) { const item = await this.repo.findOne({ where: { idAlmacen: id } }); if (!item) throw new NotFoundException('Almacén no encontrado'); return item; }
  async findPrincipal(idSucursal: number) { const item = await this.repo.findOne({ where: { sucursal: { idSucursal }, codigo: 'PRINCIPAL', estado: true } }); if (!item) throw new NotFoundException('La sucursal no tiene almacén principal activo'); return item; }
  /**
   * El almacén PRINCIPAL de cada sucursal lo usan reservas, compras online, devoluciones, cambios,
   * el catálogo offline y los traspasos. Por eso no se puede renombrar, desactivar ni mover
   * (antes se podía y la sucursal dejaba de funcionar en esas operaciones). El nombre visible sí.
   */
  private protegerPrincipal(item: Almacen, dto: UpdateAlmacenDto) {
    if (item.codigo === 'PRINCIPAL') {
      if (dto.codigo !== undefined && dto.codigo !== 'PRINCIPAL') throw new BadRequestException('El código del almacén principal no se puede cambiar (lo usan reservas, ventas online y la sincronización). Puedes cambiar su nombre.');
      if (dto.estado === false) throw new BadRequestException('El almacén principal no se puede desactivar: la sucursal lo necesita para reservas y ventas online.');
      if (dto.idSucursal !== undefined && dto.idSucursal !== item.sucursal?.idSucursal) throw new BadRequestException('El almacén principal no se puede mover a otra sucursal.');
    } else if (dto.codigo?.trim().toUpperCase() === 'PRINCIPAL') {
      throw new BadRequestException('PRINCIPAL está reservado para el almacén principal de cada sucursal.');
    }
  }

  async update(id: number, dto: UpdateAlmacenDto) { const item = await this.findOne(id); this.protegerPrincipal(item, dto); if (dto.idSucursal) { const s = await this.branches.findOne({ where: { idSucursal: dto.idSucursal } }); if (!s) throw new NotFoundException('Sucursal no encontrada'); item.sucursal = s; } if (dto.codigo !== undefined) item.codigo=dto.codigo; if(dto.nombre!==undefined)item.nombre=dto.nombre;if(dto.estado!==undefined)item.estado=dto.estado; return this.repo.save(item); }
  async remove(id: number) { const item=await this.findOne(id); this.protegerPrincipal(item, { estado: false }); item.estado=false; return this.repo.save(item); }
}
