# FashionStore

Plataforma inteligente de comercio electrónico para tienda de ropa con vestidores virtuales vía realidad aumentada.

Proyecto académico - Sistemas de Información II - S2-2026

## Estructura

- `backend/` - API REST con NestJS + TypeORM + PostgreSQL
- `frontend/` - Aplicación web con React (en desarrollo)
- `mobile/` - Aplicación móvil con React Native (pendiente)
- `docs/` - Documentación del proyecto

## Stack

- **Backend:** NestJS + TypeScript + TypeORM
- **Frontend:** React
- **Móvil:** React Native
- **Base de datos:** PostgreSQL 17
- **Despliegue:** Azure

## Setup del backend

```bash
cd backend
npm install
```

Copia `.env.example` a `.env` y completa con tus credenciales de PostgreSQL local.

Crea la base de datos:
```bash
psql -U postgres
CREATE DATABASE fashionstore;
\q
```

Arranca en desarrollo:
```bash
npm run start:dev
```

Backend en `http://localhost:3000`.

Al arrancar por primera vez se crean:
- 5 roles: CLIENTE, ADMIN, ENCARGADO, CAJERO, PROVEEDOR
- Usuario admin: `admin@fashionstore.com` / `admin123`

## Endpoints disponibles

### Auth
- `POST /auth/register` - registrar cliente
- `POST /auth/login` - login
- `GET /auth/profile` - perfil (auth)

### Users (ADMIN)
- `GET /users`, `GET /users/:id`

### Branches
- `/branches/ciudades` - CRUD (ADMIN escribe)
- `/branches/sucursales` - CRUD (ADMIN escribe)

### Catalog (`/catalog/*`)
- `categorias`, `tallas`, `colores`, `temporadas`, `colecciones`, `productos`, `variantes` - CRUD estándar
- `proveedores` - CRUD solo ADMIN

### Inventory
- `/inventory/inventarios` - CRUD (ADMIN/ENCARGADO)
- `/inventory/movimientos` - registrar movimientos de stock

### Reservations
- `POST /reservations` - crear reserva
- `GET /reservations/me` - mis reservas
- `GET /reservations` - todas (ADMIN/ENCARGADO)
- `PATCH /reservations/:id/estado` - cambiar estado (ADMIN/ENCARGADO)
- `PATCH /reservations/:id/cancel` - cancelar

### Cart
- `GET /cart/me` - mi carrito
- `GET /cart/me/total` - total
- `POST /cart/items` - agregar item
- `PATCH /cart/items/:id` - actualizar cantidad
- `DELETE /cart/items/:id` - quitar item
- `DELETE /cart/me` - vaciar

### Sales
- `POST /sales/from-cart` - comprar desde carrito (digital)
- `POST /sales/presencial` - venta en caja (CAJERO/ADMIN)
- `GET /sales/me` - mis ventas
- `GET /sales` - todas (ADMIN/ENCARGADO)
- `PATCH /sales/:id/confirmar` - confirmar pago (CAJERO/ADMIN)
- `PATCH /sales/:id/cancelar` - cancelar

### Payments
- `POST /payments` - registrar pago
- `PATCH /payments/:id/estado` - aprobar/rechazar (CAJERO/ADMIN)
- `GET /payments/venta/:idVenta` - pagos de una venta

### Returns
- `POST /returns` - registrar devolución (CAJERO/ENCARGADO/ADMIN)
- `GET /returns` - todas
- `GET /returns/venta/:idVenta` - devoluciones de una venta

## Autenticación

Todo endpoint protegido requiere:
```
Authorization: Bearer <access_token>
```

## División de trabajo

- **Backend:** Henry Carrillo (@tajibobliz)
- **Frontend:** oliver6400

## Estado del proyecto

- [x] Setup del backend
- [x] Modelo de datos completo (23 tablas)
- [x] Autenticación JWT + roles
- [x] CORS
- [x] Ciclo 1: users, auth, branches, catalog, inventory
- [x] Ciclo 2: reservations, cart, sales, payments, returns
- [ ] Ciclo 3: RA, IA, reportes
- [ ] Frontend base
- [ ] Despliegue en Azure