// Tipos que devuelve el backend

export interface Categoria {
  idCategoria: number;
  nombre: string;
  descripcion: string | null;
}

export interface Proveedor {
  idProveedor: number;
  nombre: string;
  nit: string | null;
  telefono: string | null;
  email: string | null;
  estado: boolean;
}

export interface Coleccion {
  idColeccion: number;
  nombre: string;
  temporada?: {
    idTemporada: number;
    nombre: string;
    fechaInicio: string;
    fechaFin: string;
  };
}

export interface Talla {
  idTalla: number;
  nombre: string;
}

export interface Color {
  idColor: number;
  nombre: string;
  codigoHex: string;
}

export interface VarianteProducto {
  idVariante: number;
  sku: string;
  talla: Talla | null;
  color: Color | null;
  imagenes?: ImagenVariante[];
  imagenTryOn?: string | null;
  imagenVestidorUrl?: string | null;
  producto?: Producto;
  // Nota: el backend también manda `producto` dentro, pero lo ignoramos aquí
}

export interface ImagenVariante {
  idImagen: number;
  url: string;
  orden: number;
  principal: boolean;
  /** Campos opcionales para contratos que separen el overlay del catálogo. */
  tipo?: 'OVERLAY' | 'PRINCIPAL' | string;
  transparente?: boolean;
}

export interface Producto {
  idProducto: number;
  nombre: string;
  descripcion: string;
  precio: string;
  precioMayorista: string | null;
  cantidadMinimaMayorista: number | null;
  imagenUrl: string | null;
  imagenCatalogoUrl?: string | null;
  imagenVestidorUrl?: string | null;
  tipoPrendaVestidor?: 'GORRA' | 'CAMISA' | 'BLUSA' | 'TOP' | 'VESTIDO' | 'FALDA' | 'PANTALON' | 'CARTERA' | 'OTRO' | null;
  imagenTryOn?: string | null;
  recursoRaUrl: string | null;
  estado: boolean;
  categoria: Categoria | null;
  proveedor: Proveedor | null;
  coleccion: Coleccion | null;
  variantes?: VarianteProducto[];  // Solo viene en el detalle, no en el listado
}
