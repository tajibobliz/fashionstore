import { api } from './axios'

/** Contratos de /ml/* (Fase 3, tareas 3.3–3.4b). */
export interface MetricasRegresion { mae: number; rmse: number; r2: number }
export interface MlMetricas {
  meta: {
    idEmpresa: number
    entrenadoEn: string
    hoy: string
    duracionSegundos: number
    sucursales: { idSucursal: number; nombre: string }[]
    datos: {
      semanas: number; desde: string; hasta: string; series: number; filas: number; filasReales: number
      filasSinteticas: number; unidadesTotales: number; semanasConDatosReales: number; anomaliasInyectadas: number
    }
  }
  demanda: {
    algoritmo: string; objetivo: string; filasEntrenamiento: number; filasAtipicasExcluidas: number; filasPrueba: number
    semanasPrueba: number; pruebaDesde: string; modelo: MetricasRegresion
    lineaBase: MetricasRegresion & { descripcion: string }; mejoraMaeVsBase: number
    importancia: { caracteristica: string; importancia: number }[]
  }
  segmentacion: { algoritmo: string; k: number; silhouette: number; pruebasK: { k: number; silhouette: number; inercia: number }[]; clientes: number; clientesReales: number }
  anomalias: { algoritmo: string; contaminacion: number; semanasAnalizadas: number; alertas: number; picosEstacionales: number; anomaliasSimuladas: number; precision: number | null; recall: number | null }
}
export interface MlDemanda {
  semanas: number
  sucursal: string | null
  serie: { semana: string; historia?: number; prediccion?: number; p10?: number; p90?: number }[]
  productos: { idProducto: number; producto: string; categoria: string; prediccion: number; ultimasSemanas: number; variacion: number | null }[]
  nota: string
}
export interface Segmento { nombre: string; clientes: number; clientesReales: number; porcentaje: number; recenciaMedia: number; frecuenciaMedia: number; montoMedio: number; accion: string }
export interface MlSegmentos {
  metricas: MlMetricas['segmentacion']
  segmentos: Segmento[]
  puntos: { recenciaDias: number; frecuencia: number; monto: number; segmento: string; real: boolean }[]
  clientesReales: { idCliente: number; nombre: string; segmento: string; recenciaDias: number; frecuencia: number; monto: number }[]
}
export interface MlAnomalias {
  metricas: MlMetricas['anomalias']
  alertas: { semana: string; idSucursal: number; sucursal: string; unidades: number; esperado: number; desviacion: number | null; tipo: 'pico' | 'caida'; puntaje: number }[]
  serie: { semana: string; idSucursal: number; unidades: number; esperado: number; alerta: boolean; estacional: boolean }[]
}

export const mlApi = {
  metricas: () => api.get<MlMetricas>('/ml/metricas').then(r => r.data),
  entrenar: () => api.post('/ml/entrenar', undefined, { timeout: 180_000 }).then(r => r.data),
  demanda: (params: { semanas: number; idSucursal?: number; top?: number }) => api.get<MlDemanda>('/ml/demanda', { params }).then(r => r.data),
  segmentos: () => api.get<MlSegmentos>('/ml/segmentos').then(r => r.data),
  anomalias: (idSucursal?: number) => api.get<MlAnomalias>('/ml/anomalias', { params: { idSucursal } }).then(r => r.data),
}
