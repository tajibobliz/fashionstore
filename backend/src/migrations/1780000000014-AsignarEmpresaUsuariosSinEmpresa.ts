import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Asigna la empresa por defecto (FashionStore) a los usuarios que quedaron sin empresa.
 *
 * La migración multitenant (1780000000000) asignó empresa a todos los usuarios que existían.
 * Las cuentas creadas DESPUÉS con la versión de una sola tienda (rama main, misma base local)
 * se guardaron con `id_empresa` NULL. Esa cuenta entraba con un token sin empresa y el RLS se la
 * trataba como plataforma: veía sucursales y prendas de TODAS las tiendas, y su carrito quedaba
 * con datos de empresas cruzadas (agregar respondía 201 pero el contador seguía en 0).
 *
 *   1. Usuarios sin empresa que no son SUPER_ADMIN → empresa por defecto, salvo que su correo ya
 *      exista en ella (no se pueden unir dos cuentas; esas quedan bloqueadas por el login).
 *   2. Se borran los carritos inconsistentes: los de una empresa distinta a la de su sucursal o
 *      a la de su dueño (eran ilegibles; sus detalles se borran en cascada).
 * Es una reparación de datos: `down` no la deshace.
 */
export class AsignarEmpresaUsuariosSinEmpresa1780000000014 implements MigrationInterface {
  name = 'AsignarEmpresaUsuariosSinEmpresa1780000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // UPDATE … RETURNING devuelve [filas, cantidad] en Postgres.
    const [asignados] = await queryRunner.query(`
      UPDATE usuario u SET id_empresa = e.id_empresa
        FROM empresa e
       WHERE e.slug = 'fashionstore'
         AND u.id_empresa IS NULL
         AND NOT EXISTS (SELECT 1 FROM rol r WHERE r.id_rol = u.id_rol AND r.nombre = 'SUPER_ADMIN')
         AND NOT EXISTS (SELECT 1 FROM usuario o WHERE o.id_empresa = e.id_empresa AND lower(o.email) = lower(u.email))
      RETURNING u.id_usuario, u.email`);
    if (asignados?.length)
      console.log(
        `Usuarios sin empresa asignados a FashionStore: ${asignados.map((u: { email: string }) => u.email).join(', ')}`,
      );

    await queryRunner.query(`
      DELETE FROM carrito c
       USING sucursal s, usuario u
       WHERE s.id_sucursal = c.id_sucursal
         AND u.id_usuario = c.id_usuario
         AND (c.id_empresa <> s.id_empresa OR c.id_empresa <> u.id_empresa)`);
  }

  public async down(): Promise<void> {
    // Reparación de datos: no se deshace.
  }
}
