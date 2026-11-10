import { useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound, Lock, ShieldCheck, WifiOff, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { authSession } from '../auth/session'
import type { AuthUser } from '../auth/types'
import { useOnline } from '../../offline/network'
import {
  LARGO_PIN, MAX_INTENTOS, ROLES_CON_PIN, activarPin, claveSesion, desbloquear, pinValido, useModoOffline, useSesionesGuardadas,
} from '../../offline/sesionOffline'
import type { ModoOffline } from '../../offline/sesionOffline'
import styles from './Offline.module.css'

const fecha = (d: Date) => d.toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const DESCARTE = (clave: string) => `fashionstore.pin_oferta_descartada.${clave}`
const leerDescarte = (clave: string) => { try { return localStorage.getItem(DESCARTE(clave)) === '1' } catch { return false } }

function horasRestantes(vence: Date, ahora: number) {
  const h = Math.max(0, (vence.getTime() - ahora) / 3_600_000)
  if (h >= 24) { const d = Math.floor(h / 24), r = Math.floor(h % 24); return `${d} ${d === 1 ? 'día' : 'días'}${r ? ` ${r} h` : ''}` }
  return h >= 1 ? `${Math.floor(h)} h` : `${Math.max(1, Math.round(h * 60))} min`
}

/** Campo de PIN: solo números, oculto, con teclado numérico en el celular. */
function CampoPin({ id, label, value, onChange, autoFocus }: { id: string; label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return <label className={styles.pinField} htmlFor={id}>
    {label}
    <input id={id} type="password" inputMode="numeric" autoComplete="off" pattern="\d*" maxLength={LARGO_PIN} value={value} autoFocus={autoFocus}
      onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, LARGO_PIN))} placeholder={'•'.repeat(LARGO_PIN)} />
  </label>
}

/**
 * Con internet: invita a activar el acceso sin conexión (CU17). Aparece una vez por usuario;
 * si la descarta no vuelve a salir en este navegador.
 */
export function OfertaPinOffline() {
  const { user, isAuthenticated } = useAuth()
  const online = useOnline()
  const modo = useModoOffline(user)
  const clave = user?.idEmpresa ? claveSesion(user) : ''
  const [descartada, setDescartada] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [listo, setListo] = useState(false)

  const aplica = isAuthenticated && online && !!user?.idEmpresa && ROLES_CON_PIN.includes(user.rol)
  if (!aplica || !user) return null
  if (listo) return <div className={styles.pinOffer} role="status">
    <ShieldCheck size={20} aria-hidden="true" />
    <div><strong>Acceso sin conexión activado</strong><p>Si te quedas sin internet, entra con tu PIN desde la pantalla de inicio de sesión.</p></div>
    <button type="button" className={styles.close} aria-label="Cerrar" onClick={() => setListo(false)}><X size={16} /></button>
  </div>
  if (modo.activo || descartada === clave || leerDescarte(clave)) return null

  function descartar() {
    try { localStorage.setItem(DESCARTE(clave), '1') } catch { /* sin almacenamiento */ }
    setDescartada(clave)
  }

  return <>
    <div className={styles.pinOffer} role="region" aria-label="Acceso sin conexión">
      <KeyRound size={20} aria-hidden="true" />
      <div>
        <strong>¿Quieres entrar sin internet?</strong>
        <p>Activa un PIN y podrás {user.rol === 'CLIENTE' ? 'ver el catálogo, reservar y hacer pedidos' : 'vender'} sin conexión hasta {user.empresa?.horasSesionOffline ?? 72} h después de tu última conexión.</p>
        <div className={styles.pinOfferActions}>
          <button type="button" className={styles.primary} onClick={() => setAbierto(true)}>Activar PIN</button>
          <button type="button" className={styles.ghost} onClick={descartar}>Ahora no</button>
        </div>
      </div>
    </div>
    {abierto && <ConfigurarPin user={user} cerrar={() => setAbierto(false)} alActivar={() => { setAbierto(false); setListo(true) }} />}
  </>
}

function ConfigurarPin({ user, cerrar, alActivar }: { user: AuthUser; cerrar: () => void; alActivar: () => void }) {
  const [pin, setPin] = useState('')
  const [repetido, setRepetido] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!pinValido(pin)) return setError(`Usa ${LARGO_PIN} dígitos que no sean todos iguales ni una secuencia (123456).`)
    if (pin !== repetido) return setError('Los dos PIN no coinciden.')
    const access = authSession.getToken()
    if (!access) return setError('Tu sesión terminó: vuelve a iniciar sesión.')
    setGuardando(true)
    try {
      await activarPin(pin, user, { access, refresh: authSession.getRefreshToken() })
      alActivar()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return <>
    <button type="button" className={styles.backdrop} aria-label="Cerrar" onClick={cerrar} />
    <form className={styles.pinDialog} role="dialog" aria-modal="true" aria-labelledby="pin-title" onSubmit={guardar}>
      <div className={styles.drawerHead}>
        <div><h2 id="pin-title">Activar acceso sin conexión</h2><p>Solo en este navegador. No uses el PIN de tu banco.</p></div>
        <button type="button" className={styles.close} onClick={cerrar} aria-label="Cerrar"><X size={16} /></button>
      </div>
      <CampoPin id="pin-nuevo" label={`PIN de ${LARGO_PIN} dígitos`} value={pin} onChange={setPin} autoFocus />
      <CampoPin id="pin-repetido" label="Repite el PIN" value={repetido} onChange={setRepetido} />
      <p className={styles.pinHelp}>Tu sesión se guarda cifrada con el PIN. Tras {MAX_INTENTOS} intentos fallidos se borra y tendrás que entrar con internet. Al cerrar sesión también se borra.</p>
      {error && <p className={`${styles.status} ${styles.statusError}`} role="alert">{error}</p>}
      <button type="submit" className={styles.primary} disabled={guardando || pin.length < LARGO_PIN || repetido.length < LARGO_PIN}>{guardando ? 'Guardando…' : 'Activar'}</button>
    </form>
  </>
}

/**
 * Sin internet, en la pantalla de inicio de sesión: elegir la cuenta guardada y entrar con el PIN.
 * `slug` limita a las cuentas de esa tienda (en /t/:slug/login).
 */
export function AccesoOffline({ slug, alEntrar }: { slug?: string | null; alEntrar: (user: AuthUser) => void }) {
  const todas = useSesionesGuardadas()
  const sesiones = (todas ?? []).filter(s => !slug || s.user.empresa?.slug === slug)
  const [elegida, setElegida] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [mensaje, setMensaje] = useState<{ error: boolean; texto: string } | null>(null)
  const [probando, setProbando] = useState(false)
  const actual = sesiones.find(s => s.clave === elegida) ?? sesiones[0]

  async function entrar(e: FormEvent) {
    e.preventDefault()
    if (!actual || pin.length < LARGO_PIN) return
    setProbando(true)
    try {
      const r = await desbloquear(actual.clave, pin)
      setPin('')
      if (r.ok) {
        authSession.set(r.tokens.access, r.user, r.tokens.refresh ?? undefined)
        alEntrar(r.user)
      } else setMensaje({
        error: true,
        texto: r.bloqueada
          ? `PIN incorrecto ${MAX_INTENTOS} veces: el acceso sin conexión se borró de este navegador. Conéctate a internet e inicia sesión.`
          : `PIN incorrecto. Te quedan ${r.restantes} ${r.restantes === 1 ? 'intento' : 'intentos'}.`,
      })
    } finally {
      setProbando(false)
    }
  }

  if (todas === undefined) return <p role="status">Buscando cuentas guardadas…</p>
  // Tras el último intento fallido la cuenta ya no está: se mantiene el aviso de por qué.
  if (!actual && mensaje) return <div className={styles.pinAccess}><p className={`${styles.status} ${styles.statusError}`} role="alert">{mensaje.texto}</p></div>
  if (!actual) return <div className={styles.banner} role="status"><WifiOff size={18} aria-hidden="true" /><span><strong>Estás sin conexión.</strong> No hay una cuenta con acceso sin conexión en este navegador: conéctate a internet para iniciar sesión.</span></div>

  return <form className={styles.pinAccess} onSubmit={entrar}>
    <div className={styles.banner} role="status"><WifiOff size={18} aria-hidden="true" /><span><strong>Estás sin conexión.</strong> Entra con el PIN que activaste en este navegador.</span></div>
    {sesiones.length > 1 && <label className={styles.pinField}>Cuenta
      <select value={actual.clave} onChange={e => { setElegida(e.target.value); setMensaje(null) }}>
        {sesiones.map(s => <option key={s.clave} value={s.clave}>{s.user.nombre ?? s.user.email} · {s.user.empresa?.nombre}</option>)}
      </select>
    </label>}
    {sesiones.length === 1 && <p className={styles.pinWho}><Lock size={15} aria-hidden="true" /> {actual.user.nombre ?? actual.user.email} · {actual.user.empresa?.nombre}</p>}
    <CampoPin id="pin-acceso" label="PIN" value={pin} onChange={v => { setPin(v); setMensaje(null) }} autoFocus />
    {actual.intentosFallidos > 0 && !mensaje && <p className={styles.pinHelp}>Te quedan {MAX_INTENTOS - actual.intentosFallidos} intentos.</p>}
    {mensaje && <p className={`${styles.status} ${mensaje.error ? styles.statusError : ''}`} role="alert">{mensaje.texto}</p>}
    <button type="submit" className={styles.primary} disabled={probando || pin.length < LARGO_PIN}>{probando ? 'Comprobando…' : 'Entrar sin conexión'}</button>
  </form>
}

/** Banner del modo offline: última conexión y tiempo que queda; vencido, avisa que solo se consulta. */
export function BannerModoOffline({ modo }: { modo: ModoOffline }) {
  if (!modo.activo || !modo.vence) return null
  if (modo.vencido) return <p className={`${styles.status} ${styles.statusError}`} role="alert">
    Venció el plazo para operar sin conexión (última conexión: {fecha(modo.ultimaConexion!)}). Puedes consultar, pero para vender, reservar o pedir conéctate a internet.
  </p>
  return <p className={styles.status} role="status">
    Modo offline — última conexión: {fecha(modo.ultimaConexion!)} · te quedan {horasRestantes(modo.vence, modo.ahora)} para operar sin internet.
  </p>
}
