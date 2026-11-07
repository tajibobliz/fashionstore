import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TenantOwned } from '../../tenancy/tenant-owned.entity';

export const ESTADOS_PAGO_SUSCRIPCION = [
  'PENDIENTE',
  'PAGADO',
  'CANCELADO',
  'EXPIRADO',
] as const;
export type EstadoPagoSuscripcion = (typeof ESTADOS_PAGO_SUSCRIPCION)[number];
export type ProveedorPago = 'STRIPE' | 'SIMULADO';

/**
 * Pago de la suscripción de una tienda a la plataforma (en USD).
 *
 * Se crea PENDIENTE al iniciar el checkout y pasa a PAGADO cuando la pasarela confirma
 * (webhook de Stripe o pago simulado). Recién entonces se activa el plan: la vuelta del
 * navegador a la página de éxito NO activa nada, porque cualquiera podría abrir esa URL.
 * `referencia` es el id de la sesión de checkout (único: evita activar dos veces).
 */
@Entity('pago_suscripcion')
@Check(
  'CHK_pago_suscripcion_estado',
  `estado IN ('PENDIENTE','PAGADO','CANCELADO','EXPIRADO')`,
)
@Check('CHK_pago_suscripcion_meses', 'meses BETWEEN 1 AND 12')
export class PagoSuscripcion extends TenantOwned {
  @PrimaryGeneratedColumn({ name: 'id_pago_suscripcion' })
  idPagoSuscripcion: number;

  @Index('UQ_pago_suscripcion_referencia', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  referencia: string;

  @Column({ type: 'varchar', length: 20 })
  proveedor: ProveedorPago;

  @Column({ name: 'codigo_plan', type: 'varchar', length: 20 })
  codigoPlan: string;

  @Column({ type: 'integer' })
  meses: number;

  /** Monto total en USD (precio del plan × meses). */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  monto: string;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  moneda: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDIENTE' })
  estado: EstadoPagoSuscripcion;

  /** Quién inició el pago (el administrador de la tienda). */
  @Column({ name: 'id_usuario', type: 'integer', nullable: true })
  idUsuario: number | null;

  /** Suscripción creada al confirmarse el pago. */
  @Column({ name: 'id_suscripcion', type: 'integer', nullable: true })
  idSuscripcion: number | null;

  /** Id del cobro en la pasarela (payment_intent de Stripe), para conciliar. */
  @Column({
    name: 'id_cobro_pasarela',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  idCobroPasarela: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @Column({ name: 'pagado_en', type: 'timestamptz', nullable: true })
  pagadoEn: Date | null;
}
