/**
 * Catálogo de la tienda demo Urban Step: moda urbana para MUJER, con foto en cada prenda.
 *
 * Lo usan el seed de demo (`npm run seed:demo`) y la migración 1780000000015, así la tienda
 * queda igual en local y en producción sin cargar fotos a mano. Solo SQL (sin entidades) para
 * que la migración no dependa de cómo cambien las entidades en el futuro.
 *
 * Es idempotente y respeta lo que la tienda haya cambiado:
 *   - renombra los 6 productos de la primera versión del demo (zapatillas, buzo, mochila…) a
 *     prendas de mujer; no se borran porque tienen ventas de ejemplo;
 *   - crea las prendas que falten (con variantes e inventario en el almacén PRINCIPAL);
 *   - pone la foto solo si la prenda no tiene una (no pisa la que eligió el administrador).
 * Las fotos son enlaces (URL): se guardan en la base y no se pierden al desplegar.
 */
interface Consultable {
  query(sql: string, params?: unknown[]): Promise<any>;
}

const IMG = 'https://cdn.dummyjson.com/product-images';

/** Primera versión del demo (calzado deportivo) → prenda de mujer equivalente. */
const RENOMBRAR: Record<string, string> = {
  'Zapatilla Runner Pro': 'Zapatos dorados de fiesta',
  'Zapatilla Urbana Classic': 'Zapatos rojos de tacón',
  'Bota Trekking': 'Tacón negro clásico',
  'Buzo Deportivo': 'Vestido gris casual',
  'Polera Dry-Fit': 'Vestido azul de verano',
  'Mochila Urbana': 'Mochila de cuero blanca',
};
/** Categorías de la primera versión → categoría de moda mujer. */
const CATEGORIAS: Record<string, string> = {
  Zapatillas: 'Zapatos',
  'Ropa deportiva': 'Vestidos',
  Botas: 'Carteras',
};

export interface PrendaDemo {
  nombre: string;
  categoria: 'Vestidos' | 'Zapatos' | 'Carteras' | 'Accesorios';
  precio: number;
  descripcion: string;
  imagen: string;
  tallas: string[];
  colores: string[];
}

export const CATALOGO_DEMO: PrendaDemo[] = [
  {
    nombre: 'Zapatos dorados de fiesta',
    categoria: 'Zapatos',
    precio: 420,
    descripcion: 'Zapatos dorados de taco medio para fiestas y eventos.',
    imagen: `${IMG}/womens-shoes/golden-shoes-woman/1.webp`,
    tallas: ['36', '37', '38', '39'],
    colores: ['Dorado'],
  },
  {
    nombre: 'Zapatos rojos de tacón',
    categoria: 'Zapatos',
    precio: 390,
    descripcion: 'Tacón rojo de charol, cómodo para todo el día.',
    imagen: `${IMG}/womens-shoes/red-shoes/1.webp`,
    tallas: ['36', '37', '38', '39'],
    colores: ['Rojo'],
  },
  {
    nombre: 'Tacón negro clásico',
    categoria: 'Zapatos',
    precio: 450,
    descripcion: 'Stiletto negro clásico que combina con todo.',
    imagen: `${IMG}/womens-shoes/calvin-klein-heel-shoes/1.webp`,
    tallas: ['36', '37', '38', '39'],
    colores: ['Negro'],
  },
  {
    nombre: 'Sandalias de cuero',
    categoria: 'Zapatos',
    precio: 280,
    descripcion: 'Sandalias de cuero con tira al tobillo.',
    imagen: `${IMG}/womens-shoes/pampi-shoes/1.webp`,
    tallas: ['36', '37', '38', '39'],
    colores: ['Marrón'],
  },
  {
    nombre: 'Vestido gris casual',
    categoria: 'Vestidos',
    precio: 250,
    descripcion: 'Vestido gris de algodón, ideal para el día a día.',
    imagen: `${IMG}/tops/gray-dress/1.webp`,
    tallas: ['S', 'M', 'L'],
    colores: ['Gris'],
  },
  {
    nombre: 'Vestido azul de verano',
    categoria: 'Vestidos',
    precio: 180,
    descripcion: 'Vestido azul ligero y fresco para el verano.',
    imagen: `${IMG}/tops/blue-frock/1.webp`,
    tallas: ['S', 'M', 'L'],
    colores: ['Azul'],
  },
  {
    nombre: 'Vestido de noche negro',
    categoria: 'Vestidos',
    precio: 590,
    descripcion: 'Vestido largo de noche para ocasiones especiales.',
    imagen: `${IMG}/womens-dresses/black-women's-gown/1.webp`,
    tallas: ['S', 'M', 'L'],
    colores: ['Negro'],
  },
  {
    nombre: 'Conjunto corsé con falda',
    categoria: 'Vestidos',
    precio: 420,
    descripcion: 'Corsé de cuero sintético con falda a juego.',
    imagen: `${IMG}/womens-dresses/corset-leather-with-skirt/1.webp`,
    tallas: ['S', 'M', 'L'],
    colores: ['Negro'],
  },
  {
    nombre: 'Vestido escocés',
    categoria: 'Vestidos',
    precio: 260,
    descripcion: 'Vestido de cuadros escoceses, corte recto.',
    imagen: `${IMG}/tops/tartan-dress/1.webp`,
    tallas: ['S', 'M', 'L'],
    colores: ['Rojo'],
  },
  {
    nombre: 'Vestido corto de verano',
    categoria: 'Vestidos',
    precio: 220,
    descripcion: 'Vestido corto con vuelo, fresco y cómodo.',
    imagen: `${IMG}/tops/girl-summer-dress/1.webp`,
    tallas: ['S', 'M', 'L'],
    colores: ['Blanco'],
  },
  {
    nombre: 'Mochila de cuero blanca',
    categoria: 'Carteras',
    precio: 310,
    descripcion: 'Mochila urbana de cuero sintético blanco.',
    imagen: `${IMG}/womens-bags/white-faux-leather-backpack/1.webp`,
    tallas: [],
    colores: ['Blanco'],
  },
  {
    nombre: 'Cartera de cuero marrón',
    categoria: 'Carteras',
    precio: 340,
    descripcion: 'Cartera amplia de cuero para el día a día.',
    imagen: `${IMG}/womens-bags/heshe-women's-leather-bag/1.webp`,
    tallas: [],
    colores: ['Marrón'],
  },
  {
    nombre: 'Bolso de mano negro',
    categoria: 'Carteras',
    precio: 290,
    descripcion: 'Bolso de mano negro con asa corta.',
    imagen: `${IMG}/womens-bags/women-handbag-black/1.webp`,
    tallas: [],
    colores: ['Negro'],
  },
  {
    nombre: 'Lentes de sol clásicos',
    categoria: 'Accesorios',
    precio: 150,
    descripcion: 'Lentes de sol con protección UV.',
    imagen: `${IMG}/sunglasses/classic-sun-glasses/1.webp`,
    tallas: [],
    colores: ['Negro'],
  },
  {
    nombre: 'Aretes de cristal verde',
    categoria: 'Accesorios',
    precio: 95,
    descripcion: 'Aretes colgantes con cristal verde.',
    imagen: `${IMG}/womens-jewellery/green-crystal-earring/1.webp`,
    tallas: [],
    colores: ['Verde'],
  },
  {
    nombre: 'Reloj dorado',
    categoria: 'Accesorios',
    precio: 480,
    descripcion: 'Reloj dorado de pulsera para mujer.',
    imagen: `${IMG}/womens-watches/watch-gold-for-women/1.webp`,
    tallas: [],
    colores: ['Dorado'],
  },
];

const HEX: Record<string, string> = {
  Negro: '#111111',
  Blanco: '#FFFFFF',
  Rojo: '#C0392B',
  Dorado: '#C9A227',
  Marrón: '#7B4B2A',
  Gris: '#8E8E93',
  Azul: '#2F5DA8',
  Verde: '#2E8B57',
};

/** Portada de la tienda demo (opción "imagen de portada" del administrador). */
export const PORTADA_DEMO = {
  portadaUrl: `${IMG}/womens-dresses/corset-with-black-skirt/1.webp`,
  eslogan:
    'Moda urbana para mujer: vestidos, zapatos, carteras y accesorios para cada momento.',
};

export async function actualizarCatalogoDemo(
  q: Consultable,
  idEmpresa: number,
) {
  const uno = async (sql: string, params: unknown[]) =>
    (await q.query(sql, params))[0];

  // 1. Categorías: renombrar las de la primera versión y crear las que falten.
  for (const [viejo, nuevo] of Object.entries(CATEGORIAS))
    await q.query(
      `UPDATE categoria SET nombre = $3, descripcion = $3 || ' de mujer'
        WHERE id_empresa = $1 AND nombre = $2
          AND NOT EXISTS (SELECT 1 FROM categoria WHERE id_empresa = $1 AND nombre = $3)`,
      [idEmpresa, viejo, nuevo],
    );
  const idCategoria: Record<string, number> = {};
  for (const nombre of new Set(CATALOGO_DEMO.map((p) => p.categoria))) {
    const fila =
      (await uno(
        `SELECT id_categoria FROM categoria WHERE id_empresa = $1 AND nombre = $2`,
        [idEmpresa, nombre],
      )) ??
      (await uno(
        `INSERT INTO categoria (nombre, descripcion, id_empresa) VALUES ($2, $2 || ' de mujer', $1) RETURNING id_categoria`,
        [idEmpresa, nombre],
      ));
    idCategoria[nombre] = fila.id_categoria;
  }

  // 2. Tallas y colores que falten.
  const idTalla: Record<string, number> = {};
  for (const nombre of new Set(CATALOGO_DEMO.flatMap((p) => p.tallas))) {
    const fila =
      (await uno(
        `SELECT id_talla FROM talla WHERE id_empresa = $1 AND nombre = $2`,
        [idEmpresa, nombre],
      )) ??
      (await uno(
        `INSERT INTO talla (nombre, id_empresa) VALUES ($2, $1) RETURNING id_talla`,
        [idEmpresa, nombre],
      ));
    idTalla[nombre] = fila.id_talla;
  }
  const idColor: Record<string, number> = {};
  for (const nombre of new Set(CATALOGO_DEMO.flatMap((p) => p.colores))) {
    const fila =
      (await uno(
        `SELECT id_color FROM color WHERE id_empresa = $1 AND nombre = $2`,
        [idEmpresa, nombre],
      )) ??
      (await uno(
        `INSERT INTO color (nombre, codigo_hex, id_empresa) VALUES ($2, $3, $1) RETURNING id_color`,
        [idEmpresa, nombre, HEX[nombre] ?? null],
      ));
    idColor[nombre] = fila.id_color;
  }

  // 3. Productos de la primera versión → prendas de mujer (conservan variantes, stock y ventas).
  for (const [viejo, nuevo] of Object.entries(RENOMBRAR)) {
    const p = CATALOGO_DEMO.find((x) => x.nombre === nuevo)!;
    await q.query(
      `UPDATE producto SET nombre = $3, descripcion = $4, precio = $5, id_categoria = $6
        WHERE id_empresa = $1 AND nombre = $2
          AND NOT EXISTS (SELECT 1 FROM producto WHERE id_empresa = $1 AND nombre = $3)`,
      [
        idEmpresa,
        viejo,
        nuevo,
        p.descripcion,
        p.precio,
        idCategoria[p.categoria],
      ],
    );
  }

  // 4. Crear las prendas que falten, con variantes e inventario en cada almacén PRINCIPAL.
  const almacenes: { id_almacen: number; id_sucursal: number }[] =
    await q.query(
      `SELECT a.id_almacen, a.id_sucursal FROM almacen a JOIN sucursal s ON s.id_sucursal = a.id_sucursal
      WHERE a.id_empresa = $1 AND a.codigo = 'PRINCIPAL' AND a.estado = true AND s.estado = true
      ORDER BY a.id_sucursal`,
      [idEmpresa],
    );
  for (const [i, p] of CATALOGO_DEMO.entries()) {
    const existe = await uno(
      `SELECT id_producto FROM producto WHERE id_empresa = $1 AND nombre = $2`,
      [idEmpresa, p.nombre],
    );
    if (existe) {
      // 5. Foto solo si no tiene (no se pisa la que haya puesto el administrador).
      await q.query(
        `UPDATE producto SET imagen_url = $2 WHERE id_producto = $1 AND (imagen_url IS NULL OR imagen_url = '')`,
        [existe.id_producto, p.imagen],
      );
      continue;
    }
    const { id_producto } = await uno(
      `INSERT INTO producto (nombre, descripcion, precio, imagen_url, estado, id_categoria, id_empresa)
       VALUES ($2, $3, $4, $5, true, $6, $1) RETURNING id_producto`,
      [
        idEmpresa,
        p.nombre,
        p.descripcion,
        p.precio,
        p.imagen,
        idCategoria[p.categoria],
      ],
    );
    const combinaciones = (p.tallas.length ? p.tallas : [null]).flatMap((t) =>
      p.colores.map((c) => ({ t, c })),
    );
    for (const [j, { t, c }] of combinaciones.entries()) {
      const sku = `US-M${String(i + 1).padStart(2, '0')}-${j + 1}`;
      const { id_variante } = await uno(
        `INSERT INTO variante_producto (sku, id_producto, id_talla, id_color, id_empresa)
         VALUES ($2, $3, $4, $5, $1) RETURNING id_variante`,
        [idEmpresa, sku, id_producto, t ? idTalla[t] : null, idColor[c]],
      );
      for (const [k, a] of almacenes.entries())
        await q.query(
          `INSERT INTO inventario (stock_disponible, stock_reservado, id_sucursal, id_variante, id_almacen, id_empresa)
           VALUES ($2, 0, $3, $4, $5, $1)`,
          [
            idEmpresa,
            k === 0 ? 6 + j : 3,
            a.id_sucursal,
            id_variante,
            a.id_almacen,
          ],
        );
    }
  }
}
