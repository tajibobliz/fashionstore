import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { mlApi } from '../../api/ml.api'
import { getApiErrorMessage } from '../../utils/apiError'

/**
 * Estado de los modelos de la empresa.
 * - Si todavía no hay modelos (404), los prepara solo una vez ("Preparando tu análisis…"),
 *   como haría un SaaS real: el usuario no tiene que pulsar "Entrenar".
 * - Si otro usuario ya está entrenando (409), espera y vuelve a consultar.
 * - `actualizar()` es el botón "Actualizar análisis" del ADMIN.
 */
export function useMl() {
  const qc = useQueryClient()
  const [preparando, setPreparando] = useState(false)
  const [errorEntrenar, setErrorEntrenar] = useState<string | null>(null)
  const intentado = useRef(false)

  const metricas = useQuery({
    queryKey: ['ml', 'metricas'],
    queryFn: mlApi.metricas,
    retry: false,
    refetchInterval: (q) => (preparando || (axios.isAxiosError(q.state.error) && q.state.error.response?.status === 404) ? 5000 : false),
  })
  const sinModelo = axios.isAxiosError(metricas.error) && metricas.error.response?.status === 404

  const entrenar = async () => {
    setPreparando(true)
    setErrorEntrenar(null)
    try {
      await mlApi.entrenar()
      await qc.invalidateQueries({ queryKey: ['ml'] })
    } catch (e) {
      // 409 = ya se está entrenando: se espera a que termine (la consulta se repite cada 5 s).
      if (!(axios.isAxiosError(e) && e.response?.status === 409)) setErrorEntrenar(getApiErrorMessage(e))
    } finally {
      setPreparando(false)
    }
  }

  useEffect(() => {
    if (sinModelo && !intentado.current) {
      intentado.current = true
      void entrenar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinModelo])

  const otroError = metricas.isError && !sinModelo ? getApiErrorMessage(metricas.error) : null
  return {
    metricas: metricas.data,
    cargando: metricas.isLoading,
    preparando: preparando || (sinModelo && !errorEntrenar),
    error: errorEntrenar ?? otroError,
    actualizar: entrenar,
  }
}
