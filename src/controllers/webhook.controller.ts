// src/controllers/webhook.controller.ts

import { Request, Response } from 'express';
import { WhatsAppWebhookPayload } from '../types';
import { whatsappBotService } from '../services/whatsapp/bot.service';
import { whatsappMessagesService } from '../services/whatsapp/messages.service';

const mensajesProcesados = new Set<string>();

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
    // Responder 200 de inmediato: si el procesamiento tarda, WhatsApp reintenta el webhook
    // y genera mensajes duplicados. El procesamiento real sigue en segundo plano.
    res.sendStatus(200);

    try {
      const body: WhatsAppWebhookPayload = req.body;

      if (body.object !== 'whatsapp_business_account') return;

      // Procesar cada entrada
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const value = change.value;

          // Procesar mensajes
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              // Ignorar mensajes ya procesados (reintentos del webhook)
              if (mensajesProcesados.has(message.id)) {
                console.log(`⚠️ Mensaje duplicado ignorado: ${message.id}`);
                continue;
              }
              mensajesProcesados.add(message.id);
              // Limpiar el set cada 1000 entradas para evitar uso excesivo de memoria
              if (mensajesProcesados.size > 1000) mensajesProcesados.clear();

              this.procesarMensaje(message, value.contacts);
            }
          }

          // Procesar estados de mensajes (entregados, leídos, etc.)
          if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
              if (status.status === 'failed' && status.errors?.length) {
                // Meta manda el motivo real en "errors", nunca en el campo "status" — sin esto
                // un envío fallido (plantilla no aprobada, número inválido, límite de mensajería,
                // etc.) solo se ve como "failed" sin poder saber por qué.
                console.log(`📊 Estado del mensaje ${status.id}: failed (destinatario: ${status.recipient_id})`);
                status.errors.forEach((err: any) => {
                  console.log(`   ❌ código ${err.code} - ${err.title}${err.error_data?.details ? `: ${err.error_data.details}` : ''}`);
                });
              } else {
                console.log(`📊 Estado del mensaje ${status.id}: ${status.status}`);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error procesando webhook:', error);
    }
  }

  private async procesarMensaje(message: any, contacts?: Array<{ wa_id?: string; user_id?: string }>) {
    try {
      // Si el usuario adoptó un "username" de WhatsApp y no compartió su número recientemente,
      // Meta omite `message.from` y en su lugar manda su BSUID (identificador estable) en `from_user_id`.
      const telefono = message.from || message.from_user_id || contacts?.[0]?.user_id;
      if (!message.from) {
        console.warn(`⚠️ Mensaje sin "from" (posible usuario con username de WhatsApp), usando BSUID de respaldo: ${JSON.stringify({ messageId: message.id, telefono, contacts })}`);
      }
      if (!telefono) {
        console.error(`❌ Mensaje sin remitente identificable, no se puede responder: ${message.id}`);
        return;
      }

      // Procesar mensajes de texto
      if (message.type === 'text') {
        const textoMensaje = message.text?.body;
        if (textoMensaje) {
          console.log(`📩 Mensaje de texto de ${telefono}: ${textoMensaje}`);
          
          //await whatsappMessagesService.marcarComoLeido(message.id);
          await whatsappBotService.procesarMensaje(telefono, textoMensaje, false);
        }
      } 
      // Procesar mensajes interactivos (botones y listas)
      else if (message.type === 'interactive') {
        // Respuesta de botón
        if (message.interactive?.button_reply) {
          const buttonReply = message.interactive.button_reply;
          console.log(`🔘 Botón presionado por ${telefono}: ${buttonReply.title} (ID: ${buttonReply.id})`);
          
          //await whatsappMessagesService.marcarComoLeido(message.id);
          // Usar el ID del botón para procesar
          await whatsappBotService.procesarMensaje(telefono, buttonReply.id, true, buttonReply.id);
        }
        // Respuesta de lista
        else if (message.interactive?.list_reply) {
          const listReply = message.interactive.list_reply;
          console.log(`📋 Elemento de lista seleccionado por ${telefono}: ${listReply.title} (ID: ${listReply.id})`);
          
          //await whatsappMessagesService.marcarComoLeido(message.id);
          // Usar el ID del elemento seleccionado para procesar
          await whatsappBotService.procesarMensaje(telefono, listReply.id, true, listReply.id);
        }
      }
      // Ignorar otros tipos de mensajes (imágenes, audios, etc.)
      else {
        console.log(`ℹ️ Mensaje tipo ${message.type} de ${telefono} - No procesado`);
      }
    } catch (error) {
      console.error('Error procesando mensaje individual:', error);
    }
  }
}

export const webhookController = new WebhookController();