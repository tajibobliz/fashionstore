import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { queryKeys } from '../../api/queryKeys'
import { branchesApi } from '../../api/branches.api'
import { usersApi } from '../../api/users.api'
import { useAuth } from '../../hooks/useAuth'
import type { Role } from '../auth/types'
import type { CreateUserRequest, User } from '../../types/user'
import type { Sucursal } from '../../types/branch'
import { getApiErrorMessage } from '../../utils/apiError'
import styles from '../dashboard/Dashboard.module.css'

const personnelSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(100),
  apellido: z.string().trim().max(100),
  email: z.email('Ingresa un correo electrónico válido.'),
  telefono: z.string().trim().max(30),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
  rolNombre: z.enum(['ADMIN', 'ENCARGADO', 'ENCARGADO_SUCURSAL', 'CAJERO']),
  idSucursal: z.number().int().nonnegative(),
}).superRefine((values, context) => {
  if ((values.rolNombre === 'ENCARGADO_SUCURSAL' || values.rolNombre === 'CAJERO') && !values.idSucursal) {
    context.addIssue({ code: 'custom', path: ['idSucursal'], message: 'Selecciona una sucursal para el personal operativo.' })
  }
})
type PersonnelFormValues = z.infer<typeof personnelSchema>

const adminRoles: { value: PersonnelFormValues['rolNombre']; label: string }[] = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'ENCARGADO', label: 'Encargado nacional' },
  { value: 'ENCARGADO_SUCURSAL', label: 'Encargado de sucursal' },
  { value: 'CAJERO', label: 'Cajero' },
]
const managerRoles = adminRoles.filter(role => role.value === 'ENCARGADO_SUCURSAL' || role.value === 'CAJERO')

export default function PersonnelManagement({ adminView }: { adminView: boolean }) {
  const { user } = useAuth()
  const isAdmin = user?.rol === 'ADMIN'
  const canCreate = isAdmin || user?.rol === 'ENCARGADO'
  const allowedRoles = isAdmin ? adminRoles : managerRoles
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [operationError, setOperationError] = useState('')
  const users = useQuery({ queryKey: queryKeys.users.all, queryFn: usersApi.list, enabled: canCreate })
  const branches = useQuery({ queryKey: queryKeys.branches.all, queryFn: branchesApi.branches.list, enabled: canCreate })
  const form = useForm<PersonnelFormValues>({
    resolver: zodResolver(personnelSchema),
    defaultValues: { nombre: '', apellido: '', email: '', telefono: '', password: '', rolNombre: allowedRoles[0]?.value ?? 'CAJERO', idSucursal: 0 },
  })
  const selectedRole = useWatch({ control: form.control, name: 'rolNombre' })
  const requiresBranch = selectedRole === 'ENCARGADO_SUCURSAL' || selectedRole === 'CAJERO'
  const create = useMutation({
    mutationFn: (values: PersonnelFormValues) => {
      const body: CreateUserRequest = {
        nombre: values.nombre,
        email: values.email,
        password: values.password,
        rolNombre: values.rolNombre as Role,
        ...(requiresBranch ? { idSucursales: [values.idSucursal] } : {}),
        ...(values.apellido ? { apellido: values.apellido } : {}),
        ...(values.telefono ? { telefono: values.telefono } : {}),
      }
      return usersApi.create(body)
    },
    onSuccess: async created => {
      setFeedback(`Personal ${created.nombre} creado correctamente.`)
      setOperationError('')
      setFormOpen(false)
      form.reset()
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
    },
    onError: error => setOperationError(getApiErrorMessage(error)),
  })

  function openCreate() {
    setOperationError('')
    form.reset({ nombre: '', apellido: '', email: '', telefono: '', password: '', rolNombre: allowedRoles[0]?.value ?? 'CAJERO', idSucursal: 0 })
    setFormOpen(true)
  }

  if (canCreate && (users.isLoading || branches.isLoading)) return <div className={styles.chartLoading} role="status">Cargando usuarios y sucursales…</div>
  if (canCreate && users.error) return <section className={styles.panel}><p className={styles.errorNotice} role="alert">{getApiErrorMessage(users.error)}</p><button className="primary-button" onClick={() => void users.refetch()}>Reintentar</button></section>
  if (canCreate && branches.error) return <section className={styles.panel}><p className={styles.errorNotice} role="alert">{getApiErrorMessage(branches.error)}</p><button className="primary-button" onClick={() => void branches.refetch()}>Reintentar</button></section>
  const rows = isAdmin ? (users.data ?? []) : (users.data ?? []).filter(person => ['ENCARGADO_SUCURSAL', 'CAJERO'].includes(roleName(person)))
  const title = adminView ? 'Usuarios' : 'Personal'

  return <section className={styles.content}>
    <div className={styles.pageHeading}><div><p className={styles.kicker}>Administración</p><h1>{title}</h1><p>{isAdmin ? 'Consulta los usuarios y crea personal interno de Fashionstore.' : 'Crea personal operativo con los roles autorizados para el encargado nacional.'}</p></div>{canCreate && <button className="primary-button" onClick={openCreate}>Nuevo personal</button>}</div>
    {feedback && <p className={styles.successNotice} role="status">{feedback}</p>}
    {operationError && <p className={styles.errorNotice} role="alert">{operationError}</p>}
    {canCreate && <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Nombre</th><th>Correo electrónico</th><th>Rol</th><th>Estado</th><th>Sucursales asignadas</th></tr></thead><tbody>{rows.length ? rows.map(person => <tr key={person.idUsuario}><td>{fullName(person)}</td><td>{person.email}</td><td>{roleName(person)}</td><td>{person.estado ? 'Activo' : 'Inactivo'}</td><td><BranchAssignments person={person} branches={branches.data ?? []} onFeedback={setFeedback} onError={setOperationError} /></td></tr>) : <tr><td colSpan={5}>No hay usuarios disponibles.</td></tr>}</tbody></table></div>}

    {formOpen && <div className={styles.modalBackdrop} role="presentation"><section className={styles.formModal} role="dialog" aria-modal="true" aria-labelledby="personnel-form-title"><div className={styles.modalHeader}><h2 id="personnel-form-title">Nuevo personal</h2><button type="button" aria-label="Cerrar formulario" onClick={() => setFormOpen(false)}>×</button></div><form className={styles.registrationForm} onSubmit={form.handleSubmit(values => create.mutate(values))}><label>Nombre<input {...form.register('nombre')} maxLength={100} /><small>{form.formState.errors.nombre?.message}</small></label><label>Apellido<input {...form.register('apellido')} maxLength={100} /></label><label>Correo electrónico<input type="email" {...form.register('email')} /><small>{form.formState.errors.email?.message}</small></label><label>Teléfono<input {...form.register('telefono')} maxLength={30} /></label><label>Contraseña inicial<input type="password" {...form.register('password')} /><small>{form.formState.errors.password?.message}</small></label><label>Rol<select {...form.register('rolNombre')}>{allowedRoles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>{requiresBranch && <label>Sucursal<select aria-label="Sucursal asignada" {...form.register('idSucursal', { valueAsNumber: true })}><option value={0}>Selecciona una sucursal</option>{(branches.data ?? []).filter(branch => branch.estado !== false).map(branch => <option key={branch.idSucursal} value={branch.idSucursal}>{branch.nombre}</option>)}</select><small>{form.formState.errors.idSucursal?.message}</small></label>}<div className={styles.modalActions}><button type="button" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary-button" disabled={create.isPending}>{create.isPending ? 'Guardando…' : 'Guardar'}</button></div></form></section></div>}
  </section>
}

function BranchAssignments({ person, branches, onFeedback, onError }: { person: User; branches: Sucursal[]; onFeedback: (message: string) => void; onError: (message: string) => void }) {
  const role = roleName(person)
  const eligible = role === 'ENCARGADO_SUCURSAL' || role === 'CAJERO'
  const queryClient = useQueryClient()
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState(0)
  const [removing, setRemoving] = useState<Sucursal | null>(null)
  const assignments = useQuery({ queryKey: queryKeys.users.branches(person.idUsuario), queryFn: () => usersApi.branches(person.idUsuario), enabled: eligible })
  const active = (assignments.data ?? []).filter(assignment => assignment.estado)
  const activeIds = new Set(active.map(assignment => assignment.sucursal.idSucursal))
  const available = branches.filter(branch => branch.estado !== false && !activeIds.has(branch.idSucursal))
  const assign = useMutation({
    mutationFn: (idSucursal: number) => usersApi.assignBranch(person.idUsuario, { idSucursal }),
    onSuccess: async () => {
      onFeedback(`Sucursal asignada a ${fullName(person)} correctamente.`)
      onError('')
      setAssignOpen(false)
      setSelectedBranch(0)
      await invalidateAssignments(queryClient, person.idUsuario)
    },
    onError: error => onError(getApiErrorMessage(error)),
  })
  const remove = useMutation({
    mutationFn: (idSucursal: number) => usersApi.deactivateBranch(person.idUsuario, idSucursal),
    onSuccess: async () => {
      onFeedback(`Asignación retirada a ${fullName(person)} correctamente.`)
      onError('')
      setRemoving(null)
      await invalidateAssignments(queryClient, person.idUsuario)
    },
    onError: error => onError(getApiErrorMessage(error)),
  })

  if (role === 'ADMIN' || role === 'ENCARGADO') return <span>Alcance nacional</span>
  if (!eligible) return <span>No requiere asignación</span>
  if (assignments.isLoading) return <span role="status">Cargando asignaciones…</span>
  if (assignments.error) return <span className={styles.errorNotice} role="alert">{getApiErrorMessage(assignments.error)}</span>

  return <div className={styles.rowActions}>
    {active.length ? active.map(assignment => <span key={assignment.idUsuarioSucursal}>{assignment.sucursal.nombre} <button type="button" className={styles.dangerButton} aria-label={`Retirar ${assignment.sucursal.nombre} de ${fullName(person)}`} onClick={() => setRemoving(assignment.sucursal)}>Retirar</button></span>) : <span>Sin sucursales</span>}
    <button type="button" disabled={available.length === 0} onClick={() => { setSelectedBranch(0); setAssignOpen(true) }}>Asignar sucursal</button>
    {assignOpen && <div className={styles.modalBackdrop} role="presentation"><section className={styles.formModal} role="dialog" aria-modal="true" aria-labelledby={`assign-title-${person.idUsuario}`}><div className={styles.modalHeader}><h2 id={`assign-title-${person.idUsuario}`}>Asignar sucursal a {fullName(person)}</h2><button type="button" aria-label="Cerrar asignación" onClick={() => setAssignOpen(false)}>×</button></div><form className={styles.registrationForm} onSubmit={event => { event.preventDefault(); if (selectedBranch) assign.mutate(selectedBranch) }}><label>Sucursal<select value={selectedBranch} onChange={event => setSelectedBranch(Number(event.target.value))}><option value={0}>Selecciona una sucursal</option>{available.map(branch => <option key={branch.idSucursal} value={branch.idSucursal}>{branch.nombre}</option>)}</select></label><div className={styles.modalActions}><button type="button" onClick={() => setAssignOpen(false)}>Cancelar</button><button className="primary-button" disabled={!selectedBranch || assign.isPending}>{assign.isPending ? 'Asignando…' : 'Asignar'}</button></div></form></section></div>}
    {removing && <div className={styles.modalBackdrop} role="presentation"><section className={styles.confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby={`remove-assignment-title-${person.idUsuario}`}><h2 id={`remove-assignment-title-${person.idUsuario}`}>Retirar asignación</h2><p>¿Deseas retirar {removing.nombre} de {fullName(person)}?</p><div className={styles.modalActions}><button type="button" onClick={() => setRemoving(null)}>Cancelar</button><button type="button" className={styles.dangerButton} disabled={remove.isPending} onClick={() => remove.mutate(removing.idSucursal)}>{remove.isPending ? 'Retirando…' : 'Confirmar retiro'}</button></div></section></div>}
  </div>
}

async function invalidateAssignments(queryClient: ReturnType<typeof useQueryClient>, idUsuario: number) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.users.branches(idUsuario) }),
  ])
}

function roleName(user: User) {
  return typeof user.rol === 'string' ? user.rol : user.rol.nombre
}

function fullName(user: User) {
  return [user.nombre, user.apellido].filter(Boolean).join(' ')
}
