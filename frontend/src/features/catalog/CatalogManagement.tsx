import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Glasses } from 'lucide-react'
import { branchesApi } from '../../api/branches.api'
import { catalogApi } from '../../api/catalog.api'
import { uploadsApi } from '../../api/uploads.api'
import { inventoryApi } from '../../api/inventory.api'
import { queryKeys } from '../../api/queryKeys'
import { warehousesApi } from '../../api/warehouses.api'
import { useAuth } from '../../hooks/useAuth'
import type { CatalogItem, CreateProductoRequest, Producto, TipoPrendaVestidor, Variante, CreateVarianteRequest } from '../../types/catalog'
import type { CreateInventarioRequest } from '../../types/inventory'
import { getApiErrorMessage } from '../../utils/apiError'
import { resolveImageUrl } from '../../utils/imageUrl'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import styles from './CatalogManagement.module.css'

export default function CatalogManagement() {
  const { user } = useAuth()
  const national = user?.rol === 'ADMIN' || user?.rol === 'ENCARGADO'
  const branchManager = user?.rol === 'ENCARGADO_SUCURSAL'
  const canManage = national || branchManager
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Producto | null>(null)
  const [editingVariant, setEditingVariant] = useState<Variante | null>(null)
  const [selectedBranchId, setSelectedBranchId] = useState(0)
  const [imageVariant, setImageVariant] = useState<Variante | null>(null)
  const [stockVariantSearch, setStockVariantSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [variantSearch, setVariantSearch] = useState('')
  const [inventorySearch, setInventorySearch] = useState('')
  const [catalogNotice, setCatalogNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const warehouses = useQuery({ queryKey: queryKeys.warehouses.all, queryFn: warehousesApi.list })
  const branches = useQuery({ queryKey: queryKeys.branches.all, queryFn: branchesApi.branches.list, enabled: national })
  const branchOptions = useMemo(() => national ? (branches.data ?? []) : uniqueBranches((warehouses.data ?? []).flatMap(item => item.sucursal ? [item.sucursal] : [])), [branches.data, national, warehouses.data])
  const branchId = branchManager ? selectedBranchId || branchOptions[0]?.idSucursal || 0 : selectedBranchId
  const categories = useQuery({ queryKey: [...queryKeys.catalog.categories, branchManager ? branchId : 'all'], queryFn: () => branchManager ? catalogApi.categories.listByBranch(branchId) : catalogApi.categories.list(), enabled: !branchManager || branchId > 0 })
  const sizes = useQuery({ queryKey: [...queryKeys.catalog.sizes, branchManager ? branchId : 'all'], queryFn: () => branchManager ? catalogApi.sizes.listByBranch(branchId) : catalogApi.sizes.list(), enabled: !branchManager || branchId > 0 })
  const colors = useQuery({ queryKey: [...queryKeys.catalog.colors, branchManager ? branchId : 'all'], queryFn: () => branchManager ? catalogApi.colors.listByBranch(branchId) : catalogApi.colors.list(), enabled: !branchManager || branchId > 0 })
  const products = useQuery({ queryKey: [...queryKeys.catalog.products, branchManager ? branchId : 'all'], queryFn: () => branchManager ? catalogApi.products.listByBranch(branchId) : catalogApi.products.list(), enabled: !branchManager || branchId > 0 })
  const variants = useQuery({ queryKey: [...queryKeys.catalog.variants, branchManager ? branchId : 'all'], queryFn: () => branchManager ? catalogApi.variants.listByBranch(branchId) : catalogApi.variants.list(), enabled: !branchManager || branchId > 0 })
  const variantImages = useQuery({ queryKey: queryKeys.catalog.variantImages(imageVariant?.idVariante ?? 0), queryFn: () => catalogApi.variantImages.list(imageVariant!.idVariante), enabled: !!imageVariant })
  const inventory = useQuery({ queryKey: ['inventory', branchManager ? branchId : 'all'], queryFn: () => branchManager ? inventoryApi.listByBranch(branchId) : inventoryApi.list(), enabled: !branchManager || branchId > 0 })
  const allQueries = [categories, sizes, colors, products, variants, inventory, warehouses]
  const warehouseOptions = (warehouses.data ?? []).filter(item => item.sucursal?.idSucursal === branchId)
  const filteredStockVariants = (variants.data ?? []).filter(item => matchesSearch(stockVariantSearch, item.sku, item.producto?.nombre))
  const filteredProducts = (products.data ?? []).filter(item => matchesSearch(productSearch, item.nombre))
  const filteredVariants = (variants.data ?? []).filter(item => matchesSearch(variantSearch, item.sku, item.producto?.nombre))
  const filteredInventory = (inventory.data ?? []).filter(item => {
    const variant = variants.data?.find(value => value.idVariante === (item.variante?.idVariante ?? item.idVariante)) ?? item.variante
    return matchesSearch(inventorySearch, variant?.sku, variant?.producto?.nombre)
  })

  const master = useMutation({
    mutationFn: ({ kind, body }: { kind: 'category' | 'size' | 'color'; body: CatalogItem }) => { const scoped = { ...body, ...(branchManager ? { idSucursal: branchId } : {}) }; return kind === 'category' ? catalogApi.categories.create(scoped) : kind === 'size' ? catalogApi.sizes.create(scoped) : catalogApi.colors.create(scoped) },
    onSuccess: async (_data, variables) => {
      setFeedback('Dato de catálogo creado correctamente.')
      setError('')
      const baseKey = variables.kind === 'category' ? queryKeys.catalog.categories : variables.kind === 'size' ? queryKeys.catalog.sizes : queryKeys.catalog.colors
      const key = [...baseKey, branchManager ? branchId : 'all']
      await queryClient.invalidateQueries({ queryKey: key })
    },
    onError: value => setError(getApiErrorMessage(value)),
  })
  const saveProduct = useMutation({
    mutationFn: (body: CreateProductoRequest) => { const scoped = { ...body, ...(branchManager ? { idSucursal: branchId } : {}) }; return editing ? catalogApi.products.update(editing.idProducto, scoped) : catalogApi.products.create(scoped) },
    onSuccess: async () => { const message = editing ? 'Producto actualizado correctamente.' : 'Producto creado correctamente.'; setFeedback(message); setError(''); setCatalogNotice({ type: 'success', message }); setEditing(null); await queryClient.invalidateQueries({ queryKey: [...queryKeys.catalog.products, branchManager ? branchId : 'all'] }) },
    onError: value => { const message = getApiErrorMessage(value); setError(message); setCatalogNotice({ type: 'error', message: `No se pudo guardar el producto: ${message}` }) },
  })
  const loadProductForEditing = async (product: Producto) => {
    try {
      const completeProduct = await catalogApi.products.get(product.idProducto, branchManager ? branchId : undefined)
      setEditing(completeProduct)
      setError('')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (value) {
      const message = getApiErrorMessage(value)
      setError(message)
      setCatalogNotice({ type: 'error', message: `No se pudo cargar el producto: ${message}` })
    }
  }
  const createVariant = useMutation({
    mutationFn: (body: CreateVarianteRequest) => { const scoped = { ...body, ...(branchManager ? { idSucursal: branchId } : {}) }; return editingVariant ? catalogApi.variants.update(editingVariant.idVariante, scoped) : catalogApi.variants.create(scoped) },
    onSuccess: async () => { const message = editingVariant ? 'Variante actualizada correctamente.' : 'Variante creada y disponible para asignar stock.'; setFeedback(message); setError(''); setCatalogNotice({ type: 'success', message }); setEditingVariant(null); await Promise.all([queryClient.invalidateQueries({ queryKey: [...queryKeys.catalog.variants, branchManager ? branchId : 'all'] }), queryClient.invalidateQueries({ queryKey: ['inventory', branchManager ? branchId : 'all'] })]) },
    onError: value => { const message = getApiErrorMessage(value); setError(message); setCatalogNotice({ type: 'error', message: `No se pudo guardar la variante: ${message}` }) },
  })

  useEffect(() => {
    if (!catalogNotice) return
    const timer = window.setTimeout(() => setCatalogNotice(null), 5000)
    return () => window.clearTimeout(timer)
  }, [catalogNotice])
  const saveInventory = useMutation({
    mutationFn: (body: CreateInventarioRequest) => {
      const existing = (inventory.data ?? []).find(item => (item.almacen?.idAlmacen ?? item.idAlmacen) === body.idAlmacen && (item.variante?.idVariante ?? item.idVariante) === body.idVariante)
      return existing ? inventoryApi.update(existing.idInventario, body) : inventoryApi.create(body)
    },
    onSuccess: async () => { setFeedback('Inventario guardado correctamente.'); setError(''); await queryClient.invalidateQueries({ queryKey: ['inventory', branchManager ? branchId : 'all'] }) },
    onError: value => setError(getApiErrorMessage(value)),
  })
  const refreshVariantImages = async () => {
    if (imageVariant) await queryClient.invalidateQueries({ queryKey: queryKeys.catalog.variantImages(imageVariant.idVariante) })
    await queryClient.invalidateQueries({ queryKey: [...queryKeys.catalog.variants, branchManager ? branchId : 'all'] })
  }
  const addVariantImage = useMutation({ mutationFn: (body: { url: string; principal: boolean }) => catalogApi.variantImages.create(imageVariant!.idVariante, body), onSuccess: async () => { setFeedback('Imagen agregada correctamente.'); setError(''); await refreshVariantImages() }, onError: value => setError(getApiErrorMessage(value)) })
  const setPrincipalImage = useMutation({ mutationFn: (idImagen: number) => catalogApi.variantImages.setPrincipal(imageVariant!.idVariante, idImagen), onSuccess: refreshVariantImages, onError: value => setError(getApiErrorMessage(value)) })
  const removeVariantImage = useMutation({ mutationFn: (idImagen: number) => catalogApi.variantImages.remove(imageVariant!.idVariante, idImagen), onSuccess: refreshVariantImages, onError: value => setError(getApiErrorMessage(value)) })

  if (allQueries.some(query => query.isLoading) || (national && branches.isLoading)) return <div className={dashboardStyles.chartLoading} role="status">Cargando catálogo e inventario…</div>
  const queryError = allQueries.find(query => query.error)?.error ?? branches.error
  if (queryError) return <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(queryError)}</p>

  return <section className={dashboardStyles.content}>
    {catalogNotice && <div className={`${styles.variantNotice} ${catalogNotice.type === 'success' ? styles.variantNoticeSuccess : styles.variantNoticeError}`} role={catalogNotice.type === 'error' ? 'alert' : 'status'} aria-live="polite">{catalogNotice.message}</div>}
    <div className={dashboardStyles.pageHeading}><div><p className={dashboardStyles.kicker}>Catálogo e inventario</p><h1>{national ? 'Productos vendibles' : 'Catálogo de tu sucursal'}</h1><p>{national ? 'Crea los datos básicos, la variante y su existencia por almacén.' : 'Consulta solo las prendas, variantes y existencias de tu sucursal.'}</p></div></div>
    {feedback && <p className={dashboardStyles.successNotice} role="status">{feedback}</p>}{error && <p className={dashboardStyles.errorNotice} role="alert">{error}</p>}
    {canManage && <div className={styles.grid}><MasterPanel title="Categorías" label="Nueva categoría" items={categories.data ?? []} onCreate={nombre => master.mutate({ kind: 'category', body: { nombre } })} /><MasterPanel title="Tallas" label="Nueva talla" items={sizes.data ?? []} onCreate={nombre => master.mutate({ kind: 'size', body: { nombre } })} /><MasterPanel title="Colores" label="Nuevo color" items={colors.data ?? []} onCreate={nombre => master.mutate({ kind: 'color', body: { nombre } })} /></div>}
    {canManage && <div className={styles.grid}>
      <section className={styles.panel}><h2>{editing ? 'Editar producto' : 'Crear producto'}</h2><form key={editing?.idProducto ?? 'new'} className={styles.form} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const catalogUrl = String(data.get('imagenCatalogoUrl') ?? '').trim(); const savedCatalogUrl = (editing?.imagenCatalogoUrl ?? editing?.imagenUrl ?? '').trim(); if (catalogUrl !== savedCatalogUrl && !validImageUrl(catalogUrl, 'catalog')) { const message = 'La imagen de catálogo debe ser una URL JPG, JPEG, PNG o WebP válida'; setError(message); setCatalogNotice({ type: 'error', message }); return } const tryOn = tryOnFields(data, editing); if (tryOn.validationError) { setError(tryOn.validationError); setCatalogNotice({ type: 'error', message: tryOn.validationError }); return } saveProduct.mutate({ idCategoria: Number(data.get('idCategoria')), nombre: String(data.get('nombre')).trim(), descripcion: optional(data, 'descripcion'), precio: Number(data.get('precio')), precioMayorista: optionalNumber(data, 'precioMayorista'), cantidadMinimaMayorista: optionalNumber(data, 'cantidadMinimaMayorista'), imagenCatalogoUrl: catalogUrl === savedCatalogUrl ? undefined : clearableUrl(data, 'imagenCatalogoUrl', savedCatalogUrl), tipoPrendaVestidor: tryOn.tipoPrendaVestidor, imagenVestidorUrl: tryOn.imagenVestidorUrl, estado: data.get('estado') === 'on' }) }}><div className={styles.formGrid}><label>Categoría<select name="idCategoria" required defaultValue={editing?.categoria?.idCategoria ?? 0}><option value={0}>Selecciona</option>{categories.data?.map(item => <option key={item.idCategoria} value={item.idCategoria}>{item.nombre}</option>)}</select></label><label>Nombre<input name="nombre" required defaultValue={editing?.nombre ?? ''} /></label><label className={styles.wide}>Descripción<textarea name="descripcion" defaultValue={editing?.descripcion ?? ''} /></label><label>Precio minorista<input name="precio" type="number" min="0" step="0.01" required defaultValue={editing?.precio ?? ''} /></label><label>Precio mayorista<input name="precioMayorista" type="number" min="0" step="0.01" defaultValue={editing?.precioMayorista ?? ''} /></label><label>Cantidad mínima mayorista<input name="cantidadMinimaMayorista" type="number" min="1" defaultValue={editing?.cantidadMinimaMayorista ?? ''} /></label><label><span>Estado</span><input name="estado" type="checkbox" defaultChecked={editing?.estado ?? true} /></label><ImageUrlField name="imagenCatalogoUrl" label="Imagen de catálogo (URL)" placeholder="https://ejemplo.com/producto.jpg" help="Puede ser JPG, PNG o WebP" alt="Vista previa de la imagen del producto" defaultValue={editing?.imagenCatalogoUrl ?? editing?.imagenUrl ?? ''} format="catalog" /><TryOnFields producto={editing} /></div><div className={styles.actions}>{editing && <button type="button" onClick={() => setEditing(null)}>Cancelar</button>}<button className="primary-button" disabled={saveProduct.isPending}>{saveProduct.isPending ? 'Guardando…' : 'Guardar producto'}</button></div></form></section>
      <section className={styles.panel}><h2>{editingVariant ? 'Editar variante' : 'Crear variante'}</h2><form key={editingVariant?.idVariante ?? 'new-variant'} className={styles.form} onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const imageUrl = String(data.get('imagenVestidorUrl') ?? '').trim(); if (!validImageUrl(imageUrl, 'transparent')) { const message = 'Para vestidor virtual pegue una URL PNG o WebP con fondo transparente y poco borde'; setError(message); setCatalogNotice({ type: 'error', message }); return } createVariant.mutate({ idProducto: Number(data.get('idProducto')), idTalla: optionalNumber(data, 'idTalla'), idColor: optionalNumber(data, 'idColor'), sku: String(data.get('sku')).trim(), imagenVestidorUrl: clearableUrl(data, 'imagenVestidorUrl', editingVariant?.imagenVestidorUrl) }, { onSuccess: () => form.reset() }) }}><label>Producto<select name="idProducto" required defaultValue={editingVariant?.producto?.idProducto ?? editingVariant?.idProducto ?? ''}><option value="">{!(products.data ?? []).length ? 'No hay productos de esta sucursal' : 'Selecciona'}</option>{(products.data ?? []).map(item => <option key={item.idProducto} value={item.idProducto}>{item.nombre}</option>)}</select></label><label>Talla<select name="idTalla" defaultValue={editingVariant?.talla?.idTalla ?? editingVariant?.idTalla ?? ''}><option value="">Sin talla</option>{sizes.data?.map(item => <option key={item.idTalla} value={item.idTalla}>{item.nombre}</option>)}</select></label><label>Color<select name="idColor" defaultValue={editingVariant?.color?.idColor ?? editingVariant?.idColor ?? ''}><option value="">Sin color</option>{colors.data?.map(item => <option key={item.idColor} value={item.idColor}>{item.nombre}</option>)}</select></label><label>SKU<input name="sku" required maxLength={80} defaultValue={editingVariant?.sku ?? ''} /></label><ImageUrlField name="imagenVestidorUrl" label="Overlay de vestidor para esta variante" placeholder="https://.../overlay.webp" help="Para vestidor virtual pegue una URL PNG o WebP con fondo transparente y poco borde" alt="Vista previa del overlay" defaultValue={editingVariant?.imagenVestidorUrl ?? ''} format="transparent" uploadLocal transparent /><div className={styles.actions}>{editingVariant && <button type="button" onClick={() => setEditingVariant(null)}>Cancelar</button>}<button className="primary-button" disabled={createVariant.isPending}>{createVariant.isPending ? 'Guardando…' : editingVariant ? 'Guardar variante' : 'Crear variante'}</button></div></form></section>
      <section className={styles.panel}><h2>Imágenes de variante</h2><label>Variante<select aria-label="Variante para imágenes" value={imageVariant?.idVariante ?? ''} onChange={event => setImageVariant((variants.data ?? []).find(item => item.idVariante === Number(event.target.value)) ?? null)}><option value="">Selecciona</option>{variants.data?.map(item => <option key={item.idVariante} value={item.idVariante}>{item.sku}</option>)}</select></label>{imageVariant && <><form className={styles.inlineForm} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); addVariantImage.mutate({ url: String(data.get('url')).trim(), principal: data.get('principal') === 'on' }); event.currentTarget.reset() }}><input name="url" aria-label="URL de imagen de variante" type="url" required placeholder="https://..." /><label><input name="principal" type="checkbox" /> Principal</label><button disabled={addVariantImage.isPending || (variantImages.data?.length ?? 0) >= 3}>Agregar</button></form>{variantImages.isLoading ? <p>Cargando imágenes...</p> : <div className={styles.imageList}>{variantImages.data?.map(image => <article key={image.idImagen} className={styles.imageItem}><img src={image.url} alt={`Imagen ${image.orden} de ${imageVariant.sku}`} /><div><strong>Orden {image.orden}</strong>{image.principal && <span> Principal</span>}<button type="button" disabled={image.principal || setPrincipalImage.isPending} onClick={() => setPrincipalImage.mutate(image.idImagen)}>Hacer principal</button><button type="button" disabled={removeVariantImage.isPending} onClick={() => removeVariantImage.mutate(image.idImagen)}>Eliminar</button></div></article>)}</div>}<p>{variantImages.data?.length ?? 0}/3 imágenes. La imagen principal se muestra primero.</p></>}</section>
      <section className={styles.panel}><h2>Cargar o ajustar stock</h2><form className={styles.form} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); saveInventory.mutate({ idSucursal: branchId, idAlmacen: Number(data.get('idAlmacen')), idVariante: Number(data.get('idVariante')), stockDisponible: Number(data.get('stockDisponible')), stockReservado: 0 }) }}><label>Sucursal<select aria-label="Sucursal de inventario" value={branchId} onChange={event => setSelectedBranchId(Number(event.target.value))} required><option value={0}>Selecciona</option>{branchOptions.map(item => <option key={item.idSucursal} value={item.idSucursal}>{item.nombre}</option>)}</select></label><label>Almacén<select name="idAlmacen" required><option value="">Selecciona</option>{warehouseOptions.map(item => <option key={item.idAlmacen} value={item.idAlmacen}>{item.nombre} ({item.codigo})</option>)}</select></label><label>Buscar variante<input type="search" value={stockVariantSearch} onChange={event => setStockVariantSearch(event.target.value)} placeholder="SKU o nombre del producto" autoComplete="off" /></label><label>Variante<select name="idVariante" required><option value="">{filteredStockVariants.length ? 'Selecciona' : 'No se encontraron variantes'}</option>{filteredStockVariants.map(item => <option key={item.idVariante} value={item.idVariante}>{item.sku} — {item.producto?.nombre ?? 'Sin producto'}</option>)}</select></label><label>Stock disponible<input name="stockDisponible" type="number" min="0" required /></label><button className="primary-button" disabled={!branchId || saveInventory.isPending}>Guardar stock</button></form></section>
    </div>}
    <div className={styles.tables}><DataTable title="Productos" searchLabel="Buscar productos" searchPlaceholder="Nombre del producto" searchValue={productSearch} onSearchChange={setProductSearch} headers={canManage ? ['Producto','Categoría','Minorista','Mayorista','Mínimo','Vestidor','Acciones'] : ['Producto','Categoría','Minorista','Mayorista','Mínimo','Vestidor']} rows={filteredProducts.map(item => canManage ? [item.nombre,item.categoria?.nombre ?? '—',money(item.precio),money(item.precioMayorista),String(item.cantidadMinimaMayorista ?? '—'),tryOnBadge(item),<button type="button" onClick={() => void loadProductForEditing(item)}>Editar</button>] : [item.nombre,item.categoria?.nombre ?? '—',money(item.precio),money(item.precioMayorista),String(item.cantidadMinimaMayorista ?? '—'),tryOnBadge(item)])} /><DataTable title="Variantes" searchLabel="Buscar variantes" searchPlaceholder="SKU o nombre del producto" searchValue={variantSearch} onSearchChange={setVariantSearch} headers={['SKU','Producto','Talla','Color','Vestidor','Acciones']} rows={filteredVariants.map(item => [item.sku,item.producto?.nombre ?? '—',item.talla?.nombre ?? '—',item.color?.nombre ?? '—',item.imagenVestidorUrl ? 'Configurado' : '—',<button type="button" onClick={() => { setEditingVariant(item); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Editar</button>])} /><DataTable title="Variantes con stock" searchLabel="Buscar variantes con stock" searchPlaceholder="SKU o nombre del producto" searchValue={inventorySearch} onSearchChange={setInventorySearch} headers={['SKU','Producto','Almacén','Sucursal','Stock']} rows={filteredInventory.map(item => { const variant = variants.data?.find(value => value.idVariante === (item.variante?.idVariante ?? item.idVariante)); return [variant?.sku ?? item.variante?.sku ?? '—',variant?.producto?.nombre ?? item.variante?.producto?.nombre ?? '—',item.almacen?.nombre ?? '—',item.sucursal?.nombre ?? '—',String(item.stockDisponible)] })} /></div>
  </section>
}

function MasterPanel({ title, label, items, onCreate }: { title: string; label: string; items: CatalogItem[]; onCreate: (name: string) => void }) { return <section className={styles.panel}><h2>{title}</h2><form className={styles.inlineForm} onSubmit={event => { event.preventDefault(); const input = event.currentTarget.elements.namedItem('nombre') as HTMLInputElement; if (input.value.trim()) { onCreate(input.value.trim()); input.value = '' } }}><input name="nombre" aria-label={label} required /><button>Crear</button></form><div className={styles.chips}>{items.map(item => <span key={item.idCategoria ?? item.idTalla ?? item.idColor}>{item.nombre}</span>)}</div></section> }
function DataTable({ title, headers, rows, searchLabel, searchPlaceholder, searchValue, onSearchChange }: { title: string; headers: string[]; rows: (string | ReactNode)[][]; searchLabel?: string; searchPlaceholder?: string; searchValue?: string; onSearchChange?: (value: string) => void }) { return <section className={styles.panel}><div className={styles.tableHeading}><h2>{title}</h2>{searchLabel && onSearchChange && <label className={styles.searchField}><span>{searchLabel}</span><input type="search" value={searchValue ?? ''} onChange={event => onSearchChange(event.target.value)} placeholder={searchPlaceholder} autoComplete="off" /></label>}</div><div className={styles.tableWrap}><table className={styles.table}><thead><tr>{headers.map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row,index) => <tr key={index}>{row.map((value,column) => <td key={column}>{value}</td>)}</tr>) : <tr><td colSpan={headers.length}>No hay registros que coincidan con la búsqueda.</td></tr>}</tbody></table></div></section> }
// Campo de URL de imagen con vista previa. El estado local solo sirve para la vista previa; el valor viaja con el
// resto del formulario por FormData (name). `transparent` dibuja fondo de cuadros para apreciar PNG sin fondo.
function ImageUrlField({ name, label, placeholder, help, alt, defaultValue, transparent = false, format = 'transparent', uploadLocal = false }: { name: string; label: string; placeholder: string; help: string; alt: string; defaultValue: string; transparent?: boolean; format?: 'catalog' | 'transparent'; uploadLocal?: boolean }) {
  const [value, setValue] = useState(defaultValue)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const trimmed = value.trim()
  const valid = validImageUrl(trimmed, format) || trimmed === defaultValue.trim()
  const uploadSelectedFile = async () => {
    if (!selectedFile) return
    if (selectedFile.type !== 'image/png' || !selectedFile.name.toLowerCase().endsWith('.png')) {
      setUploadError('Seleccione un archivo PNG válido.')
      return
    }
    setUploading(true)
    setUploadError('')
    try {
      const result = await uploadsApi.uploadTryOn(selectedFile)
      setValue(result.url)
      setSelectedFile(null)
    } catch (error) {
      setUploadError(getApiErrorMessage(error))
    } finally {
      setUploading(false)
    }
  }
  return <div className={`${styles.field} ${styles.wide}`}>
    <label>{label}<input name={name} value={value} onChange={event => setValue(event.target.value)} placeholder={placeholder} maxLength={500} inputMode="url" autoComplete="off" aria-invalid={trimmed !== '' && !valid} aria-describedby={`${name}-help`} /></label>
    <small id={`${name}-help`} className={styles.hint}>{help}</small>
    {uploadLocal ? <div className={styles.uploadControls}>
      <label className={styles.filePicker}>Seleccionar PNG local<input type="file" accept=".png,image/png" onChange={event => { setSelectedFile(event.target.files?.[0] ?? null); setUploadError('') }} /></label>
      <button type="button" className="primary-button" onClick={() => void uploadSelectedFile()} disabled={!selectedFile || uploading}>{uploading ? 'Subiendo…' : 'Subir'}</button>
    </div> : null}
    {uploadError ? <p className={styles.previewError} role="alert">{uploadError}</p> : null}
    {trimmed && !valid ? <p className={styles.previewError} role="status">{format === 'catalog' ? 'Ingrese una URL válida que termine en .jpg, .jpeg, .png o .webp' : 'Ingrese una URL válida que termine en .png o .webp'}</p> : null}
    {valid && trimmed ? <ImagePreview key={trimmed} url={trimmed} alt={alt} transparent={transparent} /> : null}
  </div>
}
function ImagePreview({ url, alt, transparent }: { url: string; alt: string; transparent: boolean }) {
  const [failed, setFailed] = useState(false)
  if (!url) return null
  if (failed) return <p className={styles.previewError} role="status">No se pudo cargar la imagen. Verifique que la URL sea accesible.</p>
  return <img className={`${styles.imagePreview} ${transparent ? styles.imagePreviewChecker : ''}`} src={resolveImageUrl(url)} alt={alt} onError={() => setFailed(true)} />
}
// Selector "Tipo de prenda" + campo de imagen del vestidor. Van juntos porque elegir "Sin vestidor" debe
// limpiar la imagen: es un componente aparte (no solo JSX inline) para que pueda tener su propio estado
// del <select> y decidir cuándo remontar el campo de imagen (ver el `key` de ImageUrlField más abajo).
function TryOnFields({ producto }: { producto: Producto | null }) {
  const [tipo, setTipo] = useState<TipoPrendaVestidor | ''>(producto?.tipoPrendaVestidor ?? '')
  return <>
    <label>Tipo de prenda para vestidor<select name="tipoPrendaVestidor" value={tipo} onChange={event => setTipo(event.target.value as TipoPrendaVestidor | '')}>
      <option value="">Sin vestidor</option>
      {(['GORRA', 'CAMISA', 'BLUSA', 'TOP', 'VESTIDO', 'FALDA', 'PANTALON', 'CARTERA', 'OTRO'] as const).map(value => <option key={value} value={value}>{value}</option>)}
    </select></label>
    {/* Al pasar de "Sin vestidor" a un tipo (o viceversa) este key cambia y React remonta el campo, así que
        vuelve a leer su defaultValue: limpio si se acaba de elegir "Sin vestidor", o el valor guardado si no. */}
    <ImageUrlField key={tipo ? 'con-tipo' : 'sin-tipo'} name="imagenVestidorUrl" label="Imagen para vestidor virtual (overlay transparente)" placeholder="https://ejemplo.com/producto-overlay.webp" help="Para vestidor virtual pegue una URL PNG o WebP con fondo transparente y poco borde" alt="Vista previa de la imagen para el vestidor virtual" defaultValue={tipo ? (producto?.imagenVestidorUrl ?? producto?.imagenTryOn ?? '') : ''} format="transparent" uploadLocal transparent />
  </>
}
const TIPO_TRY_ON_LABEL: Record<TipoPrendaVestidor, string> = { GORRA: 'Gorra', CAMISA: 'Camisa', BLUSA: 'Blusa', TOP: 'Top', VESTIDO: 'Vestido', FALDA: 'Falda', PANTALON: 'Pantalón', CARTERA: 'Cartera', OTRO: 'Otro' }
function tryOnBadge(item: Producto) {
  if (item.imagenVestidorUrl && item.tipoPrendaVestidor) return <span className={styles.badgeOn} title="Tiene imagen y tipo para el vestidor virtual"><Glasses size={14} aria-hidden="true" />Configurado ({TIPO_TRY_ON_LABEL[item.tipoPrendaVestidor!]})</span>
  if (item.imagenVestidorUrl) return <span className={styles.badgeOn} title="Tiene imagen, pero falta elegir el tipo de prenda: el botón del vestidor no se mostrará hasta que lo definas"><Glasses size={14} aria-hidden="true" />Configurado (sin tipo)</span>
  return <span className={styles.badgeOff}>—</span>
}
// Del <select> "Tipo de prenda" sale null ("Sin vestidor") o un TipoTryOn válido; nunca se envía "".
// Si se eligió "Sin vestidor" se fuerza imagenTryOn a null/"" aunque el campo (ya limpio por el remount
// de arriba) tuviera algo, para que ambos campos queden siempre consistentes.
function tryOnFields(data: FormData, editing: Producto | null) {
  const tipoPrendaVestidor = (String(data.get('tipoPrendaVestidor') ?? '').trim() || null) as TipoPrendaVestidor | null
  const image = String(data.get('imagenVestidorUrl') ?? '').trim()
  const savedImage = (editing?.imagenVestidorUrl ?? editing?.imagenTryOn ?? '').trim()
  if (image !== savedImage && image && !validImageUrl(image, 'transparent')) return { validationError: 'Para vestidor virtual pegue una URL PNG o WebP con fondo transparente y poco borde' }
  return { tipoPrendaVestidor, imagenVestidorUrl: tipoPrendaVestidor ? clearableUrl(data, 'imagenVestidorUrl', editing?.imagenVestidorUrl) : editing?.imagenVestidorUrl ? '' : undefined }
}
// Vacío: se omite el campo, salvo que el producto ya tuviera imagen y se esté borrando; entonces se envía "" (el backend la limpia).
// Así editar un producto sin imagen no convierte su NULL en "".
function clearableUrl(data: FormData, key: string, previous?: string | null) { const value = String(data.get(key) ?? '').trim(); return value || (previous ? '' : undefined) }
function validImageUrl(value: string, format: 'catalog' | 'transparent') {
  if (!value) return true
  if (format === 'transparent' && /^\/uploads\/tryon\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/i.test(value)) return true
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return format === 'catalog' ? /\.(?:jpe?g|png|webp)$/i.test(url.pathname) : /\.(?:png|webp)$/i.test(url.pathname)
  } catch { return false }
}
function optional(data: FormData, key: string) { const value = String(data.get(key) ?? '').trim(); return value || undefined }
function optionalNumber(data: FormData, key: string) { const value = String(data.get(key) ?? '').trim(); return value ? Number(value) : undefined }
function money(value: number | string | null | undefined) { const number = Number(value); return value !== null && value !== undefined && Number.isFinite(number) ? `Bs ${number.toFixed(2)}` : '—' }
function matchesSearch(search: string, ...values: (string | null | undefined)[]) { const term = normalizeSearch(search); return !term || values.some(value => normalizeSearch(value ?? '').includes(term)) }
function normalizeSearch(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim() }
function uniqueBranches(items: import('../../types/branch').Sucursal[]) { return [...new Map(items.map(item => [item.idSucursal,item])).values()] }
