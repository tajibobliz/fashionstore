import { expect, test } from '@playwright/test'

const center = { idSucursal: 4, nombre: 'Sucursal Centro', direccion: 'Av. Central', estado: true }
const north = { idSucursal: 5, nombre: 'Sucursal Norte', direccion: 'Av. Norte', estado: true }
const warehouse = { idAlmacen: 10, codigo: 'PRINCIPAL', nombre: 'Principal Centro', estado: true, sucursal: center }
const box = { idCaja: 2, codigo: 'C01', nombre: 'Caja 01', estado: true, sucursal: center, almacenDefault: warehouse }
const cashier = { idUsuario: 8, nombre: 'Lucía', apellido: 'Pérez', email: 'lucia@example.com', estado: true, rol: { nombre: 'CAJERO' } }

async function authenticate(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('fashionstore.access_token', 'access')
    sessionStorage.setItem('fashionstore.refresh_token', 'r'.repeat(96))
  })
  await page.route('**/auth/profile', route => route.fulfill({ json: { ...cashier, rol: 'CAJERO' } }))
}

test('CAJERO abre y cierra su turno desde Mi turno', async ({ page }) => {
  await authenticate(page)
  let shift: Record<string, unknown> | null = null
  await page.route('**/pos/turnos/actual', route => shift ? route.fulfill({ json: shift }) : route.fulfill({ status: 404, json: { message: 'No existe turno abierto' } }))
  await page.route('**/branches/sucursales', route => route.fulfill({ json: [center, north] }))
  await page.route('**/pos/cajas/sucursal/4', route => route.fulfill({ json: [box] }))
  await page.route('**/pos/cajas/sucursal/5', route => route.fulfill({ status: 403, json: { message: 'No tienes una asignación activa para esta sucursal' } }))
  await page.route('**/pos/turnos/abrir', async route => {
    expect(route.request().postDataJSON()).toEqual({ idCaja: 2, montoApertura: 100 })
    shift = { idTurno: 30, caja: box, cajero: cashier, fechaApertura: '2026-09-18T12:00:00.000Z', montoApertura: '100.00', estado: 'ABIERTO' }
    await route.fulfill({ json: shift })
  })
  await page.route('**/pos/turnos/30/cerrar', async route => {
    expect(route.request().postDataJSON()).toEqual({ montoCierreDeclarado: 125 })
    const closed = { ...shift, estado: 'CERRADO', montoCierreEsperado: '120.00', montoCierreDeclarado: '125.00', diferencia: '5.00' }
    shift = null
    await route.fulfill({ json: closed })
  })

  await page.goto('/dashboard/cajero')
  const navigation = page.getByRole('navigation', { name: 'Menú del dashboard' })
  await expect(navigation.getByRole('link', { name: 'Mi turno' })).toBeVisible()
  await expect(navigation.getByRole('link', { name: 'Cajas', exact: true })).toHaveCount(0)
  await navigation.getByRole('link', { name: 'Mi turno' }).click()

  await expect(page.getByRole('heading', { name: 'Abrir turno' })).toBeVisible()
  await expect(page.getByLabel('Caja')).toHaveText(/Caja 01.*Sucursal Centro/)
  await expect(page.getByLabel('Caja')).not.toContainText('Sucursal Norte')
  await page.getByLabel('Caja').selectOption('2')
  await page.getByLabel('Monto de apertura').fill('100')
  await page.getByRole('button', { name: 'Abrir turno' }).click()

  await expect(page.locator('span').getByText('ABIERTO', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ir al punto de venta' })).toHaveAttribute('href', '/dashboard/cajero/punto-de-venta')
  await page.getByRole('button', { name: 'Cerrar turno' }).click()
  await page.getByLabel('Monto de cierre declarado').fill('125')
  await page.getByRole('button', { name: 'Confirmar cierre' }).click()
  await expect(page.getByRole('status')).toContainText('Diferencia: Bs 5.00')
  await expect(page.getByRole('heading', { name: 'Abrir turno' })).toBeVisible()
})

test('Mi turno es responsive en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await authenticate(page)
  await page.route('**/pos/turnos/actual', route => route.fulfill({ status: 404, json: { message: 'No existe turno abierto' } }))
  await page.route('**/branches/sucursales', route => route.fulfill({ json: [center] }))
  await page.route('**/pos/cajas/sucursal/4', route => route.fulfill({ json: [box] }))
  await page.goto('/dashboard/cajero/caja')
  await expect(page.getByRole('heading', { name: 'Abrir turno' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
