import { useCallback, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { FileSpreadsheet, FileText, History, Lock, Mic, MicOff, RotateCcw, Send, Sparkles, Square, Volume2 } from 'lucide-react'
import { aiReportsApi } from '../../api/aiReports.api'
import type { ReporteIa, RespuestaReporteIa, TurnoHistorial } from '../../api/aiReports.api'
import { useAuth } from '../../hooks/useAuth'
import { getApiErrorMessage } from '../../utils/apiError'
import { usePlan } from '../plan/usePlan'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import { ReporteIaChart } from './ReporteIaChart'
import { exportarExcel, exportarPdf } from './exportar'
import type { MetaExportacion } from './exportar'
import { COLORES_SERIES, esNumerica, formatear } from './formato'
import { graficoComoImagen } from './imagenGrafico'
import { CHART_PALETTE } from '../reports/charts/colors'
import { useDictado, useLectura } from './useVoz'
import styles from './AiReports.module.css'

/**
 * Reportes con IA (Fase 3, tarea 3.2): la persona pregunta por texto o por voz y recibe
 * tabla + gráfico + resumen, con exportación a PDF y Excel.
 * Las cifras vienen del backend (herramientas validadas); la IA solo interpreta la
 * pregunta y redacta el resumen.
 */

const ROL: Record<string, string> = { ADMIN: 'Administrador', ENCARGADO: 'Encargado', ENCARGADO_SUCURSAL: 'Encargado de sucursal' }

const EJEMPLOS = [
  'Ventas por día de este mes',
  'Los 5 productos más vendidos este mes',
  'Ventas por sucursal del mes pasado',
  'Ingresos por categoría de este año',
  '¿Qué productos tienen stock bajo?',
  'Reservas por estado de los últimos 30 días',
  'Cobros por método de pago de esta semana',
  'Prendas más devueltas y cambiadas este mes',
  '¿Por qué cambian o devuelven las prendas?',
  'Ventas por talla y color de este mes, solo la cantidad, de menor a mayor',
  'Stock por producto y talla, ordenado de menor a mayor',
]

const ESTADO_HISTORIAL: Record<string, string> = { OK: 'Reporte', ACLARACION: 'Aclaración', SIN_REPORTE: 'Sin reporte', ERROR: 'Error' }
const FILAS_VISIBLES = 15
const MAX_TURNOS_CONTEXTO = 6

interface Turno {
  id: number
  consulta: string
  porVoz: boolean
  estado: 'cargando' | 'listo' | 'error'
  respuesta?: RespuestaReporteIa
  error?: string
}

export default function AiReportsPage({ planPath }: { planPath: string | null }) {
  const { user } = useAuth()
  const plan = usePlan()
  const queryClient = useQueryClient()
  const [texto, setTexto] = useState('')
  const [turnos, setTurnos] = useState<Turno[]>([])
  const siguienteId = useRef(1)
  const lectura = useLectura()
  const sinIa = plan.data?.plan?.features.aiReports === false

  const historial = useQuery({
    queryKey: ['ai-reports', 'historial'],
    queryFn: aiReportsApi.historial,
    enabled: !sinIa && !!plan.data,
  })

  const ocupado = turnos.some(t => t.estado === 'cargando')

  const preguntar = useCallback(async (consulta: string, porVoz = false) => {
    const pregunta = consulta.trim()
    if (pregunta.length < 3 || ocupado) return
    // Contexto para preguntas de seguimiento ("¿y solo en Centro?") o para responder una aclaración.
    const contexto: TurnoHistorial[] = turnos
      .filter(t => t.estado === 'listo' && t.respuesta)
      .slice(0, MAX_TURNOS_CONTEXTO / 2)
      .reverse()
      .flatMap(t => [
        { rol: 'usuario' as const, texto: t.consulta.slice(0, 1000) },
        { rol: 'asistente' as const, texto: (t.respuesta!.aclaracion ?? t.respuesta!.narrativa ?? 'Sin reporte.').slice(0, 1000) },
      ])
    const id = siguienteId.current++
    setTexto('')
    lectura.callar()
    setTurnos(prev => [{ id, consulta: pregunta, porVoz, estado: 'cargando' }, ...prev])
    try {
      const respuesta = await aiReportsApi.consultar(pregunta, contexto)
      setTurnos(prev => prev.map(t => (t.id === id ? { ...t, estado: 'listo', respuesta } : t)))
      if (porVoz) lectura.leer(respuesta.aclaracion ?? respuesta.narrativa ?? '')
    } catch (error) {
      setTurnos(prev => prev.map(t => (t.id === id ? { ...t, estado: 'error', error: mensajeError(error) } : t)))
    } finally {
      void queryClient.invalidateQueries({ queryKey: ['ai-reports', 'historial'] })
    }
  }, [ocupado, turnos, lectura, queryClient])

  const dictado = useDictado(useCallback((frase: string) => { void preguntar(frase, true) }, [preguntar]))

  const enviar = (e: FormEvent) => { e.preventDefault(); void preguntar(texto) }
  const alPresionar = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void preguntar(texto) }
  }

  const meta: MetaExportacion = {
    empresa: plan.data?.empresa.nombre ?? user?.empresa?.nombre ?? 'FashionStore',
    usuario: user?.nombre ? `${user.nombre} <${user.email}>` : user?.email ?? '',
    rol: ROL[user?.rol ?? ''] ?? user?.rol ?? '',
  }
  const esperandoAclaracion = turnos[0]?.respuesta?.tipo === 'aclaracion'

  return (
    <section className={dashboardStyles.content}>
      <div className={dashboardStyles.pageHeading}>
        <div>
          <p className={dashboardStyles.kicker}>Reportes con IA</p>
          <h1>Pregúntale a tus datos</h1>
          <p>Escribe o dicta lo que necesitas saber. La IA elige el reporte; las cifras salen directamente del sistema.</p>
        </div>
        {turnos.length > 0 && (
          <button type="button" className={dashboardStyles.refreshButton} onClick={() => { lectura.callar(); setTurnos([]) }}>
            <RotateCcw size={16} /> Nueva conversación
          </button>
        )}
      </div>

      {sinIa ? (
        <div className={`${dashboardStyles.panel} ${styles.locked}`}>
          <Lock size={22} />
          <div>
            <h2>Tu plan {plan.data?.plan?.nombre} no incluye reportes con IA</h2>
            <p>Están disponibles en los planes Profesional y Empresarial. Mientras tanto puedes usar la sección Reportes.</p>
            {planPath && user?.rol === 'ADMIN' && <Link to={planPath} className={dashboardStyles.textLink}>Ver planes y mejorar</Link>}
          </div>
        </div>
      ) : (
        <>
          <form className={`${dashboardStyles.panel} ${styles.composer}`} onSubmit={enviar}>
            <label htmlFor="consulta-ia" className={styles.srOnly}>Pregunta</label>
            <div className={styles.inputRow}>
              <textarea
                id="consulta-ia"
                rows={2}
                maxLength={500}
                value={dictado.escuchando ? dictado.parcial : texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={alPresionar}
                placeholder={dictado.escuchando ? 'Escuchando…' : esperandoAclaracion ? 'Responde la pregunta de la IA…' : 'Ej.: ¿Cuáles fueron los 5 productos más vendidos este mes?'}
                disabled={dictado.escuchando}
              />
              <div className={styles.actions}>
                {dictado.soportado && (
                  <button
                    type="button"
                    className={`${styles.iconButton} ${dictado.escuchando ? styles.recording : ''}`}
                    onClick={dictado.escuchando ? dictado.detener : dictado.iniciar}
                    disabled={ocupado}
                    aria-label={dictado.escuchando ? 'Detener dictado' : 'Dictar por voz'}
                    title={dictado.escuchando ? 'Detener dictado' : 'Dictar por voz'}
                  >
                    {dictado.escuchando ? <Square size={18} /> : <Mic size={18} />}
                  </button>
                )}
                <button type="submit" className={styles.sendButton} disabled={ocupado || texto.trim().length < 3}>
                  <Send size={16} /> {ocupado ? 'Analizando…' : 'Preguntar'}
                </button>
              </div>
            </div>
            {!dictado.soportado && (
              <p className={styles.hint}><MicOff size={14} /> Tu navegador no permite dictado por voz; usa Chrome o Edge.</p>
            )}
            {dictado.error && <p className={styles.voiceError}>{dictado.error}</p>}
            <div className={styles.examples} aria-label="Ejemplos de preguntas">
              {EJEMPLOS.map(ej => (
                <button key={ej} type="button" onClick={() => void preguntar(ej)} disabled={ocupado}>{ej}</button>
              ))}
            </div>
          </form>

          {turnos.length === 0 && (
            <div className={`${dashboardStyles.panel} ${styles.empty}`}>
              <Sparkles size={22} />
              <p>Prueba con un ejemplo o pregunta con tus palabras: ventas por periodo o por sucursal, productos más vendidos, ingresos por categoría, stock bajo, reservas y métodos de pago.</p>
            </div>
          )}

          {turnos.map(t => (
            <TurnoCard key={t.id} turno={t} meta={meta} lectura={lectura} />
          ))}

          <details className={`${dashboardStyles.panel} ${styles.history}`}>
            <summary><History size={16} /> Consultas recientes {historial.data ? `(${historial.data.length})` : ''}</summary>
            {historial.isError && <p className={dashboardStyles.errorNotice}>{getApiErrorMessage(historial.error)}</p>}
            {historial.data?.length === 0 && <p className={styles.hint}>Todavía no hay consultas.</p>}
            <ul>
              {historial.data?.map(h => (
                <li key={h.idConsulta}>
                  <button type="button" onClick={() => void preguntar(h.consulta)} disabled={ocupado} title="Volver a preguntar">
                    {h.consulta}
                  </button>
                  <small>
                    <span className={`${styles.badge} ${h.estado === 'OK' ? styles.badgeOk : h.estado === 'ERROR' ? styles.badgeError : ''}`}>{ESTADO_HISTORIAL[h.estado] ?? h.estado}</span>
                    {h.usuario && user?.rol === 'ADMIN' ? ` ${h.usuario} ·` : ''} {new Date(h.creadaEn).toLocaleString('es-BO')}
                    {h.herramientas.length > 0 && ` · ${h.herramientas.join(', ')}`}
                  </small>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  )
}

function TurnoCard({ turno, meta, lectura }: { turno: Turno; meta: MetaExportacion; lectura: ReturnType<typeof useLectura> }) {
  const r = turno.respuesta
  return (
    <article className={`${dashboardStyles.panel} ${styles.turn}`} aria-busy={turno.estado === 'cargando'}>
      <p className={styles.question}>
        {turno.porVoz ? <Mic size={15} aria-label="Pregunta por voz" /> : null}
        <strong>{turno.consulta}</strong>
      </p>

      {turno.estado === 'cargando' && <div className={styles.loading}><span /><span /><span /> Analizando la pregunta y consultando los datos…</div>}
      {turno.estado === 'error' && <p className={dashboardStyles.errorNotice}>{turno.error}</p>}

      {r?.tipo === 'aclaracion' && (
        <div className={styles.clarify}>
          <Sparkles size={16} />
          <div>
            <p>{r.aclaracion}</p>
            <small>Escribe tu respuesta arriba; la IA recordará esta pregunta.</small>
          </div>
        </div>
      )}

      {r && r.tipo !== 'aclaracion' && r.narrativa && (
        <div className={styles.narrative}>
          <p>{r.narrativa}</p>
          <div className={styles.narrativeFooter}>
            <small>Resumen generado por IA · las cifras oficiales están en la tabla.</small>
            {lectura.soportado && (
              <button type="button" onClick={() => (lectura.leyendo ? lectura.callar() : lectura.leer(r.narrativa ?? ''))}>
                {lectura.leyendo ? <Square size={14} /> : <Volume2 size={14} />} {lectura.leyendo ? 'Detener' : 'Escuchar'}
              </button>
            )}
          </div>
        </div>
      )}

      {r?.reportes.map((rep, i) => (
        <ReporteBloque key={`${rep.herramienta}-${i}`} reporte={rep} consulta={turno.consulta} narrativa={r.narrativa} meta={meta} />
      ))}

      {r && (
        <p className={styles.meta}>
          {r.meta.proveedor === 'simulado' ? 'Modo simulado (sin modelo real)' : r.meta.modelo}
          {' · '}{r.meta.iteraciones} {r.meta.iteraciones === 1 ? 'paso' : 'pasos'}
          {r.meta.tokensEntrada + r.meta.tokensSalida > 0 && ` · ${r.meta.tokensEntrada + r.meta.tokensSalida} tokens`}
          {' · '}{(r.meta.duracionMs / 1000).toFixed(1)} s
        </p>
      )}
    </article>
  )
}

function ReporteBloque({ reporte, consulta, narrativa, meta }: { reporte: ReporteIa; consulta: string; narrativa: string | null; meta: MetaExportacion }) {
  const [todas, setTodas] = useState(false)
  const [exportando, setExportando] = useState<'pdf' | 'excel' | null>(null)
  const grafico = useRef<HTMLDivElement>(null)
  const filas = todas ? reporte.filas : reporte.filas.slice(0, FILAS_VISIBLES)

  const exportar = async (tipo: 'pdf' | 'excel') => {
    setExportando(tipo)
    try {
      const imagen = await graficoComoImagen(grafico.current, leyendaDe(reporte))
      const contenido = { reporte, consulta, narrativa, meta, grafico: imagen }
      if (tipo === 'pdf') exportarPdf(contenido)
      else await exportarExcel(contenido)
    } finally {
      setExportando(null)
    }
  }

  return (
    <div className={styles.report}>
      <div className={styles.reportHeader}>
        <h2>{reporte.titulo}</h2>
        {reporte.filas.length > 0 && (
          <div className={styles.exports}>
            <button type="button" onClick={() => void exportar('pdf')} disabled={exportando !== null}><FileText size={15} /> {exportando === 'pdf' ? 'Generando…' : 'PDF'}</button>
            <button type="button" onClick={() => void exportar('excel')} disabled={exportando !== null}><FileSpreadsheet size={15} /> {exportando === 'excel' ? 'Generando…' : 'Excel'}</button>
          </div>
        )}
      </div>
      <ul className={styles.filters} aria-label="Filtros aplicados">
        {Object.entries(reporte.filtros).map(([k, v]) => <li key={k}><span>{k}:</span> {v}</li>)}
      </ul>

      {reporte.filas.length === 0 ? (
        <p className={styles.hint}>No hay datos para estos filtros.</p>
      ) : (
        <>
          <div ref={grafico}><ReporteIaChart reporte={reporte} /></div>
          <div className={dashboardStyles.tableWrap}>
            <table className={dashboardStyles.table}>
              <thead>
                <tr>{reporte.columnas.map(c => <th key={c.clave} className={esNumerica(c.formato) ? styles.num : undefined}>{c.etiqueta}</th>)}</tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={i}>
                    {reporte.columnas.map(c => (
                      <td key={c.clave} className={esNumerica(c.formato) ? styles.num : undefined}>{formatear(f[c.clave], c, reporte)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {reporte.filas.length > FILAS_VISIBLES && (
            <button type="button" className={styles.more} onClick={() => setTodas(!todas)}>
              {todas ? 'Ver menos' : `Ver las ${reporte.filas.length} filas`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

/** Leyenda para la imagen del gráfico (la de recharts es HTML y no viaja en el SVG). */
function leyendaDe(r: ReporteIa) {
  const g = r.grafico
  if (!g) return []
  if (g.y.length > 1) return g.y.map((clave, i) => ({ nombre: r.columnas.find(c => c.clave === clave)?.etiqueta ?? clave, color: COLORES_SERIES[i % COLORES_SERIES.length] }))
  const colX = r.columnas.find(c => c.clave === g.x)
  if (g.tipo === 'torta' && colX && r.filas.length <= 8)
    return r.filas.map((f, i) => ({ nombre: formatear(f[g.x], colX, r), color: CHART_PALETTE[i % CHART_PALETTE.length] }))
  return []
}

function mensajeError(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 429) return 'Hiciste muchas consultas seguidas. Espera un minuto e intenta de nuevo.'
    if (error.response?.status === 503) return 'El servicio de IA no está disponible ahora. Intenta de nuevo en un momento o usa la sección Reportes.'
  }
  return getApiErrorMessage(error)
}
