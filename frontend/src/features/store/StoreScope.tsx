import { Link, Outlet, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { saasApi } from '../../api/saas.api'
import { useAuth } from '../../hooks/useAuth'
import { DEFAULT_STORE, StoreContext } from './storeContext'
import { storeScope } from './storeScope'

/**
 * Envuelve las rutas de la tienda online. Con `:slug` en la URL, todo lo de adentro
 * trabaja con esa empresa; sin slug (`/tienda`, `/login`) se usa la tienda por defecto.
 */
export default function StoreScope() {
  const { slug } = useParams()
  // Se fija durante el render para que las consultas de los hijos ya salgan con X-Tenant.
  storeScope.set(slug ?? null)
  const { user } = useAuth()
  const tienda = useQuery({ queryKey: ['saas', 'tienda', slug], queryFn: () => saasApi.tienda(slug!), enabled: !!slug, staleTime: 5 * 60_000, retry: false })

  if (!slug) return <StoreContext.Provider value={DEFAULT_STORE}><Outlet /></StoreContext.Provider>
  if (tienda.isLoading) return <main className="session-loading" role="status">Cargando tienda…</main>
  if (tienda.isError || !tienda.data) return <main className="session-loading">
    <h1>Tienda no encontrada</h1><p>La dirección /t/{slug} no corresponde a ninguna tienda activa.</p><Link to="/">Ir a FashionStore SaaS</Link>
  </main>

  const info = { slug: tienda.data.slug, nombre: tienda.data.nombre, base: `/t/${tienda.data.slug}` }
  // Con sesión de otra empresa, el backend mostraría los datos de esa otra empresa: avisar.
  const otraEmpresa = user?.idEmpresa != null && user.idEmpresa !== tienda.data.idEmpresa
  return <StoreContext.Provider value={info}>
    {otraEmpresa && <div className="store-mismatch" role="alert">
      Iniciaste sesión con una cuenta de otra tienda. Cierra sesión para comprar en <strong>{info.nombre}</strong>.
    </div>}
    <Outlet />
  </StoreContext.Provider>
}
