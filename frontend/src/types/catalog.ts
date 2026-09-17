export interface CatalogItem { idCategoria?: number; idTalla?: number; idColor?: number; idTemporada?: number; idColeccion?: number; idProveedor?: number; nombre: string; estado?: boolean }
export interface Producto extends CatalogItem { idProducto: number; descripcion?: string; precio: number | string; precioMayorista?: number | string; cantidadMinimaMayorista?: number; imagenUrl?: string }
export interface Variante { idVariante: number; idProducto: number; idTalla?: number; idColor?: number; sku: string; estado?: boolean }
export interface CreateProductoRequest extends CatalogItem { idCategoria: number; precio: number; idProveedor?: number; idTemporada?: number; idColeccion?: number; descripcion?: string; imagenUrl?: string; precioMayorista?: number; cantidadMinimaMayorista?: number }
export interface CreateVarianteRequest { idProducto: number; idTalla?: number; idColor?: number; sku: string }
