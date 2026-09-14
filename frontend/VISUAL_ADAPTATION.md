# Fashionstore frontend

El home y las pantallas de autenticación adaptan la estructura visual de
`ecommerce/FromEcomerce/src/Pages/landingPages.jsx` y `Pages/Login/Login.jsx`:
navegación, hero, tarjetas, secciones de pasos, bloque de tienda, banner, footer
y formulario en dos paneles. Los CSS y las tres ilustraciones de `public/images`
se copiaron al proyecto y se adaptaron a los colores y textos de Fashionstore.

Los componentes nuevos usan TypeScript y la estructura existente de Fashionstore.
No dependen del backend ni de la configuración del proyecto de referencia.

## Desarrollo

```powershell
cd frontend
npm.cmd run dev
```

Configurar `VITE_API_URL=http://localhost:3000` en `.env` y ejecutar el backend.

### Backend local y desplegado

`npm.cmd run dev` carga `.env.development` y conecta con `http://localhost:3000`.
El login se envía a `/auth/login`: el backend actual no tiene prefijo `/api`.
Reinicia Vite tras modificar variables de entorno.

Para desplegar, copia `.env.production.example` a `.env.production`, reemplaza
la URL de ejemplo por el dominio real del backend y ejecuta `npm.cmd run build`.
También puedes definir `VITE_API_URL` en el entorno del proceso de compilación
del proveedor de hosting. Ese valor tiene prioridad sobre los archivos `.env`.
La URL queda incorporada al bundle: cambiarla después requiere compilar y
desplegar nuevamente el frontend. Mantén la URL local en los archivos de desarrollo.

## Rutas

- `/`: home público, disponible antes del login.
- `/login`: acceso mediante correo y contraseña.
- `/register`: registro principal de encargados.
- `/tienda`: catálogo y sucursales para usuarios autenticados.
- `/dashboard/admin`: dashboard del superusuario ADMIN.
- `/dashboard/encargado`: dashboard del encargado de negocio.
- `/dashboard/cajero`: dashboard de atención y caja.
- `/dashboard`, `/panel` y `/pos`: redirigen al dashboard propio según el rol.

El acceso usa `useAuth`, Axios y los endpoints del backend de Fashionstore.
Se conservan los tokens, la renovación automática y el logout remoto implementados.
Los listados consumen datos reales de la API y muestran carga, errores, reintentos
y estados vacíos. Cobros, facturación y checkout siguen pendientes.

## Verificación

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run test:e2e
```

Las pruebas de navegador usan Chrome y respuestas simuladas de la API para
verificar navegación, credenciales, registro, restauración, refresh y logout.
No sustituyen una comprobación contra PostgreSQL y el backend en ejecución.

## Dashboards por rol

Se copiaron los CSS de Componentes/Template/template.module.css y
Pages/Inicio/Inicio.module.css del proyecto de referencia. La adaptación incluye
barra lateral, navegación activa, perfil, cabecera, métricas, tarjetas de acceso,
gráficas de distribución, filtros de búsqueda y tablas.

La configuración de secciones está en src/features/dashboard/config.ts.
ADMIN, ENCARGADO y CAJERO tienen rutas independientes y protección por rol.
CLIENTE continúa a /tienda; PROVEEDOR vuelve al home público, sin dashboard.

Las métricas derivan de endpoints existentes y no incluyen ventas inventadas.
Solo ADMIN consulta el listado de usuarios y el catálogo de proveedores. ENCARGADO y CAJERO consultan catálogo
e inventario. El backend actual no filtra por empresa, encargado o caja; las
consultas reflejan los registros disponibles en su API, no una empresa aislada.

Registro de empresa, tiendas de una empresa, puntos de venta, cajas y cobros se presentan como Próximamente.
Para habilitarlos hace falta implementar sus modelos y permisos en el backend.
No se alteraron la URL del servidor, los archivos .env, Axios ni los tokens.

Las pruebas cubren el destino de login de los cinco roles, acceso directo a rutas
de otros roles, menús móviles y el flujo de refresh previamente implementado.

El registro principal POST /auth/register fija ENCARGADO en el servidor. El
usuario no selecciona su rol. CLIENTE y PROVEEDOR no tienen dashboard ni registro
público en el frontend: sus altas corresponden a ENCARGADO y CAJERO.
Los usuarios ya existentes conservan su rol. El registro de empresa, ecommerce
por sucursal, almacenes y vinculación de proveedores requiere ampliar el backend.

Altas de usuarios disponibles en POST /users (con token Bearer):
ENCARGADO puede crear CAJERO, CLIENTE y PROVEEDOR. CAJERO puede crear CLIENTE y
PROVEEDOR. ADMIN conserva la administración de todos los roles. El registro
principal no permite seleccionar roles y siempre crea ENCARGADO.
Los formularios Clientes y proveedores y Mi equipo de cajeros ya están conectados.
Estas altas crean cuentas de usuario; la vinculación con empresa, sucursal,
almacén o caja requiere los modelos correspondientes y continúa pendiente.
