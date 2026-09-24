export interface CatalogItem { idCategoria?: number; idTalla?: number; idColor?: number; idTemporada?: number; idColeccion?: number; idProveedor?: number; nombre: string; descripcion?: string; codigoHex?: string; estado?: boolean }
export interface Producto extends CatalogItem { idProducto: number; categoria?: CatalogItem; precio: number | string; precioMayorista?: number | string | null; cantidadMinimaMayorista?: number | null; imagenUrl?: string; recursoRaUrl?: string }
export interface ImagenVariante { idImagen: number; url: string; orden: number; principal: boolean }
export interface Variante { idVariante: number; idProducto?: number; idTalla?: number; idColor?: number; sku: string; estado?: boolean; producto?: Producto; talla?: CatalogItem | null; color?: CatalogItem | null; imagenes?: ImagenVariante[] }
export interface CreateProductoRequest extends CatalogItem { idCategoria: number; precio: number; idProveedor?: number; idColeccion?: number; imagenUrl?: string; recursoRaUrl?: string; precioMayorista?: number; cantidadMinimaMayorista?: number }
export interface CreateVarianteRequest { idProducto: number; idTalla?: number; idColor?: number; sku: string }
