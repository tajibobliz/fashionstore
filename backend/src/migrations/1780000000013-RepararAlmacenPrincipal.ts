import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Repara el almacén principal de cada sucursal.
 *
 * Reservas, compras online desde el carrito, devoluciones, cambios, el catálogo offline y los
 * traspasos buscan el almacén con código `PRINCIPAL` de la sucursal. La pantalla de almacenes
 * permitía renombrarlo (p. ej. a `A1`), desactivarlo o moverlo, y entonces esas operaciones
 * fallaban en esa sucursal (pasó en la empresa original FashionStore: almacenes `A1`/`A2`).
 *
 * Para cada sucursal sin un `PRINCIPAL` activo:
 *   1. si tiene uno con código `PRINCIPAL` pero inactivo → se reactiva;
 *   2. si no → el almacén activo con más stock (empate: el más antiguo) pasa a llamarse `PRINCIPAL`
 *      (conserva su nombre visible y su inventario);
 *   3. si no tiene ningún almacén activo → se crea "Almacén Principal".
 * Es una reparación de datos: `down` no la deshace.
 */
export class RepararAlmacenPrincipal1780000000013 implements MigrationInterface {
  name = 'RepararAlmacenPrincipal1780000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Reactivar un PRINCIPAL inactivo.
    await queryRunner.query(`
      UPDATE almacen a SET estado = true
       WHERE a.codigo = 'PRINCIPAL' AND a.estado = false
         AND NOT EXISTS (SELECT 1 FROM almacen o WHERE o.id_sucursal = a.id_sucursal AND o.codigo = 'PRINCIPAL' AND o.estado = true AND o.id_almacen <> a.id_almacen)`);
    // 2. Sin PRINCIPAL: el almacén activo con más stock pasa a ser el principal.
    await queryRunner.query(`
      WITH candidatos AS (
        SELECT DISTINCT ON (a.id_sucursal) a.id_almacen
          FROM almacen a
          LEFT JOIN inventario i ON i.id_almacen = a.id_almacen
         WHERE a.estado = true
           AND NOT EXISTS (SELECT 1 FROM almacen p WHERE p.id_sucursal = a.id_sucursal AND p.codigo = 'PRINCIPAL')
         GROUP BY a.id_sucursal, a.id_almacen
         ORDER BY a.id_sucursal, COALESCE(SUM(i.stock_disponible), 0) DESC, a.id_almacen
      )
      UPDATE almacen SET codigo = 'PRINCIPAL' WHERE id_almacen IN (SELECT id_almacen FROM candidatos)`);
    // 3. Sucursales sin ningún almacén activo: se crea uno.
    await queryRunner.query(`
      INSERT INTO almacen (id_sucursal, id_empresa, codigo, nombre, estado)
      SELECT s.id_sucursal, s.id_empresa, 'PRINCIPAL', 'Almacén Principal', true
        FROM sucursal s
       WHERE NOT EXISTS (SELECT 1 FROM almacen a WHERE a.id_sucursal = s.id_sucursal AND a.codigo = 'PRINCIPAL')
      ON CONFLICT (id_sucursal, codigo) DO NOTHING`);
  }

  public async down(): Promise<void> {
    // Reparación de datos: no se revierte (volver a A1/A2 rompería de nuevo la sucursal).
  }
}
