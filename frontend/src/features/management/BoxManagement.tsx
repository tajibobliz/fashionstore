import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { branchesApi } from '../../api/branches.api'
import { posApi } from '../../api/pos.api'
import { queryKeys } from '../../api/queryKeys'
import { warehousesApi } from '../../api/warehouses.api'
import { useAuth } from '../../hooks/useAuth'
import type { Sucursal } from '../../types/branch'
import type { Caja, CreateCajaRequest } from '../../types/pos'
import { getApiErrorMessage } from '../../utils/apiError'
import styles from '../dashboard/Dashboard.module.css'

const boxSchema = z.object({
  idSucursal: z.number().int().positive('Selecciona una sucursal.'),
  idAlmacenDefault: z.number().int().nonnegative(),
  codigo: z.string().trim().min(1, 'El código es obligatorio.').max(50),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(120),
  estado: z.boolean(),
})
type BoxFormValues = z.infer<typeof boxSchema>

export default function BoxManagement() {
  const { user } = useAuth()
  const isNationalManager = user?.rol === 'ADMIN' || user?.rol === 'ENCARGADO'
  const canCreate = isNationalManager || user?.rol === 'ENCARGADO_SUCURSAL'
  const canManage = isNationalManager
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Caja | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [removing, setRemoving] = useState<Caja | null>(null)
  const [feedback, setFeedback] = useState('')
  const [operationError, setOperationError] = useState('')
  const boxes = useQuery({ queryKey: queryKeys.boxes.all, queryFn: posApi.boxes.list })
  const warehouses = useQuery({ queryKey: queryKeys.warehouses.all, queryFn: warehousesApi.list, enabled: formOpen })
  const nationalBranches = useQuery({ queryKey: queryKeys.branches.all, queryFn: branchesApi.branches.list, enabled: isNationalManager && formOpen })
  const form = useForm<BoxFormValues>({
    resolver: zodResolver(boxSchema),
    defaultValues: { idSucursal: 0, idAlmacenDefault: 0, codigo: '', nombre: '', estado: true },
  })
  const selectedBranch = useWatch({ control: form.control, name: 'idSucursal' })
  const selectedWarehouse = useWatch({ control: form.control, name: 'idAlmacenDefault' })
  const warehouseRows = warehouses.data ?? []
  const scopedBranches = uniqueBranches([
    ...(boxes.data ?? []).flatMap(box => box.sucursal ? [box.sucursal] : []),
    ...warehouseRows.flatMap(warehouse => warehouse.sucursal ? [warehouse.sucursal] : []),
  ])
  const branchOptions = isNationalManager ? (nationalBranches.data ?? []) : scopedBranches
  const warehouseOptions = warehouseRows.filter(warehouse => warehouse.sucursal?.idSucursal === selectedBranch)

  useEffect(() => {
    if (!warehouses.isLoading && warehouses.data && selectedWarehouse && !warehouseOptions.some(warehouse => warehouse.idAlmacen === selectedWarehouse)) {
      form.setValue('idAlmacenDefault', 0, { shouldValidate: true })
    }
  }, [form, selectedWarehouse, warehouseOptions, warehouses.data, warehouses.isLoading])

  const save = useMutation({
    mutationFn: (values: BoxFormValues) => {
      const body: CreateCajaRequest = {
        idSucursal: values.idSucursal,
        codigo: values.codigo,
        nombre: values.nombre,
        estado: values.estado,
        ...(values.idAlmacenDefault ? { idAlmacenDefault: values.idAlmacenDefault } : {}),
      }
      return editing ? posApi.boxes.update(editing.idCaja, body) : posApi.boxes.create(body)
    },
    onSuccess: async () => {
      setFeedback(editing ? 'Caja actualizada correctamente.' : 'Caja creada correctamente.')
      setOperationError('')
      setFormOpen(false)
      setEditing(null)
      form.reset()
      await queryClient.invalidateQueries({ queryKey: queryKeys.boxes.all })
    },
    onError: error => setOperationError(getApiErrorMessage(error)),
  })
  const deactivate = useMutation({
    mutationFn: (id: number) => posApi.boxes.remove(id),
    onSuccess: async () => {
      setFeedback('Caja desactivada correctamente.')
      setOperationError('')
      setRemoving(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.boxes.all })
    },
    onError: error => setOperationError(getApiErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setOperationError('')
    form.reset({ idSucursal: branchOptions.length === 1 ? branchOptions[0].idSucursal : 0, idAlmacenDefault: 0, codigo: '', nombre: '', estado: true })
    setFormOpen(true)
  }
  function openEdit(box: Caja) {
    setEditing(box)
    setOperationError('')
    form.reset({
      idSucursal: box.sucursal?.idSucursal ?? box.idSucursal ?? 0,
      idAlmacenDefault: box.almacenDefault?.idAlmacen ?? box.idAlmacenDefault ?? 0,
      codigo: box.codigo,
      nombre: box.nombre,
      estado: box.estado,
    })
    setFormOpen(true)
  }

  if (boxes.isLoading) return <div className={styles.chartLoading} role="status">Cargando cajas…</div>
  if (boxes.error) return <section className={styles.panel}><p className={styles.errorNotice} role="alert">{getApiErrorMessage(boxes.error)}</p><button className="primary-button" onClick={() => void boxes.refetch()}>Reintentar</button></section>
  const rows = boxes.data ?? []
  const formLoading = warehouses.isLoading || (isNationalManager && nationalBranches.isLoading)
  const formError = warehouses.error ?? (isNationalManager ? nationalBranches.error : null)

  return <section className={styles.content}>
    <div className={styles.pageHeading}><div><p className={styles.kicker}>Administración</p><h1>Cajas</h1><p>Gestiona las cajas físicas de cada sucursal.</p></div>{canCreate && <button className="primary-button" onClick={openCreate}>Nueva caja</button>}</div>
    {feedback && <p className={styles.successNotice} role="status">{feedback}</p>}
    {operationError && <p className={styles.errorNotice} role="alert">{operationError}</p>}
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Código</th><th>Caja</th><th>Sucursal</th><th>Almacén predeterminado</th><th>Estado</th>{canManage && <th>Acciones</th>}</tr></thead><tbody>{rows.length ? rows.map(box => <tr key={box.idCaja}><td>{box.codigo}</td><td>{box.nombre}</td><td>{box.sucursal?.nombre ?? '—'}</td><td>{box.almacenDefault?.nombre ?? 'Sin asignar'}</td><td>{box.estado ? 'Activa' : 'Inactiva'}</td>{canManage && <td><div className={styles.rowActions}><button type="button" onClick={() => openEdit(box)}>Editar</button>{box.estado && <button type="button" className={styles.dangerButton} onClick={() => setRemoving(box)}>Desactivar</button>}</div></td>}</tr>) : <tr><td colSpan={canManage ? 6 : 5}>No hay cajas disponibles.</td></tr>}</tbody></table></div>

    {formOpen && <div className={styles.modalBackdrop} role="presentation"><section className={styles.formModal} role="dialog" aria-modal="true" aria-labelledby="box-form-title"><div className={styles.modalHeader}><h2 id="box-form-title">{editing ? 'Editar caja' : 'Nueva caja'}</h2><button type="button" aria-label="Cerrar formulario" onClick={() => setFormOpen(false)}>×</button></div>{formLoading ? <div role="status">Cargando opciones…</div> : formError ? <p className={styles.errorNotice} role="alert">{getApiErrorMessage(formError)}</p> : <form className={styles.registrationForm} onSubmit={form.handleSubmit(values => save.mutate(values))}><label>Sucursal<select {...form.register('idSucursal', { valueAsNumber: true })}><option value={0}>Selecciona una sucursal</option>{branchOptions.map(branch => <option key={branch.idSucursal} value={branch.idSucursal}>{branch.nombre}</option>)}</select><small>{form.formState.errors.idSucursal?.message}</small></label><label>Almacén predeterminado<select {...form.register('idAlmacenDefault', { valueAsNumber: true })}>{(!editing?.almacenDefault || editing.almacenDefault.sucursal?.idSucursal !== selectedBranch) && <option value={0}>Sin almacén predeterminado</option>}{warehouseOptions.map(warehouse => <option key={warehouse.idAlmacen} value={warehouse.idAlmacen}>{warehouse.nombre}</option>)}</select></label><label>Código<input {...form.register('codigo')} maxLength={50} /><small>{form.formState.errors.codigo?.message}</small></label><label>Nombre<input {...form.register('nombre')} maxLength={120} /><small>{form.formState.errors.nombre?.message}</small></label><label className={styles.checkboxField}><input type="checkbox" {...form.register('estado')} /> Caja activa</label><div className={styles.modalActions}><button type="button" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary-button" disabled={save.isPending || branchOptions.length === 0}>{save.isPending ? 'Guardando…' : 'Guardar'}</button></div>{branchOptions.length === 0 && <p className={styles.errorNotice} role="alert">No hay sucursales disponibles para este usuario.</p>}</form>}</section></div>}
    {removing && <div className={styles.modalBackdrop} role="presentation"><section className={styles.confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby="deactivate-box-title"><h2 id="deactivate-box-title">Desactivar caja</h2><p>¿Deseas desactivar la caja {removing.nombre}? Esta acción requiere confirmación.</p><div className={styles.modalActions}><button type="button" onClick={() => setRemoving(null)}>Cancelar</button><button type="button" className={styles.dangerButton} disabled={deactivate.isPending} onClick={() => deactivate.mutate(removing.idCaja)}>{deactivate.isPending ? 'Desactivando…' : 'Confirmar desactivación'}</button></div></section></div>}
  </section>
}

function uniqueBranches(branches: Sucursal[]) {
  return [...new Map(branches.map(branch => [branch.idSucursal, branch])).values()]
}
