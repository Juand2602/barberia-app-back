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
   * Recordatorio de cita (~1 hora antes), vía plantilla de WhatsApp "recordatorio_cita_cliente".
   * Un recordatorio se manda fuera de la ventana de 24h de conversación (el cliente normalmente
   * no le ha escrito al bot recientemente), así que tiene que ser plantilla aprobada por Meta —
   * un mensaje de texto libre fallaría en la mayoría de los casos.
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

      await whatsappMessagesService.enviarPlantilla(
        cita.cliente.telefono,
        'recordatorio_cita_cliente',
        'es',
        [
          cita.cliente.nombre,
          cita.empleado.nombre,
          formatearFecha(cita.fechaHora),
          formatearHora(cita.fechaHora.toTimeString().substring(0, 5)),
          cita.servicioNombre,
          cita.radicado,
        ]
      );

      await prisma.cita.update({
        where: { id: citaId },
        data: { recordatorioEnviado: true },
      });

      console.log(`✅ Recordatorio enviado al cliente ${cita.cliente.nombre} (cita ${cita.radicado})`);
    } catch (error) {
      console.error('Error enviando recordatorio:', error);
    }
  }
}

export const notificacionesService = new NotificacionesService();

/**
 * Busca citas confirmadas que empiezan en ~1 hora (ventana de 50-70 min, pensada para correr
 * cada 5 min: ancha lo suficiente para no perder ninguna si el servidor estuvo caído un rato,
 * sin solapar huecos entre una corrida del cron y la siguiente) y a las que no se les haya
 * enviado el recordatorio todavía. `recordatorioEnviado` evita que una misma cita reciba el
 * recordatorio dos veces si cae dentro de la ventana en más de una corrida del cron.
 */
export async function enviarRecordatoriosPendientes() {
  const ahora = new Date();
  const desde = new Date(ahora.getTime() + 50 * 60 * 1000);
  const hasta = new Date(ahora.getTime() + 70 * 60 * 1000);

  const citas = await prisma.cita.findMany({
    where: {
      estado: 'CONFIRMADA',
      recordatorioEnviado: false,
      fechaHora: { gte: desde, lt: hasta },
    },
    select: { id: true },
  });

  for (const cita of citas) {
    await notificacionesService.enviarRecordatorio(cita.id);
  }

  if (citas.length > 0) {
    console.log(`🔔 ${citas.length} recordatorio(s) de cita procesado(s)`);
  }
}