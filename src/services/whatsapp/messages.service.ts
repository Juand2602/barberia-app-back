import axios from 'axios';
import { whatsappConfig } from '../../config/whatsapp';

export class WhatsAppMessagesService {
  private async sendRequest(endpoint: string, data: any) {
    try {
      const url = `${whatsappConfig.apiUrl}/${whatsappConfig.phoneId}/${endpoint}`;
      const response = await axios.post(url, data, {
        headers: {
          'Authorization': `Bearer ${whatsappConfig.token}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('Error enviando mensaje WhatsApp:', error.response?.data || error.message);
      throw error;
    }
  }

  async enviarMensaje(telefono: string, mensaje: string) {
    return this.sendRequest('messages', {
      messaging_product: 'whatsapp',
      to: telefono,
      type: 'text',
      text: { body: mensaje },
    });
  }

  async marcarComoLeido(messageId: string) {
    return this.sendRequest('messages', {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }
}

export const whatsappMessagesService = new WhatsAppMessagesService();