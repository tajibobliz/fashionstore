import { useSyncExternalStore } from 'react'

/**
 * Estado de la conexión según el navegador (`navigator.onLine` y los eventos online/offline).
 * En las DevTools de Chrome se prueba con Network → "Offline".
 */
function subscribe(listener: () => void) {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

export const isOnline = () => navigator.onLine

export function useOnline() {
  return useSyncExternalStore(subscribe, isOnline, () => true)
}
