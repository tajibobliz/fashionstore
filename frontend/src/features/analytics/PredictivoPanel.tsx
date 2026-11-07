import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { mlApi } from '../../api/ml.api'
import type { MlMetricas } from '../../api/ml.api'
import { getApiErrorMessage } from '../../utils/apiError'
import { CHART_PRIMARY } from '../reports/charts/colors'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import { Aviso, Calidad, Dato } from './mlComunes'
import { fechaCorta, numero } from './mlFormato'
import styles from './Analytics.module.css'

const NOMBRES: Record<string, string> = {
  lag1: 'Ventas de la semana anterior', lag2: 'Ventas de hace 2 semanas', lag4: 'Ventas de hace 4 semanas',
  media4: 'Promedio de las últimas 4 semanas', media12: 'Promedio de las últimas 12 semanas',
  sem_sin: 'Época del año', sem_cos: 'Época del año', mes: 'Mes', navidad: 'Navidad', madre: 'Día de la Madre',
  blackfriday: 'Black Friday', carnaval: 'Carnaval', clases: 'Vuelta a clases', precio: 'Precio', categoria: 'Categoría', sucursal: 'Sucursal',
}

/** "Análisis predictivo" (CU12, ML supervisado): pronóstico de unidades por semana y por producto. */
export function PredictivoPanel({ metricas }: { metricas: MlMetricas }) {
  const [semanas, setSemanas] = useState(4)
  const [idSucursal, setIdSucursal] = useState<number | undefined>()
  const demanda = useQuery({
    queryKey: ['ml', 'demanda', metricas.meta.entrenadoEn, semanas, idSucursal ?? null],
    queryFn: () => mlApi.demanda({ semanas, idSucursal, top: 10 }),
  })
  const d = demanda.data
  const m = metricas.demanda
  const datos = metricas.meta.datos

  const futuras = d?.serie.filter(x => x.prediccion !== undefined) ?? []
  const pasadas = d?.serie.filter(x => x.historia !== undefined).slice(-semanas) ?? []
  const totalFuturo = futuras.reduce((s, x) => s + (x.prediccion ?? 0), 0)
  const totalPasado = pasadas.reduce((s, x) => s + (x.historia ?? 0), 0)
  const variacion = totalPasado ? Math.round((totalFuturo / totalPasado - 1) * 1000) / 10 : null
  // Une la última semana real con la primera predicción para que la línea sea continua.
  const grafico = (d?.serie ?? []).map((x, i, arr) => ({
    ...x,
    banda: x.p10 !== undefined ? [x.p10, x.p90] : undefined,
    prediccion: x.prediccion ?? (arr[i + 1]?.prediccion !== undefined ? x.historia : undefined),
  }))

  const importancia = Object.values(m.importancia.reduce<Record<string, { nombre: string; valor: number }>>((acc, x) => {
    const nombre = NOMBRES[x.caracteristica] ?? x.caracteristica
    acc[nombre] = { nombre, valor: (acc[nombre]?.valor ?? 0) + x.importancia }
    return acc
  }, {})).sort((a, b) => b.valor - a.valor).slice(0, 8).map(x => ({ ...x, porcentaje: Math.round(x.valor * 1000) / 10 }))

  return (
    <div className={styles.stack}>
      {datos.semanasConDatosReales < 12 && (
        <Aviso>
          Tu empresa tiene {datos.semanasConDatosReales} {datos.semanasConDatosReales === 1 ? 'semana' : 'semanas'} con ventas reales.
          Se requiere mínimo 3 meses de historial para un pronóstico confiable; mientras tanto el modelo se apoya en datos sintéticos.
        </Aviso>
      )}
      {m.modelo.r2 < 0.5 && (
        <Aviso>
          La precisión del modelo es baja (R² {numero(m.modelo.r2, 2)}). Conviene acumular más historial de ventas o agregar variables
          (promociones, clima, eventos) antes de tomar decisiones solo con este pronóstico.
        </Aviso>
      )}

      <div className={`${dashboardStyles.panel} ${styles.toolbar}`}>
        <label>
          Pronosticar
          <select value={semanas} onChange={e => setSemanas(Number(e.target.value))}>
            {[4, 8, 12].map(n => <option key={n} value={n}>Próximas {n} semanas</option>)}
          </select>
        </label>
        {metricas.meta.sucursales.length > 1 && (
          <label>
            Sucursal
            <select value={idSucursal ?? ''} onChange={e => setIdSucursal(e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">Todas</option>
              {metricas.meta.sucursales.map(s => <option key={s.idSucursal} value={s.idSucursal}>{s.nombre}</option>)}
            </select>
          </label>
        )}
      </div>

      {demanda.isError && <p className={dashboardStyles.errorNotice}>{getApiErrorMessage(demanda.error)}</p>}
      {demanda.isLoading && <div className={dashboardStyles.chartLoading} role="status">Calculando pronóstico…</div>}

      {d && (
        <>
          <div className={styles.kpiGrid}>
            <Dato titulo={`Unidades esperadas (${semanas} semanas)`} valor={numero(totalFuturo, 0)}
              detalle={variacion === null ? '' : `${variacion >= 0 ? '+' : ''}${numero(variacion, 1)} % frente a las últimas ${semanas} semanas`} />
            <Dato texto titulo="Producto con más demanda" valor={d.productos[0]?.producto ?? '—'}
              detalle={d.productos[0] ? `${numero(d.productos[0].prediccion, 0)} unidades esperadas` : ''} />
            <Dato titulo="Margen de error típico" valor={`± ${numero(m.modelo.mae, 1)} u.`}
              detalle="por producto, sucursal y semana (MAE)" />
          </div>

          <section className={`${dashboardStyles.panel} ${styles.chartPanel}`}>
            <div className={styles.panelTitle}>
              <h2>Unidades por semana: historia y pronóstico</h2>
              <span>{d.sucursal ?? 'Todas las sucursales'}</span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={grafico} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee5e9" vertical={false} />
                <XAxis dataKey="semana" tickFormatter={fechaCorta} tick={{ fontSize: 11 }} minTickGap={14} />
                <YAxis tick={{ fontSize: 11 }} width={52} />
                <Tooltip labelFormatter={(s: unknown) => `Semana del ${fechaCorta(String(s))}`}
                  formatter={(v: unknown, n: unknown) => {
                    if (Array.isArray(v)) return [`${numero(v[0], 0)} – ${numero(v[1], 0)}`, 'Rango probable']
                    return [numero(Number(v), 0), n === 'historia' ? 'Vendido' : 'Pronóstico']
                  }} />
                <Legend formatter={(n: string) => (n === 'historia' ? 'Vendido' : n === 'prediccion' ? 'Pronóstico' : 'Rango probable (p10–p90)')} />
                <Area dataKey="banda" stroke="none" fill={CHART_PRIMARY} fillOpacity={0.14} isAnimationActive={false} />
                <Line dataKey="historia" stroke="#4b5563" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="prediccion" stroke={CHART_PRIMARY} strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </section>

          <section className={dashboardStyles.panel}>
            <div className={styles.panelTitle}><h2>Demanda esperada por producto</h2><span>próximas {semanas} semanas</span></div>
            <div className={dashboardStyles.tableWrap}>
              <table className={dashboardStyles.table}>
                <thead><tr><th>Producto</th><th>Categoría</th><th className={styles.num}>Pronóstico</th><th className={styles.num}>Últimas {semanas} sem.</th><th className={styles.num}>Variación</th></tr></thead>
                <tbody>
                  {d.productos.map(p => (
                    <tr key={p.idProducto}>
                      <td>{p.producto}</td><td>{p.categoria}</td>
                      <td className={styles.num}>{numero(p.prediccion, 0)}</td>
                      <td className={styles.num}>{numero(p.ultimasSemanas, 0)}</td>
                      <td className={`${styles.num} ${p.variacion !== null && p.variacion < 0 ? styles.textDown : styles.textUp}`}>
                        {p.variacion === null ? '—' : `${p.variacion > 0 ? '+' : ''}${numero(p.variacion, 1)} %`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.footnote}>Úsalo para planificar compras y traspasos. {d.nota}</p>
          </section>
        </>
      )}

      <Calidad titulo="Calidad del modelo de demanda">
        <p>{m.algoritmo}. Se entrena con {numero(m.filasEntrenamiento, 0)} filas y se evalúa con las últimas {m.semanasPrueba} semanas
          (desde {fechaCorta(m.pruebaDesde)}), que el modelo no vio. {m.filasAtipicasExcluidas > 0 && `Se excluyeron ${m.filasAtipicasExcluidas} filas de semanas atípicas.`}</p>
        <div className={dashboardStyles.tableWrap}>
          <table className={dashboardStyles.table}>
            <thead><tr><th>Métrica</th><th className={styles.num}>Modelo</th><th className={styles.num}>Línea base*</th><th>Qué significa</th></tr></thead>
            <tbody>
              <tr><td>MAE</td><td className={styles.num}>{numero(m.modelo.mae, 2)}</td><td className={styles.num}>{numero(m.lineaBase.mae, 2)}</td><td>Error promedio en unidades (menor es mejor)</td></tr>
              <tr><td>RMSE</td><td className={styles.num}>{numero(m.modelo.rmse, 2)}</td><td className={styles.num}>{numero(m.lineaBase.rmse, 2)}</td><td>Como el MAE, pero castiga más los errores grandes</td></tr>
              <tr><td>R²</td><td className={styles.num}>{numero(m.modelo.r2, 3)}</td><td className={styles.num}>{numero(m.lineaBase.r2, 3)}</td><td>Qué parte de la variación explica (1 = perfecto)</td></tr>
            </tbody>
          </table>
        </div>
        <p><strong>{m.mejoraMaeVsBase >= 0 ? `${numero(m.mejoraMaeVsBase, 1)} % menos error` : `${numero(-m.mejoraMaeVsBase, 1)} % más error`}</strong> que la línea base. *Línea base: {m.lineaBase.descripcion}.</p>
        <h3 className={styles.subTitle}>Qué variables pesan más en la predicción</h3>
        <ResponsiveContainer width="100%" height={Math.max(180, importancia.length * 30)}>
          <BarChart data={importancia} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }}>
            <XAxis type="number" tickFormatter={(v: number) => `${v} %`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="nombre" width={200} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: unknown) => [`${v} %`, 'Importancia']} />
            <Bar dataKey="porcentaje" fill={CHART_PRIMARY} radius={[0, 6, 6, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        <p className={styles.footnote}>Datos: {numero(datos.filas, 0)} filas ({datos.semanas} semanas × {datos.series} series producto-sucursal),
          de las cuales {numero(datos.filasReales, 0)} son ventas reales y {numero(datos.filasSinteticas, 0)} sintéticas.</p>
      </Calidad>
    </div>
  )
}
