import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import Home from './pages/home/Home'
import AuthForm from './features/auth/components/AuthForm'
import { ProtectedRoute } from './routes/ProtectedRoute'
import Workspace from './pages/Workspace'
import DashboardLayout from './components/layout/DashboardLayout'
import Dashboard from './features/dashboard/Dashboard'
import type { DashboardRole } from './features/dashboard/config'
import { dashboardConfig } from './features/dashboard/config'
import { useAuth } from './hooks/useAuth'
import { getSessionPath } from './routes/auth'

// Carga diferida: MediaPipe y el vestidor solo se descargan al abrir /vestidor/:productoId.
const VestidorVirtual = lazy(() => import('./features/tryon/VestidorVirtual'))

function DashboardRedirect() {
 const { user } = useAuth()
 return <Navigate to={user ? getSessionPath(user.rol) : '/login'} replace />
}
export default function App() {
 const roles: DashboardRole[] = ['ADMIN', 'ENCARGADO', 'ENCARGADO_SUCURSAL', 'CAJERO']
 return <BrowserRouter><Routes>
 <Route path="/" element={<Home />} />
 <Route path="/login" element={<AuthForm key="login" mode="login" />} />
 <Route path="/register" element={<AuthForm key="register" mode="register" />} />
 <Route path="/tienda" element={<Workspace key="store" mode="store" />} />
 <Route path="/vestidor/:productoId" element={<Suspense fallback={<main className="session-loading">Cargando vestidor…</main>}><VestidorVirtual /></Suspense>} />
 <Route element={<ProtectedRoute roles={roles} />}>
 {['/dashboard', '/panel', '/pos'].map(path => <Route key={path} path={path} element={<DashboardRedirect />} />)}
 {roles.map(role => <Route key={role} element={<ProtectedRoute roles={[role]} />}>
 <Route path={`/dashboard/${dashboardConfig[role].slug}`} element={<DashboardLayout key={role} role={role} />}>
 <Route index element={<Dashboard key={`${role}-home`} role={role} />} />
 <Route path=":section" element={<Dashboard key={role} role={role} />} />
 </Route></Route>)}
 </Route>
 <Route path="*" element={<main className="session-loading"><h1>Página no encontrada</h1><Link to="/">Volver a Fashionstore</Link></main>} />
 </Routes></BrowserRouter>
}
