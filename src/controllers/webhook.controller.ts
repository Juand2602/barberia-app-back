import { Request, Response } from 'express';
import { WhatsAppWebhookPayload } from '../types';
import { whatsappBotService } from '../services/whatsapp/bot.service';
import { whatsappMessagesService } from '../services/whatsapp/messages.service';

export class WebhookController {
  async verificar(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'mi_token_secreto';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Webhook verificado correctamente');
      res.status(200).send(challenge);
    } else {
      console.error('❌ Error verificando webhook');
      res.sendStatus(403);
    }
  }

  async recibirMensaje(req: Request, res: Response) {
    try {
      const body: WhatsAppWebhookPayload = req.body;

      if (body.object !== 'whatsapp_business_account') {
        return res.sendStatus(404);
      }

      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const value = change.value;

          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              const telefono = message.from;
              const textoMensaje = message.text?.body;

              if (textoMensaje) {
                console.log(`📩 Mensaje de ${telefono}: ${textoMensaje}`);
                await whatsappMessagesService.marcarComoLeido(message.id);
                await whatsappBotService.procesarMensaje(telefono, textoMensaje);
              }
            }
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