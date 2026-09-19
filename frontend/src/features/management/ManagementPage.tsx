import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { branchesApi } from '../../api/branches.api'
import { posApi } from '../../api/pos.api'
import { usersApi } from '../../api/users.api'
import { warehousesApi } from '../../api/warehouses.api'
import { getApiErrorMessage } from '../../utils/apiError'
import { queryKeys } from '../../api/queryKeys'
import styles from '../dashboard/Dashboard.module.css'
import BranchManagement from './BranchManagement'
import WarehouseManagement from './WarehouseManagement'
import BoxManagement from './BoxManagement'
import PersonnelManagement from './PersonnelManagement'

type Section = 'usuarios' | 'personal' | 'ciudades' | 'sucursales' | 'almacenes' | 'cajas'
export default function ManagementPage({ section }: { section: Section }) {
 const queryClient = useQueryClient(); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const users = useManagementQuery(false, () => usersApi.list()); const branches = useManagementQuery(false, () => branchesApi.branches.list()); const warehouses = useManagementQuery(false, () => warehousesApi.list()); const boxes = useManagementQuery(false, () => posApi.boxes.list())
 const reload = () => { void queryClient.invalidateQueries({ queryKey: queryKeys.users.all }); void queryClient.invalidateQueries({ queryKey: queryKeys.branches.all }); void queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all }); void queryClient.invalidateQueries({ queryKey: queryKeys.boxes.all }) }
 const cityMutation = useMutation({ mutationFn: (nombre: string) => branchesApi.cities.create({ nombre }), onSuccess: () => { setMessage('Ciudad creada correctamente.'); void queryClient.invalidateQueries({ queryKey: queryKeys.branches.cities }) }, onError: e => setError(getApiErrorMessage(e)) })
 const title = section === 'personal' ? 'Personal' : section === 'usuarios' ? 'Usuarios' : section[0].toUpperCase() + section.slice(1)
 const cities = useManagementQuery(section === 'ciudades', () => branchesApi.cities.list())
 const data = section === 'usuarios' ? users : section === 'sucursales' ? branches : section === 'almacenes' ? warehouses : section === 'cajas' ? boxes : cities
 if (section === 'sucursales') return <BranchManagement />
 if (section === 'almacenes') return <WarehouseManagement />
 if (section === 'cajas') return <BoxManagement />
 if (section === 'usuarios' || section === 'personal') return <PersonnelManagement adminView={section === 'usuarios'} />
 if (data.isLoading) return <div className={styles.chartLoading} role="status">Cargando {title.toLowerCase()}…</div>
 if (data.error) return <section className={styles.panel}><p className={styles.errorNotice} role="alert">{getApiErrorMessage(data.error)}</p><button className="primary-button" onClick={reload}>Reintentar</button></section>
 const rows = (Array.isArray(data.data) ? data.data : []) as unknown as Record<string, unknown>[]
 return <section className={styles.content}><div className={styles.pageHeading}><div><p className={styles.kicker}>Administración</p><h1>{title}</h1><p>Información administrada por Fashionstore.</p></div></div>{message && <p className={styles.successNotice} role="status">{message}</p>}{error && <p className={styles.errorNotice} role="alert">{error}</p>}{section === 'ciudades' && <form className={styles.registrationForm} onSubmit={e => { e.preventDefault(); const value = String(new FormData(e.currentTarget).get('nombre') || '').trim(); if (value) cityMutation.mutate(value) }}><label>Nombre<input name="nombre" required maxLength={100} /></label><button className="primary-button" disabled={cityMutation.isPending}>Crear ciudad</button></form>}<div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Nombre</th><th>Detalle</th><th>Estado</th></tr></thead><tbody>{rows.length ? rows.map((row: Record<string, unknown>, index: number) => <tr key={String(row.idUsuario ?? row.idSucursal ?? row.idAlmacen ?? row.idCaja ?? row.idCiudad ?? index)}><td>{String(row.nombre ?? row.codigo ?? '—')}</td><td>{String(row.email ?? row.direccion ?? row.codigo ?? '—')}</td><td>{row.estado === false ? 'Inactivo' : 'Activo'}</td></tr>) : <tr><td colSpan={3}>No hay registros disponibles.</td></tr>}</tbody></table></div></section>
}
function useManagementQuery<T>(enabled: boolean, queryFn: () => Promise<T>) { return useQuery({ queryKey: ['management', enabled], queryFn, enabled }) }
