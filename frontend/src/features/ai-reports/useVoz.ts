import { useCallback, useEffect, useRef, useState } from 'react'
import { montosParaVoz } from '../../utils/money'

/**
 * Voz con las APIs del navegador (sin costo ni servidor):
 *  - Web Speech API `SpeechRecognition`: dictado → texto (Chrome y Edge; Firefox no la tiene).
 *  - `speechSynthesis`: texto → voz, para leer en voz alta el resumen del reporte.
 * El audio lo procesa el navegador; al backend solo llega el texto.
 */

interface ResultadoVoz { isFinal: boolean; 0: { transcript: string } }
interface EventoVoz { resultIndex: number; results: ArrayLike<ResultadoVoz> }
interface Reconocedor {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: EventoVoz) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type ConstructorReconocedor = new () => Reconocedor

function constructorReconocedor(): ConstructorReconocedor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: ConstructorReconocedor; webkitSpeechRecognition?: ConstructorReconocedor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const ERRORES: Record<string, string> = {
  'not-allowed': 'El navegador no tiene permiso para usar el micrófono.',
  'service-not-allowed': 'El navegador no tiene permiso para usar el micrófono.',
  'no-speech': 'No se escuchó nada. Intenta de nuevo.',
  'audio-capture': 'No se encontró un micrófono.',
  network: 'El dictado por voz necesita conexión a internet.',
}

/** Dictado: `onFinal` recibe la frase completa cuando la persona deja de hablar. */
export function useDictado(onFinal: (texto: string) => void) {
  const soportado = constructorReconocedor() !== null
  const [escuchando, setEscuchando] = useState(false)
  const [parcial, setParcial] = useState('')
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Reconocedor | null>(null)
  const alTerminar = useRef(onFinal)
  useEffect(() => { alTerminar.current = onFinal }, [onFinal])
  useEffect(() => () => rec.current?.abort(), [])

  const iniciar = useCallback(() => {
    const Ctor = constructorReconocedor()
    if (!Ctor) return
    setError(null)
    setParcial('')
    const r = new Ctor()
    r.lang = 'es-BO'
    r.interimResults = true
    r.continuous = false
    let final = ''
    r.onresult = (e) => {
      let interino = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) final += res[0].transcript
        else interino += res[0].transcript
      }
      setParcial((final + interino).trim())
    }
    r.onerror = (e) => { if (e.error !== 'aborted') setError(ERRORES[e.error] ?? 'No se pudo usar el dictado por voz.') }
    r.onend = () => {
      setEscuchando(false)
      setParcial('')
      if (final.trim()) alTerminar.current(final.trim())
    }
    rec.current = r
    setEscuchando(true)
    r.start()
  }, [])

  const detener = useCallback(() => rec.current?.stop(), [])
  return { soportado, escuchando, parcial, error, iniciar, detener }
}

/** Lectura en voz alta del resumen. */
export function useLectura() {
  const soportado = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [leyendo, setLeyendo] = useState(false)
  useEffect(() => () => { if (soportado) window.speechSynthesis.cancel() }, [soportado])

  const leer = useCallback((texto: string) => {
    if (!soportado || !texto) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(montosParaVoz(texto))
    u.lang = 'es-ES'
    const voz = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('es'))
    if (voz) u.voice = voz
    u.onend = () => setLeyendo(false)
    u.onerror = () => setLeyendo(false)
    setLeyendo(true)
    window.speechSynthesis.speak(u)
  }, [soportado])

  const callar = useCallback(() => { if (soportado) window.speechSynthesis.cancel(); setLeyendo(false) }, [soportado])
  return { soportado, leyendo, leer, callar }
}
