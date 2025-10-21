// src/services/whatsapp/messages.service.ts
import axios, { AxiosError, AxiosResponse } from 'axios';
import { whatsappConfig } from '../../config/whatsapp';

export class WhatsAppMessagesService {
  private async sendRequest(endpoint: string, data: any, retries = 2): Promise<any> {
    try {
      const url = `${whatsappConfig.apiUrl}/${whatsappConfig.phoneId}/${endpoint}`;
      const response: AxiosResponse = await axios.post(url, data, {
        headers: {
          'Authorization': `Bearer ${whatsappConfig.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 segundos de timeout
      });
      return response.data;
    } catch (error: any) {
      console.error('Error enviando mensaje WhatsApp:', error.response?.data || error.message);
      
      // Si es un error de timeout o de servidor y tenemos reintentos, reintentamos
      if ((error.code === 'ECONNABORTED' || error.response?.status >= 500) && retries > 0) {
        console.log(`Reintentando envío de mensaje (${retries} reintentos restantes)...`);
        return this.sendRequest(endpoint, data, retries - 1);
      }
      
      throw error;
    }
  }

  async enviarMensaje(telefono: string, mensaje: string): Promise<any> {
    try {
      return await this.sendRequest('messages', {
        messaging_product: 'whatsapp',
        to: telefono,
        type: 'text',
        text: { body: mensaje },
      });
    } catch (error) {
      console.error(`Error al enviar mensaje a ${telefono}:`, error);
      throw error;
    }
  }

  async marcarComoLeido(messageId: string): Promise<any> {
    try {
      return await this.sendRequest('messages', {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });
    } catch (error) {
      console.error(`Error al marcar mensaje ${messageId} como leído:`, error);
      // No lanzamos el error para no interrumpir el flujo
    }
  }

  async enviarMensajeConBotones(telefono: string, mensaje: string, botones: Array<{ id: string; title: string }>): Promise<any> {
    try {
      return await this.sendRequest('messages', {
        messaging_product: 'whatsapp',
        to: telefono,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: mensaje,
          },
          action: {
            buttons: botones.map(boton => ({
              type: 'reply',
              reply: {
                id: boton.id,
                title: boton.title,
              },
            })),
          },
        },
      });
    } catch (error) {
      console.error(`Error al enviar mensaje con botones a ${telefono}:`, error);
      throw error;
    }
  }
}

export const whatsappMessagesService = new WhatsAppMessagesService();