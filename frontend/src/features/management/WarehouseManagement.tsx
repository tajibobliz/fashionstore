import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { branchesApi } from '../../api/branches.api'
import { queryKeys } from '../../api/queryKeys'
import { warehousesApi } from '../../api/warehouses.api'
import { useAuth } from '../../hooks/useAuth'
import type { Sucursal } from '../../types/branch'
import type { Almacen, CreateAlmacenRequest } from '../../types/warehouse'
import { getApiErrorMessage } from '../../utils/apiError'
import styles from '../dashboard/Dashboard.module.css'

const warehouseSchema = z.object({
  idSucursal: z.number().int().positive('Selecciona una sucursal.'),
  codigo: z.string().trim().min(1, 'El código es obligatorio.').max(50),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(120),
  estado: z.boolean(),
})
type WarehouseFormValues = z.infer<typeof warehouseSchema>

export default function WarehouseManagement() {
  const { user } = useAuth()
  const isNationalManager = user?.rol === 'ADMIN' || user?.rol === 'ENCARGADO'
  const canCreate = isNationalManager || user?.rol === 'ENCARGADO_SUCURSAL'
  const canManage = isNationalManager
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Almacen | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [removing, setRemoving] = useState<Almacen | null>(null)
  const [feedback, setFeedback] = useState('')
  const [operationError, setOperationError] = useState('')
  const warehouses = useQuery({ queryKey: queryKeys.warehouses.all, queryFn: warehousesApi.list })
  const nationalBranches = useQuery({
    queryKey: queryKeys.branches.all,
    queryFn: branchesApi.branches.list,
    enabled: isNationalManager && formOpen,
  })
  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: { idSucursal: 0, codigo: '', nombre: '', estado: true },
  })

  const scopedBranches = uniqueBranches((warehouses.data ?? []).flatMap(warehouse => warehouse.sucursal ? [warehouse.sucursal] : []))
  const branchOptions = isNationalManager ? (nationalBranches.data ?? []) : scopedBranches
  const branchesLoading = isNationalManager && nationalBranches.isLoading
  const branchesError = isNationalManager ? nationalBranches.error : null

  const save = useMutation({
    mutationFn: (values: WarehouseFormValues) => {
      const body: CreateAlmacenRequest = values
      return editing ? warehousesApi.update(editing.idAlmacen, body) : warehousesApi.create(body)
    },
    onSuccess: async () => {
      setFeedback(editing ? 'Almacén actualizado correctamente.' : 'Almacén creado correctamente.')
      setOperationError('')
      setFormOpen(false)
      setEditing(null)
      form.reset()
      await queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all })
    },
    onError: error => setOperationError(getApiErrorMessage(error)),
  })
  const deactivate = useMutation({
    mutationFn: (id: number) => warehousesApi.remove(id),
    onSuccess: async () => {
      setFeedback('Almacén desactivado correctamente.')
      setOperationError('')
      setRemoving(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all })
    },
    onError: error => setOperationError(getApiErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setOperationError('')
    form.reset({ idSucursal: branchOptions.length === 1 ? branchOptions[0].idSucursal : 0, codigo: '', nombre: '', estado: true })
    setFormOpen(true)
  }
  function openEdit(warehouse: Almacen) {
    setEditing(warehouse)
    setOperationError('')
    form.reset({
      idSucursal: warehouse.sucursal?.idSucursal ?? warehouse.idSucursal ?? 0,
      codigo: warehouse.codigo,
      nombre: warehouse.nombre,
      estado: warehouse.estado,
    })
    setFormOpen(true)
  }

  if (warehouses.isLoading) return <div className={styles.chartLoading} role="status">Cargando almacenes…</div>
  if (warehouses.error) return <section className={styles.panel}><p className={styles.errorNotice} role="alert">{getApiErrorMessage(warehouses.error)}</p><button className="primary-button" onClick={() => void warehouses.refetch()}>Reintentar</button></section>
  const rows = warehouses.data ?? []

  return <section className={styles.content}>
    <div className={styles.pageHeading}><div><p className={styles.kicker}>Administración</p><h1>Almacenes</h1><p>Gestiona los almacenes asociados a las sucursales de Fashionstore.</p></div>{canCreate && <button className="primary-button" onClick={openCreate}>Nuevo almacén</button>}</div>
    {feedback && <p className={styles.successNotice} role="status">{feedback}</p>}
    {operationError && <p className={styles.errorNotice} role="alert">{operationError}</p>}
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Código</th><th>Almacén</th><th>Sucursal</th><th>Estado</th>{canManage && <th>Acciones</th>}</tr></thead><tbody>{rows.length ? rows.map(warehouse => <tr key={warehouse.idAlmacen}><td>{warehouse.codigo}</td><td>{warehouse.nombre}</td><td>{warehouse.sucursal?.nombre ?? '—'}</td><td>{warehouse.estado ? 'Activo' : 'Inactivo'}</td>{canManage && <td><div className={styles.rowActions}><button type="button" onClick={() => openEdit(warehouse)}>Editar</button>{warehouse.estado && <button type="button" className={styles.dangerButton} onClick={() => setRemoving(warehouse)}>Desactivar</button>}</div></td>}</tr>) : <tr><td colSpan={canManage ? 5 : 4}>No hay almacenes disponibles.</td></tr>}</tbody></table></div>

    {formOpen && <div className={styles.modalBackdrop} role="presentation"><section className={styles.formModal} role="dialog" aria-modal="true" aria-labelledby="warehouse-form-title"><div className={styles.modalHeader}><h2 id="warehouse-form-title">{editing ? 'Editar almacén' : 'Nuevo almacén'}</h2><button type="button" aria-label="Cerrar formulario" onClick={() => setFormOpen(false)}>×</button></div>{branchesLoading ? <div role="status">Cargando sucursales…</div> : branchesError ? <p className={styles.errorNotice} role="alert">{getApiErrorMessage(branchesError)}</p> : <form className={styles.registrationForm} onSubmit={form.handleSubmit(values => save.mutate(values))}><label>Sucursal<select {...form.register('idSucursal', { valueAsNumber: true })}><option value={0}>Selecciona una sucursal</option>{branchOptions.map(branch => <option key={branch.idSucursal} value={branch.idSucursal}>{branch.nombre}</option>)}</select><small>{form.formState.errors.idSucursal?.message}</small></label><label>Código<input {...form.register('codigo')} maxLength={50} /><small>{form.formState.errors.codigo?.message}</small></label><label>Nombre<input {...form.register('nombre')} maxLength={120} /><small>{form.formState.errors.nombre?.message}</small></label><label className={styles.checkboxField}><input type="checkbox" {...form.register('estado')} /> Almacén activo</label><div className={styles.modalActions}><button type="button" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary-button" disabled={save.isPending || branchOptions.length === 0}>{save.isPending ? 'Guardando…' : 'Guardar'}</button></div>{branchOptions.length === 0 && <p className={styles.errorNotice} role="alert">No hay sucursales disponibles para este usuario.</p>}</form>}</section></div>}
    {removing && <div className={styles.modalBackdrop} role="presentation"><section className={styles.confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby="deactivate-warehouse-title"><h2 id="deactivate-warehouse-title">Desactivar almacén</h2><p>¿Deseas desactivar el almacén {removing.nombre}? Esta acción requiere confirmación.</p><div className={styles.modalActions}><button type="button" onClick={() => setRemoving(null)}>Cancelar</button><button type="button" className={styles.dangerButton} disabled={deactivate.isPending} onClick={() => deactivate.mutate(removing.idAlmacen)}>{deactivate.isPending ? 'Desactivando…' : 'Confirmar desactivación'}</button></div></section></div>}
  </section>
}

function uniqueBranches(branches: Sucursal[]) {
  return [...new Map(branches.map(branch => [branch.idSucursal, branch])).values()]
}
