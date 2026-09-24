import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { branchesApi } from '../../api/branches.api'
import { catalogApi } from '../../api/catalog.api'
import { inventoryApi } from '../../api/inventory.api'
import { queryKeys } from '../../api/queryKeys'
import { warehousesApi } from '../../api/warehouses.api'
import { useAuth } from '../../hooks/useAuth'
import type { CatalogItem, CreateProductoRequest, Producto, Variante } from '../../types/catalog'
import type { CreateInventarioRequest } from '../../types/inventory'
import { getApiErrorMessage } from '../../utils/apiError'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import styles from './CatalogManagement.module.css'

export default function CatalogManagement() {
  const { user } = useAuth()
  const national = user?.rol === 'ADMIN' || user?.rol === 'ENCARGADO'
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Producto | null>(null)
  const [branchId, setBranchId] = useState(0)
  const [imageVariant, setImageVariant] = useState<Variante | null>(null)
  const categories = useQuery({ queryKey: queryKeys.catalog.categories, queryFn: catalogApi.categories.list })
  const sizes = useQuery({ queryKey: queryKeys.catalog.sizes, queryFn: catalogApi.sizes.list })
  const colors = useQuery({ queryKey: queryKeys.catalog.colors, queryFn: catalogApi.colors.list })
  const products = useQuery({ queryKey: queryKeys.catalog.products, queryFn: catalogApi.products.list })
  const variants = useQuery({ queryKey: queryKeys.catalog.variants, queryFn: catalogApi.variants.list })
  const variantImages = useQuery({ queryKey: queryKeys.catalog.variantImages(imageVariant?.idVariante ?? 0), queryFn: () => catalogApi.variantImages.list(imageVariant!.idVariante), enabled: !!imageVariant })
  const inventory = useQuery({ queryKey: queryKeys.inventory.all, queryFn: inventoryApi.list })
  const warehouses = useQuery({ queryKey: queryKeys.warehouses.all, queryFn: warehousesApi.list })
  const branches = useQuery({ queryKey: queryKeys.branches.all, queryFn: branchesApi.branches.list, enabled: national })
  const allQueries = [categories, sizes, colors, products, variants, inventory, warehouses]
  const branchOptions = national ? (branches.data ?? []) : uniqueBranches((warehouses.data ?? []).flatMap(item => item.sucursal ? [item.sucursal] : []))
  const warehouseOptions = (warehouses.data ?? []).filter(item => item.sucursal?.idSucursal === branchId)

  const master = useMutation({
    mutationFn: ({ kind, body }: { kind: 'category' | 'size' | 'color'; body: CatalogItem }) => kind === 'category' ? catalogApi.categories.create(body) : kind === 'size' ? catalogApi.sizes.create(body) : catalogApi.colors.create(body),
    onSuccess: async (_data, variables) => {
      setFeedback('Dato de catálogo creado correctamente.')
      setError('')
      const key = variables.kind === 'category' ? queryKeys.catalog.categories : variables.kind === 'size' ? queryKeys.catalog.sizes : queryKeys.catalog.colors
      await queryClient.invalidateQueries({ queryKey: key })
    },
    onError: value => setError(getApiErrorMessage(value)),
  })
  const saveProduct = useMutation({
    mutationFn: (body: CreateProductoRequest) => editing ? catalogApi.products.update(editing.idProducto, body) : catalogApi.products.create(body),
    onSuccess: async () => { setFeedback(editing ? 'Producto actualizado correctamente.' : 'Producto creado correctamente.'); setError(''); setEditing(null); await queryClient.invalidateQueries({ queryKey: queryKeys.catalog.products }) },
    onError: value => setError(getApiErrorMessage(value)),
  })
  const createVariant = useMutation({
    mutationFn: catalogApi.variants.create,
    onSuccess: async () => { setFeedback('Variante creada correctamente.'); setError(''); await queryClient.invalidateQueries({ queryKey: queryKeys.catalog.variants }) },
    onError: value => setError(getApiErrorMessage(value)),
  })
  const saveInventory = useMutation({
    mutationFn: (body: CreateInventarioRequest) => {
      const existing = (inventory.data ?? []).find(item => (item.almacen?.idAlmacen ?? item.idAlmacen) === body.idAlmacen && (item.variante?.idVariante ?? item.idVariante) === body.idVariante)
      return existing ? inventoryApi.update(existing.idInventario, body) : inventoryApi.create(body)
    },
    onSuccess: async () => { setFeedback('Inventario guardado correctamente.'); setError(''); await queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }) },
    onError: value => setError(getApiErrorMessage(value)),
  })
  const refreshVariantImages = async () => {
    if (imageVariant) await queryClient.invalidateQueries({ queryKey: queryKeys.catalog.variantImages(imageVariant.idVariante) })
    await queryClient.invalidateQueries({ queryKey: queryKeys.catalog.variants })
  }
  const addVariantImage = useMutation({ mutationFn: (body: { url: string; principal: boolean }) => catalogApi.variantImages.create(imageVariant!.idVariante, body), onSuccess: async () => { setFeedback('Imagen agregada correctamente.'); setError(''); await refreshVariantImages() }, onError: value => setError(getApiErrorMessage(value)) })
  const setPrincipalImage = useMutation({ mutationFn: (idImagen: number) => catalogApi.variantImages.setPrincipal(imageVariant!.idVariante, idImagen), onSuccess: refreshVariantImages, onError: value => setError(getApiErrorMessage(value)) })
  const removeVariantImage = useMutation({ mutationFn: (idImagen: number) => catalogApi.variantImages.remove(imageVariant!.idVariante, idImagen), onSuccess: refreshVariantImages, onError: value => setError(getApiErrorMessage(value)) })

  if (allQueries.some(query => query.isLoading) || (national && branches.isLoading)) return <div className={dashboardStyles.chartLoading} role="status">Cargando catálogo e inventario…</div>
  const queryError = allQueries.find(query => query.error)?.error ?? branches.error
  if (queryError) return <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(queryError)}</p>

  return <section className={dashboardStyles.content}>
    <div className={dashboardStyles.pageHeading}><div><p className={dashboardStyles.kicker}>Catálogo e inventario</p><h1>Productos vendibles</h1><p>Crea los datos básicos, la variante y su existencia por almacén.</p></div></div>
    {feedback && <p className={dashboardStyles.successNotice} role="status">{feedback}</p>}{error && <p className={dashboardStyles.errorNotice} role="alert">{error}</p>}
    <div className={styles.grid}><MasterPanel title="Categorías" label="Nueva categoría" items={categories.data ?? []} onCreate={nombre => master.mutate({ kind: 'category', body: { nombre } })} /><MasterPanel title="Tallas" label="Nueva talla" items={sizes.data ?? []} onCreate={nombre => master.mutate({ kind: 'size', body: { nombre } })} /><MasterPanel title="Colores" label="Nuevo color" items={colors.data ?? []} onCreate={nombre => master.mutate({ kind: 'color', body: { nombre } })} /></div>
    <div className={styles.grid}>
      <section className={styles.panel}><h2>{editing ? 'Editar producto' : 'Crear producto'}</h2><form key={editing?.idProducto ?? 'new'} className={styles.form} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); saveProduct.mutate({ idCategoria: Number(data.get('idCategoria')), nombre: String(data.get('nombre')).trim(), descripcion: optional(data, 'descripcion'), precio: Number(data.get('precio')), precioMayorista: optionalNumber(data, 'precioMayorista'), cantidadMinimaMayorista: optionalNumber(data, 'cantidadMinimaMayorista'), estado: data.get('estado') === 'on' }) }}><div className={styles.formGrid}><label>Categoría<select name="idCategoria" required defaultValue={editing?.categoria?.idCategoria ?? 0}><option value={0}>Selecciona</option>{categories.data?.map(item => <option key={item.idCategoria} value={item.idCategoria}>{item.nombre}</option>)}</select></label><label>Nombre<input name="nombre" required defaultValue={editing?.nombre ?? ''} /></label><label className={styles.wide}>Descripción<textarea name="descripcion" defaultValue={editing?.descripcion ?? ''} /></label><label>Precio minorista<input name="precio" type="number" min="0" step="0.01" required defaultValue={editing?.precio ?? ''} /></label><label>Precio mayorista<input name="precioMayorista" type="number" min="0" step="0.01" defaultValue={editing?.precioMayorista ?? ''} /></label><label>Cantidad mínima mayorista<input name="cantidadMinimaMayorista" type="number" min="1" defaultValue={editing?.cantidadMinimaMayorista ?? ''} /></label><label><span>Estado</span><input name="estado" type="checkbox" defaultChecked={editing?.estado ?? true} /></label></div><div className={styles.actions}>{editing && <button type="button" onClick={() => setEditing(null)}>Cancelar</button>}<button className="primary-button" disabled={saveProduct.isPending}>Guardar producto</button></div></form></section>
      <section className={styles.panel}><h2>Crear variante</h2><form className={styles.form} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); createVariant.mutate({ idProducto: Number(data.get('idProducto')), idTalla: optionalNumber(data, 'idTalla'), idColor: optionalNumber(data, 'idColor'), sku: String(data.get('sku')).trim() }) }}><label>Producto<select name="idProducto" required><option value="">Selecciona</option>{products.data?.map(item => <option key={item.idProducto} value={item.idProducto}>{item.nombre}</option>)}</select></label><label>Talla<select name="idTalla"><option value="">Sin talla</option>{sizes.data?.map(item => <option key={item.idTalla} value={item.idTalla}>{item.nombre}</option>)}</select></label><label>Color<select name="idColor"><option value="">Sin color</option>{colors.data?.map(item => <option key={item.idColor} value={item.idColor}>{item.nombre}</option>)}</select></label><label>SKU<input name="sku" required maxLength={80} /></label><button className="primary-button" disabled={createVariant.isPending}>Crear variante</button></form></section>
      <section className={styles.panel}><h2>Imágenes de variante</h2><label>Variante<select aria-label="Variante para imágenes" value={imageVariant?.idVariante ?? ''} onChange={event => setImageVariant((variants.data ?? []).find(item => item.idVariante === Number(event.target.value)) ?? null)}><option value="">Selecciona</option>{variants.data?.map(item => <option key={item.idVariante} value={item.idVariante}>{item.sku}</option>)}</select></label>{imageVariant && <><form className={styles.inlineForm} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); addVariantImage.mutate({ url: String(data.get('url')).trim(), principal: data.get('principal') === 'on' }); event.currentTarget.reset() }}><input name="url" aria-label="URL de imagen de variante" type="url" required placeholder="https://..." /><label><input name="principal" type="checkbox" /> Principal</label><button disabled={addVariantImage.isPending || (variantImages.data?.length ?? 0) >= 3}>Agregar</button></form>{variantImages.isLoading ? <p>Cargando imágenes...</p> : <div className={styles.imageList}>{variantImages.data?.map(image => <article key={image.idImagen} className={styles.imageItem}><img src={image.url} alt={`Imagen ${image.orden} de ${imageVariant.sku}`} /><div><strong>Orden {image.orden}</strong>{image.principal && <span> Principal</span>}<button type="button" disabled={image.principal || setPrincipalImage.isPending} onClick={() => setPrincipalImage.mutate(image.idImagen)}>Hacer principal</button><button type="button" disabled={removeVariantImage.isPending} onClick={() => removeVariantImage.mutate(image.idImagen)}>Eliminar</button></div></article>)}</div>}<p>{variantImages.data?.length ?? 0}/3 imágenes. La imagen principal se muestra primero.</p></>}</section>
      <section className={styles.panel}><h2>Cargar o ajustar stock</h2><form className={styles.form} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); saveInventory.mutate({ idSucursal: branchId, idAlmacen: Number(data.get('idAlmacen')), idVariante: Number(data.get('idVariante')), stockDisponible: Number(data.get('stockDisponible')), stockReservado: 0 }) }}><label>Sucursal<select aria-label="Sucursal de inventario" value={branchId} onChange={event => setBranchId(Number(event.target.value))} required><option value={0}>Selecciona</option>{branchOptions.map(item => <option key={item.idSucursal} value={item.idSucursal}>{item.nombre}</option>)}</select></label><label>Almacén<select name="idAlmacen" required><option value="">Selecciona</option>{warehouseOptions.map(item => <option key={item.idAlmacen} value={item.idAlmacen}>{item.nombre} ({item.codigo})</option>)}</select></label><label>Variante<select name="idVariante" required><option value="">Selecciona</option>{variants.data?.map(item => <option key={item.idVariante} value={item.idVariante}>{item.sku}</option>)}</select></label><label>Stock disponible<input name="stockDisponible" type="number" min="0" required /></label><button className="primary-button" disabled={!branchId || saveInventory.isPending}>Guardar stock</button></form></section>
    </div>
    <div className={styles.tables}><DataTable title="Productos" headers={['Producto','Categoría','Minorista','Mayorista','Mínimo','Acciones']} rows={(products.data ?? []).map(item => [item.nombre,item.categoria?.nombre ?? '—',money(item.precio),money(item.precioMayorista),String(item.cantidadMinimaMayorista ?? '—'),<button type="button" onClick={() => setEditing(item)}>Editar</button>])} /><DataTable title="Variantes con stock" headers={['SKU','Producto','Almacén','Sucursal','Stock']} rows={(inventory.data ?? []).map(item => { const variant = variants.data?.find(value => value.idVariante === (item.variante?.idVariante ?? item.idVariante)); return [variant?.sku ?? item.variante?.sku ?? '—',variant?.producto?.nombre ?? '—',item.almacen?.nombre ?? '—',item.sucursal?.nombre ?? '—',String(item.stockDisponible)] })} /></div>
  </section>
}

function MasterPanel({ title, label, items, onCreate }: { title: string; label: string; items: CatalogItem[]; onCreate: (name: string) => void }) { return <section className={styles.panel}><h2>{title}</h2><form className={styles.inlineForm} onSubmit={event => { event.preventDefault(); const input = event.currentTarget.elements.namedItem('nombre') as HTMLInputElement; if (input.value.trim()) { onCreate(input.value.trim()); input.value = '' } }}><input name="nombre" aria-label={label} required /><button>Crear</button></form><div className={styles.chips}>{items.map(item => <span key={item.idCategoria ?? item.idTalla ?? item.idColor}>{item.nombre}</span>)}</div></section> }
function DataTable({ title, headers, rows }: { title: string; headers: string[]; rows: (string | ReactNode)[][] }) { return <section className={styles.panel}><h2>{title}</h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr>{headers.map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row,index) => <tr key={index}>{row.map((value,column) => <td key={column}>{value}</td>)}</tr>) : <tr><td colSpan={headers.length}>No hay registros.</td></tr>}</tbody></table></div></section> }
function optional(data: FormData, key: string) { const value = String(data.get(key) ?? '').trim(); return value || undefined }
function optionalNumber(data: FormData, key: string) { const value = String(data.get(key) ?? '').trim(); return value ? Number(value) : undefined }
function money(value: number | string | null | undefined) { const number = Number(value); return value !== null && value !== undefined && Number.isFinite(number) ? `Bs ${number.toFixed(2)}` : '—' }
function uniqueBranches(items: import('../../types/branch').Sucursal[]) { return [...new Map(items.map(item => [item.idSucursal,item])).values()] }
