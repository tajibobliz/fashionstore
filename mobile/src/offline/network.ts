import NetInfo, { useNetInfo } from "@react-native-community/netinfo";
import type { NetInfoState } from "@react-native-community/netinfo";

/**
 * Conexión del teléfono con NetInfo. `isInternetReachable` puede ser null mientras se
 * comprueba: en ese caso se considera "con conexión" y, si el envío falla, la cola reintenta.
 */
export const conectado = (estado: Pick<NetInfoState, "isConnected" | "isInternetReachable">) =>
  estado.isConnected !== false && estado.isInternetReachable !== false;

export function useOnline() {
  return conectado(useNetInfo());
}

export async function hayConexion() {
  return conectado(await NetInfo.fetch());
}

/** Avisa cuando vuelve la conexión (para sincronizar). Devuelve la función para dejar de escuchar. */
export function alVolverLaConexion(callback: () => void) {
  let antes: boolean | null = null;
  return NetInfo.addEventListener((estado) => {
    const ahora = conectado(estado);
    if (antes === false && ahora) callback();
    antes = ahora;
  });
}
