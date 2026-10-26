import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { authApi } from './features/auth/auth.api'
import { queryClient } from './api/queryClient'
import { iniciarSincronizacion } from './offline/sync'

void authApi.restoreSession()
void iniciarSincronizacion()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}><App /></QueryClientProvider>
  </StrictMode>,
)
