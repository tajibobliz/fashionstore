import { useState } from 'react'
import { Shirt } from 'lucide-react'
import { api } from '../../api/axios'

export function ProductImage({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false)
  let imageUrl: string | undefined
  try {
    if (src) {
      const url = new URL(src, api.defaults.baseURL)
      if (url.protocol === 'https:' || url.protocol === 'http:') imageUrl = url.href
    }
  } catch { /* Usar el icono cuando la URL no sea válida. */ }
  return <div className="product-image">{imageUrl && !failed
    ? <img src={imageUrl} alt={name} loading="lazy" onError={() => setFailed(true)} />
    : <Shirt size={52} strokeWidth={1} aria-label="Imagen de prenda no disponible" />}</div>
}
