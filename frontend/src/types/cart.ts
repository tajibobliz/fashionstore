export interface CartItem { idItemCarrito: number; idVariante: number; cantidad: number }
export interface Carrito { idCarrito: number; items: CartItem[] }
