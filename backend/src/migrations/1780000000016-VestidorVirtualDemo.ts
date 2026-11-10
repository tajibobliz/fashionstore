import { MigrationInterface, QueryRunner } from 'typeorm';
import { actualizarCatalogoDemo } from '../tenancy/seeds/catalogo-demo';

/**
 * Vestidor virtual (probador con cámara) en las tiendas de prueba.
 *
 * El probador necesita en el producto el tipo de prenda (lentes, gorra o polera) y un PNG sin
 * fondo que se dibuja sobre la cámara. Ningún seed lo traía: se configuraba a mano en el panel,
 * y en una base nueva (o en producción) ninguna prenda tenía el botón "Probar con vestidor".
 * Los PNG van dentro del frontend (frontend/public/tryon), así viajan con el código y no se
 * pierden al desplegar.
 *
 *   - FashionStore: "Polera básica blanca" (polera) y "Sombrero fedora" (gorra).
 *   - Urban Step: "Lentes de sol clásicos" (lentes) y dos prendas nuevas, "Polera básica blanca"
 *     y "Gorra urbana negra" (ver tenancy/seeds/catalogo-demo.ts).
 * Solo se activa en prendas que todavía no tienen vestidor (no pisa lo que haya puesto el
 * administrador). Es una carga de datos de ejemplo: `down` no la deshace.
 */
export class VestidorVirtualDemo1780000000016 implements MigrationInterface {
  name = 'VestidorVirtualDemo1780000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [nombre, tipo, imagen] of [
      ['Polera básica blanca', 'polera', '/tryon/polera-blanca.png'],
      ['Sombrero fedora', 'gorra', '/tryon/sombrero.png'],
    ])
      await queryRunner.query(
        `UPDATE producto p SET tipo_try_on = $2, imagen_try_on = $3
           FROM empresa e
          WHERE e.slug = 'fashionstore' AND p.id_empresa = e.id_empresa AND p.nombre = $1
            AND p.tipo_try_on IS NULL AND (p.imagen_try_on IS NULL OR p.imagen_try_on = '')`,
        [nombre, tipo, imagen],
      );

    const [demo] = await queryRunner.query(
      `SELECT id_empresa FROM empresa WHERE slug = 'urban-step'`,
    );
    if (demo) await actualizarCatalogoDemo(queryRunner, demo.id_empresa);
  }

  public async down(): Promise<void> {
    // Datos de ejemplo: no se deshacen.
  }
}
