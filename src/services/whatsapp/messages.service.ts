// src/services/whatsapp/messages.service.ts

import axios, { AxiosResponse } from 'axios';
import { whatsappConfig } from '../../config/whatsapp';

// Tipos para botones interactivos
export interface ReplyButton {
  id: string;
  title: string; // Máximo 20 caracteres
}

export interface ListSection {
  title: string;
  rows: Array<{
    id: string;
    title: string; // Máximo 24 caracteres
    description?: string; // Máximo 72 caracteres
  }>;
}

export class WhatsAppMessagesService {
  private async sendRequest(endpoint: string, data: any, retries = 2): Promise<any> {
    try {
      const url = `${whatsappConfig.apiUrl}/${whatsappConfig.phoneId}/${endpoint}`;
      const response: AxiosResponse = await axios.post(url, data, {
        headers: {
          'Authorization': `Bearer ${whatsappConfig.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error enviando mensaje WhatsApp:', error.response?.data || error.message);
      
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

  /**
   * Envía un mensaje con botones de respuesta rápida (máximo 3 botones)
   * Los títulos de los botones deben tener máximo 20 caracteres
   */
  async enviarMensajeConBotones(
    telefono: string, 
    mensaje: string, 
    botones: ReplyButton[]
  ): Promise<any> {
    try {
      if (botones.length > 3) {
        throw new Error('WhatsApp solo permite máximo 3 botones por mensaje');
      }

      // Validar longitud de títulos
      botones.forEach(boton => {
        if (boton.title.length > 20) {
          console.warn(`Título muy largo para botón: "${boton.title}" - Será truncado`);
          boton.title = boton.title.substring(0, 20);
        }
      });

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

  /**
   * Envía un mensaje con lista desplegable
   * Útil para mostrar muchas opciones (barberos, horarios, etc.)
   */
  async enviarMensajeConLista(
    telefono: string,
    mensaje: string,
    buttonText: string, // Texto del botón para abrir la lista (max 20 chars)
    sections: ListSection[]
  ): Promise<any> {
    try {
      if (buttonText.length > 20) {
        console.warn(`Texto de botón muy largo: "${buttonText}" - Será truncado`);
        buttonText = buttonText.substring(0, 20);
      }

      return await this.sendRequest('messages', {
        messaging_product: 'whatsapp',
        to: telefono,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: {
            text: mensaje,
          },
          action: {
            button: buttonText,
            sections: sections.map(section => ({
              title: section.title,
              rows: section.rows.map(row => ({
                id: row.id,
                title: row.title.substring(0, 24), // Máximo 24 caracteres
                description: row.description?.substring(0, 72), // Máximo 72 caracteres
              })),
            })),
          },
        },
      });
    } catch (error) {
      console.error(`Error al enviar mensaje con lista a ${telefono}:`, error);
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
    }
  }
}

export const whatsappMessagesService = new WhatsAppMessagesService();