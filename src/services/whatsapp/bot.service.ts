// src/services/whatsapp/bot.service.ts
import prisma from '../../config/database';
import { whatsappMessagesService } from './messages.service';
import { messageParser } from './parser.service';
import {
  MENSAJES,
  generarRadicado,
  formatearFecha,
  formatearHora,
  validarNombreCompleto,
} from './templates';
import { clientesService } from '../clientes.service';
import { serviciosService } from '../servicios.service';
import { empleadosService } from '../empleados.service';
import { citasService } from '../citas.service';
import { ConversationState, ConversationContext } from '../../types';
import { botConfig } from '../../config/whatsapp';

// Tipo para plantilla de lista de precios
type ServicioParaPlantilla = {
  nombre: string;
  precio: number;
  descripcion?: string;
};

export class WhatsAppBotService {
  async procesarMensaje(telefono: string, mensaje: string) {
    try {
      let conversacion = await this.obtenerConversacionActiva(telefono);

      if (!conversacion) {
        conversacion = await this.crearConversacion(telefono);
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.BIENVENIDA());
        return;
      }

      // Si por alguna razón la conversación no incluye cliente, reiniciamos
      if (!('cliente' in conversacion) || !conversacion.cliente) {
        console.error(`Conversación ${conversacion.id} sin cliente asociado. Reiniciando.`);
        await this.finalizarConversacion(conversacion.id);
        const nuevaConversacion = await this.crearConversacion(telefono);
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.BIENVENIDA());
        return;
      }

      // Actualizar última actividad
      await this.actualizarActividad(conversacion.id);

      const estado = (conversacion.estado as ConversationState) || 'INICIAL';
      const contexto: ConversationContext = conversacion.contexto
        ? JSON.parse(conversacion.contexto)
        : {};

      await this.procesarEstado(telefono, mensaje, estado, contexto, conversacion.id);
    } catch (error) {
      console.error('Error procesando mensaje:', error);
      try {
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
      } catch (err) {
        console.error('Error enviando mensaje de error al usuario:', err);
      }
    }
  }

  private async procesarEstado(
    telefono: string,
    mensaje: string,
    estado: ConversationState,
    contexto: ConversationContext,
    conversacionId: string
  ) {
    switch (estado) {
      case 'INICIAL':
        await this.manejarInicial(telefono, mensaje, contexto, conversacionId);
        break;
      case 'ESPERANDO_BARBERO':
        await this.manejarSeleccionBarbero(telefono, mensaje, contexto, conversacionId);
        break;
      case 'ESPERANDO_NOMBRE':
        await this.manejarNombre(telefono, mensaje, contexto, conversacionId);
        break;
      case 'ESPERANDO_FECHA':
        await this.manejarFecha(telefono, mensaje, contexto, conversacionId);
        break;
      case 'ESPERANDO_HORA':
        await this.manejarHora(telefono, mensaje, contexto, conversacionId);
        break;
      case 'ESPERANDO_RADICADO':
        await this.manejarRadicado(telefono, mensaje, contexto, conversacionId);
        break;
      case 'ESPERANDO_CONFIRMACION_CANCELACION':
        await this.manejarConfirmacionCancelacion(telefono, mensaje, contexto, conversacionId);
        break;
      default:
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
    }
  }

  private async manejarInicial(
    telefono: string,
    mensaje: string,
    contexto: ConversationContext,
    conversacionId: string
  ) {
    // (esta función ya la tienes corregida en el cambio anterior)
    const opcion = messageParser.parsearOpcionNumerica(mensaje, 4);
    if (opcion === 1) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.UBICACION());
      await this.actualizarConversacion(conversacionId, 'INICIAL', contexto);
      return;
    } else if (opcion === 2) {
      const servicios = await serviciosService.listarActivos();
      const serviciosParaPlantilla: ServicioParaPlantilla[] = servicios.map((s: any) => ({
        nombre: s.nombre,
        precio: s.precio,
        descripcion: s.descripcion ?? undefined,
      }));
      await whatsappMessagesService.enviarMensaje(
        telefono,
        MENSAJES.LISTA_PRECIOS(serviciosParaPlantilla)
      );
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.PUEDE_SERVIR_MAS());
      await this.actualizarConversacion(conversacionId, 'INICIAL', contexto);
      return;
    } else if (opcion === 3) {
      const barberos = await empleadosService.getAll(true);
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ELEGIR_BARBERO(barberos));
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_BARBERO', contexto);
      return;
    } else if (opcion === 4) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SOLICITAR_RADICADO());
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_RADICADO', {
        ...contexto,
        flujo: 'cancelacion',
      });
      return;
    }

    if (messageParser.esAfirmativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.BIENVENIDA());
      await this.actualizarConversacion(conversacionId, 'INICIAL', {});
      return;
    }
    if (messageParser.esNegativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.DESPEDIDA());
      await this.finalizarConversacion(conversacionId);
      return;
    }

    await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
  }

  private async manejarSeleccionBarbero(
    telefono: string,
    mensaje: string,
    contexto: ConversationContext,
    conversacionId: string
  ) {
    const barberos = await empleadosService.getAll(true);
    const opcion = messageParser.parsearOpcionNumerica(mensaje, barberos.length);
    if (opcion) {
      const barbero = barberos[opcion - 1];
      contexto.empleadoId = barbero.id;
      contexto.empleadoNombre = barbero.nombre;
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SOLICITAR_NOMBRE_COMPLETO());
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_NOMBRE', contexto);
    } else if (messageParser.normalizarRespuesta(mensaje) === 'ninguno') {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.DESPEDIDA());
      await this.finalizarConversacion(conversacionId);
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
    }
  }

  private async manejarNombre(
    telefono: string,
    mensaje: string,
    contexto: ConversationContext,
    conversacionId: string
  ) {
    if (validarNombreCompleto(mensaje)) {
      contexto.nombre = mensaje;
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SOLICITAR_FECHA());
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_FECHA', contexto);
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.NOMBRE_INVALIDO());
    }
  }

  private async manejarFecha(
    telefono: string,
    mensaje: string,
    contexto: ConversationContext,
    conversacionId: string
  ) {
    if (messageParser.esAfirmativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SOLICITAR_FECHA());
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_FECHA', contexto);
      return;
    }
    if (messageParser.esNegativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.PUEDE_SERVIR_MAS());
      await this.actualizarConversacion(conversacionId, 'INICIAL', {});
      return;
    }

    const fecha = messageParser.parsearFecha(mensaje);
    if (fecha) {
      const yyyy = fecha.getFullYear().toString().padStart(4, '0');
      const mm = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const dd = fecha.getDate().toString().padStart(2, '0');
      contexto.fecha = `${yyyy}-${mm}-${dd}`;

      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.CONSULTANDO_AGENDA());
      const horarios = await citasService.calcularHorariosDisponibles(
        contexto.empleadoId!,
        fecha,
        30
      );

      if (horarios.length > 0) {
        const horariosFormateados = horarios.map((h: any, idx: number) => {
          if (h instanceof Date) {
            const hh = h.getHours().toString().padStart(2, '0');
            const mm2 = h.getMinutes().toString().padStart(2, '0');
            return { numero: idx + 1, hora: `${hh}:${mm2}` };
          }
          if (typeof h === 'string') {
            return { numero: idx + 1, hora: h };
          }
          const d = new Date(h);
          if (!isNaN(d.getTime())) {
            const hh = d.getHours().toString().padStart(2, '0');
            const mm3 = d.getMinutes().toString().padStart(2, '0');
            return { numero: idx + 1, hora: `${hh}:${mm3}` };
          }
          return { numero: idx + 1, hora: '' };
        });

        const horariosRaw: string[] = horariosFormateados.map((hf) => hf.hora);

        contexto.horariosDisponibles = horariosFormateados;
        contexto.horariosRaw = horariosRaw;

        await whatsappMessagesService.enviarMensaje(
          telefono,
          MENSAJES.HORARIOS_DISPONIBLES(horariosFormateados)
        );
        await this.actualizarConversacion(conversacionId, 'ESPERANDO_HORA', contexto);
      } else {
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.NO_HAY_HORARIOS());
        await this.actualizarConversacion(conversacionId, 'ESPERANDO_FECHA', contexto);
      }
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
    }
  }

  private async manejarHora(
    telefono: string,
    mensaje: string,
    contexto: ConversationContext,
    conversacionId: string
  ) {
    if (messageParser.normalizarRespuesta(mensaje) === 'cancelar') {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.DESPEDIDA());
      await this.finalizarConversacion(conversacionId);
      return;
    }

    const opcion = messageParser.parsearOpcionNumerica(
      mensaje,
      contexto.horariosDisponibles?.length || 0
    );
    if (opcion && Array.isArray(contexto.horariosRaw)) {
      const horaSeleccionada = contexto.horariosRaw[opcion - 1]; // ej. "16:00"
      if (!horaSeleccionada) {
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
        return;
      }
      contexto.hora = horaSeleccionada;

      const cliente = await clientesService.obtenerOCrear(telefono, contexto.nombre!);
      if (!cliente) {
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
        return;
      }

      // --- ZONA HORARIA / CREACION DE Date ---
      // Expectativa: contexto.fecha = "YYYY-MM-DD", horaSeleccionada = "HH:mm"
      // BARBERIA_UTC_OFFSET_MINUTES debe ser positivo (ej: Bogotá -> 300)
      const offsetMinutes = parseInt(process.env.BARBERIA_UTC_OFFSET_MINUTES || '300', 10);

      const [yearStr, monthStr, dayStr] = (contexto.fecha || '').split('-');
      const year = parseInt(yearStr || '1970', 10);
      const month = parseInt(monthStr || '1', 10);
      const day = parseInt(dayStr || '1', 10);
      const [horasStr, minutosStr] = horaSeleccionada.split(':');
      const horas = parseInt(horasStr || '0', 10);
      const minutos = parseInt(minutosStr || '0', 10);

      // Construimos un timestamp UTC correcto para la hora local de la barbería.
      // Date.UTC interpreta las horas como UTC, por eso sumamos el offset local (p.e. UTC-5 => +300 min)
      const fechaLocalAsIfUtcMs = Date.UTC(year, month - 1, day, horas, minutos);
      const fechaUtcMs = fechaLocalAsIfUtcMs + offsetMinutes * 60_000; // <-- CORRECCIÓN: sumar, no restar
      const fechaHora = new Date(fechaUtcMs);

      const radicado = generarRadicado();
      const servicios = await serviciosService.listarActivos();
      const servicio = servicios[0];

      await citasService.create({
        radicado,
        clienteId: cliente.id,
        empleadoId: contexto.empleadoId!,
        servicioNombre: servicio.nombre,
        fechaHora,
        duracionMinutos: servicio.duracionMinutos,
        origen: 'WHATSAPP',
      });

      await whatsappMessagesService.enviarMensaje(
        telefono,
        MENSAJES.CITA_CONFIRMADA({
          radicado,
          servicio: servicio.nombre,
          barbero: contexto.empleadoNombre!,
          fecha: formatearFecha(fechaHora),
          hora: formatearHora(fechaHora),
        })
      );

      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.PUEDE_SERVIR_MAS());
      await this.actualizarConversacion(conversacionId, 'INICIAL', {});
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
    }
  }

  private async manejarRadicado(
    telefono: string,
    mensaje: string,
    contexto: ConversationContext,
    conversacionId: string
  ) {
    if (messageParser.esAfirmativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SOLICITAR_CODIGO_RADICADO());
      return;
    }
    if (messageParser.esNegativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SIN_RADICADO());
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.PUEDE_SERVIR_MAS());
      await this.actualizarConversacion(conversacionId, 'INICIAL', {});
      return;
    }

    const codigo = mensaje.trim().toUpperCase();
    const cita = await citasService.buscarPorRadicado(codigo);
    if (cita && cita.cliente.telefono === telefono) {
      contexto.radicado = cita.radicado;
      contexto.citaId = cita.id;
      await whatsappMessagesService.enviarMensaje(
        telefono,
        MENSAJES.CONFIRMAR_CANCELACION({
          radicado: cita.radicado,
          servicio: cita.servicioNombre,
          fecha: formatearFecha(cita.fechaHora),
          hora: formatearHora(cita.fechaHora),
        })
      );
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_CONFIRMACION_CANCELACION', contexto);
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.RADICADO_NO_ENCONTRADO());
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.PUEDE_SERVIR_MAS());
      await this.actualizarConversacion(conversacionId, 'INICIAL', {});
    }
  }

  private async manejarConfirmacionCancelacion(
    telefono: string,
    mensaje: string,
    contexto: ConversationContext,
    conversacionId: string
  ) {
    if (messageParser.esAfirmativo(mensaje) || messageParser.normalizarRespuesta(mensaje).includes('cancelar')) {
      try {
        await citasService.cancelar(contexto.radicado!);
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.CITA_CANCELADA());
      } catch (err) {
        console.error('Error cancelando cita:', err);
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
      }
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.PUEDE_SERVIR_MAS());
      await this.actualizarConversacion(conversacionId, 'INICIAL', {});
    } else if (messageParser.esNegativo(mensaje) || messageParser.normalizarRespuesta(mensaje).includes('conservar')) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.PUEDE_SERVIR_MAS());
      await this.actualizarConversacion(conversacionId, 'INICIAL', {});
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
    }
  }

  private async obtenerConversacionActiva(telefono: string) {
    return prisma.conversacion.findFirst({
      where: { telefono, activa: true },
      include: { cliente: true },
    });
  }

  private async crearConversacion(telefono: string) {
    let cliente = await clientesService.buscarPorTelefono(telefono);
    if (!cliente) {
      cliente = await clientesService.crear({ nombre: 'Cliente WhatsApp', telefono });
    }
    return prisma.conversacion.create({
      data: {
        clienteId: cliente.id,
        telefono,
        estado: 'INICIAL',
        contexto: JSON.stringify({}),
        activa: true,
      },
      include: {
        cliente: true,
      },
    });
  }

  private async actualizarConversacion(id: string, estado: ConversationState, contexto: ConversationContext) {
    return prisma.conversacion.update({
      where: { id },
      data: { estado, contexto: JSON.stringify(contexto), lastActivity: new Date() },
    });
  }

  private async actualizarActividad(id: string) {
    return prisma.conversacion.update({
      where: { id },
      data: { lastActivity: new Date() },
    });
  }

  private async finalizarConversacion(id: string) {
    return prisma.conversacion.update({
      where: { id },
      data: { activa: false, estado: 'COMPLETADA' },
    });
  }
}

export const whatsappBotService = new WhatsAppBotService();

/**
 * Limpieza de conversaciones inactivas
 */
export async function limpiarConversacionesInactivas() {
  const timeout = botConfig.timeoutConversacion;
  const fechaLimite = new Date(Date.now() - timeout);
  const result = await prisma.conversacion.updateMany({
    where: { activa: true, lastActivity: { lt: fechaLimite } },
    data: { activa: false },
  });
  if (result.count > 0) {
    console.log(`✅ ${result.count} conversaciones inactivas limpiadas`);
  }
}
