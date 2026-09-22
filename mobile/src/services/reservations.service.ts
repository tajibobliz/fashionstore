import { api } from "./api";
import { CreateReservationDto, Reservation } from "@/types/reservation.types";

export const reservationsService = {
  // Crear una reserva
  async create(dto: CreateReservationDto): Promise<Reservation> {
    const { data } = await api.post<Reservation>("/reservations", dto);
    return data;
  },

  // Lista mis reservas
  async getMine(): Promise<Reservation[]> {
    const { data } = await api.get<Reservation[]>("/reservations/me");
    return data;
  },

  // Detalle de una reserva
  async getById(id: number): Promise<Reservation> {
    const { data } = await api.get<Reservation>(`/reservations/${id}`);
    return data;
  },

  // Cancelar reserva (devuelve stock)
  async cancel(id: number): Promise<Reservation> {
    const { data } = await api.patch<Reservation>(
      `/reservations/${id}/cancel`
    );
    return data;
  },
};