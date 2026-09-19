import { test, expect } from '@playwright/test'

const center = { idSucursal: 4, nombre: 'Sucursal Centro', direccion: 'Av. Central', estado: true }
const north = { idSucursal: 5, nombre: 'Sucursal Norte', direccion: 'Av. Norte', estado: true }
const manager = { idUsuario: 7, nombre: 'Elena', apellido: 'Rojas', email: 'elena@example.com', estado: true, rol: { nombre: 'ENCARGADO_SUCURSAL' } }
const cashier = { idUsuario: 8, nombre: 'Lucía', apellido: 'Pérez', email: 'lucia@example.com', estado: true, rol: { nombre: 'CAJERO' } }

async function openUsers(page: import('@playwright/test').Page) {
  const admin = { idUsuario: 1, nombre: 'Admin', email: 'admin@example.com', rol: 'ADMIN' }
  await page.addInitScript(() => {
    sessionStorage.setItem('fashionstore.access_token', 'access')
    sessionStorage.setItem('fashionstore.refresh_token', 'r'.repeat(96))
  })
  await page.route('**/auth/profile', route => route.fulfill({ json: admin }))
  await page.goto('/dashboard/admin/usuarios')
}

test('muestra, asigna y retira sucursales de personal interno', async ({ page }) => {
  const assignments = new Map<number, { idUsuarioSucursal: number; sucursal: typeof center; estado: boolean }[]>([
    [7, [{ idUsuarioSucursal: 20, sucursal: center, estado: true }]],
    [8, []],
  ])
  await page.route('**/users', route => route.fulfill({ json: [manager, cashier] }))
  await page.route('**/branches/sucursales', route => route.fulfill({ json: [center, north] }))
  await page.route('**/users/*/sucursales', async route => {
    const id = Number(route.request().url().split('/').at(-2))
    if (route.request().method() === 'POST') {
      const { idSucursal } = route.request().postDataJSON()
      const branch = idSucursal === center.idSucursal ? center : north
      const current = assignments.get(id) ?? []
      const existing = current.find(item => item.sucursal.idSucursal === idSucursal)
      if (existing) existing.estado = true
      else current.push({ idUsuarioSucursal: 30 + id, sucursal: branch, estado: true })
      assignments.set(id, current)
      return route.fulfill({ status: 201, json: current.find(item => item.sucursal.idSucursal === idSucursal) })
    }
    return route.fulfill({ json: assignments.get(id) ?? [] })
  })
  await page.route('**/users/*/sucursales/*', async route => {
    const parts = route.request().url().split('/')
    const id = Number(parts.at(-3))
    const branchId = Number(parts.at(-1))
    const assignment = (assignments.get(id) ?? []).find(item => item.sucursal.idSucursal === branchId)
    if (assignment) assignment.estado = false
    return route.fulfill({ json: assignment })
  })

  await openUsers(page)
  const managerRow = page.getByRole('row').filter({ hasText: 'Elena Rojas' })
  await expect(managerRow).toContainText('Sucursal Centro')
  await managerRow.getByRole('button', { name: 'Asignar sucursal' }).click()
  let dialog = page.getByRole('dialog', { name: 'Asignar sucursal a Elena Rojas' })
  await expect(dialog.getByRole('combobox').locator('option')).toHaveText(['Selecciona una sucursal', 'Sucursal Norte'])
  await dialog.getByRole('combobox').selectOption('5')
  await dialog.getByRole('button', { name: 'Asignar', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Sucursal asignada a Elena Rojas correctamente')
  await expect(managerRow).toContainText('Sucursal Norte')

  const cashierRow = page.getByRole('row').filter({ hasText: 'Lucía Pérez' })
  await cashierRow.getByRole('button', { name: 'Asignar sucursal' }).click()
  dialog = page.getByRole('dialog', { name: 'Asignar sucursal a Lucía Pérez' })
  await dialog.getByRole('combobox').selectOption('4')
  await dialog.getByRole('button', { name: 'Asignar', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Sucursal asignada a Lucía Pérez correctamente')
  await expect(cashierRow).toContainText('Sucursal Centro')

  await managerRow.getByRole('button', { name: 'Retirar Sucursal Centro de Elena Rojas' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('¿Deseas retirar Sucursal Centro de Elena Rojas?')
  await page.getByRole('button', { name: 'Confirmar retiro' }).click()
  await expect(page.getByRole('status')).toContainText('Asignación retirada a Elena Rojas correctamente')
  await expect(managerRow.getByRole('button', { name: 'Retirar Sucursal Centro de Elena Rojas' })).toHaveCount(0)
})

test('presenta errores 409 y 403 de asignaciones de forma legible', async ({ page }) => {
  await page.route('**/users', route => route.fulfill({ json: [manager] }))
  await page.route('**/branches/sucursales', route => route.fulfill({ json: [center, north] }))
  await page.route('**/users/*/sucursales', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 409, json: { message: 'La sucursal ya está asignada' } })
    return route.fulfill({ json: [{ idUsuarioSucursal: 20, sucursal: center, estado: true }] })
  })
  await page.route('**/users/*/sucursales/*', route => route.fulfill({ status: 403, json: { message: 'No tienes permiso para retirar esta asignación' } }))

  await openUsers(page)
  const row = page.getByRole('row').filter({ hasText: 'Elena Rojas' })
  await row.getByRole('button', { name: 'Asignar sucursal' }).click()
  const dialog = page.getByRole('dialog', { name: 'Asignar sucursal a Elena Rojas' })
  await dialog.getByRole('combobox').selectOption('5')
  await dialog.getByRole('button', { name: 'Asignar', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('La sucursal ya está asignada')
  await page.getByRole('button', { name: 'Cerrar asignación' }).click()
  await row.getByRole('button', { name: 'Retirar Sucursal Centro de Elena Rojas' }).click()
  await page.getByRole('button', { name: 'Confirmar retiro' }).click()
  await expect(page.getByRole('alert')).toContainText('No tienes permiso para retirar esta asignación')
})

test('formulario de asignación es responsive en vista móvil', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.route('**/users', route => route.fulfill({ json: [cashier] }))
  await page.route('**/branches/sucursales', route => route.fulfill({ json: [center] }))
  await page.route('**/users/*/sucursales', route => route.fulfill({ json: [] }))
  await openUsers(page)
  await page.getByRole('button', { name: 'Asignar sucursal' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
