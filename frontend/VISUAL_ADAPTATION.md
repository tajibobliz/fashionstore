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

## Rutas

- `/`: home público, disponible antes del login.
- `/login`: acceso mediante correo y contraseña.
- `/register`: registro público de clientas.
- `/tienda`: catálogo y sucursales para usuarios autenticados.
- `/panel`: catálogo, sucursales e inventario para ADMIN y ENCARGADO.
- `/pos`: consulta de catálogo, sucursales y stock para ADMIN, ENCARGADO y CAJERO.

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
