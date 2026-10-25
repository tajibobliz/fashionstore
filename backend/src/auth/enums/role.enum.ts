export enum Role {
  /** Administra la plataforma SaaS (empresas, planes). No pertenece a ninguna empresa. */
  SUPER_ADMIN = 'SUPER_ADMIN',
  CLIENTE = 'CLIENTE',
  /** Administrador de una empresa (tenant). */
  ADMIN = 'ADMIN',
  ENCARGADO = 'ENCARGADO',
  ENCARGADO_SUCURSAL = 'ENCARGADO_SUCURSAL',
  CAJERO = 'CAJERO',
  PROVEEDOR = 'PROVEEDOR',
}
