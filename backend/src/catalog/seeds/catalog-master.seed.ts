import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria } from '../entities/categoria.entity';
import { Talla } from '../entities/talla.entity';
import { Color } from '../entities/color.entity';

const CATEGORIAS = [
  'Vestidos',
  'Blusas',
  'Pantalones',
  'Faldas',
  'Poleras y polerones',
  'Zapatos',
  'Accesorios',
];

const TALLAS = ['XS', 'S', 'M', 'L', 'XL', '36', '37', '38', '39', '40', 'UNICA'];

const COLORES: { nombre: string; codigoHex: string }[] = [
  { nombre: 'Negro', codigoHex: '#000000' },
  { nombre: 'Blanco', codigoHex: '#FFFFFF' },
  { nombre: 'Rojo', codigoHex: '#DC2626' },
  { nombre: 'Azul', codigoHex: '#2563EB' },
  { nombre: 'Café', codigoHex: '#8B4513' },
  { nombre: 'Beige', codigoHex: '#D4B896' },
  { nombre: 'Rosado', codigoHex: '#F9A8D4' },
  { nombre: 'Gris', codigoHex: '#6B7280' },
  { nombre: 'Verde', codigoHex: '#059669' },
  { nombre: 'Amarillo', codigoHex: '#F59E0B' },
];

@Injectable()
export class CatalogMasterSeed implements OnModuleInit {
  private readonly logger = new Logger(CatalogMasterSeed.name);

  constructor(
    @InjectRepository(Categoria) private readonly categoriaRepo: Repository<Categoria>,
    @InjectRepository(Talla) private readonly tallaRepo: Repository<Talla>,
    @InjectRepository(Color) private readonly colorRepo: Repository<Color>,
  ) {}

  async onModuleInit() {
    await this.seedCategorias();
    await this.seedTallas();
    await this.seedColores();
  }

  private async seedCategorias() {
    for (const nombre of CATEGORIAS) {
      const existe = await this.categoriaRepo.findOne({ where: { nombre } });
      if (existe) {
        this.logger.log(`Categoría "${nombre}" ya existe, se omite.`);
        continue;
      }
      await this.categoriaRepo.save(this.categoriaRepo.create({ nombre }));
      this.logger.log(`Categoría "${nombre}" creada.`);
    }
  }

  private async seedTallas() {
    for (const nombre of TALLAS) {
      const existe = await this.tallaRepo.findOne({ where: { nombre } });
      if (existe) {
        this.logger.log(`Talla "${nombre}" ya existe, se omite.`);
        continue;
      }
      await this.tallaRepo.save(this.tallaRepo.create({ nombre }));
      this.logger.log(`Talla "${nombre}" creada.`);
    }
  }

  private async seedColores() {
    for (const color of COLORES) {
      const existe = await this.colorRepo.findOne({ where: { nombre: color.nombre } });
      if (existe) {
        this.logger.log(`Color "${color.nombre}" ya existe, se omite.`);
        continue;
      }
      await this.colorRepo.save(this.colorRepo.create(color));
      this.logger.log(`Color "${color.nombre}" creado.`);
    }
  }
}
