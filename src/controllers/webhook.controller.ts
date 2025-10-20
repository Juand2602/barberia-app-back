// src/controllers/webhook.controller.ts
import { Request, Response } from 'express';
import crypto from 'crypto';
import { WhatsAppWebhookPayload } from '../types';
import { whatsappBotService } from '../services/whatsapp/bot.service';
import { whatsappMessagesService } from '../services/whatsapp/messages.service';

export class WebhookController {
  // GET /webhook -> verificación inicial de Meta
  async verificar(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'mi_token_secreto';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Webhook verificado correctamente');
      return res.status(200).send(String(challenge));
    } else {
      console.error('❌ Error verificando webhook - token inválido o modo incorrecto');
      return res.sendStatus(403);
    }
  }

  // POST /webhook -> recibe mensajes
  async recibirMensaje(req: any, res: Response) {
    try {
      // Obtener rawBody (lo guardamos en app.ts con express.json verify)
      const rawBody: Buffer | undefined = req.rawBody;
      const signatureHeader = req.headers['x-hub-signature-256'] as string | undefined;
      const appSecret = process.env.WHATSAPP_APP_SECRET || '';

      // Verificación HMAC (si APP_SECRET configurado)
      if (appSecret) {
        if (!rawBody || !signatureHeader) {
          console.warn('Firma HMAC faltante o rawBody no disponible');
          return res.status(401).send('Invalid signature');
        }

        const hmac = crypto.createHmac('sha256', appSecret);
        hmac.update(rawBody);
        const expected = 'sha256=' + hmac.digest('hex');

        // timingSafeEqual para evitar ataques por timing
        const a = Buffer.from(expected);
        const b = Buffer.from(signatureHeader);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          console.warn('Firma inválida proporcionada en x-hub-signature-256');
          return res.status(401).send('Invalid signature');
        }
      } else {
        // En dev si no hay secret, solo warn (permite pruebas sin firma)
        console.warn('WHATSAPP_APP_SECRET no definido - se omite verificación HMAC (solo para dev/testing)');
      }

      // Parsear payload desde rawBody (manteniendo el string exacto que firma HMAC)
      const body: WhatsAppWebhookPayload = rawBody ? JSON.parse(rawBody.toString('utf8')) : req.body;

      // Responder rápido a Meta para evitar reintentos por timeout
      res.status(200).send('ok');

      // Procesar en background (no bloquea la respuesta)
      (async () => {
        try {
          if (!body || body.object !== 'whatsapp_business_account') {
            console.log('Webhook recibido pero object distinto o body vacío. Ignorando.');
            return;
          }

          for (const entry of body.entry || []) {
            for (const change of entry.changes || []) {
              const value = change.value;
              if (!value) continue;

              // Mensajes entrantes
              if (value.messages && Array.isArray(value.messages) && value.messages.length > 0) {
                for (const message of value.messages) {
                  try {
                    const telefono = message.from;
                    const textoMensaje = message.text?.body || null;

                    console.log(`📩 Mensaje entrante de ${telefono}:`, textoMensaje ?? '(no-text payload)');

                    // Marcar como leído (si existe implementación)
                    try {
                      if (message.id) {
                        await whatsappMessagesService.marcarComoLeido(message.id);
                      }
                    } catch (err) {
                      console.warn('Error marcando mensaje como leído:', err);
                    }

                    // Procesar el contenido por tu bot
                    if (textoMensaje) {
                      try {
                        await whatsappBotService.procesarMensaje(telefono, textoMensaje);
                      } catch (err) {
                        console.error('Error procesando mensaje por bot.service:', err);
                      }
                    } else {
                      // manejar otros tipos (e.g., media, interactive) si lo deseas
                      console.log('Mensaje sin texto recibido (tipo:', message.type, ')');
                    }
                  } catch (err) {
                    console.error('Error procesando message:', err);
                  }
                }
              }

              // Manejar status / delivery / otros eventos si vienen (opcional)
              if (value.statuses) {
                console.log('Eventos de status recibidos:', value.statuses);
              }
            }
          }
        } catch (err) {
          console.error('Error procesando webhook en background:', err);
        }
      })();
    } catch (error) {
      console.error('Error procesando webhook (recibirMensaje):', error);
      return res.sendStatus(500);
    }
  }
}

export const webhookController = new WebhookController();
