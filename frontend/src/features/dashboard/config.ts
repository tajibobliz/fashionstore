import { LayoutDashboard, Building2, Store, Monitor, Wallet, Users, Shirt, Package, Truck, Contact } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
export type DashboardRole = 'ADMIN' | 'ENCARGADO' | 'CAJERO'
export interface DashboardSection { id: string; label: string; icon: LucideIcon; pending?: boolean; description?: string }
export const dashboardConfig: Record<DashboardRole, { slug: string; title: string; subtitle: string; sections: DashboardSection[] }> = {
 ADMIN: { slug: 'admin', title: 'Administración del sistema', subtitle: 'Superusuario · Vista general', sections: [
 { id: '', label: 'Dashboard', icon: LayoutDashboard },
 { id: 'empresas', label: 'Empresas', icon: Building2, pending: true, description: 'Administración de las empresas registradas en Fashionstore.' },
 { id: 'usuarios', label: 'Usuarios y roles', icon: Users },
 { id: 'catalogo', label: 'Catálogo', icon: Shirt },
 { id: 'sucursales', label: 'Sucursales', icon: Store },
 { id: 'inventario', label: 'Inventario', icon: Package },
 { id: 'proveedores', label: 'Proveedores', icon: Truck },
 ] },
 ENCARGADO: { slug: 'encargado', title: 'Gestión de tu negocio', subtitle: 'Encargado · Tienda y equipo', sections: [
 { id: '', label: 'Dashboard', icon: LayoutDashboard },
 { id: 'empresa', label: 'Mi empresa', icon: Building2, pending: true, description: 'Registra los datos de tu empresa y configura tu negocio.' },
 { id: 'tiendas', label: 'Mis tiendas', icon: Store, pending: true, description: 'Crea y organiza las tiendas de tu empresa.' },
 { id: 'puntos-de-venta', label: 'Puntos de venta', icon: Monitor, pending: true, description: 'Configura los puntos de atención de tus tiendas.' },
 { id: 'cajas', label: 'Cajas', icon: Wallet, pending: true, description: 'Crea las cajas y organiza sus turnos de atención.' },
 { id: 'cajeros', label: 'Mi equipo de cajeros', icon: Users, description: 'Crea las cuentas de tus cajeros y asígnales un punto de venta.' },
 { id: 'clientes', label: 'Clientes y proveedores', icon: Contact, description: 'Registra clientes y proveedores para las sucursales de tu negocio.' },
 { id: 'catalogo', label: 'Catálogo', icon: Shirt },
 { id: 'sucursales', label: 'Sucursales', icon: Store },
 { id: 'inventario', label: 'Inventario', icon: Package },
 ] },
 CAJERO: { slug: 'cajero', title: 'Punto de venta', subtitle: 'Cajero · Atención en tienda', sections: [
 { id: '', label: 'Dashboard', icon: LayoutDashboard },
 { id: 'punto-de-venta', label: 'Atender punto de venta', icon: Monitor, pending: true, description: 'Registra la venta y realiza el cobro de las prendas seleccionadas.' },
 { id: 'caja', label: 'Mi caja', icon: Wallet, pending: true, description: 'Consulta tu caja asignada y administra la apertura y el cierre del turno.' },
 { id: 'clientes', label: 'Clientes y proveedores', icon: Contact, description: 'Registra las cuentas de clientes y proveedores vinculados a la atención de tu sucursal.' },
 { id: 'catalogo', label: 'Consultar prendas', icon: Shirt },
 { id: 'inventario', label: 'Consultar stock', icon: Package },
 ] },
}
