import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnthropicProveedor } from './anthropic.provider';
import { SimuladoProveedor } from './simulado.provider';
import type { ProveedorLlm } from './llm.types';
import { hoyEn } from '../ai-reports.service';

/**
 * Elige el proveedor con `LLM_PROVIDER`:
 *   - `anthropic` (por defecto): Claude con `ANTHROPIC_API_KEY` y `AI_REPORTS_MODEL`.
 *   - `simulado`: reglas por palabras clave, sin internet (pruebas y demostración).
 */
export function crearProveedorLlm(config: ConfigService): ProveedorLlm {
  const log = new Logger('ProveedorLlm');
  const tipo = (config.get<string>('LLM_PROVIDER') || 'anthropic').toLowerCase();
  const zona = config.get<string>('APP_TIMEZONE') || 'America/La_Paz';
  if (tipo === 'simulado') {
    log.warn('Reportes con IA en modo SIMULADO (sin modelo real).');
    return new SimuladoProveedor(() => hoyEn(zona));
  }
  if (tipo !== 'anthropic') log.warn(`LLM_PROVIDER="${tipo}" no se usa en reportes; se usa anthropic.`);
  const apiKey = config.get<string>('ANTHROPIC_API_KEY');
  const modelo = config.get<string>('AI_REPORTS_MODEL') || 'claude-haiku-4-5';
  if (!apiKey) {
    log.warn('ANTHROPIC_API_KEY vacía: /ai/reports/query responderá 503 (o usa LLM_PROVIDER=simulado).');
    return {
      nombre: 'anthropic',
      responder: () => Promise.reject(new Error('ANTHROPIC_API_KEY no configurada')),
    };
  }
  return new AnthropicProveedor(apiKey, modelo);
}
