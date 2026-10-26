import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, LayoutGrid, Loader2 } from 'lucide-react'
import { saasApi, slugify } from '../../api/saas.api'
import type { CodigoPlan } from '../../api/saas.api'
import { getApiErrorMessage } from '../../utils/apiError'
import { getSessionPath } from '../../routes/auth'
import styles from './ContratarPlan.module.css'

type SlugEstado = 'vacio' | 'revisando' | 'libre' | 'ocupado' | 'invalido'

/** Devuelve `value` recién cuando deja de cambiar durante `ms` milisegundos. */
function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

/** Contratación (simulada) de un plan: registra la empresa y su administrador. */
export default function ContratarPlan() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const planes = useQuery({ queryKey: ['saas', 'planes'], queryFn: saasApi.planes, staleTime: 5 * 60_000 })
  const inicial = (params.get('plan')?.toUpperCase() as CodigoPlan) || 'PROFESIONAL'

  const [plan, setPlan] = useState<CodigoPlan>(inicial)
  const [empresa, setEmpresa] = useState('')
  const [slugManual, setSlugManual] = useState<string | null>(null)
  const [nit, setNit] = useState('')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  // El slug se sugiere a partir del nombre hasta que el usuario lo edite.
  const slug = slugManual ?? slugify(empresa)
  const formatoValido = slug.length >= 3 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)
  // Disponibilidad del slug, con una pequeña espera para no consultar en cada tecla.
  const slugConsultado = useDebounced(slug, 350)
  const disponibilidad = useQuery({
    queryKey: ['saas', 'slug', slugConsultado],
    queryFn: () => saasApi.slugDisponible(slugConsultado),
    enabled: formatoValido && slugConsultado === slug,
    staleTime: 30_000,
  })
  const slugEstado: SlugEstado = !slug ? 'vacio'
    : !formatoValido ? 'invalido'
    : slugConsultado !== slug || disponibilidad.isFetching ? 'revisando'
    : disponibilidad.data ? (disponibilidad.data.disponible ? 'libre' : 'ocupado')
    : 'vacio'

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (enviando || slugEstado === 'ocupado' || slugEstado === 'invalido') return
    setError('')
    setEnviando(true)
    try {
      const user = await saasApi.registrar({
        nombre: empresa.trim(), slug, nit: nit.trim() || undefined, codigoPlan: plan,
        admin: { nombre: nombre.trim(), apellido: apellido.trim() || undefined, email: email.trim(), password },
      })
      navigate(getSessionPath(user.rol), { replace: true })
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setEnviando(false)
    }
  }

  const ayudaSlug: Record<SlugEstado, string> = {
    vacio: 'Se usa en la dirección de tu tienda online.',
    revisando: 'Comprobando disponibilidad…',
    libre: 'Disponible.',
    ocupado: 'Ya está en uso. Prueba con otro.',
    invalido: 'Mínimo 3 caracteres: minúsculas, números y guiones.',
  }

  return <div className={styles.page}>
    <header className={styles.top}>
      <Link to="/" className={styles.brand} aria-label="FashionStore SaaS, inicio"><LayoutGrid size={20} aria-hidden="true" />FashionStore<span>SaaS</span></Link>
      <Link to="/#planes" className={styles.back}><ArrowLeft size={16} aria-hidden="true" /> Volver a los planes</Link>
    </header>

    <main className={styles.main}>
      <h1>Registra tu empresa</h1>
      <p className={styles.lead}>En un minuto tu empresa queda lista y entras a tu panel como administrador.</p>

      {error && <div className={styles.error} role="alert">{error}</div>}

      <form onSubmit={enviar} className={styles.form} aria-busy={enviando}>
        <fieldset className={styles.block}>
          <legend>1. Elige tu plan</legend>
          {planes.isLoading && <p className={styles.help}>Cargando planes…</p>}
          <div className={styles.planes} role="radiogroup" aria-label="Plan">
            {planes.data?.map(p => {
              const activo = plan === p.codigo
              return <button key={p.codigo} type="button" role="radio" aria-checked={activo}
                className={`${styles.planOpt} ${activo ? styles.planOptActive : ''}`} onClick={() => setPlan(p.codigo)}>
                <span className={styles.planName}>{p.nombre}{activo && <Check size={16} aria-hidden="true" />}</span>
                <span className={styles.planPrice}>Bs {p.precioReferencia.toLocaleString('es-BO')} / mes</span>
                <span className={styles.planMeta}>
                  {p.maxSucursales == null ? 'Sucursales ilimitadas' : `${p.maxSucursales} sucursales`} · {p.maxUsuarios == null ? 'empleados ilimitados' : `${p.maxUsuarios} empleados`}
                  {p.features.aiReports ? ' · IA' : ''}
                </span>
              </button>
            })}
          </div>
        </fieldset>

        <fieldset className={styles.block}>
          <legend>2. Datos de la empresa</legend>
          <label className={styles.field}>Nombre comercial
            <input value={empresa} onChange={e => setEmpresa(e.target.value)} required maxLength={150} placeholder="Ej. Bella Moda" disabled={enviando} autoComplete="organization" />
          </label>
          <label className={styles.field}>Dirección de tu tienda
            <span className={styles.slugBox}>
              <span className={styles.slugPrefix}>/t/</span>
              <input value={slug} onChange={e => setSlugManual(slugify(e.target.value))} required minLength={3} maxLength={60}
                aria-describedby="slug-ayuda" aria-invalid={slugEstado === 'ocupado' || slugEstado === 'invalido'} disabled={enviando} placeholder="bella-moda" />
            </span>
            <span id="slug-ayuda" className={`${styles.help} ${slugEstado === 'libre' ? styles.ok : ''} ${slugEstado === 'ocupado' || slugEstado === 'invalido' ? styles.bad : ''}`} aria-live="polite">{ayudaSlug[slugEstado]}</span>
          </label>
          <label className={styles.field}><span>NIT <span className={styles.optional}>(opcional)</span></span>
            <input value={nit} onChange={e => setNit(e.target.value)} maxLength={30} inputMode="numeric" disabled={enviando} />
          </label>
        </fieldset>

        <fieldset className={styles.block}>
          <legend>3. Administrador de la empresa</legend>
          <div className={styles.row}>
            <label className={styles.field}>Nombre
              <input value={nombre} onChange={e => setNombre(e.target.value)} required maxLength={100} disabled={enviando} autoComplete="given-name" />
            </label>
            <label className={styles.field}><span>Apellido <span className={styles.optional}>(opcional)</span></span>
              <input value={apellido} onChange={e => setApellido(e.target.value)} maxLength={100} disabled={enviando} autoComplete="family-name" />
            </label>
          </div>
          <label className={styles.field}>Correo electrónico
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={enviando} autoComplete="email" />
          </label>
          <label className={styles.field}>Contraseña
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} disabled={enviando} autoComplete="new-password" placeholder="Al menos 6 caracteres" />
          </label>
        </fieldset>

        <button type="submit" className={styles.submit} disabled={enviando || slugEstado === 'ocupado' || slugEstado === 'invalido'}>
          {enviando ? <><Loader2 size={18} className={styles.spin} aria-hidden="true" /> Creando tu empresa…</> : 'Contratar y crear mi empresa'}
        </button>
        <p className={styles.note}>Contratación simulada: el plan se activa al instante, sin cobro real. Puedes cambiarlo después desde "Mi plan".</p>
      </form>
    </main>
  </div>
}
