import { test, expect } from '@playwright/test'

const branch = { idSucursal: 4, nombre: 'Sucursal Centro', direccion: 'Av. Central', estado: true }
const warehouse = { idAlmacen: 10, codigo: 'PRINCIPAL', nombre: 'Principal Centro', estado: true, sucursal: branch }
const box = { idCaja: 2, codigo: 'C01', nombre: 'Caja Centro', estado: true, sucursal: branch, almacenDefault: warehouse }
const cashier = { idUsuario: 8, nombre: 'Lucía', apellido: 'Pérez', email: 'lucia@example.com', estado: true, rol: { nombre: 'CAJERO' } }
const shift = { idTurno: 30, caja: box, cajero: cashier, fechaApertura: '2026-09-18T12:00:00.000Z', montoApertura: '100.00', estado: 'ABIERTO' }
const product = { idProducto: 40, nombre: 'Vestido Aurora', precio: '150.00', precioMayorista: '120.00', cantidadMinimaMayorista: 2, estado: true }
const variant = { idVariante: 50, sku: 'SKU-AURORA-M-ROJO', producto: product, talla: { idTalla: 2, nombre: 'M' }, color: { idColor: 3, nombre: 'Rojo' } }
const inventory = { idInventario: 60, stockDisponible: 3, stockReservado: 0, sucursal: branch, almacen: warehouse, variante: { idVariante: 50, sku: variant.sku } }

async function openPos(page: import('@playwright/test').Page) {
  const profile = { idUsuario: 8, nombre: 'Lucía', email: 'lucia@example.com', rol: 'CAJERO' }
  await page.addInitScript(() => {
    sessionStorage.setItem('fashionstore.access_token', 'access')
    sessionStorage.setItem('fashionstore.refresh_token', 'r'.repeat(96))
  })
  await page.route('**/auth/profile', route => route.fulfill({ json: profile }))
  await page.goto('/dashboard/cajero/punto-de-venta')
}

test('POS exige un turno abierto', async ({ page }) => {
  await page.route('**/pos/turnos/actual', route => route.fulfill({ status: 404, json: { message: 'No existe turno abierto' } }))
  await openPos(page)
  await expect(page.getByRole('heading', { name: 'Turno cerrado' })).toBeVisible()
  await expect(page.getByText('Necesitas un turno abierto')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ir a Mi caja' })).toHaveAttribute('href', '/dashboard/cajero/caja')
})

test('busca variantes y gestiona el carrito POS local sin superar stock', async ({ page }) => {
  await page.route('**/pos/turnos/actual', route => route.fulfill({ json: shift }))
  await page.route('**/inventory/inventarios', route => route.fulfill({ json: [inventory] }))
  await page.route('**/catalog/variantes', route => route.fulfill({ json: [variant] }))
  await openPos(page)

  await expect(page.getByText('Sucursal Centro', { exact: true })).toBeVisible()
  await expect(page.getByText('Caja Centro', { exact: true })).toBeVisible()
  await expect(page.getByText('Principal Centro', { exact: true })).toBeVisible()
  await page.getByLabel('Buscar producto o SKU').fill('aurora')
  await expect(page.getByRole('heading', { name: 'Vestido Aurora' })).toBeVisible()

  await page.getByRole('button', { name: 'Agregar' }).click()
  await page.getByRole('button', { name: 'Agregar' }).click()
  const summary = page.getByRole('complementary')
  await expect(summary.getByText('SKU-AURORA-M-ROJO', { exact: false })).toHaveCount(1)
  await expect(summary.getByLabel('Cantidad de Vestido Aurora')).toHaveText('2')
  await summary.getByRole('button', { name: 'Aumentar Vestido Aurora' }).click()
  await expect(summary.getByLabel('Cantidad de Vestido Aurora')).toHaveText('3')
  await expect(summary.getByRole('button', { name: 'Aumentar Vestido Aurora' })).toBeDisabled()
  await summary.getByRole('button', { name: 'Disminuir Vestido Aurora' }).click()
  await expect(summary.getByLabel('Cantidad de Vestido Aurora')).toHaveText('2')

  await page.getByLabel('Modalidad comercial').selectOption('MAYORISTA')
  await expect(page.getByText('Precio mayorista: Bs 120.00 · Mínimo: 2')).toBeVisible()
  await expect(summary.getByText('2 × Bs 120.00')).toBeVisible()
  await expect(summary.getByText('Bs 240.00', { exact: true })).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Continuar al cobro' })).toBeEnabled()

  await summary.getByRole('button', { name: 'Eliminar' }).click()
  await expect(summary.getByText('Todavía no agregaste productos.')).toBeVisible()
})

test('POS reorganiza catálogo y resumen en vista móvil', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.route('**/pos/turnos/actual', route => route.fulfill({ json: shift }))
  await page.route('**/inventory/inventarios', route => route.fulfill({ json: [inventory] }))
  await page.route('**/catalog/variantes', route => route.fulfill({ json: [variant] }))
  await openPos(page)
  await expect(page.getByRole('heading', { name: 'Nueva atención' })).toBeVisible()
  await expect(page.getByRole('complementary')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('completa venta presencial en efectivo, muestra comprobante y limpia el carrito', async ({ page }) => {
  const sale = { idVenta: 91, tipoVenta: 'PRESENCIAL', modalidadComercial: 'MINORISTA', estado: 'PAGADA', total: '450.00', numeroComprobante: 'PRE-000091', fecha: '2026-09-18T14:00:00.000Z', sucursal: branch, cajero: cashier, almacen: warehouse, turno: { idTurno: 30 }, detalles: [{ idDetalleVenta: 1, cantidad: 3, precioUnitario: '150.00', subtotal: '450.00', variante: variant }] }
  let stock = 20
  let saleRequests = 0
  await page.route('**/pos/turnos/actual', route => route.fulfill({ json: shift }))
  await page.route('**/inventory/inventarios', route => route.fulfill({ json: [{ ...inventory, stockDisponible: stock }] }))
  await page.route('**/catalog/variantes', route => route.fulfill({ json: [variant] }))
  await page.route('**/sales/presencial', async route => {
    saleRequests += 1
    expect(route.request().postDataJSON()).toMatchObject({ idSucursal: 4, idCaja: 2, modalidadComercial: 'MINORISTA', detalles: [{ idVariante: 50, cantidad: 3 }] })
    stock = 17
    await new Promise(resolve => setTimeout(resolve, 150))
    await route.fulfill({ status: 201, json: sale })
  })
  await page.route('**/payments', async route => {
    expect(route.request().postDataJSON()).toMatchObject({ idVenta: 91, metodo: 'EFECTIVO', monto: 450 })
    await route.fulfill({ status: 201, json: { idPago: 101, idVenta: 91, metodo: 'EFECTIVO', monto: '450.00', estado: 'APROBADO' } })
  })
  await openPos(page)
  await page.getByLabel('Buscar producto o SKU').fill('aurora')
  await page.getByRole('button', { name: 'Agregar' }).click()
  await page.getByRole('button', { name: 'Agregar' }).click()
  await page.getByRole('button', { name: 'Agregar' }).click()
  await page.getByRole('button', { name: 'Continuar al cobro' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cobro en efectivo' })
  await expect(dialog.getByText('Vestido Aurora · SKU-AURORA-M-ROJO · 3 unidades')).toBeVisible()
  await expect(dialog.getByLabel('Método de pago')).toHaveValue('EFECTIVO')
  await dialog.getByLabel('Monto recibido').fill('500')
  await expect(dialog.getByText('Cambio estimado:')).toContainText('Bs 50.00')
  await dialog.getByRole('button', { name: 'Completar venta' }).click()
  await expect(dialog.getByRole('button', { name: 'Procesando…' })).toBeDisabled()
  await expect(page.getByRole('heading', { name: 'Comprobante' })).toBeVisible()
  expect(saleRequests).toBe(1)
  await expect(page.getByText('PRE-000091')).toBeVisible()
  await expect(page.getByText('APROBADO')).toBeVisible()
  await page.getByRole('button', { name: 'Nueva venta' }).click()
  await expect(page.getByText('Todavía no agregaste productos.')).toBeVisible()
  await page.getByLabel('Buscar producto o SKU').fill('aurora')
  await expect(page.getByText('Stock disponible:').locator('strong')).toHaveText('17')
})

test('un error de pago conserva el carrito para reintentar', async ({ page }) => {
  await page.route('**/pos/turnos/actual', route => route.fulfill({ json: shift }))
  await page.route('**/inventory/inventarios', route => route.fulfill({ json: [inventory] }))
  await page.route('**/catalog/variantes', route => route.fulfill({ json: [variant] }))
  await page.route('**/sales/presencial', route => route.fulfill({ status: 201, json: { idVenta: 92, tipoVenta: 'PRESENCIAL', modalidadComercial: 'MINORISTA', estado: 'PAGADA', total: '150.00' } }))
  await page.route('**/payments', route => route.fulfill({ status: 500, json: { message: 'No se pudo registrar el pago en efectivo' } }))
  await openPos(page)
  await page.getByLabel('Buscar producto o SKU').fill('aurora')
  await page.getByRole('button', { name: 'Agregar' }).click()
  await page.getByRole('button', { name: 'Continuar al cobro' }).click()
  await page.getByRole('button', { name: 'Completar venta' }).click()
  await expect(page.getByRole('alert')).toContainText('No se pudo registrar el pago en efectivo')
  await page.getByRole('button', { name: 'Volver' }).click()
  await expect(page.getByRole('complementary').getByLabel('Cantidad de Vestido Aurora')).toHaveText('1')
})
