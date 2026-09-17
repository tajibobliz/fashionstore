import { test, expect } from '@playwright/test'

const center = { idSucursal: 4, nombre: 'Sucursal Centro', direccion: 'Av. Central', estado: true }
const north = { idSucursal: 5, nombre: 'Sucursal Norte', direccion: 'Av. Norte', estado: true }
const centerWarehouse = { idAlmacen: 10, codigo: 'PRINCIPAL', nombre: 'Principal Centro', estado: true, sucursal: center }
const centerFloor = { idAlmacen: 11, codigo: 'PISO', nombre: 'Piso Venta Centro', estado: true, sucursal: center }
const northWarehouse = { idAlmacen: 20, codigo: 'PRINCIPAL', nombre: 'Principal Norte', estado: true, sucursal: north }

async function openBoxes(page: import('@playwright/test').Page, role: 'ADMIN' | 'ENCARGADO_SUCURSAL') {
  const user = { idUsuario: role === 'ADMIN' ? 1 : 7, nombre: role, email: `${role.toLowerCase()}@example.com`, rol: role }
  await page.addInitScript(() => {
    sessionStorage.setItem('fashionstore.access_token', 'access')
    sessionStorage.setItem('fashionstore.refresh_token', 'r'.repeat(96))
  })
  await page.route('**/auth/profile', route => route.fulfill({ json: user }))
  await page.goto(role === 'ADMIN' ? '/dashboard/admin/cajas' : '/dashboard/encargado-sucursal/cajas')
}

test('ADMIN lista, crea, edita y desactiva cajas con almacenes filtrados', async ({ page }) => {
  let boxes = [{ idCaja: 2, codigo: 'C01', nombre: 'Caja Centro', estado: true, sucursal: center, almacenDefault: centerWarehouse }]
  await page.route('**/branches/sucursales', route => route.fulfill({ json: [center, north] }))
  await page.route('**/warehouses', route => route.fulfill({ json: [centerWarehouse, centerFloor, northWarehouse] }))
  await page.route('**/pos/cajas', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      expect(body).toMatchObject({ idSucursal: 4, idAlmacenDefault: 11, codigo: 'C02', nombre: 'Caja Secundaria', estado: true })
      const created = { idCaja: 3, ...body, sucursal: center, almacenDefault: centerFloor }
      boxes = [...boxes, created]
      return route.fulfill({ status: 201, json: created })
    }
    return route.fulfill({ json: boxes })
  })
  await page.route('**/pos/cajas/*', async route => {
    const id = Number(route.request().url().split('/').pop())
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON()
      boxes = boxes.map(box => box.idCaja === id ? { ...box, ...body } : box)
      return route.fulfill({ json: boxes.find(box => box.idCaja === id) })
    }
    if (route.request().method() === 'DELETE') {
      boxes = boxes.map(box => box.idCaja === id ? { ...box, estado: false } : box)
      return route.fulfill({ json: boxes.find(box => box.idCaja === id) })
    }
    return route.fulfill({ json: boxes.find(box => box.idCaja === id) })
  })

  await openBoxes(page, 'ADMIN')
  await expect(page.getByRole('heading', { name: 'Cajas' })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'C01' })).toContainText('Principal Centro')
  await page.getByRole('button', { name: 'Nueva caja' }).click()
  await page.getByLabel('Sucursal').selectOption('4')
  await expect(page.getByLabel('Almacén predeterminado').locator('option')).toHaveText(['Sin almacén predeterminado', 'Principal Centro', 'Piso Venta Centro'])
  await page.getByLabel('Almacén predeterminado').selectOption('11')
  await page.getByLabel('Sucursal').selectOption('5')
  await expect(page.getByLabel('Almacén predeterminado')).toHaveValue('0')
  await expect(page.getByLabel('Almacén predeterminado').locator('option')).toHaveText(['Sin almacén predeterminado', 'Principal Norte'])
  await page.getByLabel('Sucursal').selectOption('4')
  await page.getByLabel('Almacén predeterminado').selectOption('11')
  await page.getByLabel('Código').fill('C02')
  await page.getByLabel('Nombre').fill('Caja Secundaria')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('status')).toContainText('Caja creada correctamente')

  await page.getByRole('row').filter({ hasText: 'C02' }).getByRole('button', { name: 'Editar' }).click()
  await page.getByLabel('Nombre').fill('Caja Secundaria Actualizada')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('status')).toContainText('Caja actualizada correctamente')
  await page.getByRole('row').filter({ hasText: 'C02' }).getByRole('button', { name: 'Desactivar' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('¿Deseas desactivar la caja Caja Secundaria Actualizada?')
  await page.getByRole('button', { name: 'Confirmar desactivación' }).click()
  await expect(page.getByRole('status')).toContainText('Caja desactivada correctamente')
  await expect(page.getByRole('row').filter({ hasText: 'C02' })).toContainText('Inactiva')
})

test('ENCARGADO_SUCURSAL lista y crea en su ámbito sin editar ni desactivar', async ({ page }) => {
  let boxes = [{ idCaja: 2, codigo: 'C01', nombre: 'Caja Centro', estado: true, sucursal: center, almacenDefault: centerWarehouse }]
  await page.route('**/warehouses', route => route.fulfill({ json: [centerWarehouse, centerFloor] }))
  await page.route('**/pos/cajas', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      expect(body.idSucursal).toBe(4)
      const created = { idCaja: 3, ...body, sucursal: center, almacenDefault: centerFloor }
      boxes = [...boxes, created]
      return route.fulfill({ status: 201, json: created })
    }
    return route.fulfill({ json: boxes })
  })

  await openBoxes(page, 'ENCARGADO_SUCURSAL')
  await expect(page.getByRole('cell', { name: 'Caja Centro' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Desactivar' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Nueva caja' }).click()
  await expect(page.getByLabel('Sucursal').locator('option')).toHaveText(['Selecciona una sucursal', 'Sucursal Centro'])
  await page.getByLabel('Almacén predeterminado').selectOption('11')
  await page.getByLabel('Código').fill('C02')
  await page.getByLabel('Nombre').fill('Caja de Piso')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('status')).toContainText('Caja creada correctamente')
})

test('formulario de caja es responsive en vista móvil', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.route('**/pos/cajas', route => route.fulfill({ json: [] }))
  await page.route('**/warehouses', route => route.fulfill({ json: [centerWarehouse] }))
  await page.route('**/branches/sucursales', route => route.fulfill({ json: [center] }))
  await openBoxes(page, 'ADMIN')
  await page.getByRole('button', { name: 'Nueva caja' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
