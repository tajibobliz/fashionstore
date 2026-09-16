import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Completa instalaciones antiguas que fueron creadas parcialmente mediante
 * synchronize. Todas las sentencias conservan las tablas y los datos que ya
 * existan. La ampliación de almacenes y POS se ejecuta en la migración siguiente.
 */
export class CompleteLegacySchema1759000000000 implements MigrationInterface {
  name = 'CompleteLegacySchema1759000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS carrito (
      id_carrito SERIAL PRIMARY KEY,
      fecha timestamp NOT NULL DEFAULT now(),
      estado varchar(30) NOT NULL DEFAULT 'ACTIVO',
      id_usuario integer,
      CONSTRAINT fk_carrito_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
    )`);
    await q.query(`CREATE TABLE IF NOT EXISTS detalle_carrito (
      id_detalle_carrito SERIAL PRIMARY KEY,
      cantidad integer NOT NULL,
      precio numeric(12,2) NOT NULL,
      id_carrito integer,
      id_variante integer,
      CONSTRAINT uq_detalle_carrito UNIQUE (id_carrito,id_variante),
      CONSTRAINT fk_detalle_carrito FOREIGN KEY (id_carrito) REFERENCES carrito(id_carrito) ON DELETE CASCADE,
      CONSTRAINT fk_detalle_carrito_variante FOREIGN KEY (id_variante) REFERENCES variante_producto(id_variante)
    )`);
    await q.query(`CREATE TABLE IF NOT EXISTS reserva (
      id_reserva SERIAL PRIMARY KEY,
      codigo varchar(50) NOT NULL UNIQUE,
      fecha_reserva timestamp NOT NULL DEFAULT now(),
      fecha_atencion timestamp,
      estado varchar(30) NOT NULL DEFAULT 'PENDIENTE',
      id_usuario integer,
      id_sucursal integer,
      CONSTRAINT fk_reserva_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
      CONSTRAINT fk_reserva_sucursal FOREIGN KEY (id_sucursal) REFERENCES sucursal(id_sucursal)
    )`);
    await q.query(`CREATE TABLE IF NOT EXISTS detalle_reserva (
      id_detalle_reserva SERIAL PRIMARY KEY,
      cantidad integer NOT NULL,
      id_reserva integer,
      id_variante integer,
      CONSTRAINT fk_detalle_reserva FOREIGN KEY (id_reserva) REFERENCES reserva(id_reserva) ON DELETE CASCADE,
      CONSTRAINT fk_detalle_reserva_variante FOREIGN KEY (id_variante) REFERENCES variante_producto(id_variante)
    )`);
    await q.query(`CREATE TABLE IF NOT EXISTS venta (
      id_venta SERIAL PRIMARY KEY,
      tipo_venta varchar(20) NOT NULL,
      fecha timestamp NOT NULL DEFAULT now(),
      total numeric(12,2) NOT NULL,
      numero_comprobante varchar(50) UNIQUE,
      estado varchar(30) NOT NULL DEFAULT 'PENDIENTE',
      id_usuario integer,
      id_sucursal integer,
      id_cajero integer,
      id_reserva integer,
      CONSTRAINT fk_venta_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
      CONSTRAINT fk_venta_sucursal FOREIGN KEY (id_sucursal) REFERENCES sucursal(id_sucursal),
      CONSTRAINT fk_venta_cajero FOREIGN KEY (id_cajero) REFERENCES usuario(id_usuario),
      CONSTRAINT fk_venta_reserva FOREIGN KEY (id_reserva) REFERENCES reserva(id_reserva)
    )`);
    await q.query(`CREATE TABLE IF NOT EXISTS detalle_venta (
      id_detalle_venta SERIAL PRIMARY KEY,
      cantidad integer NOT NULL,
      precio_unitario numeric(12,2) NOT NULL,
      subtotal numeric(12,2) NOT NULL,
      id_venta integer,
      id_variante integer,
      CONSTRAINT fk_detalle_venta FOREIGN KEY (id_venta) REFERENCES venta(id_venta) ON DELETE CASCADE,
      CONSTRAINT fk_detalle_venta_variante FOREIGN KEY (id_variante) REFERENCES variante_producto(id_variante)
    )`);
    await q.query(`CREATE TABLE IF NOT EXISTS pago (
      id_pago SERIAL PRIMARY KEY,
      metodo varchar(30) NOT NULL,
      monto numeric(12,2) NOT NULL,
      estado varchar(30) NOT NULL DEFAULT 'PENDIENTE',
      referencia_pasarela varchar(150),
      fecha timestamp NOT NULL DEFAULT now(),
      id_venta integer,
      CONSTRAINT fk_pago_venta FOREIGN KEY (id_venta) REFERENCES venta(id_venta)
    )`);
    await q.query(`CREATE TABLE IF NOT EXISTS devolucion (
      id_devolucion SERIAL PRIMARY KEY,
      fecha timestamp NOT NULL DEFAULT now(),
      motivo varchar(300),
      id_venta integer,
      id_usuario_registra integer,
      CONSTRAINT fk_devolucion_venta FOREIGN KEY (id_venta) REFERENCES venta(id_venta),
      CONSTRAINT fk_devolucion_usuario FOREIGN KEY (id_usuario_registra) REFERENCES usuario(id_usuario)
    )`);
    await q.query(`CREATE TABLE IF NOT EXISTS detalle_devolucion (
      id_detalle_devolucion SERIAL PRIMARY KEY,
      cantidad integer NOT NULL,
      id_devolucion integer,
      id_detalle_venta integer,
      CONSTRAINT fk_detalle_devolucion FOREIGN KEY (id_devolucion) REFERENCES devolucion(id_devolucion) ON DELETE CASCADE,
      CONSTRAINT fk_detalle_devolucion_venta FOREIGN KEY (id_detalle_venta) REFERENCES detalle_venta(id_detalle_venta)
    )`);
    await q.query(`CREATE TABLE IF NOT EXISTS promocion (
      id_promocion SERIAL PRIMARY KEY,
      nombre varchar(120) NOT NULL,
      porcentaje numeric(5,2) NOT NULL,
      fecha_inicio date,
      fecha_fin date,
      estado boolean NOT NULL DEFAULT true
    )`);
    await q.query(`CREATE TABLE IF NOT EXISTS promocion_producto (
      id_promocion integer NOT NULL,
      id_producto integer NOT NULL,
      PRIMARY KEY (id_promocion,id_producto),
      CONSTRAINT fk_promocion_producto_promocion FOREIGN KEY (id_promocion) REFERENCES promocion(id_promocion) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_promocion_producto_producto FOREIGN KEY (id_producto) REFERENCES producto(id_producto) ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_promocion_producto_promocion ON promocion_producto(id_promocion)`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_promocion_producto_producto ON promocion_producto(id_producto)`);
    await q.query(`CREATE TABLE IF NOT EXISTS interaccion_cliente (
      id_interaccion SERIAL PRIMARY KEY,
      tipo varchar(30) NOT NULL,
      fecha timestamp NOT NULL DEFAULT now(),
      id_usuario integer,
      id_producto integer,
      CONSTRAINT fk_interaccion_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
      CONSTRAINT fk_interaccion_producto FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
    )`);
  }

  async down(): Promise<void> {
    // No se eliminan tablas históricas: pudieron existir antes de esta migración.
  }
}
