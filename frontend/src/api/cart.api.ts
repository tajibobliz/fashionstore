import { api } from './axios'
export interface CartItemRequest { idVariante: number; cantidad: number }
export const cartApi = { mine: () => api.get('/cart/me').then(r => r.data), total: () => api.get('/cart/me/total').then(r => r.data), add: (body: CartItemRequest) => api.post('/cart/items', body).then(r => r.data), update: (id: number, body: Pick<CartItemRequest, 'cantidad'>) => api.patch(`/cart/items/${id}`, body).then(r => r.data), remove: (id: number) => api.delete(`/cart/items/${id}`).then(r => r.data), clear: () => api.delete('/cart/me').then(r => r.data) }
