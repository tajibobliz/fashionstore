/**
 * Contrato neutral entre el arnés de reportes y el modelo de lenguaje (LLM).
 *
 * El arnés no depende de un proveedor concreto: Anthropic (Claude) o el proveedor
 * "simulado" (sin internet, para pruebas y demostraciones) implementan la misma interfaz.
 * Así se puede cambiar de modelo con una variable de entorno (`LLM_PROVIDER`).
 */

/** Herramienta que el modelo puede pedir. `parametros` es un JSON Schema. */
export interface DefinicionHerramienta {
  nombre: string;
  descripcion: string;
  parametros: Record<string, unknown>;
}

/** Petición del modelo para ejecutar una herramienta ("tool call"). */
export interface LlamadaHerramienta {
  id: string;
  nombre: string;
  entrada: Record<string, unknown>;
}

export interface ResultadoHerramienta {
  id: string;
  /** JSON (o texto) que se devuelve al modelo. */
  contenido: string;
  esError: boolean;
}

export type MensajeLlm =
  | { rol: 'usuario'; texto: string }
  | { rol: 'asistente'; texto: string | null; llamadas: LlamadaHerramienta[] }
  | { rol: 'resultados'; resultados: ResultadoHerramienta[] };

export interface PeticionLlm {
  sistema: string;
  mensajes: MensajeLlm[];
  herramientas: DefinicionHerramienta[];
  maxTokens: number;
}

export interface RespuestaLlm {
  /** Texto final del modelo (la narrativa), si lo hay. */
  texto: string | null;
  /** Herramientas que el modelo quiere ejecutar en este turno. */
  llamadas: LlamadaHerramienta[];
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
}

export interface ProveedorLlm {
  readonly nombre: string;
  responder(peticion: PeticionLlm): Promise<RespuestaLlm>;
}

/** Token de inyección de Nest para el proveedor activo. */
export const PROVEEDOR_LLM = Symbol('PROVEEDOR_LLM');
