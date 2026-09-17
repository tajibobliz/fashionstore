import { test, expect } from '@playwright/test'

const branch = { idSucursal: 4, nombre: 'Sucursal Centro', direccion: 'Av. Central', estado: true }

async function openWarehouses(page: import('@playwright/test').Page, role: 'ADMIN' | 'ENCARGADO_SUCURSAL') {
  const user = { idUsuario: role === 'ADMIN' ? 1 : 7, nombre: role, email: `${role.toLowerCase()}@example.com`, rol: role }
  await page.addInitScript(() => {
    sessionStorage.setItem('fashionstore.access_token', 'access')
    sessionStorage.setItem('fashionstore.refresh_token', 'r'.repeat(96))
  })
  await page.route('**/auth/profile', route => route.fulfill({ json: user }))
  await page.goto(role === 'ADMIN' ? '/dashboard/admin/almacenes' : '/dashboard/encargado-sucursal/almacenes')
}

test('ADMIN lista, crea, edita y desactiva almacenes con confirmación', async ({ page }) => {
  let warehouses = [{ idAlmacen: 10, codigo: 'PRINCIPAL', nombre: 'Almacén Principal', estado: true, sucursal: branch }]
  await page.route('**/branches/sucursales', route => route.fulfill({ json: [branch] }))
  await page.route('**/warehouses', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      expect(body).toMatchObject({ idSucursal: 4, codigo: 'NORTE', nombre: 'Depósito Norte', estado: true })
      const created = { idAlmacen: 11, ...body, sucursal: branch }
      warehouses = [...warehouses, created]
      return route.fulfill({ status: 201, json: created })
    }
    return route.fulfill({ json: warehouses })
  })
  await page.route('**/warehouses/*', async route => {
    const id = Number(route.request().url().split('/').pop())
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON()
      warehouses = warehouses.map(item => item.idAlmacen === id ? { ...item, ...body, sucursal: branch } : item)
      return route.fulfill({ json: warehouses.find(item => item.idAlmacen === id) })
    }
    if (route.request().method() === 'DELETE') {
      warehouses = warehouses.map(item => item.idAlmacen === id ? { ...item, estado: false } : item)
      return route.fulfill({ json: warehouses.find(item => item.idAlmacen === id) })
    }
    return route.fulfill({ json: warehouses.find(item => item.idAlmacen === id) })
  })

  await openWarehouses(page, 'ADMIN')
  await expect(page.getByRole('heading', { name: 'Almacenes' })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'PRINCIPAL' })).toContainText('Sucursal Centro')

  await page.getByRole('button', { name: 'Nuevo almacén' }).click()
  await page.getByLabel('Sucursal').selectOption('4')
  await page.getByLabel('Código').fill('NORTE')
  await page.getByLabel('Nombre').fill('Depósito Norte')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('status')).toContainText('Almacén creado correctamente')
  await expect(page.getByRole('cell', { name: 'Depósito Norte' })).toBeVisible()

  const northRow = page.getByRole('row').filter({ hasText: 'NORTE' })
  await northRow.getByRole('button', { name: 'Editar' }).click()
  await page.getByLabel('Nombre').fill('Depósito Norte Actualizado')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('status')).toContainText('Almacén actualizado correctamente')
  await expect(page.getByRole('cell', { name: 'Depósito Norte Actualizado' })).toBeVisible()

  await page.getByRole('row').filter({ hasText: 'NORTE' }).getByRole('button', { name: 'Desactivar' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('¿Deseas desactivar el almacén Depósito Norte Actualizado?')
  await page.getByRole('button', { name: 'Confirmar desactivación' }).click()
  await expect(page.getByRole('status')).toContainText('Almacén desactivado correctamente')
  await expect(page.getByRole('row').filter({ hasText: 'NORTE' })).toContainText('Inactivo')
})

test('ENCARGADO_SUCURSAL ve su ámbito, puede crear y no recibe acciones nacionales', async ({ page }) => {
  let warehouses = [{ idAlmacen: 10, codigo: 'PRINCIPAL', nombre: 'Almacén Principal', estado: true, sucursal: branch }]
  await page.route('**/warehouses', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      expect(body.idSucursal).toBe(4)
      const created = { idAlmacen: 12, ...body, sucursal: branch }
      warehouses = [...warehouses, created]
      return route.fulfill({ status: 201, json: created })
    }
    return route.fulfill({ json: warehouses })
  })

  await openWarehouses(page, 'ENCARGADO_SUCURSAL')
  await expect(page.getByRole('cell', { name: 'Almacén Principal' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Desactivar' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Nuevo almacén' }).click()
  await expect(page.getByLabel('Sucursal').locator('option')).toHaveCount(2)
  await expect(page.getByLabel('Sucursal').locator('option').nth(1)).toHaveText('Sucursal Centro')
  await page.getByLabel('Código').fill('PISO')
  await page.getByLabel('Nombre').fill('Piso de venta')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('status')).toContainText('Almacén creado correctamente')
})

test('formulario de almacén es responsive en vista móvil', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.route('**/warehouses', route => route.fulfill({ json: [] }))
  await page.route('**/branches/sucursales', route => route.fulfill({ json: [branch] }))
  await openWarehouses(page, 'ADMIN')
  await page.getByRole('button', { name: 'Nuevo almacén' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
