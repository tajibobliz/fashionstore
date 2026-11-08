# PLAN-SAAS — Evolución de FashionStore a SaaS multitenant

> Rama: `feat/saas` (creada desde `main` @ `60d70c2`). `main` = producción, no se toca.
> `feat/ai-harness` queda aparte (otra presentación). No se usa OpenSpec: este archivo es el plan y la bitácora de avance.
> Fuente de requisitos: Examen Parcial 2 — Sistemas de Información 2 (S2-2026).
> Versión: v1.27 (2026-11-08)

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
| Analítica ML (predicción, segmentación, anomalías) | No | Sí (v1.10, CU12) | Sí |
| Medios de pago de la tienda para sus clientas (tarjeta, QR, transferencia, efectivo al retirar, contra entrega) | Sí | Sí | Sí |
| Pago diferido de pedidos hechos sin conexión (CU16, feature `pagosOnline`) | No | No | **Sí** (lo que hace a Empresarial el plan más completo) |
| Precio de referencia (simulado) | **US$ 19/mes** | **US$ 49/mes** | **US$ 119/mes** |

Básico y Profesional respetan la tabla del enunciado (§9.4); Empresarial es aporte del equipo. Todo es configurable en la tabla `plan`.
- Suscripción vencida → **solo lectura** hasta renovar (decisión tomada).

### 4.4.1 Moneda: planes en USD, cada tienda en su moneda — implementado (v1.16)
**Regla:** los **planes** de la plataforma se cobran en **dólares (USD)**, iguales en todos los países; cada **tienda** vende en **su propia moneda** (`empresa.moneda`). La moneda no depende de dónde esté quien mira la página sino de **quién vende**: una tienda de Santa Cruz cobra en Bs aunque la vea alguien desde Chile.
- Migración `1780000000008-MonedaEmpresaYPlanesUsd`: `empresa.moneda` (ISO 4217, por defecto `BOB`, CHECK con BOB, USD, ARS, BRL, CLP, COP, EUR, MXN, PEN, PYG), precios de planes en USD y feature `pagosOnline` (solo Empresarial). Las tiendas existentes quedan en BOB.
- Catálogo de monedas: `backend/src/common/monedas.ts` (símbolo y decimales; CLP, COP y PYG sin decimales) y su copia en `frontend/src/utils/money.ts`.
- Se elige al **contratar** (`POST /saas/registro` con `moneda`) y el ADMIN la cambia en **Mi plan** (`PATCH /tenant/moneda`). Cambiarla **no convierte precios** (se avisa en pantalla).
- La exponen: login y `/auth/profile` (`user.empresa.moneda`, también al recargar la página), `/tenant/me`, `/saas/tiendas/:slug` (tienda online) y `GET /saas/monedas`.
- Web: un solo `formatMoney()`; la moneda la fija `DashboardLayout` (empresa del usuario) o `StoreScope` (tienda visitada). Se reemplazó el "Bs" fijo en POS, caja, cambios, devoluciones, offline, KPIs, ML, reportes, reportes con IA (columnas "Total (Bs)" / "Total (US$)", narrativa, voz y formato numérico del Excel) y tienda online.
- Pendiente: la app móvil sigue mostrando "Bs" (tarea 4.6).

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


### 4.4.2 Pago de la suscripción con Stripe Checkout — implementado (v1.17)
**Dos pagos distintos:** (A) la **tienda** paga su **plan** a la plataforma (esto) y (B) la **clienta** paga las **prendas** a la tienda (§4.4.3). En (A) los tres planes se pagan igual: con tarjeta en **Stripe Checkout** (página de pago alojada por Stripe), en USD.
- Flujo: elegir plan → `POST /billing/checkout` (o el registro público) crea el pago **PENDIENTE** y la sesión de Stripe → el navegador va a Stripe → paga → vuelve a `/pago/exito` → esa página consulta `GET /billing/pagos/:ref` hasta que el **webhook** `POST /billing/stripe/webhook` confirma → el plan se activa. **La redirección no activa nada** (cualquiera podría abrir la URL); solo el webhook con **firma verificada** (`STRIPE_WEBHOOK_SECRET`).
- Idempotencia: la fila del pago se bloquea y si ya está PAGADO el aviso repetido no hace nada; se compara el monto cobrado con el esperado; la creación de la sesión lleva `idempotencyKey`.
- La cuenta de prueba de Stripe es compartida con otro proyecto: cada sesión lleva `metadata.app = fashionstore` y el webhook **ignora** los eventos sin esa marca.
- Renovar el mismo plan vigente **suma** los meses al vencimiento actual; cambiar de plan empieza hoy. Una tienda vencida puede pagar (endpoint permitido sin suscripción).
- Registro público: crea la empresa y su ADMIN **sin suscripción** (solo lectura) y la lleva a pagar; si cancela, puede pagar luego desde **Mi plan**. El SUPER_ADMIN sigue pudiendo asignar un plan a mano (pago por transferencia o QR fuera del sistema). Se eliminó `POST /tenant/suscripcion` (cambiaba el plan sin pagar).
- **Pasarela simulada:** sin `STRIPE_SECRET_KEY` (o `BILLING_PROVIDER=simulado`, como en las pruebas) se usa una pantalla propia `/pago/simulado` que imita Stripe (tarjeta 4242… aprobada, 4000…0002 rechazada). Sirve para pruebas automáticas y para demostrar sin internet.
- Tabla `pago_suscripcion` (RLS) — migración `1780000000009-AddPagoSuscripcion`. Web: páginas `/pago/exito`, `/pago/cancelado`, `/pago/simulado`; **Mi plan** con selector de meses (1, 3, 6, 12) y tabla de **Pagos**.
- Configuración local: `STRIPE_SECRET_KEY` (sk_test), `STRIPE_WEBHOOK_SECRET` (whsec de `stripe listen --forward-to localhost:3000/billing/stripe/webhook`), `APP_URL` (ver `.env.example`).

### 4.4.3 Medios de pago de la tienda online — implementado (v1.18)
Pago (B): la **clienta** paga su compra a la **tienda**. Disponible en **todos los planes**. El ADMIN elige en **Medios de pago** qué acepta; la clienta solo ve esos medios, en la **moneda de la tienda**.

| Medio | Cómo paga la clienta | Quién lo confirma |
|---|---|---|
| Tarjeta | Stripe Checkout (o la pasarela simulada sin claves) | El **webhook firmado** (`metadata.tipo = venta`), automático |
| QR | Escanea el QR de la tienda y sube el comprobante (imagen o PDF ≤ 3 MB) | El personal en **Pagos por verificar** |
| Transferencia | Transfiere a la cuenta de la tienda y sube el comprobante | El personal en **Pagos por verificar** |
| Efectivo al retirar / Contra entrega | Paga al recibir el pedido | El personal al cobrar (**Cobrado**) |

- Aprobar un pago confirma la venta y **descuenta el stock** (mismo camino de siempre: `PaymentsService.updateEstado`). Rechazar deja la compra PENDIENTE para pagar de otra forma; si la clienta cambia de medio, el intento anterior queda **ANULADO**.
- Tarjeta: si Stripe cobró pero la prenda se agotó mientras pagaba, el pago queda RECHAZADO y se **reembolsa** automáticamente. El webhook compara el monto (en unidades mínimas; CLP/PYG sin decimales), es idempotente (`ya_procesado`) y la sesión lleva `idempotencyKey`.
- Archivos (QR y comprobantes) se guardan en la base (`bytea`, Render no conserva disco) y se validan por su **contenido** (firma PNG/JPEG/WebP/PDF), no solo por el tipo declarado; se sirven con `nosniff`. Cuerpo JSON hasta 6 MB.
- **Seguridad:** se eliminó `/mock-gateway/*` (aprobaba cualquier pago **sin autenticación**). La clienta ya no puede registrar un pago con tarjeta "a mano": tarjeta solo vía pasarela.
- API: `GET|PUT /payments/config`, `PUT|GET|DELETE /payments/config/qr`, `GET /payments/metodos`, `POST /payments/venta/:id/tarjeta`, `POST|GET /payments/:id/comprobante`, `GET /payments/por-verificar`, `POST /payments/:id/simulado/pagar`. Tablas `config_pago_tienda` y `comprobante_pago` (RLS) — migración `1780000000010-MediosDePagoTienda`.
- Web: dashboard **Medios de pago** (ADMIN) y **Pagos por verificar** (ADMIN, encargados, cajero; por sucursal autorizada); en la tienda, pantalla **Pagar mi compra** (también desde *Mis compras* → **Pagar**) y la página `/t/:slug/compra/:idVenta`, que es la vuelta de la pasarela (`?ref`, `?cancelado`, `?simulado`).

### 4.4.4 Pedidos sin conexión con pago diferido (CU16 / RF-027) — implementado (v1.19)
Lo exclusivo del plan **Empresarial** (feature `pagosOnline`). En los otros planes la tienda offline solo **reserva**.

1. **Sin conexión** (PWA, tienda de la clienta): botón **Pedir** → operación `ORDEN_PAGO_DIFERIDO` en la cola con UUID y el precio que vio. Mensaje: *"Pedido guardado localmente. El pago se completará cuando haya conexión."* El catálogo offline trae `tienda { moneda, pagoDiferido, horasParaPagar }` para saber si se puede pedir sin preguntar al servidor.
2. **Al sincronizar** (`POST /sync/operations`): solo CLIENTE y plan con `pagosOnline` (si no → RECHAZADA). Se valida producto activo y **stock central** de la sucursal:
   - no alcanza → **CONFLICTO `SIN_STOCK`** + alternativas; no se crea el pedido;
   - alcanza → venta DIGITAL **PENDIENTE** con `pago_diferido = true` y `pago_vence_en = ahora + PAGO_DIFERIDO_HORAS` (48 h). **No se aparta stock**: se valida otra vez al cobrar (si se agotó, se reembolsa — RN-018);
   - el precio cambió → se cobra el **vigente** (RN-007), queda `total_estimado` = total que vio la clienta y la operación vuelve como **CONFLICTO `PRECIO`**: debe **aceptar el nuevo total** (`PATCH /sales/:id/aceptar-total`) o cancelar; hasta entonces no se puede pagar.
   - idempotente por `operationId`; suscripción vencida → el lote queda pendiente en el dispositivo (403).
3. **Pago**: desde el aviso de sincronización (**Pagar pedido**) o *Mis compras*, con la pantalla de §4.4.3 (tarjeta por Stripe Checkout con webhook, o los medios de la tienda).
4. **Vencimiento (EXPIRADO)**: la tarea `PagoDiferidoScheduler` (cada 15 min, `PAGO_DIFERIDO_CRON`) cancela los pedidos vencidos y anula sus pagos pendientes; además se revisa al intentar pagar. Si el cobro de Stripe llega cuando el pedido ya se canceló, se **reembolsa**.

Migración `1780000000011-PagoDiferidoOffline` (columnas en `venta` + índice parcial de pedidos pendientes por vencimiento).

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

### 5.1 Sesión offline con PIN (CU17 / RF-028) — implementado (v1.20)
Para **cajero, encargado de sucursal y clienta** en la PWA (la app móvil queda para la fase 4).

**Conceptos:** *PBKDF2* = convierte un PIN en una clave de cifrado de forma deliberadamente lenta (310 000 iteraciones), para que probar PINs sea costoso; *AES-GCM* = cifrado que además detecta si la clave es incorrecta (si no se puede descifrar, el PIN está mal). El PIN **no se guarda**.

- **Activar** (con internet): tarjeta *"¿Quieres entrar sin internet?"* → PIN de 6 dígitos (no repetidos ni secuencias). Los tokens se guardan cifrados en IndexedDB (`sesiones`, Dexie v2) junto con los datos del usuario (sin secretos). `src/offline/sesionOffline.ts`, `features/offline/PinOffline.tsx`.
- **Entrar sin conexión**: la pantalla de login, sin red, muestra **Acceso sin conexión** con las cuentas guardadas (en `/t/:slug/login` solo las de esa tienda). PIN correcto → misma sesión de siempre. **5 intentos fallidos** → se borra la sesión guardada y hay que entrar con internet.
- **Plazo** configurable por empresa (`empresa.horas_sesion_offline`, 1–720 h, por defecto 72; el ADMIN lo cambia en **Sincronización offline** → `PATCH /tenant/sesion-offline`). Se cuenta desde la **última vez en línea**; vencido, sin conexión **solo se consulta** (POS y tienda offline desactivan vender, reservar y pedir; la cola también lo impide). Banner *"Modo offline — última conexión … · te quedan …"*.
- **Invalidación**: `/auth/profile` ahora consulta la base: usuario desactivado → 401 y la app borra su sesión offline; si cambió el rol, también se borra (hay que activar el PIN de nuevo). Cada login o perfil válido reinicia el plazo.
- **Cerrar sesión** borra la sesión offline, los catálogos de esa empresa (si no queda otra cuenta de la empresa en el navegador) y las operaciones ya resueltas. Las **pendientes de enviar no se borran** (son ventas o pedidos reales): se envían cuando ese usuario vuelve a entrar.
- **Desactivar usuarios** (v1.22): el ADMIN activa/desactiva usuarios en **Usuarios y roles** (`PATCH /users/:id/estado`). Desactivado: no inicia sesión, se borran sus sesiones de refresco, su token deja de servir en ≤ 30 s (`JwtStrategy` consulta el estado con una caché corta) y su acceso offline se borra al volver la red. No se puede desactivar a uno mismo ni a un usuario de la plataforma.
- **Límites conocidos:** el contador de intentos vive en el dispositivo (alguien con acceso técnico al navegador podría probar PINs fuera de la app; la derivación lenta lo encarece). No hay revocación de dispositivos desde el servidor. Migración `1780000000012-SesionOfflineEmpresa`.

### 5.2 Carrito offline (CU15 / RF-026) — implementado (v1.21)
Para la **clienta** en la PWA, en el plan **Empresarial** (el mismo que habilita el pago diferido; en los otros planes la tienda offline solo reserva).
- **Carrito local**: tabla `carritos` en IndexedDB (Dexie v3), uno por usuario y sucursal; sigue ahí al cerrar y reabrir el navegador. `src/offline/carrito.ts`.
- En la tienda offline cada prenda tiene **Al carrito**; el panel muestra cantidades (+/−, quitar), subtotales y **total estimado** con los precios del catálogo guardado.
- **Stock local referencial**: si la cantidad supera lo que dice el catálogo guardado se avisa, pero se permite continuar; el servidor lo valida al sincronizar.
- **Cupones**: se avisa que solo se aplican con conexión.
- **Confirmar pedido** → una sola operación `ORDEN_PAGO_DIFERIDO` con todas las prendas (§4.4.4): mensaje *"Pedido guardado localmente. El pago se completará cuando haya conexión."* El servidor lo registra **completo o nada** (si falta stock de una prenda, CONFLICTO con alternativas).
- Plazo offline vencido (§5.1) → no se puede agregar ni confirmar; **cerrar sesión** borra el carrito.

## 6. Móvil offline (Desafío III) y sincronización (Desafío IV)

### 6.1 Móvil — implementado (v1.6)
**Decisión D13:** la app móvil es la app de la **clienta**; el móvil offline cubre **catálogo y reservas** sin conexión. Las **ventas** offline las hace el cajero en el POS web (PWA, §5). Así no se duplica un POS en el teléfono.
- `expo-sqlite` (`mobile/src/offline/db.ts`), base `fashionstore-offline.db`, migraciones con `PRAGMA user_version`, `PRAGMA foreign_keys = ON`. Tablas: `sucursal`, `producto`, `variante` (FK → producto), `inventario_local` (FK → sucursal y variante, `CHECK stock >= 0`), `operacion_pendiente` (cola, `CHECK` de tipo y estado), `sync_log` (bitácora de cada sincronización). Todo con `id_empresa`.
- Catálogo: `offline/catalog.ts` descarga `/sync/catalog` de cada sucursal en una transacción, con **UPSERT** (`INSERT … ON CONFLICT DO UPDATE`; no `INSERT OR REPLACE`, que borraría en cascada).
- `@react-native-community/netinfo` (`offline/network.ts`) detecta la conexión; `offline/sync.ts` sincroniza al volver la red, al volver la app a primer plano, al encolar y cada minuto, con backoff.
- Pantallas: `app/offline/index.tsx` (catálogo guardado por sucursal + reservar), `app/offline/pendientes.tsx` (cola y resultado), aviso flotante en las pestañas (`components/offline/OfflineChip.tsx`), accesos en Perfil. En el detalle de producto, si no hay red (o falla al enviar), la reserva se guarda en la cola.
- SaaS en el móvil: login y registro con campo **Tienda** (slug), header `X-Tenant` sin sesión (`config/tienda.ts`), y la **sucursal se elige** (`stores/sucursalStore.ts` + `SucursalPicker`) en lugar del antiguo `DEFAULT_SUCURSAL_ID = 1`.

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

### 6.5 Cambios de prendas (aporte exigido) — implementado (v1.7)
**Concepto:** un *cambio* no es una devolución: la clienta trae una prenda de una compra y se lleva otra (otra talla, otro color u otro producto). La venta original no cambia de estado; el cambio queda como historial aparte.

- Tablas `cambio` (por empresa, con RLS) y `detalle_cambio` (línea de la venta que vuelve → variante entregada, con `precio_original` y `precio_nuevo`). Migración `1780000000004-AddCambioPrendas`.
- **Plazo:** `empresa.plazo_cambio_dias` (ya existía; por defecto 7). Se acepta si `ahora ≤ fecha_venta + plazo`; 0 = la tienda no acepta cambios. El ADMIN lo cambia (`PATCH /exchanges/politica`, 0–90 días).
- **Unidades:** solo las no devueltas ni cambiadas antes. Las devoluciones ahora también descuentan las unidades cambiadas (una prenda cambiada no se puede devolver además).
- **Inventario:** en una transacción con bloqueo de fila (ordenado por variante para evitar *deadlocks*): la prenda original entra (`CAMBIO_ENTRADA`) y la nueva sale (`CAMBIO_SALIDA`) del almacén de la venta; si no hay stock de la nueva, se rechaza.
- **Diferencia de precio:** precio vigente de la nueva − precio pagado por la original. Positiva → la clienta paga y se exige el método de pago; negativa → se registra el monto a devolver.
- Endpoints: `GET /exchanges/politica`, `PATCH /exchanges/politica` (ADMIN), `GET /exchanges/venta/:id` (qué se puede cambiar y si está en plazo), `GET /exchanges`, `POST /exchanges`. Roles: ADMIN, ENCARGADO, ENCARGADO_SUCURSAL (solo sus sucursales), CAJERO.
- Web: sección **Cambios de prendas** en el dashboard (cajero, encargados, admin).

### 6.6 Traspasos entre sucursales (CU14, RF-025, RN-013) — implementado (v1.15)
**Concepto:** mover prendas del almacén de una sucursal al de otra de la misma empresa. Mientras viajan, el stock ya no está en el origen ni todavía en el destino: el traspaso queda **En tránsito**.

- Tablas `traspaso` (por empresa, con RLS) y `detalle_traspaso` (variante, `cantidad_enviada`, `cantidad_recibida`). Migración `1780000000007-AddTraspasos`. CHECK: origen ≠ destino, estado válido y `0 ≤ recibida ≤ enviada`.
- **Estados:** `EN_TRANSITO` → `RECIBIDO` (llegó todo) · `RECIBIDO_PARCIAL` (la diferencia es **merma**) · `RECHAZADO` (no llegó nada utilizable) · `CANCELADO` (el origen lo anuló antes de llegar; el stock vuelve).
- **Enviar:** valida todo el pedido antes de descontar; si falta stock responde 400 con cada prenda, lo pedido y lo disponible ("Reduce la cantidad"). Movimiento `TRASPASO_SALIDA` en el almacén PRINCIPAL del origen. Aviso push a quienes operan el destino (si tienen la app registrada).
- **Recibir:** se indica cuánto llegó bien de cada línea; si es menos de lo enviado, el **motivo de la merma es obligatorio**. Lo recibido entra al destino (`TRASPASO_ENTRADA`; se crea la fila de inventario si la prenda no existía allí).
- **Concurrencia:** bloqueo de la cabecera del traspaso y de las filas de inventario (ordenadas por variante). Dos recepciones simultáneas → una se aplica y la otra recibe 409.
- **Permisos:** ADMIN y ENCARGADO, todas las sucursales; ENCARGADO_SUCURSAL envía solo desde la suya y recibe solo en la suya (ve el stock de todas para decidir); CAJERO no gestiona traspasos.
- Endpoints: `GET /transfers/stock?q=`, `GET /transfers?estado=`, `GET /transfers/pendientes`, `GET /transfers/:id`, `POST /transfers`, `POST /transfers/:id/recibir`, `POST /transfers/:id/cancelar`.
- Web: sección **Traspasos** con pestañas *En tránsito* (por recibir / enviados, con contador), *Nuevo traspaso* (stock por sucursal) e *Historial* (unidades, merma y quién envió y recibió).

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

**Implementado (v1.9) — `backend/src/ai/reports/`:**
- `report-tools.ts`: 9 herramientas de reporte (`ventas_por_periodo` día/semana/mes, `ventas_por_sucursal`, `top_productos` con categoría, `ingresos_por_categoria`, `stock_bajo`, `reservas_por_estado`, `ventas_por_metodo_pago` y, desde v1.14, `devoluciones_y_cambios_por_producto` y `motivos_devolucion_y_cambio`) + `pedir_aclaracion`. Cada una valida con class-validator y rechaza parámetros extra, fechas inexistentes, rangos invertidos o de más de 2 años, y sucursales no permitidas al usuario (aunque existan en otra empresa). Ejecuta las consultas de `ReportsService` (se agregaron `salesByPeriod` y `salesByCategory`).
- `ai-reports.service.ts`: bucle de tool use con máximo `AI_REPORTS_MAX_ITER` iteraciones y 3 herramientas por turno; el error de validación vuelve al modelo para que corrija; la **tabla y el gráfico los arma el backend** (la IA solo redacta la narrativa); límite de `AI_REPORTS_POR_MINUTO` consultas por usuario (429); si el proveedor falla → 503.
- Proveedores (`llm/`): `anthropic` (Claude, `AI_REPORTS_MODEL`, por defecto `claude-haiku-4-5`) y `simulado` (reglas por palabras clave, sin internet: pruebas y respaldo en la defensa). Se elige con `LLM_PROVIDER`.
- Bitácora `consulta_ia` (migración `1780000000005-AddConsultaIa`, con RLS): pregunta, herramientas con parámetros y si se aceptaron, tokens, duración y estado (OK, ACLARACION, SIN_REPORTE, ERROR).
- Endpoints (plan con `aiReports`; ADMIN, ENCARGADO, ENCARGADO_SUCURSAL): `POST /ai/reports/query` `{consulta, historial?}` → `{tipo, narrativa, aclaracion, reportes:[{titulo, columnas, filas, grafico, filtros, resumen}], meta}`; `GET /ai/reports/herramientas`; `GET /ai/reports/historial` (ADMIN ve toda la empresa, los demás solo lo suyo).
- El endpoint anterior `POST /ai/reporte-voz` se mantiene por compatibilidad; la UI nueva (3.2) usa `/ai/reports/query`.

**Pantalla (v1.10) — `frontend/src/features/ai-reports/`:** sección **Reportes con IA** (ADMIN, ENCARGADO, ENCARGADO_SUCURSAL).
- Pregunta escrita o **dictada** (Web Speech API del navegador, `es-BO`; Chrome/Edge): al terminar de hablar se envía sola y el resumen se **lee en voz alta** (`speechSynthesis`). El audio lo procesa el navegador; al backend solo llega el texto.
- Ejemplos de un clic, conversación con contexto (preguntas de seguimiento y respuesta a aclaraciones, hasta 6 turnos), "Nueva conversación".
- Por cada reporte: filtros aplicados, gráfico según el tipo que indica el backend (línea, barras o torta con recharts), tabla y exportación a **PDF** (jspdf + autotable: pregunta, resumen, filtros y tabla) y **Excel** (xlsx: hoja Datos con números reales + hoja Consulta).
- Plan sin `aiReports` → pantalla bloqueada con enlace a Mi plan; 429 y 503 con mensajes claros; historial de consultas recientes (clic = volver a preguntar).

### 7.1 Módulo de analítica con ML (8.4–8.5)
Microservicio **Python + FastAPI** (`ml-service/`), lo que también cubre la exigencia de Python/FastAPI:
- Generador de **datos sintéticos** (ventas por producto/semana/sucursal con estacionalidad).
- **Supervisado**: predicción de demanda semanal por producto (RandomForest/GradientBoosting) — métricas MAE, RMSE, R².
- **No supervisado**: segmentación de clientes RFM (K-Means, silhouette) y/o anomalías de ventas (IsolationForest).
- Endpoints `/predict/demand`, `/segments`, `/metrics`; NestJS los consume con alcance de tenant.
- Dashboard analítico en el frontend.

**Implementado (v1.11):**
- `ml-service/` (Python 3.13, FastAPI, scikit-learn 1.6, pandas): `app/sintetico.py` (ventas semanales por producto × sucursal con precio, popularidad, tendencia, estacionalidad boliviana y ruido de Poisson; clientes con 5 perfiles), `app/demanda.py` (RandomForest con lags, promedios, calendario circular y festivos; validación temporal con las últimas 12 semanas; línea base "semana anterior"; pronóstico recursivo con banda p10–p90 entre árboles), `app/segmentos.py` (K-Means RFM, k por silhouette, nombres de negocio y acción sugerida), `app/main.py` (clave `X-ML-Key`, un modelo por empresa con joblib). 11 pruebas pytest. README con instalación en Windows.
- Backend `backend/src/ml/`: `POST /ml/entrenar`, `GET /ml/metricas`, `GET /ml/demanda`, `GET /ml/segmentos`. Solo plan Empresarial (`features.ml`) y ADMIN/ENCARGADO. Envía al ml-service el catálogo, las sucursales, las ventas semanales netas y el RFM de las clientas REALES de la empresa (SQL con RLS + `id_empresa`); la empresa sale del JWT. Servicio caído → 503; sin modelo → 404 "Entrenar modelos"; sucursal ajena → 400.
- Endpoints del ml-service: `/tenants/{id}/train`, `/metrics`, `/demand`, `/segments` (en vez de `/predict/demand`).

**Implementado (v1.13, tarea 3.4b) — cómo se comporta como un SaaS real:**
- **Nadie pulsa "Entrenar"**: `MlScheduler` (`@nestjs/schedule`, cron `ML_CRON`, por defecto 03:00 hora de la empresa) reentrena cada noche las empresas activas con suscripción vigente y plan con ML, cada una dentro de `TenantContext.run({ idEmpresa })` (RLS). Si una empresa aún no tiene modelos, la pantalla los prepara sola la primera vez. El ADMIN tiene un botón discreto **"Actualizar análisis"**; dos entrenamientos simultáneos de la misma empresa → 409.
- **Anomalías (no supervisado)**: `ml-service/app/anomalias.py` con IsolationForest sobre la desviación de cada semana frente a su línea base local (mediana de ±4 semanas); los picos en fechas festivas se marcan como estacionales. El generador sintético inserta semanas atípicas conocidas para medir **precisión y exhaustividad** del detector. Las semanas atípicas se **excluyen del entrenamiento** del modelo de demanda (limpieza de atípicos). `GET /ml/anomalias?idSucursal=`.
- **Pantalla** (Dashboard analítico → pestañas *Análisis predictivo* y *Descubrir patrones*, ADMIN y ENCARGADO con plan que incluya ML): pronóstico con banda p10–p90 y tabla por producto; segmentos con acción sugerida, gráfico de dispersión y clientas reales (solo ADMIN); semanas atípicas por sucursal. Métricas técnicas (MAE, RMSE, R² vs. línea base, importancia de variables, silhouette por k, precisión/recall de anomalías) en un apartado plegable **"Calidad del modelo"**.
- **Avisos del CU12**: menos de 12 semanas con ventas reales → "Se requiere mínimo 3 meses de historial…"; R² < 0,5 → precisión baja; silhouette < 0,3 → "No se detectaron patrones claros en los datos actuales".

---

### 7.2 Dashboard de KPIs (A2)
Por empresa, filtrable por sucursal y período; sobre `ReportsService` (`/reports/dashboard` ya existe):
- Ventas totales y variación vs. período anterior · Ticket promedio · Unidades vendidas
- Ventas por sucursal y por canal (presencial/digital)
- Top productos y categorías por ingreso · Stock crítico · Rotación de inventario
- Reservas: conversión a venta y cancelación · Devoluciones/cambios sobre ventas
- Conflictos de sincronización abiertos
- Uso del plan: sucursales y usuarios usados vs. límite

**Implementado (v1.12, tarea 3.4a):** `backend/src/reports/kpis.service.ts` + `GET /reports/kpis?idSucursal=&dias=` (ADMIN, ENCARGADO, ENCARGADO_SUCURSAL). Calcula en la zona horaria de la empresa: ventas de hoy (vs. ayer), del mes (vs. mismo periodo del mes anterior), ticket promedio, canal, stock crítico y agotados, reservas pendientes, **tasa de devoluciones**, **tasa de cambios**, **top 5 prendas más cambiadas**, más devueltas, **top 3 por sucursal**, conflictos offline abiertos y tendencia diaria. Alcance: RLS + `id_empresa` + sucursales asignadas (otra sucursal → 403). Pantalla `frontend/src/features/analytics/`: tarjetas con **drill-down** a la sección correspondiente, filtros de sucursal y ventana, **refresco cada 5 min**, copia local con banner **"Datos actualizados al [hora]"** sin conexión.
El uso del plan (sucursales/usuarios vs. límite) se muestra en **Mi plan**.

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
- [x] 2.4 Móvil: expo-sqlite, cola, netinfo, pantallas offline (clienta: catálogo y reservas; ver D13 en §6.1)
- [x] 2.5 Cambios de prendas con plazo (§6.5)
- [x] 2.6 Pruebas: idempotencia, reintento, conflicto de stock (incluido el caso de dos ventas simultáneas de la última unidad, §6.4.1), persistencia tras reinicio
  - [x] Servidor: `backend/test/tenant-sync.e2e-spec.ts` (11 E2E)
  - [x] Web: recarga sin conexión, venta y reserva offline, reconexión y resultado (Playwright, modo offline)
  - [x] App móvil: lógica SQLite + cola + sync probada contra el backend real (16 comprobaciones) y bundle Android compilado

### Fase 3 — Voz + KPIs + IA + ML (→ Presentación 3)
- [x] 3.1 `/ai/reports/query` con tools y validación; ≥4 tipos de reporte (7 herramientas + aclaración; ver §7)
- [x] 3.2 UI de reportes: texto/voz, tabla, gráfico, PDF/Excel (sección **Reportes con IA**, ver §7)
- [x] 3.3 `ml-service` FastAPI: datos sintéticos, supervisado, no supervisado, métricas (ver §7.1; falta la pantalla, que va en 3.4)
- [x] 3.4 Dashboard analítico (CU12), en tres entregas:
  - [x] 3.4a ML también en el plan Profesional (CU12) + KPIs (`GET /reports/kpis`) y sección **Dashboard analítico**
  - [x] 3.4b Pestañas de ML "Análisis predictivo" y "Descubrir patrones" (segmentos + anomalías con IsolationForest), reentrenamiento nocturno automático, avisos del CU12 (ver §7.1)
  - [x] 3.4c Reporte con IA de prendas cambiadas y devoluciones; PDF/Excel con empresa, usuario, fecha y gráfico embebido
- [ ] 3.5 Despliegue en la nube (backend + ml-service + frontend) — **se hace al final**, cuando backend y frontend estén terminados (decisión 2026-11-07)

### Pendientes del documento ICONIX (después de la Fase 3, antes de la defensa)
> Revisión 2026-11-07 contra el documento del equipo: casos de uso y requisitos que todavía no están en el código.
- [x] P1 **CU14 Traspaso entre sucursales** (§6.6): mover stock de una sucursal a otra con estado "En tránsito" hasta confirmar la recepción en destino
- [x] P2a **Moneda** (antes de Stripe): planes en USD, cada tienda en su moneda, feature `pagosOnline` solo en Empresarial (§4.4.1)
- [x] P2b **Pago de la suscripción con Stripe Checkout** en los tres planes + webhook firmado + pasarela simulada (§4.4.2)
- [x] P2c **Medios de pago de la tienda** (todos los planes): tarjeta con Stripe, QR y transferencia con comprobante y confirmación de la tienda, efectivo al retirar en sucursal, contra entrega; el ADMIN activa los que quiere y sube su QR y datos bancarios
- [x] P2 **CU16 / RF-027 Pago diferido de pedidos offline** (§4.4.4) (solo Empresarial, feature `pagosOnline`; en la moneda de la tienda): orden creada offline con "Pago pendiente diferido"; al reconectar el backend crea el `PaymentIntent`, la clienta confirma y el webhook actualiza la orden o reembolsa
- [x] P3 **CU17 / RF-028 Sesión offline con PIN** (§5.1): PIN local + token cifrado, plazo máximo configurable, bloqueo por intentos fallidos y borrado de datos al cerrar sesión
- [x] P4 **RF-026 / CU15 Carrito offline** (§5.2): conservar el carrito sin conexión (también tras cerrar la app) y convertirlo en orden con pago diferido (enlaza con P2)

### Fase 4 — App móvil (se hace al final, después de la Fase 3)
> Decisión del equipo (2026-11-06): el móvil y sus pruebas se dejan para el final. La app sigue siendo la de la clienta (D13).
- [ ] 4.1 Prueba en un teléfono real (pendiente de la 2.4): `API_URL` a la IP de la PC, Expo Go, login `cliente@urbanstep.demo` / tienda `urban-step`, modo avión → reservar → reconectar → Operaciones pendientes muestra CONFIRMADA o CONFLICTO (§13)
- [ ] 4.2 Persistencia tras cerrar la app: reservas pendientes siguen en SQLite y se envían al reabrir
- [ ] 4.3 Voz en el móvil con `expo-speech-recognition` (Fase 3, versión clienta): búsqueda de productos por voz o asistente de compra; los reportes del administrador quedan en la web
- [ ] 4.4 Ajustes visuales de la app (detalles de pantallas pendientes)
- [ ] 4.6 Moneda de la tienda en la app (hoy muestra "Bs" fijo): leerla de `/saas/tiendas/:slug` como la web (§4.4.1)
- [ ] 4.5 Build nuevo (EAS / APK) apuntando a Render una vez que producción tenga `/sync`; verificar que la app ya instalada (tokens sin `tid`) siga entrando como Empresa A

### Fase 5 — Pruebas y cierre (antes de la defensa)
- [ ] 5.1 UML coherente con el código final (robustez, secuencia, clases, BD)
- [ ] 5.2 Plan y casos de prueba documentados (web, backend y móvil)
- [ ] 5.3 Ensayo de la defensa con Empresa A y B

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
| 6 | Pruebas automáticas | `npm run test:e2e:tenant` → 153 pruebas en verde (aislamiento + planes + SaaS público + moneda + cobro de suscripción + sincronización + cambios + traspasos + reportes con IA + ML + KPIs; las de ML necesitan `ml-service/.venv`) |

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

Rutas web para probar: `/` (página del SaaS), `/contratar`, `/t/fashionstore` (Empresa A), `/t/urban-step` y `/t/urban-step/tienda` (Empresa B), `/plataforma` (SUPER_ADMIN). App móvil: en el login escribir la tienda (`urban-step`) o dejarla vacía para FashionStore.

**Probar el móvil offline:** en `mobile/src/config/env.ts` poner `API_URL = "http://IP-DE-TU-PC:3000"` (el backend de Render todavía no tiene `/sync`), `npm install`, `npx expo start` y abrir con Expo Go. Iniciar sesión como `cliente@urbanstep.demo` con tienda `urban-step` → se guarda el catálogo. Activar el **modo avión** → aparece "Sin conexión · ver catálogo guardado" → reservar → desactivar el modo avión → Perfil → Operaciones pendientes muestra el resultado.

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
| 2026-10-26 | v1.6: **tarea 2.4 (móvil offline)**. D13: el móvil es la app de la clienta → catálogo y reservas sin conexión (las ventas offline quedan en el POS web). SQLite con migraciones, FKs y CHECK; descarga de catálogo con UPSERT; cola + sincronización con NetInfo, backoff y `sync_log`; pantallas Catálogo sin conexión y Operaciones pendientes; aviso flotante. SaaS en el móvil: login/registro con tienda, `X-Tenant`, sucursal elegible (se elimina `DEFAULT_SUCURSAL_ID`) | Lógica real del móvil ejecutada en Node (SQLite de Node en lugar del teléfono) contra el backend: 16 comprobaciones (FK y CHECK activos, UPSERT, 2 reservas offline, falla de red → siguen PENDIENTES, reconexión → 1 CONFIRMADA y 1 CONFLICTO con sucursal alternativa, reenvío sin duplicar, bitácora). `expo export --platform android` compila. tsc sin errores nuevos; lint limpio en los archivos nuevos. **No probado en un teléfono real** |
| 2026-10-26 | v1.7: **tarea 2.5 (cambios de prendas)** → **Fase 2 completa**. Tablas `cambio` (RLS) y `detalle_cambio`; plazo por empresa (`plazo_cambio_dias`, editable por el ADMIN); stock de la prenda original y la nueva en una transacción; diferencia de precio con método de pago obligatorio si la clienta paga; las devoluciones descuentan las unidades ya cambiadas. Web: sección Cambios de prendas | 43/43 E2E (7 nuevas: plazo, cambio de talla sin diferencia, prenda más cara exige método, unidades y stock insuficientes, no se devuelve lo cambiado, venta de hace 10 días fuera de plazo y vuelve a estar en plazo con 15 días, solo ADMIN edita el plazo, aislamiento A↔B). Migración up/down y esquema = entidades. Unitarias: 139 en verde (se ajustó el mock de devoluciones). Navegador: cambio sin diferencia, cambio a una prenda más cara con QR, historial, edición del plazo, sin desbordes a 390 px |
| 2026-11-06 | v1.8: se agregan las tareas del móvil como **Fase 4** (prueba en teléfono real, persistencia, voz con `expo-speech-recognition`, ajustes visuales, build para producción); el cierre pasa a **Fase 5**. Orden acordado: Fase 3 → Fase 4 (móvil) → Fase 5 | Solo documentación |
| 2026-11-06 | v1.9: **tarea 3.1 (reportes con IA, backend)**. Arnés de tool use en `backend/src/ai/reports/`: 7 herramientas de reporte + aclaración, validación de parámetros, alcance de empresa (RLS) y de sucursal, límite de iteraciones y de consultas por minuto, tabla y gráfico calculados por el backend, narrativa del modelo. Proveedores `anthropic` y `simulado`. Bitácora `consulta_ia` con RLS | 70/70 E2E (27 nuevas: plan Básico bloqueado, cajero sin acceso, 7 tipos de reporte con datos reales, cifras iguales a `/reports`, mes = suma de días, categoría, aclaración, 8 consultas inválidas rechazadas, bitácora, encargado limitado a su sucursal, Empresa A no puede pedir sucursales de B). Unitarias: 158 en verde (19 nuevas del bucle, adaptador Anthropic y reglas del simulado). Migración up/down y esquema = entidades. **Falta probar con la API real de Anthropic** (aquí no hay API key) |
| 2026-11-06 | v1.10: **tarea 3.2 (pantalla de reportes con IA)**: texto y voz (dictado + lectura en voz alta), gráfico, tabla, PDF y Excel, conversación con contexto, historial, bloqueo por plan. Narrativa del modo simulado mejorada (mayor valor y % del total). Corrección de diseño: el panel ya no deja un hueco arriba en secciones con poco contenido (`align-content: start` en `DashboardLayout`) | Playwright: Básico → bloqueado; Profesional → ventas por sucursal, top productos, ventas por mes (línea), ingresos por categoría (torta), stock bajo; descarga de PDF y Excel revisados; aclaración; historial; dictado por voz simulado → envío automático y lectura del resumen; encargado ve solo su sucursal; sin desbordes a 1280 y 390 px; 429 muestra el aviso. tsc, eslint y build en verde; 27/27 E2E de IA |
| 2026-11-06 | v1.11: **tarea 3.3 (ML)**. Microservicio `ml-service` (FastAPI): datos sintéticos sobre el catálogo real, RandomForest de demanda semanal (validación temporal y línea base), K-Means RFM con silhouette, un modelo por empresa. Backend `/ml/*` (plan Empresarial, ADMIN/ENCARGADO) que envía los datos reales de la empresa | pytest 11/11 (reproducibilidad, estacionalidad, reales sobre sintéticos, clave, validación, el modelo supera a la línea base, banda p10–p90, un modelo por empresa, segmentos). E2E 79/79 (9 nuevas: Básico y Profesional sin ML, roles, servicio caído → 503, validación, 404 antes de entrenar, entrenamiento con datos reales de Urban Step, pronóstico, sucursal de otra empresa → 400, segmentos). Ejemplo con 6 productos × 2 sucursales: R² 0,89 y 16 % menos error que la línea base; 3 segmentos con silhouette 0,47 |
| 2026-11-07 | v1.12: revisión contra el documento ICONIX del equipo. **ML pasa también al plan Profesional** (CU12; migración `1780000000006-PlanProfesionalConMl`). **Tarea 3.4a**: KPIs del CU12 (`/reports/kpis`) y sección Dashboard analítico con drill-down, refresco cada 5 min y copia offline. Se anotan los pendientes P1–P4 (CU14, CU16, CU17, RF-026) | E2E 85/85 (6 nuevas de KPIs: vista de empresa, tendencia de 365 días = `/reports`, tasas coherentes, encargado limitado a su sucursal y 403 en otra, Empresa A no puede pedir sucursales de B, roles y validación; ML: Básico 403, Profesional y Empresarial con acceso). Playwright: 8 tarjetas, filtros, drill-down a Inventario, banner sin conexión, encargado a 390 px sin desborde |
| 2026-11-07 | v1.13: **tarea 3.4b**. Reentrenamiento nocturno (`MlScheduler`, `@nestjs/schedule` 12.0.2), entrenamiento automático la primera vez y botón "Actualizar análisis" solo para ADMIN (bloqueo 409). Anomalías con IsolationForest + anomalías simuladas para medir precisión/recall; limpieza de atípicos antes de entrenar la demanda. Pestañas *Análisis predictivo* y *Descubrir patrones* con avisos del CU12 y "Calidad del modelo" plegable | pytest 13/13 (anomalías simuladas fuera de festivos y de la prueba, recall ≥ 0,66 y precisión ≥ 0,5, filtro por sucursal, atípicos excluidos). Unitarias +5 (cron: listado en modo plataforma, cada empresa en su contexto, sigue si una falla, sin corridas dobles, `ML_CRON=off`; bloqueo 409). E2E ML 11/11 (+2: anomalías y 409). Playwright: Básico bloqueado; primer ingreso entrena solo; avisos de historial y R² bajo con Urban Step; 8 semanas; segmentos y 4 semanas atípicas; "Actualizar análisis" reentrena; encargado sin botón; encargado de sucursal sin pestañas ML; sin desborde a 390 px |
| 2026-11-07 | v1.14: **tarea 3.4c**. Dos herramientas nuevas del arnés: `devoluciones_y_cambios_por_producto` (vendidas, devueltas, cambiadas y sus tasas por prenda; filtro de categoría y límite) y `motivos_devolucion_y_cambio` (motivos agrupados; tipo devoluciones/cambios/ambos). Gráfico de varias series (barras agrupadas con leyenda). Exportación profesional: **PDF** con encabezado de marca, metadatos (empresa, usuario y rol, fecha y hora, pregunta, filtros), resumen de la IA, gráfico embebido, tabla y pie con número de página; **Excel** con `exceljs` 4.4.0 (hoja *Reporte* con metadatos, formatos numéricos reales Bs/unidades/% , autofiltro y gráfico como imagen; hoja *Datos* con la tabla cruda) | E2E 90/90 (+3: totales iguales a `/reports/kpis`, motivos de cambio = cambios de los KPIs, tipo inválido rechazado, encargado = admin filtrado a su sucursal). Unitarias 166 (+3 reglas del simulado). Playwright: 3 reportes exportados; PDF ~30 KB con gráfico (se corrigió que tomaba el ícono de la leyenda y se activó compresión); Excel con imagen en `xl/media` y formatos revisados |
| 2026-11-07 | v1.15: orden acordado — el **despliegue (3.5) pasa al final**, cuando backend y frontend estén terminados; antes se completan P1–P4 y los detalles visuales. **P1 traspasos entre sucursales (CU14)**: módulo `backend/src/transfers/`, migración `1780000000007-AddTraspasos` (RLS), estados En tránsito / Recibido / Recibido con merma / Rechazado / Cancelado, movimientos `TRASPASO_*`, aviso push al destino; sección web **Traspasos** (ver §6.6) | E2E 101/101 (11 nuevas en `tenant-transfers`: stock por sucursal y orígenes permitidos, stock insuficiente con detalle, datos inválidos y de otra empresa, permisos de encargado y cajero, envío, recepción parcial con motivo obligatorio, recepción total y rechazo, cancelación, dos recepciones simultáneas → 201 + 409, movimientos de inventario, aislamiento con Empresa A; la prueba restaura el stock y cancela lo que deja en tránsito). Migración up/down/up y esquema = entidades. Unitarias 166. Playwright: encargado de Centro envía, admin recibe con merma (botón bloqueado sin motivo), aviso de resultado, historial con detalle, 390 px sin desborde |
| 2026-11-07 | v1.16: **moneda**. Decisión: planes del SaaS en **USD** (Básico 19, Profesional 49, Empresarial 119) y cada tienda vende en **su moneda** (`empresa.moneda`, por defecto BOB). Empresarial pasa a ser el plan más completo con la feature `pagosOnline` (Stripe, P2). Migración `1780000000008`; selector de moneda al contratar y en **Mi plan** (solo ADMIN, avisa que no convierte precios); `/auth/profile` devuelve la empresa para que la moneda sobreviva a recargar la página; `formatMoney()` único en la web. Mi plan muestra los últimos 10 del historial con "Ver todo" (ver §4.4.1) | E2E 106/106 (5 nuevas en `tenant-moneda`: planes en USD y `pagosOnline` solo Empresarial, catálogo de monedas, registro en CLP visible en sesión / `/tenant/me` / tienda pública, moneda inválida 400, reportes con IA con columnas en `$` y `US$`, solo el ADMIN cambia la moneda, perfil tras recargar, otras tiendas siguen en BOB). Migración up/down/up y esquema = entidades. Unitarias 166. Playwright: landing en US$, selector al contratar, Urban Step a USD → KPIs y tienda online en US$ → vuelta a Bs |
| 2026-11-07 | v1.17: **pago de la suscripción con Stripe Checkout** (los 3 planes, USD). Decisiones: los medios de pago de la tienda van en **todos** los planes y lo exclusivo de Empresarial es el **pago diferido offline** (`pagosOnline`); el registro crea la empresa sin plan y la lleva a pagar; el plan se activa solo con el **webhook firmado** (idempotente, filtra `metadata.app=fashionstore` porque la cuenta de prueba es compartida); renovar suma meses al vencimiento; pasarela simulada sin claves. SDK `stripe` 22.6.2 (fijado). Migración `1780000000009` (ver §4.4.2) | E2E 116/116 (10 nuevas en `tenant-billing`: pago pendiente al registrarse y solo lectura, pagar activa y es idempotente, renovar suma meses y cambiar empieza hoy, cancelar, permisos y otra empresa, webhook sin firma/firma falsa → 400, eventos de otro proyecto ignorados, monto alterado no activa, aviso repetido → ya_procesado, sesión expirada → EXPIRADO, tienda vencida paga y vuelve a operar; se adaptaron registro, moneda y planes). Unitarias 169 (+3: parámetros de la sesión de Stripe con cliente simulado). Migración up/down/up y esquema = entidades. Playwright: contratar → pago simulado (tarjeta rechazada bloquea) → éxito con plan activo → Mi plan: Empresarial 3 meses US$ 357 → cancelar → tabla de Pagos |
| 2026-11-07 | v1.18: **medios de pago de la tienda online** (P2c, todos los planes, §4.4.3): tarjeta con Stripe en la moneda de la tienda (webhook de ventas, reembolso si se agotó el stock), QR y transferencia con comprobante verificado por el personal, efectivo al retirar y contra entrega. Se eliminó el simulador público `/mock-gateway` (aprobaba pagos sin autenticación). Migración `1780000000010` | E2E 128/128 (12 nuevas en `tenant-store-payments`: permisos y validaciones de la configuración, QR validado por contenido, quitar QR, medio desactivado y tarjeta manual rechazados, comprobante (tipo, tamaño, otra empresa no lo ve), aprobar descuenta stock, rechazar no, cambiar de medio anula el anterior, tarjeta simulada, webhook de venta idempotente y con monto alterado, reembolso por stock agotado, `/mock-gateway` → 404; restaura la configuración original). Unitarias 169. Migración up/down/up y esquema = entidades. Playwright: ADMIN configura QR y cuenta → clienta paga por QR y sube comprobante → tarjeta simulada → encargado de sucursal ve el comprobante y aprueba → ventas PAGADA; vista móvil |
| 2026-11-07 | v1.18 (corrección): **reportes por día en la hora de la tienda.** `/reports` cortaba los días en UTC (23:59 UTC = 19:59 en Bolivia), así que lo vendido después de las 20:00 no entraba en el reporte de "hoy" y no cuadraba con los KPIs (que sí usan `APP_TIMEZONE`). Ahora `desde/hasta` AAAA-MM-DD son días completos en `APP_TIMEZONE` y las ventas por día se agrupan en esa zona (`common/zona-horaria.ts`) | Las pruebas de KPIs y de reportes con IA fallaban solo si se corrían después de las 20:00 de Bolivia; reproducido y corregido. E2E 128/128 corridas a las 22:30 de Bolivia. Unitarias 169 (se actualizó la prueba que fijaba el corte en UTC) |
| 2026-11-07 | v1.19: **P2 pedidos sin conexión con pago diferido** (CU16, solo Empresarial, §4.4.4). Operación `ORDEN_PAGO_DIFERIDO` en la sincronización; pedido pendiente con plazo (48 h), precio central con aceptación del nuevo total, stock validado sin apartar, vencimiento automático (cron) y reembolso si el cobro llega tarde. PWA: botón **Pedir** en la tienda offline y **Pagar pedido** en el indicador. Migración `1780000000011` | E2E 137/137 (9 nuevas en `tenant-pago-diferido`: plan Básico rechaza, Empresarial habilita y el personal no puede pedir, pedido con plazo sin descontar stock e idempotente, pago con tarjeta por webhook descuenta stock, sin stock → conflicto con alternativas, precio cambiado → aceptar antes de pagar, vencido → cancelado y pagos anulados, cobro tardío → reembolso, suscripción vencida → 403). Unitarias 169. Migración sin diferencias con las entidades. Playwright (versión compilada): clienta sin conexión → Pedir → vuelve la red → Pagar pedido → tarjeta simulada → pagado |
| 2026-11-07 | v1.20: **P3 sesión offline con PIN** (CU17, §5.1): PIN de 6 dígitos que cifra la sesión (PBKDF2 + AES-GCM) en IndexedDB, acceso sin conexión desde el login, bloqueo al 5.º intento, plazo por empresa desde la última conexión (vencido = solo consulta), perfil validado contra la base (usuario desactivado o rol cambiado invalidan la sesión offline) y borrado de datos locales al cerrar sesión. Migración `1780000000012` | E2E 140/140 (3 nuevas en `tenant-sesion-offline`: login y perfil traen el plazo, solo el ADMIN lo cambia y se valida el rango, usuario desactivado → 401). Unitarias 169. Migración up/down/up sin diferencias. Playwright (versión compilada): oferta y PIN rechazado por secuencia → PIN válido → pestaña nueva sin red → PIN incorrecto (quedan 4) → entra con banner del plazo → plazo vencido desactiva Reservar → 5 fallos borran el acceso; ADMIN cambia el plazo |
| 2026-11-08 | v1.21: **P4 carrito offline** (CU15, §5.2): carrito en IndexedDB por usuario y sucursal (persiste al cerrar el navegador), cantidades, total estimado, aviso de stock local referencial y de cupones, confirmación como un solo pedido con pago diferido. Corrección: la tarjeta de activar PIN tapaba el panel de operaciones (z-index) | E2E 141/141 (1 nueva en `tenant-pago-diferido`: pedido de carrito con 2 prendas se registra completo; si falta stock de una, no se registra nada). Unitarias 169. Playwright (versión compilada): sin red arma carrito de 3 prendas, aviso de stock referencial, cierra y reabre (carrito conservado), confirma, vuelve la red, Pagar pedido con 2 líneas; vista móvil |
| 2026-11-08 | v1.22: **desactivar usuarios** (ADMIN): endpoint `PATCH /users/:id/estado`, botón Activar/Desactivar con confirmación en *Usuarios y roles*; el token de un usuario desactivado deja de servir en segundos (JwtStrategy + caché de 30 s) y se revocan sus sesiones de refresco. **Número de pedido corto** (#312) en vez del comprobante con UUID en pago, *Mis compras* y *Pagos por verificar*. Lint: se quitaron 3 de los 4 problemas que había (efectos con setState en `Workspace.tsx` → valores derivados); queda 1 en `Chatbot.tsx`, que no se toca porque pertenece a la rama del arnés. Corrección: los diálogos abiertos desde una celda de tabla no partían el texto | E2E 145/145 (4 nuevas en `tenant-usuarios`: solo el ADMIN y de su empresa, nadie se desactiva a sí mismo, desactivada pierde token/login/refresh al instante, reactivada vuelve a entrar). Unitarias 171 (2 nuevas en `jwt.strategy.spec`: token de usuario desactivado rechazado y caché del estado). Revisado en el navegador |
| 2026-11-08 | v1.23: **corrección del carrito** (reportado al revisar con una cuenta de clienta antigua: *"dice agregado pero el carrito sigue en 0"*). Causa: la sucursal guardada en el navegador era de **otra tienda**; el backend no validaba la sucursal, respondía 201 pero la prenda quedaba en un carrito que RLS no deja leer (y con un id inexistente daba 500). Ahora `CartService` exige una sucursal **activa de la tienda actual** (404 con mensaje claro) y la web ignora una sucursal guardada que no esté entre las activas. También: cambiar o quitar un item buscaba *cualquier* carrito activo y fallaba con carritos en dos sucursales → ahora busca el item entre los carritos de la clienta. *Mis reservas* con el mismo diseño de *Mis compras* (Reserva #id, estado como etiqueta, una línea por prenda) | E2E 149/149 (4 nuevas en `tenant-carrito`: sucursal ajena o inexistente → 404, lo agregado se ve, cambiar/quitar con dos carritos, nadie toca el carrito ajeno). Reproducido y verificado en el navegador con la sucursal de otra tienda guardada: carrito 0 → 1 y la reserva aparece en *Mis reservas* |
| 2026-11-08 | v1.24: **almacén PRINCIPAL reparado y protegido** (reportado: en la empresa original FashionStore no funcionaban carrito→compra ni reservas; en Urban Step sí). Causa: reservas, compras online, devoluciones, cambios, catálogo offline y traspasos buscan el almacén con código `PRINCIPAL`, y en FashionStore se había renombrado a `A1`/`A2` desde la pantalla de almacenes (Urban Step tuvo lo mismo y solo se arregló en su seed). Migración `1780000000013-RepararAlmacenPrincipal`: a cada sucursal sin principal activo le reactiva o asigna uno (el de más stock, conserva nombre e inventario) o lo crea. `WarehousesService` ya no deja renombrar, desactivar ni mover el principal ni usar el código PRINCIPAL en otro almacén; la pantalla de almacenes lo marca *Principal de la sucursal* y solo permite cambiar su nombre. **Al desplegar, esta migración también repara producción** | E2E 153/153 (4 nuevas en `tenant-almacenes`: toda sucursal activa tiene principal, no se renombra/desactiva/mueve pero sí cambia de nombre, código reservado, la empresa original puede reservar). Esquema = entidades. Verificado en el navegador |
| 2026-11-08 | v1.25: **portada de tienda, redirección de clientas y cuentas sin empresa**. (1) `StoreHome` (`/t/:slug`) es ahora una portada de tienda de moda: aviso, cabecera fija, portada con fotos, cinta y tarjetas de categorías, novedades con precio en la moneda de la tienda, beneficios, invitación y pie; usa el catálogo público con `X-Tenant` y muestra un bloque de color si la prenda no tiene foto. (2) Una clienta que entraba desde `/login` (página de planes) iba a `/tienda`, la tienda por defecto: veía el nombre *Fashionstore* con las sucursales de su empresa y al salir volvía a los planes. `getSessionPath(rol, slug)` la manda a `/t/<slug>/tienda` y `StoreScope` redirige `/tienda` a la tienda de la clienta. (3) **Carrito de la empresa A** (reportado: no contaba prendas ni reservas con una cuenta antigua). Causa: la cuenta se creó después de la migración multitenant con la versión de una sola tienda y quedó con `id_empresa` NULL; su token no tenía empresa y el RLS le mostraba **todas** las empresas, y sus carritos quedaban con empresas cruzadas. Migración `1780000000014-AsignarEmpresaUsuariosSinEmpresa`: asigna FashionStore a esas cuentas (salvo SUPER_ADMIN o correo repetido) y borra los carritos inconsistentes. El login, la renovación de sesión y `JwtStrategy` ya no aceptan un usuario o token sin empresa que no sea SUPER_ADMIN | Unitarias 173/173 (2 nuevas: token sin empresa rechazado, no se renueva una sesión sin empresa). Diagnóstico `scripts/diagnostico-carrito.mjs` antes/después: agregar → carrito 0 / carrito 1. Verificado en el navegador (portada en escritorio y 390 px; login desde `/login` → `/t/urban-step/tienda`; salir → portada) |
| 2026-11-08 | v1.26: **catálogo de moda mujer con fotos en la tienda demo y portada configurable**. (1) Urban Step pasa de calzado deportivo a moda urbana para mujer: 16 prendas en Vestidos, Zapatos, Carteras y Accesorios, todas con foto (enlaces verificados de dummyjson, la misma fuente que FashionStore). Definido una sola vez en `tenancy/seeds/catalogo-demo.ts` (solo SQL) y aplicado por el seed de demo y por la migración `1780000000015-PortadaTiendaYCatalogoDemo`, así queda igual en local y en producción sin cargar fotos a mano; los 6 productos de la primera versión se renombran (conservan variantes, stock y ventas) y no se pisa una foto que haya puesto el administrador. (2) `empresa.portada_url` y `empresa.eslogan` + `PATCH /tenant/portada` (ADMIN, solo enlaces https, frase hasta 160): pantalla *Portada de la tienda* en el panel con vista previa; la portada `/t/:slug` muestra esa imagen en el recuadro grande y la frase bajo el título. Las imágenes son enlaces guardados en la base: no se pierden al desplegar (el disco de Render se borra en cada despliegue) | E2E 157/157 (4 nuevas en `tenant-portada`: guardar y ver en la tienda pública, solo https y frase corta, clienta 403 y aislamiento entre empresas, catálogo demo con foto; `tenant-isolation` actualizado a las categorías nuevas). Unitarias 173/173. Seed probado en una tienda demo nueva y repetido sin duplicar. Verificado en el navegador (portada y pantalla del administrador) |
| 2026-11-08 | v1.27: **vestidor virtual (probador con cámara) en las dos tiendas de prueba** (reportado: en la empresa A ya no aparecía el botón del probador y en la B nunca estuvo). Causa: el probador necesita en el producto el tipo de prenda (`tipo_try_on`: lentes, gorra o polera) y un PNG sin fondo (`imagen_try_on`); ningún seed los traía, se habían configurado a mano en el panel y en la base actual ninguna prenda los tenía. Se agregan 4 PNG sin fondo dentro del frontend (`frontend/public/tryon`: polera blanca, gorra negra, sombrero, lentes de sol) para que viajen con el código y no dependan de otro sitio. Migración `1780000000016-VestidorVirtualDemo`: FashionStore → *Polera básica blanca* (polera) y *Sombrero fedora* (gorra); Urban Step → *Lentes de sol clásicos* (lentes) y dos prendas nuevas con probador, *Polera básica blanca* (categoría Poleras) y *Gorra urbana negra*. Solo se activa en prendas sin vestidor (no pisa lo del administrador). El seed de FashionStore y `catalogo-demo.ts` lo incluyen para bases nuevas. La vista previa del panel acepta también rutas `/tryon/…`. Corrección: `catalogo-demo.ts` usaba un parámetro SQL sin tipo al crear una categoría nueva (`inconsistent types deduced`); ahora se castea a `varchar` | E2E 158/158 (1 nueva en `tenant-portada`: las prendas con probador traen tipo y PNG en las dos empresas). Unitarias 173/173. Seed probado en una tienda demo nueva (18 prendas, 3 con probador) y repetido sin duplicar. En el navegador: aparece *Probar con vestidor virtual* y el vestidor carga el PNG (el modelo de MediaPipe se descarga de internet) |
