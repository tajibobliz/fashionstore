import { useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import { Mail, Lock, Eye, EyeOff, Loader2, User, Building2 } from 'lucide-react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { getApiErrorMessage } from '../../../utils/apiError'
import { getSessionPath } from '../../../routes/auth'
import { AuthLayout } from './AuthLayout'
import styles from './Auth.module.css'

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const auth = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect')
  const [empresa, setEmpresa] = useState(searchParams.get('empresa') ?? '')
  const isSafeRedirect = redirect && redirect.startsWith('/') && !redirect.startsWith('//')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading || auth.status === 'loading') return
    setError('')
    setLoading(true)
    try {
      const slug = empresa.trim().toLowerCase()
      const credentials = { email: email.trim(), password, ...(slug ? { empresa: slug } : {}) }
      const user = isRegister ? await auth.register({ ...credentials, nombre: nombre.trim() }) : await auth.login(credentials)
      const destination = user.rol === 'CLIENTE' && isSafeRedirect ? redirect! : getSessionPath(user.rol)
      navigate(destination, { replace: true })
    } catch (err) {
      setError(axios.isAxiosError(err) && err.response?.status === 401
        ? 'Correo o contraseña incorrectos. Verifica tus datos e inténtalo nuevamente.' : getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (auth.isAuthenticated && auth.user) return <Navigate to={auth.user.rol === 'CLIENTE' && isSafeRedirect ? redirect! : getSessionPath(auth.user.rol)} replace />
  return <AuthLayout>
    <h1>{isRegister ? 'Crea tu cuenta' : 'Bienvenida de nuevo'}</h1>
    <p className={styles.subtitle}>{isRegister ? 'Regístrate como cliente para comprar, reservar y acceder a la tienda.' : 'Inicia sesión para descubrir la tienda o acceder a tu espacio de trabajo.'}</p>
    {error && <div className={styles.errorMsg} role="alert">{error}</div>}
    <form className={styles.form} onSubmit={handleSubmit} aria-busy={loading}>
      {isRegister && <div className={styles.field}><label htmlFor="nombre">Nombre</label><div className={styles.inputWrapper}><User size={16} className={styles.icon} /><input id="nombre" name="nombre" autoComplete="given-name" placeholder="Tu nombre" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={100} required disabled={loading} /></div></div>}
      {!isRegister && <div className={styles.field}><label htmlFor="empresa">Empresa <span style={{ fontWeight: 400 }}>(opcional)</span></label><div className={styles.inputWrapper}><Building2 size={16} className={styles.icon} /><input id="empresa" name="empresa" autoComplete="organization" placeholder="Ej. urban-step" value={empresa} onChange={e => setEmpresa(e.target.value)} maxLength={60} pattern="[a-zA-Z0-9-]*" title="La dirección de tu tienda: minúsculas, números y guiones" disabled={loading} /></div><small style={{ color: 'var(--muted)', fontSize: '.8rem' }}>La dirección de tu tienda (/t/…). Déjalo vacío si eres de FashionStore.</small></div>}
      <div className={styles.field}><label htmlFor="email">Correo electrónico</label><div className={styles.inputWrapper}><Mail size={16} className={styles.icon} /><input id="email" name="email" type="email" autoComplete="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} /></div></div>
      <div className={styles.field}><label htmlFor="password">Contraseña</label><div className={styles.inputWrapper}><Lock size={16} className={styles.icon} /><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder="Al menos 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required disabled={loading} /><button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>
      <button type="submit" className={styles.btnSubmit} disabled={loading || auth.status === 'loading'}>{loading || auth.status === 'loading' ? <><Loader2 size={18} className={styles.spinner} />{loading ? 'Un momento…' : 'Comprobando sesión…'}</> : isRegister ? 'Crear mi cuenta' : 'Iniciar sesión'}</button>
    </form>
    <p className={styles.register}>{isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'} <Link to={isRegister ? '/login' : '/register'} className={styles.link}>{isRegister ? 'Inicia sesión' : 'Crear cuenta'}</Link></p>
  </AuthLayout>
}
