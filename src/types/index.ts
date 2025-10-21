// src/types/index.ts

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
  | 'ESPERANDO_RESPUESTA_UBICACION'
  | 'ESPERANDO_RESPUESTA_LISTA_PRECIOS'
  | 'ESPERANDO_RESPUESTA_DESPUES_CITA'
  | 'ESPERANDO_RESPUESTA_NO_HAY_HORARIOS' // ← NUEVO ESTADO
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