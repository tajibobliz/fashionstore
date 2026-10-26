/**
 * Tienda (empresa) que se está navegando en la tienda online pública: /t/:slug.
 * El cliente HTTP la envía en el header `X-Tenant` para que el backend muestre el
 * catálogo de esa empresa. Si hay sesión iniciada, el backend usa la empresa del token.
 */
let currentSlug: string | null = null

export const storeScope = {
  get: () => currentSlug,
  set: (slug: string | null) => { currentSlug = slug },
}
