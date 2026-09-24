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
  producto?: Producto;
  // Nota: el backend también manda `producto` dentro, pero lo ignoramos aquí
}

export interface Producto {
  idProducto: number;
  nombre: string;
  descripcion: string;
  precio: string;
  precioMayorista: string | null;
  cantidadMinimaMayorista: number | null;
  imagenUrl: string | null;
  recursoRaUrl: string | null;
  estado: boolean;
  categoria: Categoria | null;
  proveedor: Proveedor | null;
  coleccion: Coleccion | null;
  variantes?: VarianteProducto[];  // Solo viene en el detalle, no en el listado
}
