import * as SecureStore from "expo-secure-store";
import { api } from "./api";
import { API_URL } from "@/config/env";
import { CreatePaymentDto, MetodosTienda, Payment } from "@/types/checkout.types";

/** Pagos de la tienda online: mismos endpoints que la web (frontend/src/api/payments.api.ts). */
export const paymentsService = {
  /** Registra un pago para una venta (QR, transferencia y efectivo quedan PENDIENTE de verificación). */
  async create(dto: CreatePaymentDto): Promise<Payment> {
    const { data } = await api.post<Payment>("/payments", dto);
    return data;
  },

  /** Medios de pago que activó la tienda (y cuenta bancaria / instrucciones). */
  async metodos(): Promise<MetodosTienda> {
    const { data } = await api.get<MetodosTienda>("/payments/metodos");
    return data;
  },

  /** Pagos de una venta, del más nuevo al más antiguo. */
  async deVenta(idVenta: number): Promise<Payment[]> {
    const { data } = await api.get<Payment[]>(`/payments/venta/${idVenta}`);
    return data;
  },

  /** Tarjeta: crea la sesión en la pasarela (Stripe o simulada) y devuelve la página para pagar. */
  async pagarConTarjeta(idVenta: number): Promise<{ idPago: number; url: string; proveedor: string }> {
    const { data } = await api.post(`/payments/venta/${idVenta}/tarjeta`);
    return data;
  },

  /** Sube la foto del comprobante (QR o transferencia) en base64. */
  async subirComprobante(idPago: number, archivoBase64: string, mime: string, nombre?: string) {
    const { data } = await api.post(`/payments/${idPago}/comprobante`, { archivoBase64, mime, nombre });
    return data;
  },

  /**
   * Imagen del QR de la tienda como data URL. Va con el token (no es pública), así que se descarga
   * con fetch y se convierte con FileReader, igual que la web.
   */
  async qrDataUrl(): Promise<string> {
    const token = await SecureStore.getItemAsync("access_token");
    const r = await fetch(`${API_URL}/payments/config/qr`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!r.ok) throw new Error(`QR ${r.status}`);
    const blob = await r.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  },
};
