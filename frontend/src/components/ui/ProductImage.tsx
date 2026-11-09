import { useState } from 'react'
import { Shirt } from 'lucide-react'
import { urlImagenPrenda } from '../../utils/imagenPrenda'

export function ProductImage({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const imageUrl = urlImagenPrenda(src)
  return <div className="product-image">{imageUrl && !failed
    ? <img src={imageUrl} alt={name} loading="lazy" onError={() => setFailed(true)} />
    : <Shirt size={52} strokeWidth={1} aria-label="Imagen de prenda no disponible" />}</div>
}
