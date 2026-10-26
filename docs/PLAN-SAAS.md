# PLAN-SAAS — Evolución de FashionStore a SaaS multitenant

> Rama: `feat/saas` (creada desde `main` @ `60d70c2`). `main` = producción, no se toca.
> `feat/ai-harness` queda aparte (otra presentación). No se usa OpenSpec: este archivo es el plan y la bitácora de avance.
> Fuente de requisitos: Examen Parcial 2 — Sistemas de Información 2 (S2-2026).
> Versión: v1.5 (2026-10-26)

## Fechas clave

> Las fechas del enunciado (25/10, 01/11, 08/11, defensa 10/11) **ya no son vigentes**; las nuevas están por definirse. Se sigue avanzando por fases.

| Hito | Fecha | Contenido esperado |
|---|---|---|
| Presentación 1 | _por definir_ | ICONIX (requisitos, casos de uso, modelo de dominio) + diseño multitenant + empresas/planes en backend |
| Presentación 2 | _por definir_ | PWA offline + móvil con SQLite + sincronización y conflictos |
| Presentación 3 | _por definir_ | Reportes por voz + KPIs + reportes generativos con IA + módulo ML + despliegue |
| **Defensa** | _por definir_ | Todo integrado, pruebas, UML coherente con el código |

## Alcance: puntos clave y su origen

| # | Punto | Origen | Dónde se cubre |
|---|---|---|---|
| A1 | Reportes por voz | Enunciado §8.3 ("escrito o verbal (voz)") | §7 |
| A2 | KPIs / dashboard de indicadores | Enunciado §8.4–8.5 ("dashboard analítico", "indicadores") | §7.2 |
| A3 | Machine Learning | Enunciado §8.4–8.5 | §7.1 |
| A4 | Multitenant con planes | Enunciado §9 | §4 |
| A5 | Límite de sucursales por plan | Enunciado §9.4 (Básico 2 / Profesional 10) | §4.4 |
| A6 | Varias tiendas por suscriptor | Enunciado §9.2 ("varias sucursales pueden pertenecer a una misma empresa"): **tienda física = sucursal** | §4.0, límite = A5 |
| A7 | Límite de usuarios por plan | **Aporte del equipo** (el enunciado solo dice "usuarios y roles") | §4.4 |

---

## 0. Decisiones abiertas (resolver antes de codificar)

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| D0 | **Stack** | ✅ **RESUELTA (2026-10-24)**: el stack del enunciado no es obligatorio → se mantiene **NestJS + React + Expo** y se evoluciona el sistema existente (no se hace uno nuevo) | El módulo de ML puede ser un microservicio Python/FastAPI o hacerse en Node; se decide en la Fase 3 |
| D1 | Cómo se identifica el tenant en la tienda pública (decisión técnica; el enunciado no la detalla, pero sin ella la tienda online no sabe de qué empresa mostrar productos) | subdominio · slug en URL `/t/:slug` · header `X-Tenant` | ✅ **RESUELTA (2026-10-25)**: slug en URL `/t/:slug/...`. **Compatibilidad**: las rutas actuales (`/tienda`, `/login`) siguen funcionando y apuntan a la Empresa A (FashionStore) |
| D2 | ¿Los clientes son por empresa o globales? | ✅ **RESUELTA**: **por empresa** (como Shopify: cada tienda tiene su propia lista de clientes). `email` único por `(id_empresa, email)`; la misma persona puede registrarse en la Empresa A y en la B con el mismo correo y son cuentas distintas | Ver §4.6 |
| D3 | Catálogos maestros (tallas, colores, ciudades) — es parte de lo que pide §9.2: "identificar las entidades que pertenecen a cada tenant" | por tenant · globales | ✅ **RESUELTA (2026-10-25)**: categorías, tallas, colores, temporadas, colecciones y proveedores **por empresa**; `ciudad` y `rol` **globales** |
| D4 | Política de conflicto de stock en venta offline | rechazar · aceptar y dejar stock pendiente · resolución manual | **CONFLICTO → resolución manual** por el encargado (sección 6.4) |
| D5 | Rama remota `origin/requisitos_martinez` | — | ✅ **RESUELTA (2026-10-25)**: **no se usa**. Se trabaja solo sobre `main`. (La migración SaaS mantiene el timestamp `1780000000000`; no afecta) |
| D6 | Jerarquía tienda/sucursal | ✅ **RESUELTA (2026-10-25)**: se sigue el enunciado → **Empresa (suscriptor) → Sucursales**. "Tienda" = tienda física = **sucursal**. No hay tabla `tienda` | Ver §4.0 |
| D7 | ¿Qué usuarios cuentan para el límite? | ✅ **RESUELTA**: **solo empleados** (cuentas de staff: admin de empresa, encargados, cajeros). Los clientes son ilimitados. Es como lo hacen las plataformas actuales (Shopify limita "staff accounts" por plan, no clientes) | Ver §4.6 |
| D10 | Planes | ✅ **RESUELTA (2026-10-25)**: **3 planes** (el enunciado pide mínimo Básico y Profesional; se agrega Empresarial) | Ver §4.4 |
| D12 | ¿Qué se muestra en `/`? | ✅ **RESUELTA (2026-10-25) — Opción A**: `/` = página pública del SaaS (presentación, funcionalidades, planes con precios desde la BD, contratación). La portada de la tienda FashionStore pasa a `/t/fashionstore`; `/tienda` sigue igual | Estilo visual "Software" (azul `#074ce0`, Host Grotesk + Instrument Sans) solo en las páginas del SaaS; las tiendas conservan su marca |
| D11 | Rubro de cada empresa | El sistema es para empresas de **moda** (el enunciado: "empresas dedicadas a la comercialización de prendas de vestir"). Empresa A = ropa/accesorios femeninos; Empresa B = otro negocio de moda (p. ej. calzado o ropa deportiva) | Tallas, colores, temporadas y el vestidor virtual tienen sentido en moda; un rubro totalmente distinto queda fuera del alcance |
| D8 | Catálogo | ✅ **RESUELTA (2026-10-25)**: **un catálogo por empresa**, compartido por todas sus sucursales; stock por sucursal/almacén | Rubro único: moda y accesorios femeninos (ropa, carteras, cosméticos…) como **categorías** |
| D9 | Límite de sucursales | ✅ **RESUELTA**: total de la empresa | — |

---

## 1. Análisis: qué hay

| Área | Estado actual | Reutilizable para el SaaS |
|---|---|---|
| Backend NestJS 12 + TypeORM + PostgreSQL | 17 módulos, 8 migraciones, Swagger, Jest | Sí, es la base |
| Auth | JWT `{sub,email,rol}` + refresh token rotado | Sí, se le agrega `tid` (tenant) |
| Roles | CLIENTE, ADMIN, ENCARGADO, ENCARGADO_SUCURSAL, CAJERO, PROVEEDOR | Sí, se agrega SUPER_ADMIN |
| Acceso por sucursal | `BranchAccessService` + `usuario_sucursal` | Sí, el patrón se replica para tenant |
| **Idempotencia** | `client_request_id` (uuid) + índices únicos en `venta`, `reserva`, `pago` | **Clave para la sincronización offline** (RNF05) |
| Reportes | `ReportsService` con filtros (fechas, sucursal, almacén) y alcance por rol | **Son las "tools" de los reportes con IA** |
| IA | `POST /ai/reporte-voz`: mete datos fijos en el prompt (no filtra, no consulta según la pregunta) | Hay que rehacerlo con tool use |
| Export | Frontend ya tiene `jspdf`, `xlsx`, `recharts` | Sí, para reportes dinámicos |
| Frontend web | React 19 + Vite + TanStack Query; `src/offline/{db,queue,sync}.ts` **vacíos** | Base para PWA |
| Móvil | Expo 57 + Zustand + SecureStore; **sin SQLite** | Base para offline |
| RA / vestidor | MediaPipe (web) y probador móvil | Se conserva (exigido) |
| Despliegue | Backend en Render, frontend con `vercel.json` | Sí |
| `docs/` | Vacía | Aquí va el plan y el ICONIX |

## 2. Análisis: qué falta

1. **Tenant**: no existe ninguna entidad `empresa`; ninguna tabla tiene `id_empresa`. Hay `UNIQUE` globales que chocan en multitenant (`categoria.nombre`, `usuario.email`, `venta.numero_comprobante`, `reserva.codigo`).
2. **Planes y suscripciones**: no existen (`plan`, `suscripcion`, límites, features).
3. **SUPER_ADMIN de plataforma** y panel para registrar empresas.
4. **PWA**: sin manifest, sin service worker, sin IndexedDB.
5. **Offline móvil**: sin SQLite ni cola de operaciones.
6. **Endpoint de sincronización** por lotes con estados por operación y registro (observabilidad).
7. **Detección/gestión de conflictos** (stock, precio, producto inactivo, suscripción vencida).
8. **Cambios de prendas** dentro de un plazo (hoy solo hay devoluciones).
9. **Reportes generativos reales**: interpretar → elegir reporte → filtros → consulta controlada → tabla/gráfico → PDF/Excel.
10. **Módulo ML**: datos sintéticos, modelo supervisado, no supervisado, métricas, dashboard.
11. **ICONIX + UML 2.5**: casos de uso, dominio, robustez, secuencia, clases, BD.
12. **Pruebas** de aislamiento entre tenants, idempotencia, sincronización y límites de plan.

## 3. Análisis: qué cambia

| Componente | Cambio |
|---|---|
| Esquema BD | `id_empresa` en todas las tablas de negocio + índices compuestos `(id_empresa, …)`; UNIQUE pasan a ser por tenant |
| JWT | payload `{ sub, email, rol, tid }`; login resuelve la empresa |
| Guards | nuevo `TenantGuard` (estado de suscripción) + `PlanGuard` (`@RequiresFeature('AI_REPORTS')`) |
| Servicios | todo `find`/`QueryBuilder` filtra por `tenantId` (vía contexto de request) |
| Rol ADMIN | pasa a significar **admin de empresa**; se agrega `SUPER_ADMIN` (plataforma) |
| Seeds | crean 2 planes, 2 empresas de prueba (A y B) con sus admins, sucursales y catálogo |
| `/ai/reporte-voz` | reemplazado por `/ai/reports/query` con tool use |
| Frontend/móvil | guardan `tid`, muestran plan, y ocultan IA en plan Básico (el backend igual lo bloquea) |

---

## 4. Diseño multitenant (Desafío VI)

**Concepto:** *multitenant con base compartida y aislamiento lógico* = una sola base PostgreSQL; cada fila sabe a qué empresa pertenece (`id_empresa`), y el backend **siempre** filtra por la empresa del usuario autenticado.

### 4.0 Jerarquía (D6)
```
Plataforma FashionStore (SUPER_ADMIN)
 └── Empresa / Suscriptor = TENANT (contrata 1 plan)   ← límite de aislamiento de datos
      ├── Catálogo único (categorías: ropa, carteras, cosméticos, accesorios…)
      ├── Clientes y empleados
      ├── Sucursal A (tienda física) → almacenes, cajas, inventario, ventas
      └── Sucursal B (tienda física) → …        (cantidad limitada por el plan)
```
- El suscriptor se registra → se crea su **Empresa** → crea sus **tiendas físicas como sucursales** hasta el límite del plan.
- El aislamiento fuerte (Empresa A no ve nada de B) es por `id_empresa`. Dentro de la empresa, el acceso por sucursal se controla con rol + `usuario_sucursal` (ya existe).
- Un negocio totalmente distinto (otro rubro/catálogo) = **otra suscripción** (otra empresa).

### 4.1 Entidades nuevas
```
plan(id_plan, codigo[BASICO|PROFESIONAL|EMPRESARIAL], nombre, max_sucursales, max_usuarios,
     features jsonb, precio_ref, activo)          -- NULL = ilimitado
empresa(id_empresa, nombre, slug UNIQUE, nit, estado[ACTIVA|SUSPENDIDA], plazo_cambio_dias, created_at)
suscripcion(id_suscripcion, id_empresa, id_plan, fecha_inicio, fecha_vencimiento,
            estado[ACTIVA|VENCIDA|CANCELADA], created_at)   -- historial: una ACTIVA por empresa
```
Límites y features son **configurables en BD** (requisito 9.4), no hardcodeados.

### 4.2 Tablas que reciben `id_empresa`
usuario*, usuario_sucursal, sucursal, almacen, categoria, talla, color, temporada, coleccion, proveedor, producto, variante_producto, inventario, movimiento_inventario, caja, turno_caja, carrito, venta, detalle_venta (vía venta), pago, reserva, devolucion, promocion, interaccion_cliente, refresh_session (vía usuario).
`ciudad` y `rol` quedan globales. (*) SUPER_ADMIN tiene `id_empresa = NULL`.

### 4.3 Mecanismo de aislamiento (defensa en capas) — IMPLEMENTADO

```
Petición ──► JwtAuthGuard (token → idEmpresa del claim `tid`)
         ──► TenantContextInterceptor → TenantContext (AsyncLocalStorage)
                 usuario logueado → su empresa (el header X-Tenant se ignora)
                 público          → X-Tenant: <slug>  ó  empresa por defecto
                 SUPER_ADMIN      → sin filtro (modo plataforma)
         ──► Servicio / TypeORM ──► conexión PostgreSQL
                 tenant-rls.ts: set_config('app.tenant_id', <empresa>) en esa conexión
         ──► PostgreSQL RLS: política tenant_isolation en 22 tablas
                 USING      → solo se LEEN/EDITAN/BORRAN filas de esa empresa
                 WITH CHECK → solo se ESCRIBEN filas de esa empresa
```

1. **JWT con `tid`** y **TenantContext** por request (AsyncLocalStorage).
2. **Row Level Security (RLS)** de PostgreSQL como filtro **obligatorio y central**: aunque un servicio olvide filtrar, la BD no devuelve filas de otra empresa. Cubre también las consultas SQL directas de reportes. Se eligió en lugar de editar ~200 consultas una por una: menos riesgo de olvidos y se explica mejor en la defensa ("el aislamiento lo garantiza la base de datos").
3. **Al crear**, `id_empresa` lo pone `TenantSubscriber` desde el contexto, **nunca** del body.
4. **Recursos por id de otra empresa → 404** (no 403), para no revelar que existen: lo hace RLS automáticamente.
5. **Requisito**: el backend debe conectarse con un rol **sin** superusuario ni BYPASSRLS. Al arrancar, el log indica si el aislamiento está activo. En local: `backend/scripts/crear-rol-app.sql`. En Render: verificar en el log de arranque.
6. **Pruebas**: unitarias (interceptor, JWT, auth) + E2E con 2 empresas (ver bitácora). Automatizadas en `backend/test/tenant-isolation.e2e-spec.ts` (`npm run test:e2e:tenant`).

### 4.4 Planes y suscripción — IMPLEMENTADO
- `PlanService` (`backend/src/tenancy/plan.service.ts`):
  - `asegurarFuncionalidad(empresa, 'aiReports')` → usado con `@RequiresFeature('aiReports')` en `POST /ai/reporte-voz`.
  - `asegurarCupo(empresa, 'sucursales')` → al crear/reactivar una sucursal (= tienda física; total de la empresa).
  - `asegurarCupo(empresa, 'usuarios')` → al crear un empleado (rol ≠ CLIENTE, D7).
  - `asegurarVigente(empresa)` → `SubscriptionInterceptor` bloquea **POST/PUT/PATCH/DELETE** si la suscripción venció o la empresa está suspendida; las consultas (GET) siguen permitidas. Excepciones con `@AllowWithoutSubscription()`: login/refresh/logout y `POST /tenant/suscripcion` (para poder renovar).
- Respuestas 403 con `code`: `LIMITE_DEL_PLAN`, `PLAN_SIN_FUNCIONALIDAD`, `SUSCRIPCION_VENCIDA`, `EMPRESA_SUSPENDIDA` (el frontend puede mostrar un mensaje claro).
- Si baja de plan y ya excede un límite: no se borra nada; solo se bloquea crear/activar más.
- Valores de referencia (configurables en BD):

| Límite / feature | Básico | Profesional | Empresarial |
|---|---|---|---|
| Sucursales activas (tiendas físicas) | 2 | 10 | Ilimitadas |
| Empleados (cuentas de staff) | 5 | 20 | Ilimitados |
| Clientes | Ilimitados | Ilimitados | Ilimitados |
| Productos, ventas, reservas, offline, reportes convencionales, KPIs | Sí | Sí | Sí |
| Reportes por voz / generativos con IA | No | Sí | Sí |
| Analítica ML (predicción, segmentación) | No | No _(propuesta)_ | Sí |
| Precio de referencia (simulado) | _por definir_ | _por definir_ | _por definir_ |

Básico y Profesional respetan la tabla del enunciado (§9.4); Empresarial es aporte del equipo. Todo es configurable en la tabla `plan`.
- Suscripción vencida → **solo lectura** hasta renovar (decisión tomada).

**Endpoints SUPER_ADMIN** (`/platform`, Swagger: "Plataforma SaaS"):

| Método y ruta | Para qué (enunciado) |
|---|---|
| `GET /platform/planes` · `PATCH /platform/planes/:id` | ver y **configurar** límites/funcionalidades (§9.4) |
| `GET /platform/empresas` · `GET /platform/empresas/:id` | empresas con plan, vigencia y uso |
| `POST /platform/empresas` | **registrar empresa** + plan + **administrador** (§9.3) |
| `PATCH /platform/empresas/:id/estado` | activar / suspender |
| `POST /platform/empresas/:id/suscripcion` | **asignar, cambiar o renovar plan** (§9.5); la anterior queda `CANCELADA` en el historial |
| `GET /platform/empresas/:id/suscripciones` | historial |
| `PATCH /platform/empresas/:id/suscripcion/vencimiento` | simular vencimiento (pruebas y defensa) |

**Endpoints de la empresa** (`/tenant`): `GET /tenant/me` (plan, vigencia, días restantes, límites y uso), `POST /tenant/suscripcion` (el ADMIN cambia/renueva su plan, contratación simulada), `GET /tenant/suscripciones` (historial).

### 4.5 Migración de datos existentes
Migración `1780000000000-AddMultitenancy`: crea `plan/empresa/suscripcion`, crea **Empresa A = "FashionStore"** con todos los datos actuales, agrega `id_empresa` (primero nullable → backfill → NOT NULL), reemplaza UNIQUE globales por compuestos. `npm run seed:demo` crea la **Empresa B "Urban Step"** (`urban-step`, plan Básico, calzado y ropa deportiva) con 2 sucursales, almacenes, cajas, 5 usuarios, catálogo, inventario y 3 ventas; y el SUPER_ADMIN de la plataforma. No corre en producción.

### 4.6 Clientes vs. empleados (cómo funciona)
Ambos están en la tabla `usuario` con su `id_empresa`; lo que los diferencia es el **rol**.

| | Cliente | Empleado (staff) |
|---|---|---|
| Quién | Persona que compra en la tienda online o en caja | Admin de empresa, encargado, encargado de sucursal, cajero |
| Cómo se crea | Se registra sola en la tienda online de **esa** empresa (`/t/:slug`) o la registra el cajero | Lo crea el admin de la empresa desde el panel |
| ¿Cuenta para el límite? | **No** | **Sí** (`max_usuarios`) |
| Email | Único dentro de la empresa | Único dentro de la empresa |
| Login | En `/t/:slug/login` → el sistema sabe la empresa por el slug | En el panel: email + empresa (slug); el token lleva `tid` |

- Si María compra en la Empresa A y en la Empresa B, tiene **dos cuentas independientes**; A no ve que María es clienta de B.
- Al crear o reactivar un empleado: `PlanService.assertLimit(tid, 'max_usuarios')` cuenta los usuarios activos con rol ≠ CLIENTE. Si se llega al límite → error "Tu plan permite N empleados; mejora tu plan".

---

## 5. PWA web (Desafío II)

**Conceptos:** *Web App Manifest* = archivo que hace la app instalable; *Service Worker* = script que intercepta peticiones y cachea recursos para que la app abra sin internet; *IndexedDB* = base de datos del navegador que persiste al cerrar.

**Implementado (v1.5):**
- `vite-plugin-pwa` (Workbox) en `vite.config.ts` → manifest (instalable, íconos en `public/pwa-*.png`) + service worker que precachea la app; cualquier ruta abre `index.html` sin conexión. Los datos **no** van en la caché del service worker.
- `Dexie` sobre IndexedDB (`src/offline/db.ts`), base `fashionstore-offline`: `catalogos` (foto de `/sync/catalog` por empresa y sucursal) y `operaciones` (cola). Todo separado por empresa y usuario.
- `src/offline/queue.ts`: `encolar()` crea el `operationId` (UUID) una sola vez; estados `PENDIENTE → ENVIANDO → CONFIRMADA | RECHAZADA | CONFLICTO`. Nada se borra solo: el usuario quita de la lista las ya resueltas (requisito 5.4).
- `src/offline/sync.ts`: envía al volver la red, al iniciar sesión, al encolar y cada minuto; lotes de 100; backoff 5 s → 5 min; si la pestaña se cerró en pleno envío, las operaciones vuelven a la cola al reabrir.
- `src/offline/turno.ts`: el POS guarda el turno abierto; `features/offline/OfflinePos.tsx` vende sin conexión (minorista, con pago) y `OfflineStore.tsx` deja reservas de la clienta.
- Sesión: si la página se recarga sin red, se sigue con el último usuario conocido (solo se cierra si el servidor rechaza el token). Límite: la sesión vive en `sessionStorage`, así que hay que iniciar sesión con internet en esa ventana.
- UI: indicador flotante (abajo a la izquierda) con conexión, cantidad por enviar y la lista con el resultado de cada operación; aviso "Listo para vender sin conexión" en el POS; panel **Sincronización offline** para ADMIN/ENCARGADO/ENCARGADO_SUCURSAL.

## 6. Móvil offline (Desafío III) y sincronización (Desafío IV)

### 6.1 Móvil
- `expo-sqlite` con migraciones locales. Tablas: `producto`, `variante`, `inventario_local`, `sucursal`, `cliente_min`, `venta_local` + `detalle_venta_local`, `reserva_local` + `detalle_reserva_local`, `operacion_pendiente`, `sync_log`. FKs activas (`PRAGMA foreign_keys=ON`).
- `@react-native-community/netinfo` para detectar conexión.
- Pantallas: descargar catálogo, POS/venta offline, reserva offline, pendientes, resultado de sync.

### 6.2 Contrato de sincronización (compartido PWA y móvil) — implementado en `backend/src/sync/`
```
GET  /sync/catalog?sucursal=ID
  -> { serverTime, sucursal{idSucursal,nombre},
       productos: [ { idProducto, nombre, categoria, imagenUrl, precio, precioFinal,
                      variantes: [ { idVariante, sku, talla, color, stockDisponible } ] } ] }
POST /sync/operations
  { deviceId, operations: [ { operationId(uuid), type: VENTA|RESERVA, idSucursal, createdAtLocal,
      payload{ detalles[{idVariante, cantidad, precioUnitario?}], idTurno?, idCaja?, idUsuario?,
               modalidadComercial?, catalogoDescargadoEn? } } ] }      (máx. 100 por lote)
  -> { serverTime, results: [ { operationId, status: CONFIRMADA|RECHAZADA|CONFLICTO, serverId,
                                conflictos[], reason, duplicada, alternativas? } ] }
Panel (ADMIN, ENCARGADO, ENCARGADO_SUCURSAL solo sus sucursales):
GET   /sync/operaciones?pendientes=true     GET /sync/resumen
PATCH /sync/operaciones/:id/resolver  { nota }
```
- `catalogoDescargadoEn` = el `serverTime` del catálogo con el que se vendió (para la regla de precios).
- `since` (descarga incremental) se deja para después: el catálogo de una tienda de moda es chico y la descarga completa es más simple y segura.
Estados locales: `LOCAL → ENVIADA → CONFIRMADA | RECHAZADA | CONFLICTO` (y vuelve a `LOCAL` si falla la red).

### 6.3 Reglas en el servidor
- Idempotencia: `operationId` = `client_request_id` (ya existe en venta/reserva). Reenvío → devuelve el resultado ya registrado (RNF05).
- Cada operación valida tenant + sucursal + rol. Las operaciones se procesan en el orden en que se crearon en el dispositivo; si una se rechaza, las demás siguen.
- Suscripción vencida (solo lectura): el lote completo recibe `403 SUSCRIPCION_VENCIDA` y las operaciones **quedan pendientes en el dispositivo** hasta renovar. Así no se pierden ventas que ya ocurrieron (cambio respecto a la versión anterior, que decía `RECHAZADA`).
- Error inesperado del servidor (BD caída) → el lote corta con 500 y el dispositivo reintenta; las ya procesadas devuelven su resultado guardado.
- Cada venta en **transacción** con su movimiento de inventario (RNF04).
- Tabla `operacion_sync` (operation_id, id_empresa, id_sucursal, device_id, tipo, estado, motivo, intentos, timestamps) → observabilidad sin guardar datos sensibles (RNF10).
- Reintentos con backoff en el cliente (RNF06).

### 6.4 Conflictos
| Caso | Resultado |
|---|---|
| Venta presencial offline y el stock del servidor ya no alcanza | Se **registra** igual (la prenda ya se entregó y se cobró), el stock baja hasta 0 (nunca negativo) y se marca `CONFLICTO` tipo `STOCK` con el faltante → el encargado hace ajuste de inventario y lo marca como resuelto |
| Reserva offline y el stock ya no alcanza | No se crea: `CONFLICTO` tipo `SIN_STOCK` + `alternativas` (otras sucursales con stock) para ofrecer al cliente |
| Precio cambió desde la descarga | la venta se registra con el **precio cobrado**; sin aviso si el catálogo tenía ≤ `SYNC_VENTANA_PRECIO_HORAS` (24 h por defecto) al vender; si no, `CONFLICTO` tipo `PRECIO` |
| Producto/variante inactiva, inexistente o de otra empresa | `RECHAZADA` (queda en el panel para revisión) |
| Sucursal no autorizada o rol sin permiso (p. ej. CLIENTE enviando una venta) | `RECHAZADA` |
| Suscripción vencida | el lote recibe 403 y queda pendiente en el dispositivo (ver §6.3) |
| Venta en un turno que se cerró antes de sincronizar | se registra + `CONFLICTO` tipo `TURNO_CERRADO` (revisar el arqueo) |
| Operación ya confirmada | devuelve `CONFIRMADA` con el mismo `serverId` |

### 6.4.1 Caso: dos clientes compran la última unidad al mismo tiempo, ambos sin internet

**Primero: ¿es el mismo stock?** El inventario es **por sucursal/almacén**. Si las dos compras ocurren en **sucursales distintas**, cada una vende sus propias prendas físicas → **no hay conflicto**. El conflicto solo existe si ambas operaciones descuentan del **mismo inventario** (misma sucursal con dos cajas, o venta presencial vs. venta/reserva online del mismo stock).

**Regla de desempate: gana la primera operación que llega y se confirma en el servidor**, no la que tiene la hora local más temprana:
- La hora del dispositivo no es confiable (relojes desfasados, se puede cambiar a mano).
- Si ganara la hora local, el servidor tendría que **deshacer** una venta ya confirmada cuando llegue otra "más antigua" → rompe la integridad (RNF04).
- "Al mismo tiempo" no existe para el servidor: confirma cada operación en una transacción con **bloqueo de fila** (`SELECT … FOR UPDATE` sobre el inventario), así que siempre hay una primera y una segunda.

**Qué pasa con la segunda según el tipo:**
| Segunda operación | Resultado | Por qué |
|---|---|---|
| Venta presencial (prenda ya entregada y cobrada) | Se acepta → `CONFLICTO_STOCK` + ajuste de inventario | Es un hecho físico; rechazarla dejaría una venta real sin registrar. Que haya dos entregas de "la última unidad" indica que el stock del sistema estaba mal |
| Reserva / venta online (aún no entregada) | `CONFLICTO` → no se descuenta, se notifica y se ofrece alternativa | Todavía no se entregó nada; se puede reubicar al cliente |

La hora local (`createdAtLocal`) **se guarda** para auditoría y para mostrar el orden real en el panel de conflictos.

**Prevención (extra):** stock de seguridad offline (no vender offline la última unidad si el stock local ≤ N) y aviso "stock bajo, confirma disponibilidad física".

### 6.5 Cambios de prendas (aporte exigido)
Entidad `cambio` (venta origen, variante devuelta → variante entregada, diferencia de precio) validando `fecha_venta + empresa.plazo_cambio_dias`. Reutiliza movimientos de inventario de `returns`.

---

## 7. Reportes generativos con IA (Desafío V)

**Concepto:** *tool use* = el modelo no escribe SQL; solo elige una herramienta de una lista cerrada y propone parámetros en JSON. El backend valida y ejecuta. Así se cumple "evitar consultas arbitrarias" (8.4 Seguridad).

```
Usuario (texto/voz) → POST /ai/reports/query
   → PlanGuard(AI_REPORTS) → LLM con tools:
        ventas_por_periodo(desde,hasta,agrupar:[dia|semana|mes], sucursales?)
        ventas_por_sucursal(desde,hasta)
        top_productos(desde,hasta,limite,categoria?)
        stock_bajo(sucursal?,umbral?)
        ingresos_por_categoria(desde,hasta)
        comparar_sucursales(periodos)
        reservas_por_estado(desde,hasta)
        pedir_aclaracion(pregunta)   ← solicitudes ambiguas
   → backend valida params (DTO) + inyecta tenant y sucursales permitidas
   → ReportsService (consultas reales, ya existentes)
   → respuesta: { titulo, columnas, filas, chart:{tipo,x,y}, narrativa, filtrosAplicados }
Frontend: tabla + gráfico (recharts) + exportar PDF/Excel (jspdf/xlsx ya instalados)
Voz: Web Speech API (web) / expo-speech-recognition (móvil)
```
Mínimo 4 tipos de reporte con filtros variables y datos reales. El modelo nunca ve el tenant como parámetro editable.

### 7.1 Módulo de analítica con ML (8.4–8.5)
Microservicio **Python + FastAPI** (`ml-service/`), lo que también cubre la exigencia de Python/FastAPI:
- Generador de **datos sintéticos** (ventas por producto/semana/sucursal con estacionalidad).
- **Supervisado**: predicción de demanda semanal por producto (RandomForest/GradientBoosting) — métricas MAE, RMSE, R².
- **No supervisado**: segmentación de clientes RFM (K-Means, silhouette) y/o anomalías de ventas (IsolationForest).
- Endpoints `/predict/demand`, `/segments`, `/metrics`; NestJS los consume con alcance de tenant.
- Dashboard analítico en el frontend.

---

### 7.2 Dashboard de KPIs (A2)
Por empresa, filtrable por sucursal y período; sobre `ReportsService` (`/reports/dashboard` ya existe):
- Ventas totales y variación vs. período anterior · Ticket promedio · Unidades vendidas
- Ventas por sucursal y por canal (presencial/digital)
- Top productos y categorías por ingreso · Stock crítico · Rotación de inventario
- Reservas: conversión a venta y cancelación · Devoluciones/cambios sobre ventas
- Conflictos de sincronización abiertos
- Uso del plan: sucursales y usuarios usados vs. límite

## 8. Dónde usar tools, skills o un arnés de IA

| Lugar | ¿Usar IA? | Cómo |
|---|---|---|
| **Reportes generativos** | **Sí, es el núcleo** | Arnés pequeño en el backend: tool use con tools cerradas sobre `ReportsService`, validación, límite de iteraciones, log de cada llamada. Es el mismo patrón del arnés del chatbot, pero **escrito aparte en esta rama** (no se mezcla `feat/ai-harness`). |
| Narrativa del reporte | Sí (extensión) | El LLM resume los datos ya calculados; no inventa cifras. |
| Sincronización y conflictos | **No** | Deben ser reglas deterministas y testeables (RNF04/05). Un LLM aquí daría resultados no reproducibles. |
| Aislamiento multitenant | **No** en runtime | Código + pruebas. |
| **Desarrollo (Claude Code skills)** | Sí | Skill `tenant-audit`: revisa que cada entidad/servicio filtre por `id_empresa`. Skill `uml-sync`: genera PlantUML de clases/BD desde las entidades TypeORM (RNF12). Skill `sync-tests`: plantillas de pruebas de idempotencia/conflictos. |
| Verificación | Sí | Un agente separado revisa el aislamiento entre tenants sin haber escrito el código. |

---

## 9. ICONIX (Desafío I) — entregables en `docs/iconix/`

**Concepto:** ICONIX va de casos de uso → modelo de dominio → diagramas de robustez (Boundary/Control/Entity) → secuencia → clases → código, y cada paso se revisa contra el anterior.

1. Requisitos (RF/RNF) y reglas de negocio nuevas.
2. Casos de uso nuevos/modificados: Registrar empresa, Gestionar suscripción, Cambiar plan, Registrar venta offline, Registrar reserva offline, Sincronizar operaciones, Resolver conflicto, Registrar cambio de prenda, Solicitar reporte generativo, Consultar dashboard ML.
3. Modelo de dominio actualizado (Empresa, Plan, Suscripción, OperacionSync, Cambio).
4. Robustez por caso de uso principal.
5. Secuencia: login multitenant, venta offline + sync, reporte IA.
6. Clases y diseño de BD (PostgreSQL + SQLite + IndexedDB).
Formato: PlantUML/Mermaid versionado junto al código.

---

## 10. Fases y tareas

### Por dónde empezamos (orden de trabajo)

Regla: **primero el modelo de datos, después todo lo demás**. Offline, sincronización e IA dependen de que cada registro ya tenga su `id_empresa` .

| Paso | Qué | Por qué va aquí |
|---|---|---|
| 1 | Cerrar D1, D3 | Cambian la migración; decidir después obliga a rehacerla |
| 2 | Modelo de dominio ICONIX (Empresa, Plan, Suscripción + entidades existentes) | ICONIX pide dominio antes que código |
| 3 | Entidades `Plan`, `Empresa`, `Suscripcion` + migración `AddMultitenancy` con backfill a Empresa A | Base de todo |
| 4 | `tid` en JWT + `TenantContext` + `SUPER_ADMIN` | Sin esto no se puede filtrar |
| 5 | Filtro por tenant módulo por módulo: branches → catalog → inventory → sales → reservations → resto | Del más usado al menos usado; probar cada uno |
| 6 | Seed Empresa B + pruebas de aislamiento A↔B | Demuestra RNF02 |
| 7 | Planes: `PlanGuard`, límites de sucursales/usuarios, `/platform/*`, `/tenant/me` | Depende de que el tenant ya funcione |

### Fase 1 — Multitenant + planes y límites (→ Presentación 1)
- [ ] 1.1 ICONIX: requisitos, casos de uso y modelo de dominio — ✅ modelo de dominio (`docs/iconix/01-modelo-dominio.md`); faltan requisitos y casos de uso
- [x] 1.2 Entidades `Plan`, `Empresa`, `Suscripcion` + migración multitenant con backfill (`1780000000000-AddMultitenancy`, probada up/down)
- [x] 1.3 `tid` en JWT, `TenantContext`, rol `SUPER_ADMIN`: login/registro por empresa (`empresa` = slug), header `X-Tenant` para endpoints públicos, interceptor global que llena el contexto, tokens antiguos → Empresa A
- [x] 1.4 Filtro por tenant en todos los servicios → resuelto con **RLS** (migración `1780000000001-EnableTenantRowLevelSecurity`) + `tenant-rls.ts`; endpoints públicos reconocen el token si viene
- [x] 1.5 `PlanService` + `SubscriptionInterceptor` + límites de sucursales y usuarios + IA solo en planes que la incluyen
- [x] 1.6 Endpoints `/platform/*` y `/tenant/*`; seeds Empresa A y B (`npm run seed:demo`)
- [x] 1.7 Pruebas de aislamiento A↔B (9 E2E) y de planes (11 E2E + 12 unitarias)
- [x] 1.8 Frontend
  - [x] 1.8.0 Página pública del SaaS (`/`) + contratación `/contratar` (auto-registro de empresa, sesión iniciada) + campo *Empresa* en el login
  - [x] 1.8.1 Dashboard de la empresa: "Mi plan" (plan, vigencia, uso vs. límites, cambiar/renovar) y avisos (por vencer, vencida, límite alcanzado, IA bloqueada)
  - [x] 1.8.2 Panel del SUPER_ADMIN en `/plataforma` (empresas, planes, suscripciones)
  - [x] 1.8.3 Tienda online por empresa `/t/:slug` (catálogo con `X-Tenant`, registro y login de clientes por tienda)

### Fase 2 — Offline + sync (→ Presentación 2)
- [x] 2.1 `/sync/catalog` y `/sync/operations` + tabla `operacion_sync` (migración `1780000000003-AddOperacionSync`, con RLS)
- [x] 2.2 Reglas de conflicto + panel de resolución
  - [x] Backend: reglas de §6.4 y endpoints del panel (`/sync/operaciones`, `/sync/resumen`, `/resolver`)
  - [x] Pantalla del panel en la web (`features/sync/SyncPanelPage.tsx`)
- [x] 2.3 PWA: manifest, service worker, Dexie, cola, UI de estados (ver §5)
- [ ] 2.4 Móvil: expo-sqlite, cola, netinfo, pantallas offline
- [ ] 2.5 Cambios de prendas con plazo
- [ ] 2.6 Pruebas: idempotencia, reintento, conflicto de stock (incluido el caso de dos ventas simultáneas de la última unidad, §6.4.1), persistencia tras reinicio
  - [x] Servidor: `backend/test/tenant-sync.e2e-spec.ts` (11 E2E)
  - [x] Web: recarga sin conexión, venta y reserva offline, reconexión y resultado (Playwright, modo offline)
  - [ ] App móvil (con la 2.4)

### Fase 3 — Voz + KPIs + IA + ML (→ Presentación 3)
- [ ] 3.1 `/ai/reports/query` con tools y validación; ≥4 tipos de reporte
- [ ] 3.2 UI de reportes: texto/voz, tabla, gráfico, PDF/Excel
- [ ] 3.3 `ml-service` FastAPI: datos sintéticos, supervisado, no supervisado, métricas
- [ ] 3.4 Dashboard de KPIs + dashboard analítico ML
- [ ] 3.5 Despliegue en la nube (backend + ml-service + frontend)

### Fase 4 — Cierre (antes de la defensa)
- [ ] 4.1 UML coherente con el código final (robustez, secuencia, clases, BD)
- [ ] 4.2 Plan y casos de prueba documentados
- [ ] 4.3 Ensayo de la defensa con Empresa A y B

---

## 12. Cómo llegar a producción sin romper lo que ya funciona

`main` está en producción (backend en Render con su PostgreSQL, web en Vercel, app móvil apuntando a Render). Todo el trabajo va en `feat/saas` y se sube **una sola vez**, cuando esté probado.

### 12.1 Reglas de compatibilidad (para no romper producción)
1. **Los datos actuales se convierten en la Empresa A = "FashionStore"** con plan Profesional; no se pierde nada.
2. **Rutas viejas siguen vivas**: `/tienda`, `/login`, etc. → Empresa A. Las nuevas empresas usan `/t/:slug/...`.
3. **Tokens sin `tid`** (sesiones abiertas o la app móvil ya instalada) → el backend asume Empresa A hasta que vuelvan a iniciar sesión.
4. **La migración tiene `down()`** (para revertir) y se prueba antes sobre una **copia de la BD de producción**.
5. Ojo: `app.module.ts` ejecuta las migraciones **automáticamente** en producción (`migrationsRun` con `NODE_ENV=production`). Por eso la migración se prueba antes y se hace respaldo justo antes del deploy.

### 12.2 Flujo de trabajo
| Etapa | Qué se hace |
|---|---|
| Desarrollo | Rama `feat/saas`, BD local. Commits pequeños por tarea del plan |
| Prueba de migración | `pg_dump` de producción → restaurar en una BD local → correr la migración → verificar que todo sigue funcionando como Empresa A |
| Staging (recomendado) | Un segundo servicio en Render + BD de prueba desplegando `feat/saas`, y un preview de Vercel. Ahí se prueba con Empresa A y B como en producción |
| Pull Request | `feat/saas` → `main` con checklist (abajo). `feat/ai-harness` no se mezcla |
| Deploy | 1) respaldo `pg_dump` de producción · 2) merge a `main` → Render despliega backend y corre migración · 3) Vercel despliega web · 4) nuevo build de la app móvil |
| Verificación | Login Empresa A, venta, reserva, reportes; crear Empresa B y comprobar aislamiento |
| Plan B | Si falla: revertir el merge y restaurar el respaldo (o `migration:revert`) |

### 12.3 Checklist antes del merge
- [ ] Tests de backend en verde (incluidos aislamiento A↔B, límites de plan, idempotencia)
- [ ] Migración probada sobre copia de producción (up y down)
- [ ] Rutas viejas y app móvil instalada siguen funcionando
- [ ] Variables de entorno nuevas configuradas en Render/Vercel
- [ ] Respaldo de la BD de producción hecho

## 13. Cómo probar el SaaS en local

> Haz un respaldo de tu BD local antes de migrar: `pg_dump -U postgres -Fc fashionstore > respaldo.dump`

| # | Paso | Comando (dentro de `backend/`) |
|---|---|---|
| 1 | Migrar como dueño de las tablas | `.env` con `DB_USER=postgres` → `npm run migration:run` |
| 2 | Crear el rol sin superusuario | `psql -U postgres -d fashionstore -f scripts/crear-rol-app.sql` |
| 3 | Crear la Empresa B y el SUPER_ADMIN | `npm run seed:demo` |
| 4 | Cambiar el backend al rol normal | `.env`: `DB_USER=fashion_app` y `DB_PASSWORD=fashion_app_local` |
| 5 | Arrancar y revisar el log | `npm run start:dev` → debe decir *"Aislamiento por empresa activo en la base de datos (RLS)"* |
| 6 | Pruebas automáticas | `npm run test:e2e:tenant` → 36 pruebas en verde (aislamiento + planes + SaaS público + sincronización) |

Usuarios de prueba (contraseña `demo1234`):

| Empresa | Email | Login |
|---|---|---|
| A — FashionStore | `ADMIN_EMAIL` del `.env` | como siempre (sin `empresa`) |
| B — Urban Step | `admin@urbanstep.demo`, `encargado@…`, `encargado.centro@…`, `cajero@…`, `cliente@urbanstep.demo` | web: `/login` con Empresa `urban-step`, o clientas en `/t/urban-step/login` |
| Plataforma | `superadmin@fashionstore.saas` | `/login` sin empresa → entra a `/plataforma` |

**Probar el modo offline de la web** (el service worker solo funciona con la versión compilada):
1. `backend/.env`: `CORS_ORIGINS=http://localhost:5173,http://localhost:4173` y reiniciar el backend.
2. En `frontend`: `npm install` (dependencias nuevas), luego `npm run build` y `npm run preview` → http://localhost:4173
3. Iniciar sesión con internet (cajero con turno abierto → Punto de venta; o clienta en `/t/urban-step/tienda`). Esperar el aviso "Listo para vender sin conexión".
4. DevTools (F12) → Network → **Offline** (o Application → Service workers → Offline). Recargar: la app abre igual. Vender o reservar.
5. Volver a **No throttling**: el indicador de abajo a la izquierda envía las operaciones y muestra el resultado. Los conflictos aparecen en el dashboard del admin → **Sincronización offline**.

Rutas web para probar: `/` (página del SaaS), `/contratar`, `/t/fashionstore` (Empresa A), `/t/urban-step` y `/t/urban-step/tienda` (Empresa B), `/plataforma` (SUPER_ADMIN). La app móvil todavía no envía `empresa` (solo entra a la Empresa A).

## 11. Bitácora de avance

| Fecha | Avance | Notas |
|---|---|---|
| 2026-10-23 | v0.1 del plan; análisis del repo | `feat/saas` = `main` @ `60d70c2`. Pendiente: D0–D5 |
| 2026-10-24 | D0 resuelta: se mantiene el stack actual y se evoluciona el sistema existente | — |
| 2026-10-25 | v0.2: fechas no vigentes; alcance A1–A7 con su origen; D6 resuelta (suscriptor con varias tiendas → sucursales); límites de tiendas/sucursales/usuarios; KPIs; caso de venta simultánea offline (§6.4.1); se restaura "Por dónde empezamos" | Pendiente: D1–D3, D7–D9 |
| 2026-10-25 | v0.3: D6/D8/D9 resueltas → se sigue el enunciado (Empresa → Sucursales; tienda física = sucursal; catálogo único por empresa); se elimina el nivel `tienda` | Pendiente: D1–D3, D7 |
| 2026-10-25 | v0.4: 3 planes (Básico, Profesional, Empresarial); D2 y D7 resueltas (clientes por empresa e ilimitados; límite solo a empleados); D11 rubro moda; §4.6 clientes vs. empleados | Pendiente: D1, D3 |
| 2026-10-25 | v0.5: propuesta para D1 (slug en URL + rutas actuales → Empresa A); §12 plan de paso a producción y compatibilidad | Pendiente: confirmar D1 y D3 |
| 2026-10-25 | v0.6: D1 y D3 resueltas; D5 revisada (conflicto con `requisitos_martinez`). **Implementado**: módulo `tenancy` (Plan, Empresa, Suscripcion, `TenantOwned`, `TenantSubscriber`, `TenantContext`), rol `SUPER_ADMIN`, `id_empresa` en 22 tablas, UNIQUE por empresa, migración `AddMultitenancy` y modelo de dominio ICONIX | Pruebas: migración up → esquema idéntico a las entidades; down → esquema original; datos asignados a Empresa A; registro, login y altas por API OK; tests unitarios igual que en `main` |
| 2026-10-25 | D5 resuelta: no se usa `requisitos_martinez`; solo `main`. `docs/iconix/*.md` son fuente técnica para el documento Word | — |
| 2026-10-25 | v0.7: tarea 1.3 completa. `TenantResolverService`, `TenantContextInterceptor`, `tid` en JWT, login con `empresa` (slug), registro por empresa, email único por empresa | Pruebas: 14 tests nuevos (auth, JwtStrategy, interceptor) en verde; prueba E2E con 2 empresas: mismo email en A y B, login por slug, SUPER_ADMIN sin empresa, refresh conserva `tid`, el header `X-Tenant` no permite cambiarse de empresa. **Pendiente**: las consultas aún no filtran por empresa (tarea 1.4) |
| 2026-10-25 | v0.8: tarea 1.4 completa con RLS. Endpoints públicos identifican al usuario si envía token. Seeds de arranque corren en la empresa por defecto. Script `backend/scripts/crear-rol-app.sql` | Pruebas E2E con rol sin superusuario y 2 empresas: catálogo, sucursales, ventas, inventario, reservas y reportes separados por empresa; leer/editar/cancelar/borrar recursos de la otra empresa → 404; crear inventario en sucursal ajena → 404; SUPER_ADMIN ve todo; con superusuario el log avisa que RLS no aplica. Migración up/down OK. 127 tests en verde (las 6 suites que ya fallaban en `main` siguen igual) |
| 2026-10-25 | v0.9: `npm run seed:demo` (Empresa B Urban Step + SUPER_ADMIN), pruebas E2E automáticas de aislamiento (`npm run test:e2e:tenant`), sección 13 "Cómo probar". `reportes-compartidos/` a `.gitignore` | 9/9 pruebas E2E en verde; con RLS desactivado en 2 tablas fallan 4 (las pruebas sí detectan fugas); con superusuario se niegan a correr. 127 tests unitarios en verde |
| 2026-10-25 | v1.0: tareas 1.5–1.7 completas. `PlanService`, `SubscriptionsService`, `SubscriptionInterceptor`, `@RequiresFeature`, `@AllowWithoutSubscription`, controladores `/platform` y `/tenant`. Backend de la Fase 1 terminado; falta el frontend (1.8) e ICONIX (1.1) | 20/20 E2E (aislamiento + planes: registro de empresa, límites de sucursales y empleados, clientes ilimitados, IA bloqueada en Básico, cambio de plan con historial, vencida = solo lectura y renovación, suspendida no entra, límites configurables) — repetible; 139 tests unitarios en verde |
| 2026-10-25 | v1.1: D12 (Opción A). Backend: `GET /saas/planes`, `GET /saas/slug-disponible`, `POST /saas/registro` (públicos, límite 5 registros/hora por IP), migración de precios referenciales (Bs 150 / 390 / 890). Frontend: `SaasLanding` en `/`, `ContratarPlan` en `/contratar`, campo Empresa en el login, Home de FashionStore en `/t/fashionstore` | 24/24 E2E (se suman 4 del SaaS público); prueba en navegador: landing sin desbordes a 1280 y 390 px, contratación → panel del admin, login de Urban Step con el campo Empresa |
| 2026-10-25 | v1.2: tarea 1.8.1. Sección **Mi plan** (ADMIN puede cambiar/renovar; ENCARGADO solo ve), avisos en el dashboard (vencida = solo lectura, vence en ≤7 días, restricción del plan devuelta por el backend vía interceptor de axios), nombre de empresa y plan en la barra superior | Prueba en navegador con Urban Step: Mi plan muestra 2 de 2 sucursales y 4 de 5 empleados; aviso de "vence en 3 días"; vencida → aviso rojo → Renovar → aviso desaparece; crear 3ª sucursal → aviso con el mensaje del plan; sin desbordes a 390 px. Nota: `APP_TIMEZONE=America/La_Paz` debe estar en Render para que las fechas de suscripción usen la hora de Bolivia |
| 2026-10-25 | v1.3: tareas 1.8.2 y 1.8.3 → **Fase 1 completa** (falta ICONIX 1.1). Panel `/plataforma` del SUPER_ADMIN (empresas con buscador, detalle con cambio de plan, vencimiento simulado, suspender/reactivar e historial; alta de empresa; edición de planes). Tienda por empresa `/t/:slug` (inicio, catálogo, login y registro de clientas; header `X-Tenant`; caché de React Query separada por usuario y tienda; sucursal recordada por tienda). Backend: `GET /saas/tiendas/:slug` | 25/25 E2E; prueba en navegador: suspender → login 403 → reactivar; precio editado se ve en `/saas/planes`; catálogo de Urban Step sin productos de FashionStore; registro en `/t/urban-step/register` → `/t/urban-step/tienda` con empresa 2; slug inexistente → "Tienda no encontrada"; sin desbordes a 390 px |
| 2026-10-26 | v1.4: Fase 1 probada en la PC del equipo (12 pruebas manuales + 25 E2E). Corrección para Windows (`storeScope.ts` → `currentStore.ts`, choque de mayúsculas). **Fase 2, backend de sincronización**: tabla `operacion_sync` con RLS, `GET /sync/catalog`, `POST /sync/operations` (ventas y reservas offline, idempotencia por `operationId`, "gana la primera que llega" con bloqueo de fila, conflictos STOCK / SIN_STOCK con alternativas / PRECIO / TURNO_CERRADO), panel `/sync/operaciones` + `/resolver`. Corrección del seed: los almacenes de Urban Step ahora se llaman `PRINCIPAL` (antes `US-A1/2`, rompía reservas y compras online de la Empresa B; `npm run seed:demo` repara una BD existente) | 36/36 E2E repetibles (11 nuevas de sincronización: última unidad venta vs. reserva vs. venta, reenvío sin duplicar, precio dentro/fuera de ventana, rechazos sin cortar el lote, panel y aislamiento A↔B). Migración up/down OK y esquema = entidades. Unitarias: 139 en verde (las 6 suites de `main` siguen igual) |
| 2026-10-26 | v1.5: **tarea 2.3 (PWA)** y pantalla del panel (2.2). Service worker + manifest (`vite-plugin-pwa`), IndexedDB con Dexie (catálogos y cola), motor de sincronización con backoff, POS sin conexión (turno y catálogo guardados, pago incluido), reservas sin conexión en la tienda, indicador flotante con la cola, panel **Sincronización offline**. Backend: la venta offline registra también su **pago** (efectivo aprobado; otros pendientes). Corrección: el campo Empresa del login tenía un `pattern` inválido en Chrome reciente | Playwright con red cortada: recarga sin conexión (service worker + sesión), 2 ventas offline → reconexión → 1 CONFIRMADA y 1 CONFLICTO (stock vaciado en el servidor mientras tanto) → el admin la ve en el panel y la resuelve; clienta reserva offline → reconexión → CONFIRMADA; sin desbordes a 1280 y 390 px; sin errores de consola. 36/36 E2E (se suma la verificación del pago) |
