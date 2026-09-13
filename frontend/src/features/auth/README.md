# Autenticación

Configura VITE_API_URL en .env (por defecto http://localhost:3000, sin /api).
Reinicia Vite tras cambiarlo. Nunca expongas secretos en variables VITE.

useAuth() expone user, status, isAuthenticated, login, register y logout.
Los métodos asíncronos propagan errores; getApiErrorMessage extrae mensajes.
Espera a que status deje de ser loading antes de decidir si se necesita login.

Login y registro guardan access y refresh tokens en sessionStorage. Al recargar,
se consulta /auth/profile. Ante un 401 autenticado se renueva en /auth/refresh y
se reintenta una vez. Las solicitudes simultáneas comparten la renovación.
Si falla, se limpia la sesión. Un 403 no cierra sesión.
Las sesiones antiguas sin refresh token requieren un nuevo login.

logout() limpia la sesión local y revoca el refresh en el backend. Si falla la
conexión, la sesión local queda cerrada y se propaga el error de revocación.
El access token emitido sigue válido hasta vencer. Los tokens se eliminan al
cerrar la pestaña. El perfil devuelve ID, correo y rol; el nombre se obtiene
tras login o renovación. Esta configuración no añade pantallas ni rutas protegidas.
