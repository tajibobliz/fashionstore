import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Glasses } from 'lucide-react'
import { branchesApi } from '../../api/branches.api'
import { catalogApi } from '../../api/catalog.api'
import { inventoryApi } from '../../api/inventory.api'
import { queryKeys } from '../../api/queryKeys'
import { warehousesApi } from '../../api/warehouses.api'
import { useAuth } from '../../hooks/useAuth'
import type { CatalogItem, CreateProductoRequest, Producto, TipoTryOn } from '../../types/catalog'
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
  const categories = useQuery({ queryKey: queryKeys.catalog.categories, queryFn: catalogApi.categories.list })
  const sizes = useQuery({ queryKey: queryKeys.catalog.sizes, queryFn: catalogApi.sizes.list })
  const colors = useQuery({ queryKey: queryKeys.catalog.colors, queryFn: catalogApi.colors.list })
  const products = useQuery({ queryKey: queryKeys.catalog.products, queryFn: catalogApi.products.list })
  const variants = useQuery({ queryKey: queryKeys.catalog.variants, queryFn: catalogApi.variants.list })
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

  if (allQueries.some(query => query.isLoading) || (national && branches.isLoading)) return <div className={dashboardStyles.chartLoading} role="status">Cargando catálogo e inventario…</div>
  const queryError = allQueries.find(query => query.error)?.error ?? branches.error
  if (queryError) return <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(queryError)}</p>

  return <section className={dashboardStyles.content}>
    <div className={dashboardStyles.pageHeading}><div><p className={dashboardStyles.kicker}>Catálogo e inventario</p><h1>Productos vendibles</h1><p>Crea los datos básicos, la variante y su existencia por almacén.</p></div></div>
    {feedback && <p className={dashboardStyles.successNotice} role="status">{feedback}</p>}{error && <p className={dashboardStyles.errorNotice} role="alert">{error}</p>}
    <div className={styles.grid}><MasterPanel title="Categorías" label="Nueva categoría" items={categories.data ?? []} onCreate={nombre => master.mutate({ kind: 'category', body: { nombre } })} /><MasterPanel title="Tallas" label="Nueva talla" items={sizes.data ?? []} onCreate={nombre => master.mutate({ kind: 'size', body: { nombre } })} /><MasterPanel title="Colores" label="Nuevo color" items={colors.data ?? []} onCreate={nombre => master.mutate({ kind: 'color', body: { nombre } })} /></div>
    <div className={styles.grid}>
      <section className={styles.panel}><h2>{editing ? 'Editar producto' : 'Crear producto'}</h2><form key={editing?.idProducto ?? 'new'} className={styles.form} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); saveProduct.mutate({ idCategoria: Number(data.get('idCategoria')), nombre: String(data.get('nombre')).trim(), descripcion: optional(data, 'descripcion'), precio: Number(data.get('precio')), precioMayorista: optionalNumber(data, 'precioMayorista'), cantidadMinimaMayorista: optionalNumber(data, 'cantidadMinimaMayorista'), imagenUrl: clearableUrl(data, 'imagenUrl', editing?.imagenUrl), ...tryOnFields(data, editing), estado: data.get('estado') === 'on' }) }}><div className={styles.formGrid}><label>Categoría<select name="idCategoria" required defaultValue={editing?.categoria?.idCategoria ?? 0}><option value={0}>Selecciona</option>{categories.data?.map(item => <option key={item.idCategoria} value={item.idCategoria}>{item.nombre}</option>)}</select></label><label>Nombre<input name="nombre" required defaultValue={editing?.nombre ?? ''} /></label><label className={styles.wide}>Descripción<textarea name="descripcion" defaultValue={editing?.descripcion ?? ''} /></label><label>Precio minorista<input name="precio" type="number" min="0" step="0.01" required defaultValue={editing?.precio ?? ''} /></label><label>Precio mayorista<input name="precioMayorista" type="number" min="0" step="0.01" defaultValue={editing?.precioMayorista ?? ''} /></label><label>Cantidad mínima mayorista<input name="cantidadMinimaMayorista" type="number" min="1" defaultValue={editing?.cantidadMinimaMayorista ?? ''} /></label><label><span>Estado</span><input name="estado" type="checkbox" defaultChecked={editing?.estado ?? true} /></label><ImageUrlField name="imagenUrl" label="Imagen del producto (URL)" placeholder="https://ejemplo.com/producto.jpg" help="URL de la imagen que se muestra en el catálogo. Puede ser JPG o PNG." alt="Vista previa de la imagen del producto" defaultValue={editing?.imagenUrl ?? ''} /><TryOnFields producto={editing} /></div><div className={styles.actions}>{editing && <button type="button" onClick={() => setEditing(null)}>Cancelar</button>}<button className="primary-button" disabled={saveProduct.isPending}>Guardar producto</button></div></form></section>
      <section className={styles.panel}><h2>Crear variante</h2><form className={styles.form} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); createVariant.mutate({ idProducto: Number(data.get('idProducto')), idTalla: optionalNumber(data, 'idTalla'), idColor: optionalNumber(data, 'idColor'), sku: String(data.get('sku')).trim() }) }}><label>Producto<select name="idProducto" required><option value="">Selecciona</option>{products.data?.map(item => <option key={item.idProducto} value={item.idProducto}>{item.nombre}</option>)}</select></label><label>Talla<select name="idTalla"><option value="">Sin talla</option>{sizes.data?.map(item => <option key={item.idTalla} value={item.idTalla}>{item.nombre}</option>)}</select></label><label>Color<select name="idColor"><option value="">Sin color</option>{colors.data?.map(item => <option key={item.idColor} value={item.idColor}>{item.nombre}</option>)}</select></label><label>SKU<input name="sku" required maxLength={80} /></label><button className="primary-button" disabled={createVariant.isPending}>Crear variante</button></form></section>
      <section className={styles.panel}><h2>Cargar o ajustar stock</h2><form className={styles.form} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); saveInventory.mutate({ idSucursal: branchId, idAlmacen: Number(data.get('idAlmacen')), idVariante: Number(data.get('idVariante')), stockDisponible: Number(data.get('stockDisponible')), stockReservado: 0 }) }}><label>Sucursal<select aria-label="Sucursal de inventario" value={branchId} onChange={event => setBranchId(Number(event.target.value))} required><option value={0}>Selecciona</option>{branchOptions.map(item => <option key={item.idSucursal} value={item.idSucursal}>{item.nombre}</option>)}</select></label><label>Almacén<select name="idAlmacen" required><option value="">Selecciona</option>{warehouseOptions.map(item => <option key={item.idAlmacen} value={item.idAlmacen}>{item.nombre} ({item.codigo})</option>)}</select></label><label>Variante<select name="idVariante" required><option value="">Selecciona</option>{variants.data?.map(item => <option key={item.idVariante} value={item.idVariante}>{item.sku}</option>)}</select></label><label>Stock disponible<input name="stockDisponible" type="number" min="0" required /></label><button className="primary-button" disabled={!branchId || saveInventory.isPending}>Guardar stock</button></form></section>
    </div>
    <div className={styles.tables}><DataTable title="Productos" headers={['Producto','Categoría','Minorista','Mayorista','Mínimo','Vestidor','Acciones']} rows={(products.data ?? []).map(item => [item.nombre,item.categoria?.nombre ?? '—',money(item.precio),money(item.precioMayorista),String(item.cantidadMinimaMayorista ?? '—'),tryOnBadge(item),<button type="button" onClick={() => setEditing(item)}>Editar</button>])} /><DataTable title="Variantes con stock" headers={['SKU','Producto','Almacén','Sucursal','Stock']} rows={(inventory.data ?? []).map(item => { const variant = variants.data?.find(value => value.idVariante === (item.variante?.idVariante ?? item.idVariante)); return [variant?.sku ?? item.variante?.sku ?? '—',variant?.producto?.nombre ?? '—',item.almacen?.nombre ?? '—',item.sucursal?.nombre ?? '—',String(item.stockDisponible)] })} /></div>
  </section>
}

function MasterPanel({ title, label, items, onCreate }: { title: string; label: string; items: CatalogItem[]; onCreate: (name: string) => void }) { return <section className={styles.panel}><h2>{title}</h2><form className={styles.inlineForm} onSubmit={event => { event.preventDefault(); const input = event.currentTarget.elements.namedItem('nombre') as HTMLInputElement; if (input.value.trim()) { onCreate(input.value.trim()); input.value = '' } }}><input name="nombre" aria-label={label} required /><button>Crear</button></form><div className={styles.chips}>{items.map(item => <span key={item.idCategoria ?? item.idTalla ?? item.idColor}>{item.nombre}</span>)}</div></section> }
function DataTable({ title, headers, rows }: { title: string; headers: string[]; rows: (string | ReactNode)[][] }) { return <section className={styles.panel}><h2>{title}</h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr>{headers.map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row,index) => <tr key={index}>{row.map((value,column) => <td key={column}>{value}</td>)}</tr>) : <tr><td colSpan={headers.length}>No hay registros.</td></tr>}</tbody></table></div></section> }
// Campo de URL de imagen con vista previa. El estado local solo sirve para la vista previa; el valor viaja con el
// resto del formulario por FormData (name). `transparent` dibuja fondo de cuadros para apreciar PNG sin fondo.
function ImageUrlField({ name, label, placeholder, help, alt, defaultValue, transparent = false }: { name: string; label: string; placeholder: string; help: string; alt: string; defaultValue: string; transparent?: boolean }) {
  const [value, setValue] = useState(defaultValue)
  const [previewUrl, setPreviewUrl] = useState(defaultValue.trim())
  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewUrl(value.trim()), 400)
    return () => window.clearTimeout(timer)
  }, [value])
  return <div className={`${styles.field} ${styles.wide}`}>
    <label>{label}<input name={name} value={value} onChange={event => setValue(event.target.value)} placeholder={placeholder} maxLength={500} inputMode="url" autoComplete="off" aria-describedby={`${name}-help`} /></label>
    <small id={`${name}-help`} className={styles.hint}>{help}</small>
    <ImagePreview key={previewUrl} url={previewUrl} alt={alt} transparent={transparent} />
  </div>
}
function ImagePreview({ url, alt, transparent }: { url: string; alt: string; transparent: boolean }) {
  const [failed, setFailed] = useState(false)
  if (!url) return null
  if (failed || !/^https?:\/\//i.test(url)) return <p className={styles.previewError} role="status">No se pudo cargar la vista previa</p>
  return <img className={`${styles.imagePreview} ${transparent ? styles.imagePreviewChecker : ''}`} src={url} alt={alt} onError={() => setFailed(true)} />
}
// Selector "Tipo de prenda" + campo de imagen del vestidor. Van juntos porque elegir "Sin vestidor" debe
// limpiar la imagen: es un componente aparte (no solo JSX inline) para que pueda tener su propio estado
// del <select> y decidir cuándo remontar el campo de imagen (ver el `key` de ImageUrlField más abajo).
function TryOnFields({ producto }: { producto: Producto | null }) {
  const [tipo, setTipo] = useState<TipoTryOn | ''>(producto?.tipoTryOn ?? '')
  return <>
    <label>Tipo de prenda para vestidor<select name="tipoTryOn" value={tipo} onChange={event => setTipo(event.target.value as TipoTryOn | '')}>
      <option value="">Sin vestidor</option>
      <option value="lentes">Lentes</option>
      <option value="gorra">Gorra o sombrero</option>
      <option value="polera">Polera o camiseta</option>
    </select></label>
    {/* Al pasar de "Sin vestidor" a un tipo (o viceversa) este key cambia y React remonta el campo, así que
        vuelve a leer su defaultValue: limpio si se acaba de elegir "Sin vestidor", o el valor guardado si no. */}
    <ImageUrlField key={tipo ? 'con-tipo' : 'sin-tipo'} name="imagenTryOn" label="Imagen para vestidor virtual (URL del PNG sin fondo)" placeholder="https://ejemplo.com/producto-tryon.png" help="PNG sin fondo. Usa remove.bg para quitarle el fondo. Recomendado 500-1000px de ancho." alt="Vista previa de la imagen para el vestidor virtual" defaultValue={tipo ? (producto?.imagenTryOn ?? '') : ''} transparent />
  </>
}
const TIPO_TRY_ON_LABEL: Record<TipoTryOn, string> = { lentes: 'Lentes', gorra: 'Gorra', polera: 'Polera' }
function tryOnBadge(item: Producto) {
  if (item.imagenTryOn && item.tipoTryOn) return <span className={styles.badgeOn} title="Tiene imagen y tipo para el vestidor virtual"><Glasses size={14} aria-hidden="true" />Configurado ({TIPO_TRY_ON_LABEL[item.tipoTryOn]})</span>
  if (item.imagenTryOn) return <span className={styles.badgeOn} title="Tiene imagen, pero falta elegir el tipo de prenda: el botón del vestidor no se mostrará hasta que lo definas"><Glasses size={14} aria-hidden="true" />Configurado (sin tipo)</span>
  return <span className={styles.badgeOff}>—</span>
}
// Del <select> "Tipo de prenda" sale null ("Sin vestidor") o un TipoTryOn válido; nunca se envía "".
// Si se eligió "Sin vestidor" se fuerza imagenTryOn a null/"" aunque el campo (ya limpio por el remount
// de arriba) tuviera algo, para que ambos campos queden siempre consistentes.
function tryOnFields(data: FormData, editing: Producto | null) {
  const tipoTryOn = (String(data.get('tipoTryOn') ?? '').trim() || null) as TipoTryOn | null
  return { tipoTryOn, imagenTryOn: tipoTryOn ? clearableUrl(data, 'imagenTryOn', editing?.imagenTryOn) : editing?.imagenTryOn ? '' : undefined }
}
// Vacío: se omite el campo, salvo que el producto ya tuviera imagen y se esté borrando; entonces se envía "" (el backend la limpia).
// Así editar un producto sin imagen no convierte su NULL en "".
function clearableUrl(data: FormData, key: string, previous?: string | null) { const value = String(data.get(key) ?? '').trim(); return value || (previous ? '' : undefined) }
function optional(data: FormData, key: string) { const value = String(data.get(key) ?? '').trim(); return value || undefined }
function optionalNumber(data: FormData, key: string) { const value = String(data.get(key) ?? '').trim(); return value ? Number(value) : undefined }
function money(value: number | string | null | undefined) { const number = Number(value); return value !== null && value !== undefined && Number.isFinite(number) ? `Bs ${number.toFixed(2)}` : '—' }
function uniqueBranches(items: import('../../types/branch').Sucursal[]) { return [...new Map(items.map(item => [item.idSucursal,item])).values()] }
