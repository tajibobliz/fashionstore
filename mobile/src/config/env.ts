// URL del backend según entorno
// Cambia la IP cuando te conectes a otra WiFi

// Backend local (pruebas en el teléfono con Expo Go, misma Wi-Fi que la PC). IP del Wi-Fi según
// `ipconfig` (Dirección IPv4 del adaptador Wi-Fi), actualizada el 2026-11-09.
//export const API_URL = "http://192.168.0.3:3000";

// URL del backend en producción (Render). Activa para el APK (tarea 4.5).
export const API_URL = "https://fashionstore-backend-si8t.onrender.com";

export const API_TIMEOUT = 60000; // 15 segundos

// La sucursal ya no es fija: la clienta la elige (stores/sucursalStore.ts), porque en el
// SaaS cada empresa tiene sus propias sucursales.
