import { api } from "./api";
import { CreatePaymentDto, Payment } from "@/types/checkout.types";

export const paymentsService = {
  // Registra un pago para una venta (queda PENDIENTE de aprobación)
  async create(dto: CreatePaymentDto): Promise<Payment> {
    const { data } = await api.post<Payment>("/payments", dto);
    return data;
  },
};