import { api } from './axios'
import type { Cart } from '../types/cart'
export interface CartItemRequest { idSucursal: number; idVariante: number; cantidad: number }
export const cartApi = {
 mine: (idSucursal: number) => api.get<Cart>('/cart/me', { params: { idSucursal } }).then(r => r.data),
 total: (idSucursal: number) => api.get<{ total: number }>('/cart/me/total', { params: { idSucursal } }).then(r => r.data),
 add: (body: CartItemRequest) => api.post<Cart>('/cart/items', body).then(r => r.data),
 update: (id: number, body: Pick<CartItemRequest, 'cantidad'>) => api.patch<Cart>(`/cart/items/${id}`, body).then(r => r.data),
 remove: (id: number) => api.delete<Cart>(`/cart/items/${id}`).then(r => r.data),
 clear: (idSucursal: number) => api.delete<Cart>('/cart/me', { params: { idSucursal } }).then(r => r.data),
}
