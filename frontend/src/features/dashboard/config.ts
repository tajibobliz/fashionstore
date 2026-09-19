import { LayoutDashboard, Store, Monitor, Wallet, Users, Shirt, Package, Truck, Contact } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
export type DashboardRole = 'ADMIN' | 'ENCARGADO' | 'ENCARGADO_SUCURSAL' | 'CAJERO'
export interface DashboardSection { id: string; label: string; icon: LucideIcon; pending?: boolean; description?: string }
export const dashboardConfig: Record<DashboardRole, { slug: string; title: string; subtitle: string; sections: DashboardSection[] }> = {
 ADMIN: { slug: 'admin', title: 'Administración del sistema', subtitle: 'Superusuario · Vista general', sections: [
 { id: '', label: 'Dashboard', icon: LayoutDashboard },
 { id: 'usuarios', label: 'Usuarios y roles', icon: Users },
 { id: 'ciudades', label: 'Ciudades', icon: Store },
 { id: 'catalogo', label: 'Catálogo', icon: Shirt },
 { id: 'sucursales', label: 'Sucursales', icon: Store },
 { id: 'inventario', label: 'Inventario', icon: Package },
 { id: 'almacenes', label: 'Almacenes', icon: Package },
 { id: 'cajas', label: 'Cajas', icon: Wallet },
 { id: 'proveedores', label: 'Proveedores', icon: Truck },
 ] },
 ENCARGADO: { slug: 'encargado', title: 'Gestión nacional', subtitle: 'Encargado · Operación nacional', sections: [
 { id: '', label: 'Dashboard', icon: LayoutDashboard },
 { id: 'gestion-nacional', label: 'Gestión nacional', icon: Store, pending: true, description: 'Coordina la operación nacional de Fashionstore.' },
 { id: 'personal', label: 'Personal', icon: Users },
 { id: 'ciudades', label: 'Ciudades', icon: Store },
 { id: 'puntos-de-venta', label: 'Puntos de venta', icon: Monitor, pending: true, description: 'Configura los puntos de atención de tus tiendas.' },
 { id: 'cajas', label: 'Cajas', icon: Wallet, pending: true, description: 'Crea las cajas y organiza sus turnos de atención.' },
 { id: 'cajeros', label: 'Mi equipo de cajeros', icon: Users, description: 'Crea las cuentas de tus cajeros y asígnales un punto de venta.' },
 { id: 'clientes', label: 'Clientes y proveedores', icon: Contact, description: 'Registra clientes y proveedores para las sucursales de tu negocio.' },
 { id: 'catalogo', label: 'Catálogo', icon: Shirt },
 { id: 'sucursales', label: 'Sucursales', icon: Store },
 { id: 'inventario', label: 'Inventario', icon: Package },
 { id: 'almacenes', label: 'Almacenes', icon: Package },
 ] },
 ENCARGADO_SUCURSAL: { slug: 'encargado-sucursal', title: 'Panel de Sucursal', subtitle: 'Encargado de sucursal · Operación territorial', sections: [
 { id: '', label: 'Inicio', icon: LayoutDashboard },
 { id: 'inventario', label: 'Inventario', icon: Package, pending: true, description: 'Consulta y gestión de inventario de tus sucursales autorizadas.' },
 { id: 'reservas', label: 'Reservas', icon: Store, pending: true, description: 'Gestión de reservas de las sucursales asignadas.' },
 { id: 'ventas', label: 'Ventas', icon: Monitor, pending: true, description: 'Consulta de ventas del ámbito asignado.' },
 { id: 'catalogo', label: 'Catálogo', icon: Shirt },
 { id: 'almacenes', label: 'Almacenes', icon: Package },
 { id: 'cajas', label: 'Cajas', icon: Wallet },
 ] },
 CAJERO: { slug: 'cajero', title: 'Punto de venta', subtitle: 'Cajero · Atención en tienda', sections: [
 { id: '', label: 'Dashboard', icon: LayoutDashboard },
 { id: 'punto-de-venta', label: 'Atender punto de venta', icon: Monitor, description: 'Prepara los productos de la venta antes de continuar al cobro.' },
 { id: 'caja', label: 'Mi turno', icon: Wallet, description: 'Abre y cierra tu turno en una caja autorizada.' },
 { id: 'clientes', label: 'Clientes y proveedores', icon: Contact, description: 'Registra las cuentas de clientes y proveedores vinculados a la atención de tu sucursal.' },
 { id: 'catalogo', label: 'Consultar prendas', icon: Shirt },
 { id: 'inventario', label: 'Consultar stock', icon: Package },
 ] },
}
