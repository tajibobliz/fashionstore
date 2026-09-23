import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { recommendationsApi } from '../../api/recommendations.api'
import './chatbot.css'

interface ChatMessage { role: 'user' | 'assistant'; content: string; timestamp: Date }
interface ChatResponse { consulta: string; respuesta: string; fecha: string; modelo: string; tokensUsados: { entrada: number; salida: number } }

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: '¡Hola! Soy el asistente de FashionStore. Puedo recomendarte productos y responder tus dudas sobre nuestro catálogo. ¿En qué te ayudo?',
  timestamp: new Date(),
}

export function Chatbot() {
  const { isAuthenticated } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Mensaje de bienvenida la primera vez que se abre el panel.
  useEffect(() => {
    if (open && messages.length === 0) setMessages([WELCOME_MESSAGE])
  }, [open, messages.length])

  // Scroll automático al último mensaje (o al indicador de "Escribiendo...").
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  if (!isAuthenticated) return null

  async function sendMessage() {
    const text = input.trim()
    if (!text || sending) return
    setMessages(current => [...current, { role: 'user', content: text, timestamp: new Date() }])
    setInput('')
    setSending(true)
    try {
      const result = (await recommendationsApi.chat(text)) as ChatResponse
      setMessages(current => [...current, { role: 'assistant', content: result.respuesta, timestamp: new Date() }])
    } catch {
      setMessages(current => [...current, { role: 'assistant', content: 'Ups, algo salió mal. Intenta de nuevo.', timestamp: new Date() }])
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void sendMessage()
  }

  return <>
    <button className="chatbot-toggle" aria-label={open ? 'Cerrar chat' : 'Abrir chat'} aria-expanded={open} onClick={() => setOpen(value => !value)}>💬</button>
    {open && <section className="chatbot-panel" role="dialog" aria-label="Asistente FashionStore">
      <header className="chatbot-header">
        <h2>Asistente FashionStore</h2>
        <button className="chatbot-close" aria-label="Cerrar chat" onClick={() => setOpen(false)}>×</button>
      </header>
      <div className="chatbot-body" ref={bodyRef} aria-live="polite">
        {messages.map((message, index) => <div key={index} className={`chatbot-bubble chatbot-bubble--${message.role}`}>{message.content}</div>)}
        {sending && <div className="chatbot-bubble chatbot-bubble--assistant chatbot-bubble--typing">Escribiendo...</div>}
      </div>
      <form className="chatbot-input-row" onSubmit={handleSubmit}>
        <input type="text" aria-label="Escribe tu mensaje" placeholder="Pregúntame algo sobre la tienda..." value={input} onChange={event => setInput(event.target.value)} disabled={sending} />
        <button type="submit" className="chatbot-send" disabled={sending || !input.trim()}>Enviar</button>
      </form>
    </section>}
  </>
}
