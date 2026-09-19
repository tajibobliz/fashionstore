import { test, expect } from '@playwright/test'

async function openPersonnel(page: import('@playwright/test').Page, role: 'ADMIN' | 'ENCARGADO') {
  const user = { idUsuario: role === 'ADMIN' ? 1 : 2, nombre: role, email: `${role.toLowerCase()}@example.com`, rol: role }
  await page.addInitScript(() => {
    sessionStorage.setItem('fashionstore.access_token', 'access')
    sessionStorage.setItem('fashionstore.refresh_token', 'r'.repeat(96))
  })
  await page.route('**/auth/profile', route => route.fulfill({ json: user }))
  await page.goto(role === 'ADMIN' ? '/dashboard/admin/usuarios' : '/dashboard/encargado/personal')
}

test('ADMIN abre Usuarios, lista y crea ENCARGADO_SUCURSAL', async ({ page }) => {
  const branch = { idSucursal: 4, nombre: 'Sucursal Centro', estado: true }
  let users = [{ idUsuario: 1, nombre: 'Ana', apellido: 'Admin', email: 'ana@example.com', telefono: '70000000', estado: true, rol: { nombre: 'ADMIN' } }]
  await page.route('**/branches/sucursales', route => route.fulfill({ json: [branch] }))
  await page.route('**/users/*/sucursales', route => route.fulfill({ json: [] }))
  await page.route('**/users', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      expect(body).toMatchObject({ nombre: 'Elena', apellido: 'Rojas', email: 'elena@example.com', telefono: '71111111', rolNombre: 'ENCARGADO_SUCURSAL', idSucursales: [4] })
      const created = { idUsuario: 3, ...body, estado: true, rol: { nombre: body.rolNombre } }
      users = [...users, created]
      return route.fulfill({ status: 201, json: { idUsuario: created.idUsuario, nombre: created.nombre, email: created.email, rol: body.rolNombre } })
    }
    return route.fulfill({ json: users })
  })

  await openPersonnel(page, 'ADMIN')
  await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'Ana Admin' })).toContainText('ADMIN')
  await page.getByRole('button', { name: 'Nuevo personal' }).click()
  await page.getByLabel('Nombre').fill('Elena')
  await page.getByLabel('Apellido').fill('Rojas')
  await page.getByLabel('Correo electrónico').fill('elena@example.com')
  await page.getByLabel('Teléfono').fill('71111111')
  await page.getByLabel('Contraseña inicial').fill('secret123')
  await page.getByLabel('Rol').selectOption('ENCARGADO_SUCURSAL')
  await page.getByLabel('Sucursal asignada').selectOption('4')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Personal Elena creado correctamente' })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'Elena Rojas' })).toContainText('ENCARGADO_SUCURSAL')
})

test('ENCARGADO abre Personal, crea CAJERO y no puede seleccionar ADMIN', async ({ page }) => {
  const methods: string[] = []
  const existing = { idUsuario: 7, nombre: 'Cajero anterior', email: 'anterior@example.com', estado: true, rol: { nombre: 'CAJERO' } }
  await page.route('**/branches/sucursales', route => route.fulfill({ json: [{ idSucursal: 4, nombre: 'Sucursal Centro', estado: true }] }))
  await page.route('**/users/*/sucursales', route => route.fulfill({ json: [] }))
  await page.route('**/users', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [existing] })
    methods.push(route.request().method())
    const body = route.request().postDataJSON()
    expect(body).toMatchObject({ nombre: 'Lucía', rolNombre: 'CAJERO', idSucursales: [4] })
    return route.fulfill({ status: 201, json: { idUsuario: 8, nombre: body.nombre, email: body.email, rol: body.rolNombre } })
  })

  await openPersonnel(page, 'ENCARGADO')
  await expect(page.getByRole('heading', { name: 'Personal' })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'Cajero anterior' })).toContainText('Sin sucursales')
  await page.getByRole('button', { name: 'Nuevo personal' }).click()
  await expect(page.getByLabel('Rol').locator('option')).toHaveText(['Encargado de sucursal', 'Cajero'])
  await expect(page.getByLabel('Rol').locator('option[value="ADMIN"]')).toHaveCount(0)
  await page.getByLabel('Nombre').fill('Lucía')
  await page.getByLabel('Correo electrónico').fill('lucia@example.com')
  await page.getByLabel('Contraseña inicial').fill('secret123')
  await page.getByLabel('Rol').selectOption('CAJERO')
  await page.getByLabel('Sucursal asignada').selectOption('4')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('status')).toContainText('Personal Lucía creado correctamente')
  expect(methods).toEqual(['POST'])
})

test('muestra email duplicado y mantiene el formulario responsive en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.route('**/branches/sucursales', route => route.fulfill({ json: [{ idSucursal: 4, nombre: 'Sucursal Centro', estado: true }] }))
  await page.route('**/users', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 409, json: { message: 'El email ya está registrado' } })
    return route.fulfill({ json: [] })
  })
  await openPersonnel(page, 'ADMIN')
  await page.getByRole('button', { name: 'Nuevo personal' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByLabel('Nombre').fill('Duplicada')
  await page.getByLabel('Correo electrónico').fill('existente@example.com')
  await page.getByLabel('Contraseña inicial').fill('secret123')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('alert')).toContainText('El email ya está registrado')
  await expect(page.getByRole('dialog')).toBeVisible()
})
