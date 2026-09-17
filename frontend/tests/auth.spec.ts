import { test, expect } from '@playwright/test'

const user = { idUsuario: 7, nombre: 'María', email: 'maria@example.com', rol: 'CLIENTE' }
const session = { access_token: 'access-one', refresh_token: 'a'.repeat(96), user }

test('home público y login funcionan en escritorio y móvil', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tu estilo. Tu esencia.')
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true })
  await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByLabel('Correo electrónico')).toBeVisible()
  await page.getByLabel('Contraseña', { exact: true }).fill('secret123')
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click()
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'text')
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true })
})

test('rutas protegidas requieren sesión y muestran error de credenciales', async ({ page }) => {
  await page.route('**/auth/login', route => route.fulfill({ status: 401, json: { message: 'Unauthorized' } }))
  await page.goto('/panel')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('Correo electrónico').fill(user.email)
  await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Correo o contraseña incorrectos')
})

test('login envía credenciales y token, restaura sesión y permite logout', async ({ page }) => {
  await page.route('**/catalog/productos', async route => {
    expect(route.request().headers().authorization).toBe('Bearer access-one')
    await route.fulfill({ json: [{ idProducto: 1, nombre: 'Vestido Aurora', precio: '250.00', estado: true }] })
  })
  await page.route('**/auth/login', async route => {
    expect(route.request().postDataJSON()).toEqual({ email: user.email, password: 'secret123' })
    await route.fulfill({ json: session })
  })
  await page.route('**/auth/profile', route => route.fulfill({ json: user }))
  await page.route('**/auth/logout', async route => {
    expect(route.request().postDataJSON()).toEqual({ refresh_token: session.refresh_token })
    await route.fulfill({ json: { message: 'Sesión cerrada' } })
  })
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(user.email)
  await page.getByLabel('Contraseña', { exact: true }).fill('secret123')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page).toHaveURL(/\/tienda$/)
  await expect(page.getByRole('heading', { name: 'Vestido Aurora' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Vestido Aurora' })).toBeVisible()
  await page.getByRole('button', { name: 'Salir' }).click()
  await expect(page).toHaveURL('http://127.0.0.1:5178/')
  expect(await page.evaluate(() => sessionStorage.getItem('fashionstore.refresh_token'))).toBeNull()
})

test('registro público crea CLIENTE y abre la tienda', async ({ page }) => {
  await page.route('**/inventory/inventarios', route => route.fulfill({ json: [] }))
  await page.route('**/catalog/productos', route => route.fulfill({ json: [] }))
  await page.route('**/auth/register', async route => {
    expect(route.request().postDataJSON()).toEqual({ nombre: 'María', email: user.email, password: 'secret123' })
    await route.fulfill({ json: session })
  })
  await page.goto('/register')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crea tu cuenta')
  await expect(page.getByText('Regístrate como cliente para comprar, reservar y acceder a la tienda.')).toBeVisible()
  await page.getByLabel('Nombre', { exact: true }).fill('María')
  await page.getByLabel('Correo electrónico').fill(user.email)
  await page.getByLabel('Contraseña', { exact: true }).fill('secret123')
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click()
  await expect(page).toHaveURL(/\/tienda$/)
})

test('token expirado se renueva y abre POS para cajero', async ({ page }) => {
  await page.route('**/catalog/productos', route => route.fulfill({ json: [] }))
  await page.addInitScript(({ access_token, refresh_token }) => {
    sessionStorage.setItem('fashionstore.access_token', access_token)
    sessionStorage.setItem('fashionstore.refresh_token', refresh_token)
  }, session)
  await page.route('**/auth/profile', route => route.request().headers().authorization === 'Bearer access-one'
    ? route.fulfill({ status: 401, json: { message: 'Unauthorized' } })
    : route.fulfill({ json: { ...user, rol: 'CAJERO' } }))
  await page.route('**/auth/refresh', async route => {
    expect(route.request().postDataJSON().refresh_token).toBe(session.refresh_token)
    await route.fulfill({ json: { ...session, access_token: 'access-two', refresh_token: 'b'.repeat(96), user: { ...user, rol: 'CAJERO' } } })
  })
  await page.route('**/inventory/inventarios', async route => {
    expect(route.request().headers().authorization).toBe('Bearer access-two')
    await route.fulfill({ json: [] })
  })
  await page.goto('/login')
  await expect(page).toHaveURL(/\/dashboard\/cajero$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard CAJERO')
  expect(await page.evaluate(() => sessionStorage.getItem('fashionstore.refresh_token'))).toBe('b'.repeat(96))
})
