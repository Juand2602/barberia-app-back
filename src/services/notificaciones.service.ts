// src/services/notificaciones.service.ts - NUEVO
// 🎯 Sistema de notificaciones para citas agendadas

import prisma from '../config/database';
import { whatsappMessagesService } from './whatsapp/messages.service';
import { formatearFecha, formatearHora } from './whatsapp/templates';

export class NotificacionesService {
  /**
   * Envía notificaciones cuando se agenda una cita
   * - Al empleado asignado le notifica su propia cita
   * - Al jefe barbero y administradora les notifica todas las citas
   */
  async notificarCitaAgendada(citaId: string) {
    try {
      const cita = await prisma.cita.findUnique({
        where: { id: citaId },
        include: {
          cliente: true,
          empleado: true,
        },
      });

      if (!cita) {
        throw new Error('Cita no encontrada');
      }

      const mensajeBase = this.generarMensajeCitaAgendada(cita);

      // 1️⃣ Notificar al empleado asignado (su propia cita)
      await this.notificarEmpleado(cita.empleado, mensajeBase);

      // 2️⃣ Notificar al jefe barbero (todas las citas)
      await this.notificarJefeBarbero(mensajeBase);

      // 3️⃣ Notificar a la administradora (todas las citas)
      await this.notificarAdministradora(mensajeBase);

      console.log(`✅ Notificaciones enviadas para cita ${cita.radicado}`);
    } catch (error) {
      console.error('Error enviando notificaciones:', error);
      throw error;
    }
  }

  /**
   * Genera el mensaje de notificación de cita agendada
   */
  private generarMensajeCitaAgendada(cita: any): string {
    return `🆕 *NUEVA CITA AGENDADA*

📋 *Radicado:* ${cita.radicado}
👤 *Cliente:* ${cita.cliente.nombre}
📱 *Teléfono:* ${cita.cliente.telefono}
✂️ *Servicio:* ${cita.servicioNombre}
👨‍🦲 *Barbero:* ${cita.empleado.nombre}
📅 *Fecha:* ${formatearFecha(cita.fechaHora)}
⏰ *Hora:* ${formatearHora(cita.fechaHora.toTimeString().substring(0, 5))}
⏱️ *Duración:* ${cita.duracionMinutos} minutos
🌐 *Origen:* ${cita.origen === 'WHATSAPP' ? 'WhatsApp Bot' : 'Manual'}

_Notificación automática del sistema_ 💈`;
  }

  /**
   * Notifica al empleado sobre su cita
   */
  private async notificarEmpleado(empleado: any, mensaje: string) {
    if (!empleado.telefono) {
      console.warn(`⚠️ Empleado ${empleado.nombre} no tiene teléfono configurado`);
      return;
    }

    try {
      await whatsappMessagesService.enviarMensaje(empleado.telefono, mensaje);
      console.log(`✅ Notificación enviada al empleado ${empleado.nombre} (${empleado.telefono})`);
    } catch (error) {
      console.error(`❌ Error notificando a empleado ${empleado.nombre}:`, error);
    }
  }

  /**
   * Notifica al jefe barbero (puedes configurar su número en .env)
   */
  private async notificarJefeBarbero(mensaje: string) {
    const telefonoJefe = process.env.JEFE_BARBERO_TELEFONO;
    
    if (!telefonoJefe) {
      console.warn('⚠️ JEFE_BARBERO_TELEFONO no configurado en .env');
      return;
    }

    try {
      await whatsappMessagesService.enviarMensaje(
        telefonoJefe, 
        `👔 *Notificación para Jefe Barbero*\n\n${mensaje}`
      );
      console.log(`✅ Notificación enviada al jefe barbero (${telefonoJefe})`);
    } catch (error) {
      console.error('❌ Error notificando al jefe barbero:', error);
    }
  }

  /**
   * Notifica a la administradora (usa el número del bot de WhatsApp)
   */
  private async notificarAdministradora(mensaje: string) {
    const telefonoAdmin = process.env.ADMINISTRADORA_TELEFONO;
    
    if (!telefonoAdmin) {
      console.warn('⚠️ ADMINISTRADORA_TELEFONO no configurado en .env');
      return;
    }

    try {
      await whatsappMessagesService.enviarMensaje(
        telefonoAdmin, 
        `👩‍💼 *Notificación para Administradora*\n\n${mensaje}`
      );
      console.log(`✅ Notificación enviada a la administradora (${telefonoAdmin})`);
    } catch (error) {
      console.error('❌ Error notificando a la administradora:', error);
    }
  }

  /**
   * 🌟 FUTURO: Notificar cuando se cancela una cita
   */
  async notificarCitaCancelada(citaId: string) {
    try {
      const cita = await prisma.cita.findUnique({
        where: { id: citaId },
        include: {
          cliente: true,
          empleado: true,
        },
      });

      if (!cita) return;

      const mensaje = `❌ *CITA CANCELADA*

📋 *Radicado:* ${cita.radicado}
👤 *Cliente:* ${cita.cliente.nombre}
✂️ *Servicio:* ${cita.servicioNombre}
👨‍🦲 *Barbero:* ${cita.empleado.nombre}
📅 *Fecha:* ${formatearFecha(cita.fechaHora)}
⏰ *Hora:* ${formatearHora(cita.fechaHora.toTimeString().substring(0, 5))}
${cita.motivoCancelacion ? `📝 *Motivo:* ${cita.motivoCancelacion}` : ''}

_Notificación automática del sistema_ 💈`;

      // Notificar solo al empleado y al jefe barbero
      await this.notificarEmpleado(cita.empleado, mensaje);
      await this.notificarJefeBarbero(mensaje);
      await this.notificarAdministradora(mensaje);

      console.log(`✅ Notificaciones de cancelación enviadas para cita ${cita.radicado}`);
    } catch (error) {
      console.error('Error enviando notificaciones de cancelación:', error);
    }
  }

  /**
   * 🌟 FUTURO: Recordatorio de cita (1 hora antes)
   */
  async enviarRecordatorio(citaId: string) {
    try {
      const cita = await prisma.cita.findUnique({
        where: { id: citaId },
        include: {
          cliente: true,
          empleado: true,
        },
      });

      if (!cita || cita.estado !== 'CONFIRMADA') return;

      const mensajeCliente = `🔔 *RECORDATORIO DE CITA*

Hola ${cita.cliente.nombre}, te recordamos tu cita en 1 hora:

✂️ *Servicio:* ${cita.servicioNombre}
👨‍🦲 *Barbero:* ${cita.empleado.nombre}
⏰ *Hora:* ${formatearHora(cita.fechaHora.toTimeString().substring(0, 5))}
📋 *Radicado:* ${cita.radicado}

¡Te esperamos! 💈`;

      await whatsappMessagesService.enviarMensaje(cita.cliente.telefono, mensajeCliente);
      
      console.log(`✅ Recordatorio enviado al cliente ${cita.cliente.nombre}`);
    } catch (error) {
      console.error('Error enviando recordatorio:', error);
    }
  }
}

export const notificacionesService = new NotificacionesService();