import { expect, test } from '@playwright/test'

const manager = { idUsuario: 42, nombre: 'Lucía', email: 'lucia@sucursal.test', rol: 'ENCARGADO_SUCURSAL' }
const branch = { idSucursal: 8, nombre: 'Sucursal Centro', estado: true }
const warehouse = { idAlmacen: 12, nombre: 'Almacén Principal', codigo: 'PRINCIPAL', estado: true, sucursal: branch }
const variant = { idVariante: 21, sku: 'VES-M-NEG', producto: { nombre: 'Vestido Midi' }, talla: { nombre: 'M' }, color: { nombre: 'Negro' } }

async function authenticate(page: import('@playwright/test').Page) {
  await page.addInitScript(() => sessionStorage.setItem('fashionstore.access_token', 'branch-token'))
  await page.route('**/auth/profile', route => route.fulfill({ json: manager }))
}

test('encargado de sucursal consulta y ajusta solo su inventario', async ({ page }) => {
  await authenticate(page)
  await page.route('**/inventory/inventarios', async route => {
    if (route.request().method() === 'PATCH') return route.fulfill({ json: {} })
    await route.fulfill({ json: [{ idInventario: 61, stockDisponible: 10, stockReservado: 2, sucursal: branch, almacen: warehouse, variante: { idVariante: 21, sku: 'VES-M-NEG', producto: { nombre: 'Vestido Midi' }, talla: { nombre: 'M' }, color: { nombre: 'Negro' } } }] })
  })
  await page.route('**/warehouses', route => route.fulfill({ json: [warehouse] }))
  await page.route('**/catalog/variantes', route => route.fulfill({ json: [variant] }))
  await page.goto('/dashboard/encargado-sucursal/inventario')
  await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible()
  await expect(page.getByText('Vestido Midi')).toBeVisible()
  await page.getByRole('button', { name: 'Ajustar' }).click()
  await page.getByLabel('Stock disponible').fill('15')
  await page.getByRole('button', { name: 'Guardar ajuste' }).click()
})

test('encargado de sucursal prepara sus reservas y consulta ventas', async ({ page }) => {
  await authenticate(page)
  await page.route('**/reservations', async route => {
    if (route.request().method() === 'PATCH') return route.fulfill({ json: {} })
    await route.fulfill({ json: [{ idReserva: 91, codigo: 'RES-91', estado: 'PENDIENTE', sucursal: branch, usuario: { nombre: 'Ana', email: 'ana@test.com' }, detalles: [{ cantidad: 1, variante: { idVariante: 21, sku: 'VES-M-NEG', producto: { nombre: 'Vestido Midi' }, talla: { nombre: 'M' }, color: { nombre: 'Negro' } } }] }] })
  })
  await page.goto('/dashboard/encargado-sucursal/reservas')
  await expect(page.getByText('RES-91')).toBeVisible()
  await page.getByRole('button', { name: 'Preparar' }).click()
  await page.getByRole('button', { name: 'Confirmar' }).click()

  await page.route('**/sales', route => route.fulfill({ json: [{ idVenta: 31, numeroComprobante: 'PRE-31', tipoVenta: 'PRESENCIAL', total: 150, estado: 'PAGADA', sucursal: branch, usuario: { nombre: 'Ana' }, detalles: [{ cantidad: 1, variante: { idVariante: 21, sku: 'VES-M-NEG', producto: { nombre: 'Vestido Midi' } } }] }] }))
  await page.goto('/dashboard/encargado-sucursal/ventas')
  await expect(page.getByText('PRE-31')).toBeVisible()
  await page.getByText('Ver detalle').click()
  await expect(page.getByText('Vestido Midi × 1')).toBeVisible()
})
