import { Injectable, Logger } from '@nestjs/common';

// API pública y gratuita de Expo Push Notifications: no requiere API key, solo el/los "Expo push token"
// que la app móvil registra (formato ExponentPushToken[...]).
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  /**
   * Envía una notificación push a uno o varios tokens de Expo.
   * Nunca lanza: si Expo responde con error o la red falla, solo lo registra en el log. Así una
   * notificación caída no interrumpe el flujo de negocio que la disparó (confirmar una venta, etc.).
   */
  async enviarPush(tokens: string | string[], titulo: string, cuerpo: string, data?: Record<string, unknown>): Promise<void> {
    const destinatarios = (Array.isArray(tokens) ? tokens : [tokens]).filter(Boolean);
    if (!destinatarios.length) return;

    const mensajes = destinatarios.map((to) => ({ to, title: titulo, body: cuerpo, data, sound: 'default' }));

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(mensajes),
      });
      if (!response.ok) {
        this.logger.error(`Expo Push respondió ${response.status}: ${await response.text()}`);
        return;
      }
      const payload = await response.json();
      // Expo responde un "ticket" por mensaje enviado; un ticket en error (p. ej. token inválido o
      // desinstalado) no representa una falla de red, así que también se registra sin relanzar.
      const tickets: Array<{ status: string; message?: string; details?: unknown }> = payload?.data ?? [];
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'error') this.logger.warn(`Token rechazado por Expo (${destinatarios[index]}): ${ticket.message}`);
      });
    } catch (error) {
      this.logger.error(`No se pudo contactar a Expo Push: ${(error as Error).message}`);
    }
  }
}
