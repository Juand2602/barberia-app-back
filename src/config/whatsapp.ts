// src/config/whatsapp.ts

export const whatsappConfig = {
  apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0',
  token: process.env.WHATSAPP_TOKEN || '',
  phoneId: process.env.WHATSAPP_PHONE_ID || '',
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'mi_token_secreto',
};

export const barberiaConfig = {
  nombre: process.env.BARBERIA_NOMBRE || 'Madison MVP Barbería',
  direccion: process.env.BARBERIA_DIRECCION || 'Centro Comercial Acropolis, Local 108 (primer piso), Entrada trasera',
  horaApertura: process.env.BARBERIA_HORA_APERTURA || '09:00',
  horaCierre: process.env.BARBERIA_HORA_CIERRE || '20:00',
  duracionServicioDefecto: 30, // minutos
  
  // 🌟 NUEVO: Servicio que se asignará por defecto en las citas de WhatsApp
  servicioPredeterminado: process.env.SERVICIO_PREDETERMINADO || 'Corte Clásico',
};

export const botConfig = {
  timeoutConversacion: parseInt(process.env.TIMEOUT_CONVERSACION || '600000'), // 10 min
};