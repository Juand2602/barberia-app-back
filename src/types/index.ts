export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text: {
    body: string;
  };
  type: string;
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        messages?: WhatsAppMessage[];
        statuses?: any[];
      };
      field: string;
    }>;
  }>;
}

export type ConversationState = 
  | 'INICIAL'
  | 'ESPERANDO_SERVICIO'
  | 'ESPERANDO_BARBERO'
  | 'ESPERANDO_NOMBRE'
  | 'ESPERANDO_FECHA'
  | 'ESPERANDO_HORA'
  | 'ESPERANDO_CONFIRMACION'
  | 'ESPERANDO_RADICADO'
  | 'ESPERANDO_CONFIRMACION_CANCELACION'
  | 'COMPLETADA';

export interface ConversationContext {
  nombre?: string;
  servicioId?: string;
  servicioNombre?: string;
  empleadoId?: string;
  empleadoNombre?: string;
  fecha?: string;
  hora?: string;
  radicado?: string;
  citaId?: string;
  horariosDisponibles?: Array<{ numero: number; hora: string }>;
  horariosRaw?: string[];
  flujo?: string;
}