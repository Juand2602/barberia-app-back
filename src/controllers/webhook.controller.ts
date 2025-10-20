// src/controllers/webhook.controller.ts
import { Request, Response } from 'express';
import crypto from 'crypto';
import { WhatsAppWebhookPayload } from '../types';
import { whatsappBotService } from '../services/whatsapp/bot.service';
import { whatsappMessagesService } from '../services/whatsapp/messages.service';

export class WebhookController {
  verificar(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'mi_token_secreto';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Webhook verificado correctamente');
      return res.status(200).send(challenge);
    }
    console.error('❌ Error verificando webhook (mode/token incorrecto)');
    return res.sendStatus(403);
  }

  async recibirMensaje(req: Request, res: Response) {
    try {
      // Si WHATSAPP_APP_SECRET está definido, verificar HMAC
      const appSecret = process.env.WHATSAPP_APP_SECRET;
      if (appSecret) {
        const signature = req.headers['x-hub-signature-256'] as string | undefined;
        if (!signature) {
          console.error('No se encontró x-hub-signature-256');
          return res.sendStatus(400);
        }
        const hmac = crypto.createHmac('sha256', appSecret);
        const rawBody = (req as any).rawBody || JSON.stringify(req.body);
        hmac.update(rawBody);
        const expected = `sha256=${hmac.digest('hex')}`;
        if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
          console.error('Firma HMAC inválida');
          return res.sendStatus(403);
        }
      }
      // Procesar payload
      const body: WhatsAppWebhookPayload = req.body;

      // Manejar casos no relacionados
      if (!body || body.object !== 'whatsapp_business_account') {
        return res.sendStatus(404);
      }

      // Recorrer entradas
      for (const entry of body.entry || []) {
        // changes[] puede contener messages o statuses
        for (const change of entry.changes || []) {
          const value: any = change.value;

          // Mensajes entrantes
          if (value?.messages && Array.isArray(value.messages) && value.messages.length > 0) {
            for (const message of value.messages) {
              const telefono = message.from;
              const texto = message.text?.body ?? '';
              console.log(`📩 Mensaje entrante de ${telefono}: ${texto}`);

              // Marcar como leído (intentar - si falla, continuar)
              try {
                if (message.id) {
                  await whatsappMessagesService.marcarComoLeido(message.id);
                }
              } catch (err) {
                console.error('Error marcando mensaje como leído:', err);
              }

              // Procesar mensaje por el bot
              try {
                await whatsappBotService.procesarMensaje(telefono, texto);
              } catch (err) {
                console.error('Error en procesarMensaje:', err);
              }
            }
          }

          // Eventos de estado (read, delivered, etc.)
          if (value?.statuses && Array.isArray(value.statuses) && value.statuses.length > 0) {
            console.log('Eventos de status recibidos:', value.statuses);
            // Si necesitas lógica adicional para statuses, agrégala aquí.
          }
        }
      }

      return res.sendStatus(200);
    } catch (error) {
      console.error('Error procesando webhook:', error);
      return res.sendStatus(500);
    }
  }
}

export const webhookController = new WebhookController();
