import { api } from './axios'
import type { ConfigPagoTienda, CreatePagoRequest, EstadoPago, MetodosTienda, Pago, PagoPorVerificar } from '../types/payment'

/** Pagos de ventas y medios de pago de la tienda online (QR, transferencia, tarjeta, efectivo). */
export const paymentsApi = {
  list: () => api.get<Pago[]>('/payments').then(r => r.data),
  get: (id: number) => api.get<Pago>(`/payments/${id}`).then(r => r.data),
  bySale: (idVenta: number) => api.get<Pago[]>(`/payments/venta/${idVenta}`).then(r => r.data),
  create: (body: CreatePagoRequest) => api.post<Pago>('/payments', body).then(r => r.data),
  updateStatus: (id: number, estado: EstadoPago, referenciaPasarela?: string) => api.patch<Pago>(`/payments/${id}/estado`, { estado, referenciaPasarela }).then(r => r.data),

  // Configuración de la tienda (ADMIN)
  config: () => api.get<ConfigPagoTienda>('/payments/config').then(r => r.data),
  saveConfig: (body: Partial<ConfigPagoTienda>) => api.put<ConfigPagoTienda>('/payments/config', body).then(r => r.data),
  uploadQr: (archivoBase64: string, mime: string) => api.put<ConfigPagoTienda>('/payments/config/qr', { archivoBase64, mime }).then(r => r.data),
  /** Las imágenes van con el token: se descargan y se muestran como data URL (no con un <img src> directo). */
  removeQr: () => api.delete<ConfigPagoTienda>('/payments/config/qr').then(r => r.data),
  qrDataUrl: () => api.get<Blob>('/payments/config/qr', { responseType: 'blob' }).then(r => fileToBase64(r.data)),

  // Clienta
  methods: () => api.get<MetodosTienda>('/payments/metodos').then(r => r.data),
  payWithCard: (idVenta: number) => api.post<{ idPago: number; url: string; proveedor: string }>(`/payments/venta/${idVenta}/tarjeta`).then(r => r.data),
  paySimulated: (idPago: number) => api.post<{ idPago: number; resultado: string; pago: Pago }>(`/payments/${idPago}/simulado/pagar`).then(r => r.data),
  uploadReceipt: (idPago: number, archivoBase64: string, mime: string, nombre?: string) => api.post(`/payments/${idPago}/comprobante`, { archivoBase64, mime, nombre }).then(r => r.data),
  receiptBlob: (idPago: number) => api.get<Blob>(`/payments/${idPago}/comprobante`, { responseType: 'blob' }).then(r => r.data),

  fileToDataUrl: (blob: Blob) => fileToBase64(blob),

  // Personal
  toVerify: () => api.get<PagoPorVerificar[]>('/payments/por-verificar').then(r => r.data),
}

/** Lee un archivo (o una descarga) como data URL: sirve para enviarlo en JSON o mostrarlo en un <img>. */
export const fileToBase64 = (file: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})
