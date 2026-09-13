# Renovación de sesión

Login y registro devuelven access_token, refresh_token y user.
POST /auth/refresh recibe { "refresh_token": "..." } y devuelve nuevos tokens.
POST /auth/logout recibe el mismo cuerpo y revoca la sesión de renovación.

El refresh token tiene 48 bytes aleatorios. Solo su hash SHA-256 se guarda en
PostgreSQL. La rotación usa una transacción y bloqueo de fila; el token anterior
queda invalidado. Cada login crea una sesión independiente. La renovación
conserva el vencimiento original. Usuarios inactivos no pueden iniciar ni renovar.

Variables opcionales del backend:
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_TTL_DAYS=7

Los valores existentes de JWT_EXPIRES_IN tienen prioridad. JWT_SECRET sigue
siendo obligatorio; los refresh tokens opacos no necesitan otro secreto JWT.
La tabla refresh_session se crea al arrancar con synchronize: true. Si se desactiva
la sincronización, debe crearse mediante migración antes del despliegue.

El frontend guarda ambos tokens en sessionStorage y renueva automáticamente
ante un 401 autenticado. Las solicitudes simultáneas comparten la renovación.
Usar HTTPS en despliegues. Logout revoca el refresh; los access tokens ya emitidos
siguen válidos hasta vencer. Se pueden eliminar periódicamente las filas expiradas.
