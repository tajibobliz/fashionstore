import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWarehouseAndPosScope1760000000000 implements MigrationInterface {
  name = 'AddWarehouseAndPosScope1760000000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`INSERT INTO rol(nombre,descripcion) VALUES ('ENCARGADO_SUCURSAL','Encargado limitado a sucursales asignadas') ON CONFLICT (nombre) DO NOTHING`);
    await q.query(`CREATE TABLE IF NOT EXISTS almacen (id_almacen SERIAL PRIMARY KEY,id_sucursal integer NOT NULL,codigo varchar(50) NOT NULL,nombre varchar(120) NOT NULL,estado boolean NOT NULL DEFAULT true,CONSTRAINT fk_almacen_sucursal FOREIGN KEY(id_sucursal) REFERENCES sucursal(id_sucursal),CONSTRAINT uq_almacen_sucursal_codigo UNIQUE(id_sucursal,codigo))`);
    await q.query(`INSERT INTO almacen(id_sucursal,codigo,nombre,estado) SELECT id_sucursal,'PRINCIPAL','Almacén Principal',true FROM sucursal ON CONFLICT(id_sucursal,codigo) DO NOTHING`);
    await q.query(`CREATE TABLE IF NOT EXISTS usuario_sucursal (id_usuario_sucursal SERIAL PRIMARY KEY,id_usuario integer NOT NULL,id_sucursal integer NOT NULL,estado boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),CONSTRAINT fk_us_usuario FOREIGN KEY(id_usuario) REFERENCES usuario(id_usuario),CONSTRAINT fk_us_sucursal FOREIGN KEY(id_sucursal) REFERENCES sucursal(id_sucursal),CONSTRAINT uq_usuario_sucursal UNIQUE(id_usuario,id_sucursal))`);
    await q.query(`ALTER TABLE inventario ADD COLUMN IF NOT EXISTS id_almacen integer`);
    await q.query(`UPDATE inventario i SET id_almacen=a.id_almacen FROM almacen a WHERE a.id_sucursal=i.id_sucursal AND a.codigo='PRINCIPAL' AND i.id_almacen IS NULL`);
    await q.query(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM inventario WHERE id_almacen IS NULL) THEN RAISE EXCEPTION 'Existen inventarios sin almacén'; END IF; END $$`);
    await q.query(`ALTER TABLE inventario ALTER COLUMN id_almacen SET NOT NULL`);
    await q.query(`DO $$ DECLARE c record; BEGIN FOR c IN SELECT pc.conname, array_agg(a.attname::text ORDER BY a.attname) AS column_names FROM pg_constraint pc JOIN pg_class t ON t.oid=pc.conrelid CROSS JOIN LATERAL unnest(pc.conkey) k JOIN pg_attribute a ON a.attrelid=pc.conrelid AND a.attnum=k WHERE t.relname='inventario' AND pc.contype='u' GROUP BY pc.conname LOOP IF c.column_names=ARRAY['id_sucursal','id_variante'] THEN EXECUTE format('ALTER TABLE inventario DROP CONSTRAINT %I',c.conname); END IF; END LOOP; END $$`);
    await q.query(`ALTER TABLE inventario ADD CONSTRAINT fk_inventario_almacen FOREIGN KEY(id_almacen) REFERENCES almacen(id_almacen)`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_inventario_almacen_variante ON inventario(id_almacen,id_variante)`);
    await q.query(`CREATE TABLE IF NOT EXISTS caja (id_caja SERIAL PRIMARY KEY,id_sucursal integer NOT NULL,id_almacen_default integer,codigo varchar(50) NOT NULL,nombre varchar(120) NOT NULL,estado boolean NOT NULL DEFAULT true,CONSTRAINT fk_caja_sucursal FOREIGN KEY(id_sucursal) REFERENCES sucursal(id_sucursal),CONSTRAINT fk_caja_almacen FOREIGN KEY(id_almacen_default) REFERENCES almacen(id_almacen),CONSTRAINT uq_caja_sucursal_codigo UNIQUE(id_sucursal,codigo))`);
    await q.query(`CREATE TABLE IF NOT EXISTS turno_caja (id_turno SERIAL PRIMARY KEY,id_caja integer NOT NULL,id_cajero integer NOT NULL,fecha_apertura timestamptz NOT NULL DEFAULT now(),fecha_cierre timestamptz,monto_apertura numeric(12,2) NOT NULL,monto_cierre_declarado numeric(12,2),monto_cierre_esperado numeric(12,2),diferencia numeric(12,2),estado varchar(20) NOT NULL DEFAULT 'ABIERTO',CONSTRAINT fk_turno_caja FOREIGN KEY(id_caja) REFERENCES caja(id_caja),CONSTRAINT fk_turno_cajero FOREIGN KEY(id_cajero) REFERENCES usuario(id_usuario))`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_turno_abierto_caja ON turno_caja(id_caja) WHERE estado='ABIERTO'`);
    await q.query(`ALTER TABLE venta ADD COLUMN IF NOT EXISTS id_almacen integer, ADD COLUMN IF NOT EXISTS id_turno integer`);
    await q.query(`ALTER TABLE venta ADD CONSTRAINT fk_venta_almacen FOREIGN KEY(id_almacen) REFERENCES almacen(id_almacen), ADD CONSTRAINT fk_venta_turno FOREIGN KEY(id_turno) REFERENCES turno_caja(id_turno)`);
    await q.query(`UPDATE venta v SET id_almacen=a.id_almacen FROM almacen a WHERE a.id_sucursal=v.id_sucursal AND a.codigo='PRINCIPAL' AND v.id_almacen IS NULL`);
    await q.query(`ALTER TABLE reserva ADD COLUMN IF NOT EXISTS id_almacen_origen integer`);
    await q.query(`ALTER TABLE reserva ADD CONSTRAINT fk_reserva_almacen FOREIGN KEY(id_almacen_origen) REFERENCES almacen(id_almacen)`);
    await q.query(`UPDATE reserva r SET id_almacen_origen=a.id_almacen FROM almacen a WHERE a.id_sucursal=r.id_sucursal AND a.codigo='PRINCIPAL' AND r.id_almacen_origen IS NULL`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE reserva DROP CONSTRAINT IF EXISTS fk_reserva_almacen, DROP COLUMN IF EXISTS id_almacen_origen`);
    await q.query(`ALTER TABLE venta DROP CONSTRAINT IF EXISTS fk_venta_turno, DROP CONSTRAINT IF EXISTS fk_venta_almacen, DROP COLUMN IF EXISTS id_turno, DROP COLUMN IF EXISTS id_almacen`);
    await q.query(`DROP TABLE IF EXISTS turno_caja; DROP TABLE IF EXISTS caja`);
    await q.query(`ALTER TABLE inventario DROP CONSTRAINT IF EXISTS fk_inventario_almacen, DROP COLUMN IF EXISTS id_almacen`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_inventario_sucursal_variante ON inventario(id_sucursal,id_variante)`);
    await q.query(`DROP TABLE IF EXISTS usuario_sucursal; DROP TABLE IF EXISTS almacen`);
  }
}
