import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ciudad } from './entities/ciudad.entity';
import { Sucursal } from './entities/sucursal.entity';
import { CreateCiudadDto } from './dto/create-ciudad.dto';
import { UpdateCiudadDto } from './dto/update-ciudad.dto';
import { CreateSucursalDto } from './dto/create-sucursal.dto';
import { UpdateSucursalDto } from './dto/update-sucursal.dto';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Ciudad)
    private readonly ciudadRepo: Repository<Ciudad>,
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
  ) {}

  // ===== CIUDADES =====

  createCiudad(dto: CreateCiudadDto) {
    const ciudad = this.ciudadRepo.create(dto);
    return this.ciudadRepo.save(ciudad);
  }

  findAllCiudades() {
    return this.ciudadRepo.find();
  }

  async findOneCiudad(id: number) {
    const ciudad = await this.ciudadRepo.findOne({ where: { idCiudad: id } });
    if (!ciudad) throw new NotFoundException(`Ciudad ${id} no encontrada`);
    return ciudad;
  }

  async updateCiudad(id: number, dto: UpdateCiudadDto) {
    const ciudad = await this.findOneCiudad(id);
    Object.assign(ciudad, dto);
    return this.ciudadRepo.save(ciudad);
  }

  async removeCiudad(id: number) {
    const ciudad = await this.findOneCiudad(id);
    await this.ciudadRepo.remove(ciudad);
    return { message: `Ciudad ${id} eliminada` };
  }

  // ===== SUCURSALES =====

  async createSucursal(dto: CreateSucursalDto) {
    const ciudad = await this.findOneCiudad(dto.idCiudad);
    const sucursal = this.sucursalRepo.create({
      nombre: dto.nombre,
      direccion: dto.direccion,
      telefono: dto.telefono,
      estado: dto.estado ?? true,
      ciudad,
    });
    return this.sucursalRepo.save(sucursal);
  }

  findAllSucursales() {
    return this.sucursalRepo.find();
  }

  async findOneSucursal(id: number) {
    const sucursal = await this.sucursalRepo.findOne({
      where: { idSucursal: id },
    });
    if (!sucursal) throw new NotFoundException(`Sucursal ${id} no encontrada`);
    return sucursal;
  }

  async updateSucursal(id: number, dto: UpdateSucursalDto) {
    const sucursal = await this.findOneSucursal(id);
    if (dto.idCiudad) {
      sucursal.ciudad = await this.findOneCiudad(dto.idCiudad);
    }
    Object.assign(sucursal, {
      nombre: dto.nombre ?? sucursal.nombre,
      direccion: dto.direccion ?? sucursal.direccion,
      telefono: dto.telefono ?? sucursal.telefono,
      estado: dto.estado ?? sucursal.estado,
    });
    return this.sucursalRepo.save(sucursal);
  }

  async removeSucursal(id: number) {
    const sucursal = await this.findOneSucursal(id);
    await this.sucursalRepo.remove(sucursal);
    return { message: `Sucursal ${id} eliminada` };
  }
}