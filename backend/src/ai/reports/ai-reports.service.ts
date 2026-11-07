import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Sucursal } from '../../branches/entities/sucursal.entity';
import { Empresa } from '../../tenancy/entities/empresa.entity';
import { Role } from '../../auth/enums/role.enum';
import { BranchAccessService } from '../../users/branch-access.service';
import type { ConsultaReporteDto } from './dto/consulta-reporte.dto';
import {
  ConsultaIa,
  EstadoConsultaIa,
  HerramientaRegistrada,
} from './entities/consulta-ia.entity';
import {
  PROVEEDOR_LLM,
  type MensajeLlm,
  type ProveedorLlm,
  type ResultadoHerramienta,
} from './llm/llm.types';
import {
  ContextoHerramientas,
  ErrorHerramienta,
  HERRAMIENTAS,
  HERRAMIENTA_ACLARACION,
  ReporteGenerado,
  ReportToolsService,
} from './report-tools';

export interface RespuestaReporteIa {
  tipo: 'reporte' | 'aclaracion' | 'sin_reporte';
  consulta: string;
  /** Resumen en lenguaje natural (apto para voz). Las cifras oficiales están en `reportes`. */
  narrativa: string | null;
  aclaracion: string | null;
  reportes: ReporteGenerado[];
  meta: {
    idConsulta: number;
    proveedor: string;
    modelo: string | null;
    iteraciones: number;
    tokensEntrada: number;
    tokensSalida: number;
    duracionMs: number;
  };
}

interface UsuarioReq {
  idUsuario: number;
  idEmpresa: number | null;
  rol: string;
}

/** Filas que se le envían al modelo por reporte (el resto solo va a la tabla). */
const FILAS_PARA_MODELO = 30;
const LLAMADAS_POR_TURNO = 3;
const MAX_REPORTES = 4;

/**
 * Arnés de reportes generativos (Fase 3, tarea 3.1, Desafío V).
 *
 * Bucle de *tool use*:
 *   pregunta → modelo propone herramienta(s) → backend valida y ejecuta con el alcance
 *   del usuario → resultados al modelo → el modelo redacta la narrativa (o pide otra herramienta)
 * con un límite de iteraciones. La tabla y el gráfico salen del backend, no del modelo:
 * la IA puede equivocarse en la narrativa, pero no en las cifras de la tabla.
 */
@Injectable()
export class AiReportsService {
  private readonly log = new Logger(AiReportsService.name);
  private readonly maxIteraciones: number;
  private readonly maxTokens: number;
  private readonly porMinuto: number;
  private readonly zona: string;

  constructor(
    @Inject(PROVEEDOR_LLM) private readonly llm: ProveedorLlm,
    private readonly tools: ReportToolsService,
    private readonly access: BranchAccessService,
    @InjectRepository(ConsultaIa) private readonly consultas: Repository<ConsultaIa>,
    @InjectRepository(Sucursal) private readonly sucursales: Repository<Sucursal>,
    @InjectRepository(Empresa) private readonly empresas: Repository<Empresa>,
    config: ConfigService,
  ) {
    this.maxIteraciones = Number(config.get('AI_REPORTS_MAX_ITER') ?? 4);
    this.maxTokens = Number(config.get('AI_REPORTS_MAX_TOKENS') ?? 1024);
    this.porMinuto = Number(config.get('AI_REPORTS_POR_MINUTO') ?? 10);
    this.zona = config.get<string>('APP_TIMEZONE') || 'America/La_Paz';
  }

  herramientas() {
    return HERRAMIENTAS.filter((h) => h.nombre !== HERRAMIENTA_ACLARACION).map((h) => ({
      nombre: h.nombre,
      descripcion: h.descripcion,
    }));
  }

  /** Últimas consultas: el ADMIN ve las de toda la empresa; los demás, las suyas. */
  async historial(user: UsuarioReq) {
    const filas = await this.consultas.find({
      where: user.rol === Role.ADMIN ? {} : { usuario: { idUsuario: user.idUsuario } },
      relations: { usuario: true },
      order: { creadaEn: 'DESC' },
      take: 20,
    });
    return filas.map((c) => ({
      idConsulta: c.idConsultaIa,
      consulta: c.consulta,
      estado: c.estado,
      herramientas: c.herramientas.map((h) => h.nombre),
      usuario: c.usuario ? `${c.usuario.nombre} ${c.usuario.apellido ?? ''}`.trim() : null,
      modelo: c.modelo,
      tokens: c.tokensEntrada + c.tokensSalida,
      duracionMs: c.duracionMs,
      creadaEn: c.creadaEn,
    }));
  }

  async consultar(user: UsuarioReq, dto: ConsultaReporteDto): Promise<RespuestaReporteIa> {
    const inicio = Date.now();
    await this.limitarFrecuencia(user.idUsuario);

    const ctx = await this.contexto(user);
    const empresa = user.idEmpresa ? await this.empresas.findOne({ where: { idEmpresa: user.idEmpresa } }) : null;
    const sistema = this.instrucciones(empresa?.nombre ?? 'la empresa', ctx);
    const mensajes: MensajeLlm[] = [...this.historial2Mensajes(dto.historial ?? []), { rol: 'usuario', texto: dto.consulta }];

    const reportes: ReporteGenerado[] = [];
    const registradas: HerramientaRegistrada[] = [];
    let narrativa: string | null = null;
    let aclaracion: string | null = null;
    let modelo: string | null = null;
    let tokensEntrada = 0;
    let tokensSalida = 0;
    let iteraciones = 0;

    try {
      while (iteraciones < this.maxIteraciones) {
        iteraciones += 1;
        const r = await this.llm.responder({ sistema, mensajes, herramientas: HERRAMIENTAS, maxTokens: this.maxTokens });
        modelo = r.modelo;
        tokensEntrada += r.tokensEntrada;
        tokensSalida += r.tokensSalida;

        if (!r.llamadas.length) {
          narrativa = r.texto;
          break;
        }
        mensajes.push({ rol: 'asistente', texto: r.texto, llamadas: r.llamadas });

        const pedido = r.llamadas.find((l) => l.nombre === HERRAMIENTA_ACLARACION);
        if (pedido) {
          const ok = await this.tools.validar<{ pregunta: string }>(pedido.nombre, pedido.entrada).catch(() => null);
          aclaracion = ok?.pregunta ?? '¿Puedes precisar qué reporte necesitas y de qué periodo?';
          registradas.push({ nombre: pedido.nombre, entrada: pedido.entrada, ok: true });
          break;
        }

        const resultados: ResultadoHerramienta[] = [];
        for (const [i, l] of r.llamadas.entries()) {
          if (i >= LLAMADAS_POR_TURNO) {
            resultados.push({ id: l.id, contenido: `Máximo ${LLAMADAS_POR_TURNO} herramientas por turno.`, esError: true });
            registradas.push({ nombre: l.nombre, entrada: l.entrada, ok: false, error: 'límite por turno' });
            continue;
          }
          try {
            const rep = await this.tools.ejecutar(l.nombre, l.entrada, ctx);
            reportes.push(rep);
            registradas.push({ nombre: l.nombre, entrada: l.entrada, ok: true, filas: rep.filas.length });
            resultados.push({ id: l.id, contenido: JSON.stringify(paraModelo(rep)), esError: false });
          } catch (e) {
            const mensaje = e instanceof ErrorHerramienta ? e.message : 'Error interno al generar el reporte.';
            if (!(e instanceof ErrorHerramienta)) this.log.error(`Herramienta ${l.nombre} falló`, (e as Error)?.stack);
            registradas.push({ nombre: l.nombre, entrada: l.entrada, ok: false, error: mensaje.slice(0, 200) });
            resultados.push({ id: l.id, contenido: mensaje, esError: true });
          }
        }
        mensajes.push({ rol: 'resultados', resultados });
      }
    } catch (e) {
      // Falla del proveedor (sin API key, sin crédito, sin internet...): se registra y se avisa.
      const detalle = (e as Error)?.message ?? 'desconocido';
      this.log.error(`Proveedor ${this.llm.nombre} falló: ${detalle}`);
      await this.guardar(user, dto.consulta, 'ERROR', { modelo, registradas, iteraciones, tokensEntrada, tokensSalida, inicio, error: detalle });
      throw new ServiceUnavailableException('El servicio de IA no está disponible en este momento. Intenta de nuevo o usa la sección Reportes.');
    }

    const finales = reportes.slice(-MAX_REPORTES);
    if (!narrativa && finales.length)
      narrativa = `Generé ${finales.length === 1 ? 'el reporte' : `${finales.length} reportes`}: ${finales.map((x) => x.titulo.toLowerCase()).join(', ')}.`;
    const estado: EstadoConsultaIa = aclaracion ? 'ACLARACION' : finales.length ? 'OK' : 'SIN_REPORTE';
    if (estado === 'SIN_REPORTE' && !narrativa)
      narrativa = 'No pude generar un reporte con esa pregunta. Prueba con ventas, productos, sucursales, stock, reservas, métodos de pago, devoluciones o cambios.';

    const fila = await this.guardar(user, dto.consulta, estado, { modelo, registradas, iteraciones, tokensEntrada, tokensSalida, inicio });
    return {
      tipo: aclaracion ? 'aclaracion' : finales.length ? 'reporte' : 'sin_reporte',
      consulta: dto.consulta,
      narrativa: aclaracion ? null : narrativa,
      aclaracion,
      reportes: aclaracion ? [] : finales,
      meta: {
        idConsulta: fila.idConsultaIa,
        proveedor: this.llm.nombre,
        modelo,
        iteraciones,
        tokensEntrada,
        tokensSalida,
        duracionMs: fila.duracionMs,
      },
    };
  }

  // ---------------------------------------------------------------- privados

  /** Alcance que pone el backend: empresa (RLS) + sucursales asignadas al usuario. */
  private async contexto(user: UsuarioReq): Promise<ContextoHerramientas> {
    const branchIds = await this.access.accessibleBranchIds(user as never);
    const todas = await this.sucursales.find({ where: { estado: true }, order: { nombre: 'ASC' } });
    const sucursales = todas
      .filter((s) => branchIds === null || branchIds.includes(s.idSucursal))
      .map((s) => ({ idSucursal: s.idSucursal, nombre: s.nombre }));
    return { scope: { branchIds }, sucursales, hoy: hoyEn(this.zona) };
  }

  private instrucciones(empresa: string, ctx: ContextoHerramientas) {
    const lista = ctx.sucursales.map((s) => `- ${s.idSucursal}: ${s.nombre}`).join('\n') || '- (ninguna)';
    return `Eres el analista de reportes de "${empresa}", una tienda de moda que usa el sistema FashionStore.
Hoy es ${ctx.hoy} (zona horaria ${this.zona}). Las semanas empiezan el lunes.

Respondes preguntas sobre el negocio usando EXCLUSIVAMENTE las herramientas disponibles.
Reglas:
1. Todo dato sale de una herramienta. Nunca inventes cifras ni nombres.
2. Convierte expresiones como "hoy", "la semana pasada" u "octubre" a fechas AAAA-MM-DD.
3. Si no se indica periodo, omite las fechas (la herramienta usa los últimos 30 días) y menciónalo.
4. Si la pregunta es ambigua (no se sabe qué métrica quiere), usa pedir_aclaracion.
5. Puedes usar hasta ${LLAMADAS_POR_TURNO} herramientas si la pregunta compara cosas distintas.
6. Si una herramienta responde con error, corrige los parámetros una sola vez.
7. Si la pregunta no trata de reportes del negocio, responde en una frase que solo generas reportes de ventas, productos, sucursales, stock, reservas, pagos, devoluciones y cambios (sin usar herramientas).
8. Al terminar escribe un resumen de 2 a 4 oraciones en español, apto para leerse en voz alta: sin tablas, viñetas ni markdown. Cita solo cifras que aparezcan en "resumen" o "filas" de los resultados. Los montos son en bolivianos (Bs).

Sucursales que este usuario puede consultar (usa el número en idSucursal):
${lista}`;
  }

  /** Turnos previos como texto plano; el primero debe ser del usuario. */
  private historial2Mensajes(historial: { rol: 'usuario' | 'asistente'; texto: string }[]): MensajeLlm[] {
    const salida: MensajeLlm[] = [];
    for (const t of historial) {
      if (!salida.length && t.rol === 'asistente') continue;
      const anterior = salida[salida.length - 1];
      if (anterior && anterior.rol === 'usuario' && t.rol === 'usuario') anterior.texto += `\n${t.texto}`;
      else if (anterior && anterior.rol === 'asistente' && t.rol === 'asistente') anterior.texto = `${anterior.texto ?? ''}\n${t.texto}`;
      else salida.push(t.rol === 'usuario' ? { rol: 'usuario', texto: t.texto } : { rol: 'asistente', texto: t.texto, llamadas: [] });
    }
    // La pregunta actual va como mensaje de usuario: el historial debe terminar en el asistente.
    if (salida.length && salida[salida.length - 1].rol === 'usuario') salida.pop();
    return salida;
  }

  /** Límite simple por usuario (consultas por minuto), guardado en la propia bitácora. */
  private async limitarFrecuencia(idUsuario: number) {
    const recientes = await this.consultas.count({
      where: { usuario: { idUsuario }, creadaEn: MoreThan(new Date(Date.now() - 60_000)) },
    });
    if (recientes >= this.porMinuto)
      throw new HttpException(`Máximo ${this.porMinuto} consultas por minuto. Espera un momento.`, HttpStatus.TOO_MANY_REQUESTS);
  }

  private guardar(
    user: UsuarioReq, consulta: string, estado: EstadoConsultaIa,
    d: { modelo: string | null; registradas: HerramientaRegistrada[]; iteraciones: number; tokensEntrada: number; tokensSalida: number; inicio: number; error?: string },
  ) {
    return this.consultas.save(
      this.consultas.create({
        usuario: { idUsuario: user.idUsuario },
        consulta: consulta.slice(0, 500),
        estado,
        proveedor: this.llm.nombre,
        modelo: d.modelo,
        herramientas: d.registradas,
        iteraciones: d.iteraciones,
        tokensEntrada: d.tokensEntrada,
        tokensSalida: d.tokensSalida,
        duracionMs: Date.now() - d.inicio,
        error: d.error?.slice(0, 300) ?? null,
      }),
    );
  }
}

/** Lo que ve el modelo de cada reporte: título, filtros, totales y las primeras filas. */
function paraModelo(r: ReporteGenerado) {
  return {
    titulo: r.titulo,
    filtros: r.filtros,
    resumen: r.resumen,
    filas: r.filas.slice(0, FILAS_PARA_MODELO),
    filasOmitidas: Math.max(0, r.filas.length - FILAS_PARA_MODELO),
  };
}

export function hoyEn(zona: string, ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}
