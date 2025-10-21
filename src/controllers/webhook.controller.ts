// src/controllers/webhook.controller.ts
import { Request, Response } from 'express';
import { WhatsAppWebhookPayload } from '../types';
import { whatsappBotService } from '../services/whatsapp/bot.service';
import { whatsappMessagesService } from '../services/whatsapp/messages.service';

export class WebhookController {
  async verificar(req: Request, res: Response) {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'mi_token_secreto';

      if (mode === 'subscribe' && token === verifyToken) {
        console.log('✅ Webhook verificado correctamente');
        res.status(200).send(challenge);
      } else {
        console.error('❌ Error verificando webhook - Token incorrecto');
        res.sendStatus(403);
      }
    } catch (error) {
      console.error('Error en verificación de webhook:', error);
      res.sendStatus(500);
    }
  }

  async recibirMensaje(req: Request, res: Response) {
    try {
      const body: WhatsAppWebhookPayload = req.body;

      if (body.object !== 'whatsapp_business_account') {
        return res.sendStatus(404);
      }

      // Procesar cada entrada
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const value = change.value;

          // Procesar mensajes
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              await this.procesarMensaje(message);
            }
          }

          // Procesar estados de mensajes (entregados, leídos, etc.)
          if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
              console.log(`📊 Estado del mensaje ${status.id}: ${status.status}`);
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

  private async procesarMensaje(message: any) {
    try {
      const telefono = message.from;
      
      // Solo procesar mensajes de texto
      if (message.type === 'text') {
        const textoMensaje = message.text?.body;
        
        if (textoMensaje) {
          console.log(`📩 Mensaje de ${telefono}: ${textoMensaje}`);
          
          // Marcar como leído
          await whatsappMessagesService.marcarComoLeido(message.id);
          
          // Procesar el mensaje
          await whatsappBotService.procesarMensaje(telefono, textoMensaje);
        }
      } else if (message.type === 'interactive') {
        // Manejar mensajes interactivos (botones)
        const buttonReply = message.interactive?.button_reply;
        
        if (buttonReply) {
          console.log(`📩 Botón presionado por ${telefono}: ${buttonReply.title} (${buttonReply.id})`);
          
          // Marcar como leído
          await whatsappMessagesService.marcarComoLeido(message.id);
          
          // Procesar el mensaje
          await whatsappBotService.procesarMensaje(telefono, buttonReply.title);
        }
      }
    } catch (error) {
      console.error('Error procesando mensaje individual:', error);
    }
  }
}

export const webhookController = new WebhookController();