import { porcentajesPorPrenda } from './descuento-vigente';

/** Descuento vigente por lotes (catálogo offline): gana el mayor porcentaje que aplique. */
describe('porcentajesPorPrenda', () => {
  const promociones = [
    {
      porcentaje: '15.00',
      productos: [{ idProducto: 1 }],
      categorias: [],
      temporadas: [],
    },
    {
      porcentaje: '20.00',
      productos: [],
      categorias: [{ idCategoria: 10 }],
      temporadas: [],
    },
    {
      porcentaje: '12.00',
      productos: [],
      categorias: [],
      temporadas: [{ idTemporada: 7 }],
    },
  ];

  it('aplica por producto, categoría o temporada, y elige el mayor', () => {
    const r = porcentajesPorPrenda(
      [
        { idProducto: 1, categoria: { idCategoria: 10 } }, // producto 15 y categoría 20 → 20
        {
          idProducto: 2,
          categoria: { idCategoria: 99 },
          coleccion: { temporada: { idTemporada: 7 } },
        }, // temporada → 12
        { idProducto: 3, categoria: { idCategoria: 99 } }, // ninguna → 0
        { idProducto: 4 }, // sin categoría ni colección → 0
      ],
      promociones,
    );
    expect([...r.entries()]).toEqual([
      [1, 20],
      [2, 12],
      [3, 0],
      [4, 0],
    ]);
  });

  it('sin promociones vigentes no hay descuento', () => {
    expect(porcentajesPorPrenda([{ idProducto: 5 }], []).get(5)).toBe(0);
  });
});
