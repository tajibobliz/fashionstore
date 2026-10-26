// URL del backend según entorno
// Cambia la IP cuando te conectes a otra WiFi

//export const API_URL = "http://192.168.0.6:3000";

// URL del backend en producción (Render)
export const API_URL = "https://fashionstore-backend-si8t.onrender.com";

export const API_TIMEOUT = 60000; // 15 segundos

// La sucursal ya no es fija: la clienta la elige (stores/sucursalStore.ts), porque en el
// SaaS cada empresa tiene sus propias sucursales.
