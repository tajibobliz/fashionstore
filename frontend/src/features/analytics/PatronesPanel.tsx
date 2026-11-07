import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { mlApi } from '../../api/ml.api'
import type { MlMetricas } from '../../api/ml.api'
import { getApiErrorMessage } from '../../utils/apiError'
import { CHART_PRIMARY } from '../reports/charts/colors'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import { Aviso, Calidad } from './mlComunes'
import { bs, fechaCorta, numero } from './mlFormato'
import styles from './Analytics.module.css'

/** Colores distintos por segmento (tonos separados para distinguirlos también sin color fino). */
const COLOR_SEGMENTO: Record<string, string> = {
  Campeones: '#ad3e68', Leales: '#2f855a', Nuevos: '#2563eb', 'En riesgo': '#d97706', Dormidos: '#6b7280', Ocasionales: '#7c3aed',
}
const color = (nombre: string) => COLOR_SEGMENTO[nombre.replace(/ \d+$/, '')] ?? '#0f766e'

/** "Descubrir patrones" (CU12, ML no supervisado): segmentos de clientes y semanas atípicas. */
export function PatronesPanel({ metricas, verClientes }: { metricas: MlMetricas; verClientes: boolean }) {
  const version = metricas.meta.entrenadoEn
  const seg = useQuery({ queryKey: ['ml', 'segmentos', version], queryFn: mlApi.segmentos })
  const [idSucursal, setIdSucursal] = useState<number>(metricas.meta.sucursales[0]?.idSucursal)
  const anom = useQuery({ queryKey: ['ml', 'anomalias', version, idSucursal], queryFn: () => mlApi.anomalias(idSucursal) })
  const s = seg.data
  const a = anom.data
  const nombreSucursal = metricas.meta.sucursales.find(x => x.idSucursal === idSucursal)?.nombre ?? ''

  return (
    <div className={styles.stack}>
      {/* ---------------- Segmentos de clientes ---------------- */}
      <section className={dashboardStyles.panel}>
        <div className={styles.panelTitle}>
          <h2>Segmentos de clientes</h2>
          <span>agrupados por recencia, frecuencia y monto de compra</span>
        </div>
        {seg.isError && <p className={dashboardStyles.errorNotice}>{getApiErrorMessage(seg.error)}</p>}
        {s && s.metricas.silhouette < 0.3 && <Aviso>No se detectaron patrones claros en los datos actuales (silhouette {numero(s.metricas.silhouette, 2)}). Los grupos son orientativos.</Aviso>}
        {s && (
          <>
            <div className={styles.segmentGrid}>
              {s.segmentos.map(x => (
                <article key={x.nombre} className={styles.segment} style={{ borderTopColor: color(x.nombre) }}>
                  <header><h3>{x.nombre}</h3><strong>{numero(x.porcentaje, 1)} %</strong></header>
                  <p className={styles.segmentStats}>
                    {numero(x.clientes)} clientes{x.clientesReales ? ` (${x.clientesReales} ${x.clientesReales === 1 ? 'real' : 'reales'})` : ''} · última compra hace {numero(x.recenciaMedia)} días ·
                    {' '}{numero(x.frecuenciaMedia, 1)} compras · {bs(x.montoMedio)}
                  </p>
                  <p className={styles.segmentAction}>{x.accion}</p>
                </article>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee5e9" />
                <XAxis type="number" dataKey="recenciaDias" name="Días desde la última compra" tick={{ fontSize: 11 }}
                  label={{ value: 'Días desde la última compra', position: 'insideBottom', offset: -4, fontSize: 11 }} height={42} />
                <YAxis type="number" dataKey="monto" name="Monto" scale="log" domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={70}
                  tickFormatter={(v: number) => `Bs ${numero(v)}`} />
                <ZAxis range={[28, 28]} />
                <Tooltip formatter={(v: unknown, n: unknown) => (n === 'Monto' ? bs(Number(v)) : numero(Number(v)))} />
                <Legend verticalAlign="top" height={30} />
                {s.segmentos.map(x => (
                  <Scatter key={x.nombre} name={x.nombre} data={s.puntos.filter(p => p.segmento === x.nombre)} fill={color(x.nombre)} fillOpacity={0.7} isAnimationActive={false} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
            {verClientes && s.clientesReales.length > 0 && (
              <details className={styles.inner}>
                <summary>{s.clientesReales.length === 1 ? 'Ver tu clienta registrada y su segmento' : `Ver tus ${s.clientesReales.length} clientas registradas y su segmento`}</summary>
                <div className={dashboardStyles.tableWrap}>
                  <table className={dashboardStyles.table}>
                    <thead><tr><th>Clienta</th><th>Segmento</th><th className={styles.num}>Última compra</th><th className={styles.num}>Compras</th><th className={styles.num}>Monto</th></tr></thead>
                    <tbody>
                      {s.clientesReales.map(c => (
                        <tr key={c.idCliente}>
                          <td>{c.nombre || `Cliente ${c.idCliente}`}</td>
                          <td><span className={styles.dot} style={{ background: color(c.segmento) }} />{c.segmento}</td>
                          <td className={styles.num}>hace {numero(c.recenciaDias)} días</td>
                          <td className={styles.num}>{numero(c.frecuencia)}</td>
                          <td className={styles.num}>{bs(c.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )}
      </section>

      {/* ---------------- Semanas atípicas ---------------- */}
      <section className={dashboardStyles.panel}>
        <div className={styles.panelTitle}>
          <h2>Semanas atípicas</h2>
          {metricas.meta.sucursales.length > 1 ? (
            <label className={styles.inlineSelect}>
              Sucursal
              <select value={idSucursal} onChange={e => setIdSucursal(Number(e.target.value))}>
                {metricas.meta.sucursales.map(x => <option key={x.idSucursal} value={x.idSucursal}>{x.nombre}</option>)}
              </select>
            </label>
          ) : <span>{nombreSucursal}</span>}
        </div>
        {anom.isError && <p className={dashboardStyles.errorNotice}>{getApiErrorMessage(anom.error)}</p>}
        {a && (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={a.serie.map(x => ({ ...x, atipico: x.alerta ? x.unidades : undefined }))} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee5e9" vertical={false} />
                <XAxis dataKey="semana" tickFormatter={fechaCorta} tick={{ fontSize: 11 }} minTickGap={22} />
                <YAxis tick={{ fontSize: 11 }} width={48} />
                <Tooltip labelFormatter={(x: unknown) => `Semana del ${fechaCorta(String(x))}`}
                  formatter={(v: unknown, n: unknown) => [numero(Number(v)), n === 'unidades' ? 'Vendido' : n === 'esperado' ? 'Esperado' : 'Atípica']} />
                <Legend formatter={(n: string) => (n === 'unidades' ? 'Vendido' : n === 'esperado' ? 'Esperado (línea base)' : 'Semana atípica')} />
                <Line dataKey="esperado" stroke="#9ca3af" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                <Line dataKey="unidades" stroke={CHART_PRIMARY} strokeWidth={1.8} dot={false} isAnimationActive={false} />
                <Scatter dataKey="atipico" fill="#dc2626" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            {a.alertas.length === 0 ? <p className={styles.muted}>No se detectaron semanas atípicas en esta sucursal.</p> : (
              <ul className={styles.alerts}>
                {a.alertas.slice(0, 8).map(x => (
                  <li key={x.semana} className={x.tipo === 'pico' ? styles.alertUp : styles.alertDown}>
                    <strong>Semana del {fechaCorta(x.semana)}</strong>
                    <span>{x.tipo === 'pico' ? 'Pico' : 'Caída'}: se vendieron {numero(x.unidades)} unidades cuando lo normal era ~{numero(x.esperado)}
                      {x.desviacion !== null ? ` (${x.desviacion > 0 ? '+' : ''}${numero(x.desviacion)} %)` : ''}.</span>
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.footnote}>Revisa estas semanas: un pico puede ser una promoción o un error de carga; una caída, un cierre o falta de stock.
              Los picos de Navidad o Día de la Madre se consideran esperados y no se marcan.</p>
          </>
        )}
      </section>

      <Calidad titulo="Calidad de los modelos de patrones">
        {s && (
          <>
            <p>{s.metricas.algoritmo}. Se probaron de 2 a 6 grupos y se eligió <strong>k = {s.metricas.k}</strong>, el de mayor
              coeficiente silhouette (<strong>{numero(s.metricas.silhouette, 3)}</strong>; de −1 a 1, sobre 0,3 indica grupos bien separados).
              Clientes analizados: {numero(s.metricas.clientes)} ({s.metricas.clientesReales} {s.metricas.clientesReales === 1 ? 'real' : 'reales'}, el resto sintéticos).</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={s.metricas.pruebasK} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <XAxis dataKey="k" tickFormatter={(k: number) => `k=${k}`} tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} width={36} />
                <Tooltip formatter={(v: unknown) => [numero(Number(v), 3), 'Silhouette']} labelFormatter={(k: unknown) => `${k} grupos`} />
                <Bar dataKey="silhouette" isAnimationActive={false}>
                  {s.metricas.pruebasK.map(p => <Cell key={p.k} fill={p.k === s.metricas.k ? CHART_PRIMARY : '#e5c3d1'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
        {a && (
          <p>{a.metricas.algoritmo}. Semanas analizadas: {numero(a.metricas.semanasAnalizadas)}; alertas: {a.metricas.alertas}; picos
            estacionales descartados: {a.metricas.picosEstacionales}. Contra las {a.metricas.anomaliasSimuladas} anomalías simuladas en los datos
            sintéticos: precisión <strong>{a.metricas.precision === null ? '—' : `${numero(a.metricas.precision * 100)} %`}</strong> (de las alertas, cuántas
            eran reales) y exhaustividad <strong>{a.metricas.recall === null ? '—' : `${numero(a.metricas.recall * 100)} %`}</strong> (de las anomalías, cuántas encontró).</p>
        )}
      </Calidad>
    </div>
  )
}
