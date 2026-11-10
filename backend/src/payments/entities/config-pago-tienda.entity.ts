import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantOwned } from '../../tenancy/tenant-owned.entity';

/**
 * Cómo cobra cada tienda a sus clientas en la tienda online (una fila por empresa).
 * Los medios están disponibles en TODOS los planes; el ADMIN activa los que quiere.
 * El QR se guarda en la base (bytea) porque el servidor en la nube no conserva archivos en disco.
 */
@Entity('config_pago_tienda')
@Index('UQ_config_pago_tienda_empresa', ['idEmpresa'], { unique: true })
export class ConfigPagoTienda extends TenantOwned {
  @PrimaryGeneratedColumn({ name: 'id_config_pago' })
  idConfigPago: number;

  /** Tarjeta con Stripe Checkout, en la moneda de la tienda. */
  @Column({ default: true })
  tarjeta: boolean;

  /** QR de la cuenta de la tienda: la clienta paga y sube su comprobante. */
  @Column({ default: false })
  qr: boolean;

  /** Transferencia bancaria a la cuenta de la tienda, con comprobante. */
  @Column({ default: false })
  transferencia: boolean;

  /** Efectivo al retirar el pedido en la sucursal. */
  @Column({ name: 'efectivo_retiro', default: true })
  efectivoRetiro: boolean;

  /** Efectivo al recibir el envío (contra entrega). */
  @Column({ default: false })
  contraentrega: boolean;

  @Column({ name: 'qr_imagen', type: 'bytea', nullable: true, select: false })
  qrImagen: Buffer | null;

  @Column({ name: 'qr_mime', type: 'varchar', length: 40, nullable: true })
  qrMime: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  banco: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  titular: string | null;

  @Column({
    name: 'numero_cuenta',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  numeroCuenta: string | null;

  @Column({ name: 'tipo_cuenta', type: 'varchar', length: 40, nullable: true })
  tipoCuenta: string | null;

  /** CI o NIT del titular (lo piden algunos bancos para transferir). */
  @Column({
    name: 'documento_titular',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  documentoTitular: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  instrucciones: string | null;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
