import { api } from "./api";

/** Catálogo de una sucursal tal como lo devuelve GET /sync/catalog. */
export interface CatalogoSync {
  serverTime: string;
  sucursal: { idSucursal: number; nombre: string };
  productos: {
    idProducto: number;
    nombre: string;
    categoria: string | null;
    imagenUrl: string | null;
    precio: number;
    precioFinal: number;
    variantes: { idVariante: number; sku: string; talla: string | null; color: string | null; stockDisponible: number }[];
  }[];
}

export type TipoOperacion = "VENTA" | "RESERVA";
export type EstadoServidor = "CONFIRMADA" | "RECHAZADA" | "CONFLICTO";
export interface Alternativa { idSucursal: number; sucursal: string; idVariante: number; stock: number }

export interface PayloadOperacion {
  detalles: { idVariante: number; cantidad: number; precioUnitario?: number }[];
  catalogoDescargadoEn?: string;
}

export interface OperacionEnviada {
  operationId: string;
  type: TipoOperacion;
  idSucursal: number;
  createdAtLocal: string;
  payload: PayloadOperacion;
}

export interface ResultadoSync {
  operationId: string;
  status: EstadoServidor;
  serverId: number | null;
  conflictos: string[];
  reason: string | null;
  duplicada: boolean;
  alternativas?: Alternativa[];
}

export const syncService = {
  async catalogo(idSucursal: number): Promise<CatalogoSync> {
    const { data } = await api.get<CatalogoSync>("/sync/catalog", { params: { sucursal: idSucursal } });
    return data;
  },
  async enviar(deviceId: string, operations: OperacionEnviada[]) {
    const { data } = await api.post<{ serverTime: string; results: ResultadoSync[] }>("/sync/operations", {
      deviceId,
      operations,
    });
    return data;
  },
};
