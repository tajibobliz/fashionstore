import { api } from './axios'

export const uploadsApi = {
  async uploadTryOn(file: File) {
    const body = new FormData()
    body.append('file', file)
    const response = await api.post<{ url: string }>('/uploads/tryon', body)
    return response.data
  },
}
