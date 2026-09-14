import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../api/axios'
import { getApiErrorMessage } from '../../utils/apiError'
import styles from './Dashboard.module.css'

export default function UserRegistration({ cashier = false }: { cashier?: boolean }) {
  const [role, setRole] = useState('CLIENTE')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    const form = event.currentTarget
    const fields = new FormData(form)
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const { data } = await api.post('/users', {
        nombre: String(fields.get('nombre')).trim(), email: String(fields.get('email')).trim(),
        password: String(fields.get('password')), rolNombre: cashier ? 'CAJERO' : role,
      })
      setSuccess(`Usuario ${data.nombre} registrado con rol ${data.rol}.`)
      form.reset()
    } catch (err) { setError(getApiErrorMessage(err)) }
    finally { setLoading(false) }
  }
  return <section className={styles.panel}><h1>{cashier ? 'Crear cajero' : 'Registrar clientes y proveedores'}</h1><p className={styles.pendingDescription}>Crea una cuenta para {cashier ? 'tu equipo de atención' : 'los clientes y proveedores de tu negocio'}.</p>
    {error && <p className={styles.errorNotice} role="alert">{error}</p>}
    {success && <p className={styles.successNotice} role="status">{success}</p>}
    <form className={styles.registrationForm} onSubmit={submit} aria-busy={loading}>
      {!cashier && <div className={styles.roleField}><label htmlFor="registration-role">Rol</label><select id="registration-role" value={role} onChange={event => setRole(event.target.value)} disabled={loading}><option value="CLIENTE">CLIENTE</option><option value="PROVEEDOR">PROVEEDOR</option></select></div>}
      <label>Nombre<input name="nombre" autoComplete="off" maxLength={100} required disabled={loading} /></label>
      <label>Correo electrónico<input name="email" type="email" autoComplete="off" required disabled={loading} /></label>
      <label>Contraseña inicial<input name="password" type="password" minLength={6} autoComplete="new-password" required disabled={loading} /></label>
      <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Registrando…' : 'Registrar usuario'}</button>
    </form>
  </section>
}
