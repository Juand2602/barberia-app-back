import { Request, Response } from 'express';
import { WhatsAppWebhookPayload } from '../types';
import { whatsappBotService } from '../services/whatsapp/bot.service';
import { whatsappMessagesService } from '../services/whatsapp/messages.service';

export class WebhookController {
  /**
   * Verificación del webhook (callback verification)
   * Facebook/Meta envía hub.mode, hub.verify_token y hub.challenge.
   */
  async verificar(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'mi_token_secreto';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Webhook verificado correctamente');
      res.status(200).send(challenge as string);
    } else {
      console.error('❌ Error verificando webhook - token inválido o modo no es "subscribe"');
      res.sendStatus(403);
    }
  }

  /**
   * Recibir mensajes entrantes (POST)
   */
  async recibirMensaje(req: Request, res: Response) {
    try {
      const body: WhatsAppWebhookPayload = req.body;

      // Ignoramos eventos que no sean de WhatsApp Business
      if (body.object !== 'whatsapp_business_account') {
        return res.sendStatus(404);
      }

      // Recorrer entradas y procesar mensajes
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const value = change.value;

          // Si vienen mensajes
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              const telefono = message.from;
              const textoMensaje = message.text?.body ?? '';

              if (textoMensaje) {
                console.log(`📩 Mensaje entrante de ${telefono}: ${textoMensaje}`);
                // Marcar como leído (intenta, si falla se captura)
                try {
                  await whatsappMessagesService.marcarComoLeido(message.id);
                } catch (err) {
                  console.error('Error marcando mensaje como leído:', err);
                }

                // Procesar flujo del bot
                try {
                  await whatsappBotService.procesarMensaje(telefono, textoMensaje);
                } catch (err) {
                  console.error('Error procesando mensaje en bot:', err);
                }
              }
            }
          }

          // Si vienen eventos de estado (por ejemplo read/delivery) los ignoramos o
          // podríamos procesarlos si se necesita (actualmente no hacemos nada).
          if (value.statuses && value.statuses.length > 0) {
            console.log('Eventos de status recibidos:', value.statuses);
          }
        }
      }

      res.sendStatus(200);
    } catch (error) {
      console.error('Error procesando webhook:', error);
      res.sendStatus(500);
    }
  }
}

export const webhookController = new WebhookController();
