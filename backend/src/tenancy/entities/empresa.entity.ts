import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CODIGOS_MONEDA, MONEDA_POR_DEFECTO } from '../../common/monedas';

export type EstadoEmpresa = 'ACTIVA' | 'SUSPENDIDA';

/**
 * Empresa contratante = TENANT.
 * Todo dato de negocio (sucursales, catálogo, ventas…) pertenece a una empresa
 * mediante la columna `id_empresa`. Una sucursal no es un tenant.
 */
@Entity('empresa')
@Check(
  'CHK_empresa_moneda',
  `moneda IN (${CODIGOS_MONEDA.map((c) => `'${c}'`).join(',')})`,
)
@Check(
  'CHK_empresa_horas_sesion_offline',
  `horas_sesion_offline BETWEEN 1 AND 720`,
)
export class Empresa {
  @PrimaryGeneratedColumn({ name: 'id_empresa' })
  idEmpresa: number;

  @Column({ length: 150 })
  nombre: string;

  /** Identificador corto usado en la URL pública: /t/:slug */
  @Column({ length: 60, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  nit: string | null;

  @Column({ length: 20, default: 'ACTIVA' })
  estado: EstadoEmpresa;

  /** Días que tiene un cliente para cambiar una prenda. */
  @Column({ name: 'plazo_cambio_dias', type: 'integer', default: 7 })
  plazoCambioDias: number;

  /**
   * Moneda en la que vende la tienda (ISO 4217, ver common/monedas.ts).
   * Los planes de la plataforma se cobran siempre en USD; esto es para las ventas de la tienda.
   */
  @Column({ type: 'varchar', length: 3, default: MONEDA_POR_DEFECTO })
  moneda: string;

  /**
   * Plazo máximo (horas) que un usuario puede operar sin conexión con su PIN, contado desde
   * la última vez que estuvo en línea (CU17). Pasado el plazo, sin conexión solo puede consultar.
   */
  @Column({ name: 'horas_sesion_offline', type: 'integer', default: 72 })
  horasSesionOffline: number;

  /** Imagen grande de la portada de la tienda online (enlace https). Sin ella, mosaico de prendas. */
  @Column({ name: 'portada_url', type: 'varchar', length: 500, nullable: true })
  portadaUrl: string | null;

  /** Frase corta bajo el título de la portada de la tienda online. */
  @Column({ type: 'varchar', length: 160, nullable: true })
  eslogan: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
