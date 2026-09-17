import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { branchesApi } from '../../api/branches.api'
import { queryKeys } from '../../api/queryKeys'
import { useAuth } from '../../hooks/useAuth'
import type { CreateSucursalRequest, Sucursal } from '../../types/branch'
import { getApiErrorMessage } from '../../utils/apiError'
import styles from '../dashboard/Dashboard.module.css'

const branchSchema = z.object({
  idCiudad: z.number().int().positive('Selecciona una ciudad.'),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(120),
  direccion: z.string().trim().min(1, 'La dirección es obligatoria.').max(250),
  telefono: z.string().trim().max(30).optional(),
  estado: z.boolean(),
})
type BranchFormValues = z.infer<typeof branchSchema>

export default function BranchManagement() {
  const { user } = useAuth()
  const canManage = user?.rol === 'ADMIN'
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Sucursal | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [removing, setRemoving] = useState<Sucursal | null>(null)
  const [feedback, setFeedback] = useState('')
  const [operationError, setOperationError] = useState('')
  const branches = useQuery({ queryKey: queryKeys.branches.all, queryFn: branchesApi.branches.list })
  const cities = useQuery({ queryKey: queryKeys.branches.cities, queryFn: branchesApi.cities.list })
  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: { idCiudad: 0, nombre: '', direccion: '', telefono: '', estado: true },
  })

  const refreshRelated = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.branches.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all }),
    ])
  }
  const save = useMutation({
    mutationFn: (values: BranchFormValues) => {
      const body: CreateSucursalRequest = { ...values, telefono: values.telefono || undefined }
      return editing ? branchesApi.branches.update(editing.idSucursal, body) : branchesApi.branches.create(body)
    },
    onSuccess: async () => {
      setFeedback(editing ? 'Sucursal actualizada correctamente.' : 'Sucursal creada correctamente.')
      setOperationError('')
      setFormOpen(false)
      setEditing(null)
      form.reset()
      await refreshRelated()
    },
    onError: error => setOperationError(getApiErrorMessage(error)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => branchesApi.branches.remove(id),
    onSuccess: async () => {
      setFeedback('Sucursal eliminada correctamente.')
      setOperationError('')
      setRemoving(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.branches.all })
    },
    onError: error => setOperationError(getApiErrorMessage(error)),
  })

  function openCreate() {
    setEditing(null)
    setOperationError('')
    form.reset({ idCiudad: 0, nombre: '', direccion: '', telefono: '', estado: true })
    setFormOpen(true)
  }
  function openEdit(branch: Sucursal) {
    setEditing(branch)
    setOperationError('')
    form.reset({ idCiudad: branch.ciudad?.idCiudad ?? 0, nombre: branch.nombre, direccion: branch.direccion, telefono: branch.telefono ?? '', estado: branch.estado })
    setFormOpen(true)
  }

  if (branches.isLoading) return <div className={styles.chartLoading} role="status">Cargando sucursales…</div>
  if (branches.error) return <section className={styles.panel}><p className={styles.errorNotice} role="alert">{getApiErrorMessage(branches.error)}</p><button className="primary-button" onClick={() => void branches.refetch()}>Reintentar</button></section>
  const rows = branches.data ?? []

  return <section className={styles.content}>
    <div className={styles.pageHeading}><div><p className={styles.kicker}>Administración</p><h1>Sucursales</h1><p>Gestiona los puntos de atención de Fashionstore.</p></div>{canManage && <button className="primary-button" onClick={openCreate}>Nueva sucursal</button>}</div>
    {feedback && <p className={styles.successNotice} role="status">{feedback}</p>}
    {operationError && <p className={styles.errorNotice} role="alert">{operationError}</p>}
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Sucursal</th><th>Ciudad</th><th>Dirección</th><th>Teléfono</th><th>Estado</th>{canManage && <th>Acciones</th>}</tr></thead><tbody>{rows.length ? rows.map(branch => <tr key={branch.idSucursal}><td>{branch.nombre}</td><td>{branch.ciudad?.nombre ?? '—'}</td><td>{branch.direccion}</td><td>{branch.telefono || '—'}</td><td>{branch.estado ? 'Activa' : 'Inactiva'}</td>{canManage && <td><div className={styles.rowActions}><button type="button" onClick={() => openEdit(branch)}>Editar</button><button type="button" className={styles.dangerButton} onClick={() => setRemoving(branch)}>Eliminar</button></div></td>}</tr>) : <tr><td colSpan={canManage ? 6 : 5}>No hay sucursales disponibles.</td></tr>}</tbody></table></div>

    {formOpen && <div className={styles.modalBackdrop} role="presentation"><section className={styles.formModal} role="dialog" aria-modal="true" aria-labelledby="branch-form-title"><div className={styles.modalHeader}><h2 id="branch-form-title">{editing ? 'Editar sucursal' : 'Nueva sucursal'}</h2><button type="button" aria-label="Cerrar formulario" onClick={() => setFormOpen(false)}>×</button></div>{cities.isLoading ? <div role="status">Cargando ciudades…</div> : cities.error ? <p className={styles.errorNotice} role="alert">{getApiErrorMessage(cities.error)}</p> : <form className={styles.registrationForm} onSubmit={form.handleSubmit(values => save.mutate(values))}><label>Ciudad<select {...form.register('idCiudad', { valueAsNumber: true })}><option value={0}>Selecciona una ciudad</option>{cities.data?.map(city => <option key={city.idCiudad} value={city.idCiudad}>{city.nombre}</option>)}</select><small>{form.formState.errors.idCiudad?.message}</small></label><label>Nombre<input {...form.register('nombre')} maxLength={120} /><small>{form.formState.errors.nombre?.message}</small></label><label>Dirección<input {...form.register('direccion')} maxLength={250} /><small>{form.formState.errors.direccion?.message}</small></label><label>Teléfono<input {...form.register('telefono')} maxLength={30} /></label><label className={styles.checkboxField}><input type="checkbox" {...form.register('estado')} /> Sucursal activa</label><div className={styles.modalActions}><button type="button" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary-button" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar'}</button></div></form>}</section></div>}
    {removing && <div className={styles.modalBackdrop} role="presentation"><section className={styles.confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby="remove-branch-title"><h2 id="remove-branch-title">Eliminar sucursal</h2><p>¿Deseas eliminar la sucursal {removing.nombre}? Esta acción requiere confirmación.</p><div className={styles.modalActions}><button type="button" onClick={() => setRemoving(null)}>Cancelar</button><button type="button" className={styles.dangerButton} disabled={remove.isPending} onClick={() => remove.mutate(removing.idSucursal)}>{remove.isPending ? 'Eliminando…' : 'Confirmar eliminación'}</button></div></section></div>}
  </section>
}
