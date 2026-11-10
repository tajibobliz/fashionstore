import Anthropic from '@anthropic-ai/sdk';
import type {
  PeticionLlm,
  ProveedorLlm,
  RespuestaLlm,
  MensajeLlm,
} from './llm.types';

type ClienteMensajes = Pick<Anthropic['messages'], 'create'>;

/**
 * Proveedor Claude (API de Anthropic) con *tool use*: se le pasa la lista cerrada de
 * herramientas y el modelo responde con bloques `tool_use` (qué herramienta y con qué
 * parámetros) o con texto final. El modelo nunca ejecuta nada: solo propone.
 */
export class AnthropicProveedor implements ProveedorLlm {
  readonly nombre = 'anthropic';
  private readonly mensajes: ClienteMensajes;

  constructor(
    apiKey: string,
    private readonly modelo: string,
    /** Solo para pruebas: reemplaza el cliente HTTP por uno simulado. */
    cliente?: ClienteMensajes,
  ) {
    this.mensajes = cliente ?? new Anthropic({ apiKey }).messages;
  }

  async responder(p: PeticionLlm): Promise<RespuestaLlm> {
    const r = await this.mensajes.create({
      model: this.modelo,
      max_tokens: p.maxTokens,
      system: p.sistema,
      tools: p.herramientas.map((h) => ({
        name: h.nombre,
        description: h.descripcion,
        input_schema: h.parametros as Anthropic.Tool.InputSchema,
      })),
      messages: p.mensajes.map(aMensajeAnthropic),
    });

    const texto = r.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    const llamadas = r.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map((b) => ({
        id: b.id,
        nombre: b.name,
        entrada: (b.input ?? {}) as Record<string, unknown>,
      }));

    return {
      texto: texto || null,
      llamadas,
      modelo: r.model,
      tokensEntrada: r.usage.input_tokens,
      tokensSalida: r.usage.output_tokens,
    };
  }
}

function aMensajeAnthropic(m: MensajeLlm): Anthropic.MessageParam {
  if (m.rol === 'usuario') return { role: 'user', content: m.texto };
  if (m.rol === 'asistente') {
    const content: Anthropic.ContentBlockParam[] = [];
    if (m.texto) content.push({ type: 'text', text: m.texto });
    for (const l of m.llamadas)
      content.push({ type: 'tool_use', id: l.id, name: l.nombre, input: l.entrada });
    return { role: 'assistant', content };
  }
  return {
    role: 'user',
    content: m.resultados.map((r) => ({
      type: 'tool_result' as const,
      tool_use_id: r.id,
      content: r.contenido,
      is_error: r.esError,
    })),
  };
}
