import { test, expect } from '@playwright/test'

test('ENCARGADO crea producto, variante y carga stock 20', async ({ page }) => {
  const manager = { idUsuario: 2, nombre: 'Encargada', email: 'encargada@example.com', rol: 'ENCARGADO' }
  const branch = { idSucursal: 4, nombre: 'Centro', direccion: 'Av. Central', estado: true }
  const warehouse = { idAlmacen: 10, codigo: 'PRINCIPAL', nombre: 'Almacén Principal', estado: true, sucursal: branch }
  const categories: Record<string, unknown>[] = []
  const sizes: Record<string, unknown>[] = []
  const colors: Record<string, unknown>[] = []
  let products: Record<string, unknown>[] = []
  let variants: Record<string, unknown>[] = []
  let inventories: Record<string, unknown>[] = []
  await page.addInitScript(() => {
    sessionStorage.setItem('fashionstore.access_token', 'access')
    sessionStorage.setItem('fashionstore.refresh_token', 'r'.repeat(96))
  })
  await page.route('**/auth/profile', route => route.fulfill({ json: manager }))
  await crudRoute(page, '**/catalog/categorias', categories, body => { const created = { idCategoria: 1, ...body }; categories.push(created); return created })
  await crudRoute(page, '**/catalog/tallas', sizes, body => { const created = { idTalla: 2, ...body }; sizes.push(created); return created })
  await crudRoute(page, '**/catalog/colores', colors, body => { const created = { idColor: 3, ...body }; colors.push(created); return created })
  await page.route('**/catalog/productos', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      expect(body).toMatchObject({ idCategoria: 1, nombre: 'Vestido Midi', precio: 150, precioMayorista: 120, cantidadMinimaMayorista: 12 })
      const created = { idProducto: 5, ...body, categoria: categories[0] }
      products = [...products, created]
      return route.fulfill({ status: 201, json: created })
    }
    return route.fulfill({ json: products })
  })
  await page.route('**/catalog/variantes', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      expect(body).toMatchObject({ idProducto: 5, idTalla: 2, idColor: 3, sku: 'VES-MIDI-M-NEG' })
      const created = { idVariante: 6, ...body, producto: products[0], talla: sizes[0], color: colors[0] }
      variants = [...variants, created]
      return route.fulfill({ status: 201, json: created })
    }
    return route.fulfill({ json: variants })
  })
  await page.route('**/inventory/inventarios', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      expect(body).toMatchObject({ idSucursal: 4, idAlmacen: 10, idVariante: 6, stockDisponible: 20 })
      const created = { idInventario: 7, ...body, sucursal: branch, almacen: warehouse, variante: variants[0] }
      inventories = [...inventories, created]
      return route.fulfill({ status: 201, json: created })
    }
    return route.fulfill({ json: inventories })
  })
  await page.route('**/warehouses', route => route.fulfill({ json: [warehouse] }))
  await page.route('**/branches/sucursales', route => route.fulfill({ json: [branch] }))

  await page.goto('/dashboard/encargado/catalogo')
  await createMaster(page, 'Categorías', 'Nueva categoría', 'Vestidos')
  await createMaster(page, 'Tallas', 'Nueva talla', 'M')
  await createMaster(page, 'Colores', 'Nuevo color', 'Negro')

  const productPanel = page.getByRole('heading', { name: 'Crear producto' }).locator('..')
  await productPanel.getByLabel('Categoría').selectOption('1')
  await productPanel.getByLabel('Nombre').fill('Vestido Midi')
  await productPanel.getByLabel('Descripción').fill('Vestido femenino midi')
  await productPanel.getByLabel('Precio minorista').fill('150')
  await productPanel.getByLabel('Precio mayorista').fill('120')
  await productPanel.getByLabel('Cantidad mínima mayorista').fill('12')
  await productPanel.getByRole('button', { name: 'Guardar producto' }).click()
  await expect(page.getByRole('cell', { name: 'Vestido Midi' })).toBeVisible()

  const variantPanel = page.getByRole('heading', { name: 'Crear variante' }).locator('..')
  await variantPanel.getByLabel('Producto').selectOption('5')
  await variantPanel.getByLabel('Talla').selectOption('2')
  await variantPanel.getByLabel('Color').selectOption('3')
  await variantPanel.getByLabel('SKU').fill('VES-MIDI-M-NEG')
  await variantPanel.getByRole('button', { name: 'Crear variante' }).click()

  const stockPanel = page.getByRole('heading', { name: 'Cargar o ajustar stock' }).locator('..')
  await stockPanel.getByLabel('Sucursal de inventario').selectOption('4')
  await stockPanel.getByLabel('Almacén').selectOption('10')
  await stockPanel.getByLabel('Variante').selectOption('6')
  await stockPanel.getByLabel('Stock disponible').fill('20')
  await stockPanel.getByRole('button', { name: 'Guardar stock' }).click()
  const stockRow = page.getByRole('row').filter({ hasText: 'VES-MIDI-M-NEG' })
  await expect(stockRow).toContainText('Vestido Midi')
  await expect(stockRow).toContainText('Almacén Principal')
  await expect(stockRow).toContainText('20')
})

async function crudRoute(page: import('@playwright/test').Page, pattern: string, rows: Record<string, unknown>[], create: (body: Record<string, unknown>) => Record<string, unknown>) {
  await page.route(pattern, async route => route.request().method() === 'POST' ? route.fulfill({ status: 201, json: create(route.request().postDataJSON()) }) : route.fulfill({ json: rows }))
}
async function createMaster(page: import('@playwright/test').Page, heading: string, label: string, value: string) {
  const panel = page.getByRole('heading', { name: heading }).locator('..')
  await panel.getByLabel(label).fill(value)
  await panel.getByRole('button', { name: 'Crear' }).click()
  await expect(panel.getByText(value, { exact: true })).toBeVisible()
}
