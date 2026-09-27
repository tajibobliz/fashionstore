import { api } from '../api/axios'

export function resolveImageUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value
  if (!value.startsWith('/uploads/')) return value
  const base = (api.defaults.baseURL || window.location.origin).replace(/\/+$/, '')
  return `${base}${value}`
}
