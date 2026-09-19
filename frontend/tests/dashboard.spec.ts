import { test, expect } from '@playwright/test'
const cases = [
 { role: 'ADMIN', path: '/dashboard/admin', menu: 'Usuarios y roles' },
 { role: 'ENCARGADO', path: '/dashboard/encargado', menu: 'Mi equipo de cajeros' },
 { role: 'ENCARGADO_SUCURSAL', path: '/dashboard/encargado-sucursal', menu: 'Inventario' },
 { role: 'CAJERO', path: '/dashboard/cajero', menu: 'Clientes y proveedores' },
 { role: 'CLIENTE', path: '/tienda', menu: '' },
 { role: 'PROVEEDOR', path: '/', menu: '' },
]
for (const entry of cases) {
 test(`login y permisos de dashboard para ${entry.role}`, async ({ page }) => {
  const user = { idUsuario: 10, email: 'rol@example.com', nombre: 'Ana', rol: entry.role }
  const forbidden: string[] = []
  await page.route('**/auth/login', route => route.fulfill({ json: { access_token: 'access', refresh_token: 'a'.repeat(96), user } }))
  await page.route('**/auth/profile', route => route.fulfill({ json: user }))
  await page.route(/^http:\/\/localhost:3000\/catalog\//, route => route.fulfill({ json: [] }))
  await page.route(/^http:\/\/localhost:3000\/branches\//, route => route.fulfill({ json: [] }))
  await page.route(/^http:\/\/localhost:3000\/inventory\//, route => route.fulfill({ json: [] }))
  await page.route('**/users', route => { if (entry.role !== 'ADMIN') forbidden.push(route.request().url()); return route.fulfill({ json: [] }) })
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(user.email)
  await page.getByLabel('Contraseña', { exact: true }).fill('secret123')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(entry.path + '$'))
  if (entry.menu) {
   await expect(page.getByRole('navigation', { name: 'Menú del dashboard' }).getByRole('link', { name: entry.menu })).toBeVisible()
   await expect(page.getByRole('heading', { level: 1 })).toHaveText(entry.role === 'ENCARGADO_SUCURSAL' ? 'Panel de Sucursal' : `Dashboard ${entry.role}`)
   await expect(page.getByRole('status')).toHaveCount(0)
   await page.screenshot({ path: `test-results/dashboard-${entry.role}.png`, fullPage: true })
   await page.setViewportSize({ width: 390, height: 844 })
   await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
   await page.getByRole('button', { name: 'Abrir menú' }).click()
   await page.getByRole('navigation', { name: 'Menú del dashboard' }).getByRole('link', { name: entry.menu }).click()
   if (entry.role === 'ENCARGADO' || entry.role === 'CAJERO') await expect(page.getByRole('button', { name: 'Registrar usuario' })).toBeVisible()
  } else await expect(page.getByRole('navigation', { name: 'Menú del dashboard' })).toHaveCount(0)
  for (const other of cases.filter(item => item.menu && item.role !== entry.role)) {
   await page.goto(other.path)
   await expect(page).toHaveURL(new RegExp(entry.path + '$'))
  }
  expect(forbidden).toEqual([])
 })
}

for (const actor of ['ENCARGADO', 'CAJERO']) {
 test(`${actor} registra CLIENTE y PROVEEDOR sin cambiar su sesión`, async ({ page }) => {
  const user = { idUsuario: 11, email: 'equipo@example.com', nombre: 'Ana', rol: actor }
  await page.route('**/auth/login', route => route.fulfill({ json: { access_token: 'staff-access', refresh_token: 'a'.repeat(96), user } }))
  await page.route(/^http:\/\/localhost:3000\/catalog\//, route => route.fulfill({ json: [] }))
  await page.route(/^http:\/\/localhost:3000\/inventory\//, route => route.fulfill({ json: [] }))
  const submitted: string[] = []
  await page.route('**/users', async route => {
   expect(route.request().method()).toBe('POST')
   expect(route.request().headers().authorization).toBe('Bearer staff-access')
   const input = route.request().postDataJSON()
   submitted.push(input.rolNombre)
   await route.fulfill({ json: { idUsuario: 12, nombre: input.nombre, email: input.email, rol: input.rolNombre } })
  })
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(user.email)
  await page.getByLabel('Contraseña', { exact: true }).fill('secret123')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await page.getByRole('navigation', { name: 'Menú del dashboard' }).getByRole('link', { name: 'Clientes y proveedores' }).click()
  for (const role of ['CLIENTE', 'PROVEEDOR']) {
   await page.getByLabel('Rol', { exact: true }).selectOption(role)
   await page.getByLabel('Nombre', { exact: true }).fill('Nuevo usuario')
   await page.getByLabel('Correo electrónico').fill('nuevo@example.com')
   await page.getByLabel('Contraseña inicial').fill('secret123')
   await page.getByRole('button', { name: 'Registrar usuario' }).click()
   await expect(page.getByRole('status')).toContainText(`rol ${role}`)
  }
  expect(submitted).toEqual(['CLIENTE', 'PROVEEDOR'])
  expect(await page.evaluate(() => sessionStorage.getItem('fashionstore.access_token'))).toBe('staff-access')
 })
}
