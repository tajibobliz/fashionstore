import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { Role } from '../features/auth/types'
import { getSessionPath } from './auth'

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <div className="session-loading" role="status">Comprobando tu sesión…</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (roles && !roles.includes(user.rol)) return <Navigate to={getSessionPath(user.rol)} replace />
  return <Outlet />
}
