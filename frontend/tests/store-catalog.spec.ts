import { test, expect } from '@playwright/test'
const branch = { idSucursal: 4, nombre: 'Sucursal Centro', estado: true }
const product = { idProducto: 40, nombre: 'Vestido Midi', descripcion: 'Vestido', precio: '150.00', estado: true, categoria: { idCategoria: 1, nombre: 'Vestidos' } }
const variant = { idVariante: 50, sku: 'VES-MIDI-M-NEG', estado: true, producto: product, talla: { idTalla: 2, nombre: 'M' }, color: { idColor: 3, nombre: 'Negro' } }
let details: { idDetalleCarrito: number; cantidad: number; precio: string; variante: typeof variant }[] = []
async function openStore(page: import('@playwright/test').Page) {
 details = []
 await page.addInitScript(() => { sessionStorage.setItem('fashionstore.access_token', 'access'); sessionStorage.setItem('fashionstore.refresh_token', 'r'.repeat(96)) })
 await page.route('**/auth/profile', r => r.fulfill({ json: { idUsuario: 9, nombre: 'Cliente', email: 'cliente@example.com', rol: 'CLIENTE' } }))
 await page.route('**/branches/sucursales', r => r.fulfill({ json: [branch] }))
 await page.route('**/catalog/productos', r => r.fulfill({ json: [product] })); await page.route('**/catalog/variantes', r => r.fulfill({ json: [variant] })); await page.route('**/catalog/categorias', r => r.fulfill({ json: [{ idCategoria: 1, nombre: 'Vestidos' }] })); await page.route('**/inventory/inventarios', r => r.fulfill({ json: [{ idInventario: 60, stockDisponible: 2, stockReservado: 0, sucursal: branch, variante: { idVariante: 50 } }] }))
 await page.route(/\/cart\/me(?:\?.*)?$/, async r => { if (r.request().method() === 'GET') return r.fulfill({ json: { idCarrito: 1, estado: 'ACTIVO', detalles: details } }); return r.continue() })
 await page.route('**/cart/items', async r => { const body = r.request().postDataJSON(); const found = details[0]; if (found) found.cantidad += body.cantidad; else details = [{ idDetalleCarrito: 1, cantidad: body.cantidad, precio: '150.00' , variante: variant }]; await r.fulfill({ status: 201, json: { idCarrito: 1, estado: 'ACTIVO', detalles: details } }) })
 await page.route('**/cart/items/1', async r => { if (r.request().method() === 'PATCH') { details[0].cantidad = r.request().postDataJSON().cantidad; return r.fulfill({ json: { idCarrito: 1, detalles: details } }) }; details = []; return r.fulfill({ json: { idCarrito: 1, detalles: details } }) })
 await page.route('**/reservations/me', r => r.fulfill({ json: [] }))
 await page.route('**/reservations', r => r.request().method() === 'POST' ? r.fulfill({ status: 201, json: { idReserva: 21, codigo: 'RES-21', estado: 'PENDIENTE', sucursal: branch, detalles: [{ cantidad: 1, variante: variant }] } }) : r.continue())
 await page.goto('/tienda')
}
async function addMidi(page: import('@playwright/test').Page) { await page.getByLabel('Sucursal del catalogo').selectOption('4'); await page.getByRole('button', { name: /Vestido Midi/ }).click(); await page.getByLabel('Talla').selectOption('2'); await page.getByLabel('Color').selectOption('3'); await page.getByRole('button', { name: 'VES-MIDI-M-NEG' }).click(); await page.getByLabel('Cantidad', { exact: true }).fill('1'); await page.getByRole('button', { name: 'Agregar al carrito' }).click() }
test('cliente agrega variante real, mantiene una sola linea y actualiza cantidad', async ({ page }) => { await openStore(page); await addMidi(page); await expect(page.getByText('Producto agregado al carrito.')).toBeVisible(); await page.getByRole('button', { name: /Carrito, 1/ }).click(); await expect(page.getByText('M / Negro')).toBeVisible(); await page.getByRole('button', { name: 'Aumentar VES-MIDI-M-NEG' }).click(); await expect(page.getByText('Bs 300,00').first()).toBeVisible(); await expect(page.getByRole('button', { name: 'Aumentar VES-MIDI-M-NEG' })).toBeDisabled(); await page.getByRole('button', { name: 'Disminuir VES-MIDI-M-NEG' }).click(); await expect(page.getByText('Bs 150,00').first()).toBeVisible() })
test('cliente elimina item y el carrito queda vacio en movil', async ({ page }) => { await page.setViewportSize({ width: 375, height: 812 }); await openStore(page); await addMidi(page); await page.getByRole('button', { name: /Carrito, 1/ }).click(); await page.getByRole('button', { name: 'Eliminar' }).click(); await expect(page.getByRole('heading', { name: 'Tu carrito esta vacio' })).toBeVisible(); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true) })

test('cliente reserva una variante en una sucursal con stock', async ({ page }) => { await openStore(page); await page.getByLabel('Sucursal del catalogo').selectOption('4'); await page.getByRole('button', { name: /Vestido Midi/ }).click(); await page.getByLabel('Talla').selectOption('2'); await page.getByLabel('Color').selectOption('3'); await page.getByRole('button', { name: 'VES-MIDI-M-NEG' }).click(); await page.getByLabel('Sucursal para reserva').selectOption('4'); await page.getByRole('button', { name: 'Confirmar reserva' }).click(); await expect(page.getByText('Reserva RES-21')).toBeVisible() })

test('cliente registra QR pendiente para la venta digital sin crear una segunda venta', async ({ page }) => {
 await openStore(page)
 await page.route('**/sales/from-cart', r => r.fulfill({ status: 201, json: { idVenta: 88, numeroComprobante: 'VD-88', tipoVenta: 'DIGITAL', modalidadComercial: 'MINORISTA', estado: 'PENDIENTE', total: '150.00', fecha: '2026-09-19T12:00:00.000Z', detalles: [{ idDetalleVenta: 1, cantidad: 1, precioUnitario: '150.00', subtotal: '150.00', variante: variant }] } }))
 let paymentRequests = 0
 await page.route('**/payments', r => { paymentRequests += 1; return r.fulfill({ status: 201, json: { idPago: 77, idVenta: 88, metodo: 'QR', monto: '150.00', estado: 'PENDIENTE', referenciaPasarela: 'QR-001' } }) })
 await addMidi(page)
 await page.getByRole('button', { name: /Carrito, 1/ }).click()
 await page.getByRole('button', { name: 'Continuar compra' }).click()
 await page.getByRole('button', { name: 'Confirmar compra digital' }).click()
 await page.getByRole('button', { name: 'Continuar al pago' }).click()
 await page.getByLabel('Metodo de pago').selectOption('QR')
 await page.getByLabel('Referencia de pago').fill('QR-001')
 await page.getByRole('button', { name: 'Registrar pago' }).dblclick()
 await expect(page.getByRole('heading', { name: 'Pago pendiente' }).first()).toBeVisible()
 await expect(page.getByText('El pago esta pendiente de confirmacion por el backend.')).toBeVisible()
 await expect.poll(() => paymentRequests).toBe(1)
})
