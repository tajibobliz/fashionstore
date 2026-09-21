// Item del carrito (formato interno de la app)
export interface CartItem {
  idVariante: number;      // referencia al backend
  nombre: string;          // "Vestido casual"
  precio: number;          // 299.90
  talla: string | null;    // "M"
  color: string | null;    // "Negro"
  colorHex: string | null; // "#000000" (para mostrar el chip)
  imagenUrl: string | null;
  cantidad: number;
}