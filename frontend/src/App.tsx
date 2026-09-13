import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Home from './pages/home/Home'
import AuthForm from './features/auth/components/AuthForm'
import { ProtectedRoute } from './routes/ProtectedRoute'
import Workspace from './pages/Workspace'

export default function App() {
  return <BrowserRouter><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<AuthForm key="login" mode="login" />} />
    <Route path="/register" element={<AuthForm key="register" mode="register" />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/tienda" element={<Workspace key="store" mode="store" />} />
    </Route>
    <Route element={<ProtectedRoute roles={['ADMIN', 'ENCARGADO']} />}>
      <Route path="/panel" element={<Workspace key="admin" mode="admin" />} />
    </Route>
    <Route element={<ProtectedRoute roles={['ADMIN', 'ENCARGADO', 'CAJERO']} />}>
      <Route path="/pos" element={<Workspace key="pos" mode="pos" />} />
    </Route>
    <Route path="*" element={<main className="session-loading"><h1>Página no encontrada</h1><Link to="/">Volver a Fashionstore</Link></main>} />
  </Routes></BrowserRouter>
}
