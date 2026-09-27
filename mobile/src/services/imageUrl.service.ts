import { getRuntimeApiUrl } from '@/services/apiUrl.service'

export async function resolveImageUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value
  if (!value.startsWith('/uploads/')) return value
  const apiUrl = await getRuntimeApiUrl()
  return new URL(value, `${apiUrl.replace(/\/+$/, '')}/`).toString()
}
