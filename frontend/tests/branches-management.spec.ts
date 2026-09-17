import { test, expect } from '@playwright/test'

const admin = { idUsuario: 1, nombre: 'Admin', email: 'admin@example.com', rol: 'ADMIN' }

async function login(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('fashionstore.access_token', 'access')
    sessionStorage.setItem('fashionstore.refresh_token', 'r'.repeat(96))
  })
  await page.route('**/auth/profile', route => route.fulfill({ json: admin }))
  await page.goto('/dashboard/admin/sucursales')
}

test('ADMIN crea, edita y elimina una sucursal con confirmación', async ({ page }) => {
  const city = { idCiudad: 3, nombre: 'Santa Cruz' }
  let branches = [{ idSucursal: 8, nombre: 'Centro', direccion: 'Av. Principal 10', telefono: '70000000', estado: true, ciudad: city }]
  await page.route('**/branches/ciudades', route => route.fulfill({ json: [city] }))
  await page.route('**/branches/sucursales', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      expect(body).toMatchObject({ idCiudad: 3, nombre: 'Norte', direccion: 'Av. Norte 20' })
      branches = [...branches, { idSucursal: 9, ...body, ciudad: city }]
      return route.fulfill({ status: 201, json: branches[1] })
    }
    return route.fulfill({ json: branches })
  })
  await page.route('**/branches/sucursales/*', async route => {
    const id = Number(route.request().url().split('/').pop())
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON()
      branches = branches.map(branch => branch.idSucursal === id ? { ...branch, ...body, ciudad: city } : branch)
      return route.fulfill({ json: branches.find(branch => branch.idSucursal === id) })
    }
    if (route.request().method() === 'DELETE') {
      branches = branches.filter(branch => branch.idSucursal !== id)
      return route.fulfill({ json: { message: 'Sucursal eliminada' } })
    }
    return route.fulfill({ json: branches.find(branch => branch.idSucursal === id) })
  })
  await page.route('**/warehouses', route => route.fulfill({ json: [] }))
  await login(page)
  await expect(page.getByRole('heading', { name: 'Sucursales' })).toBeVisible()
  await page.getByRole('button', { name: 'Nueva sucursal' }).click()
  await page.getByLabel('Ciudad').selectOption('3')
  await page.getByLabel('Nombre').fill('Norte')
  await page.getByLabel('Dirección').fill('Av. Norte 20')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('status')).toContainText('Sucursal creada correctamente')
  await expect(page.getByRole('cell', { name: 'Norte', exact: true })).toBeVisible()

  const northRow = page.getByRole('row').filter({ hasText: 'Norte' })
  await northRow.getByRole('button', { name: 'Editar' }).click()
  await page.getByLabel('Dirección').fill('Av. Norte 25')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('status')).toContainText('Sucursal actualizada correctamente')
  await expect(page.getByRole('cell', { name: 'Av. Norte 25' })).toBeVisible()

  await page.getByRole('row').filter({ hasText: 'Norte' }).getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('¿Deseas eliminar la sucursal Norte?')
  await page.getByRole('button', { name: 'Confirmar eliminación' }).click()
  await expect(page.getByRole('status')).toContainText('Sucursal eliminada correctamente')
  await expect(page.getByRole('cell', { name: 'Norte', exact: true })).toHaveCount(0)
})

test('formulario de sucursal funciona en móvil sin desbordamiento', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.route('**/branches/ciudades', route => route.fulfill({ json: [{ idCiudad: 1, nombre: 'La Paz' }] }))
  await page.route('**/branches/sucursales', route => route.fulfill({ json: [] }))
  await login(page)
  await page.getByRole('button', { name: 'Nueva sucursal' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
