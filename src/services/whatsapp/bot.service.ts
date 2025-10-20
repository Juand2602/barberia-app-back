import prisma from '../../config/database';
import { whatsappMessagesService } from './messages.service';
import { messageParser } from './parser.service';
import { MENSAJES, generarRadicado, formatearFecha, formatearHora, validarNombreCompleto } from './templates';
import { clientesService } from '../clientes.service';
import { serviciosService } from '../servicios.service';
import { empleadosService } from '../empleados.service';
import { citasService } from '../citas.service';
import { ConversationState, ConversationContext } from '../../types';
import { botConfig } from '../../config/whatsapp';

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

      if (!conversacion.cliente) {
        console.error(`Conversación ${conversacion.id} sin cliente asociado. Reiniciando.`);
        await this.finalizarConversacion(conversacion.id);
        const nuevaConversacion = await this.crearConversacion(telefono);
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.BIENVENIDA());
        return;
      }

      await this.actualizarActividad(conversacion.id);

      const estado = conversacion.estado as ConversationState;
      const contexto: ConversationContext = JSON.parse(conversacion.contexto);

      await this.procesarEstado(telefono, mensaje, estado, contexto, conversacion.id);

    } catch (error) {
      console.error('Error procesando mensaje:', error);
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
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
      case 'ESPERANDO_SERVICIO':
        await this.manejarServicio(telefono, mensaje, contexto, conversacionId);
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
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.BIENVENIDA());
        await this.actualizarConversacion(conversacionId, 'INICIAL', {});
    }
  }

  private async manejarInicial(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    const mensajeNormalizado = messageParser.normalizarRespuesta(mensaje);
    
    // Si responde Si o No después de alguna interacción
    if (mensajeNormalizado === 'si') {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.BIENVENIDA());
      return;
    }
    
    if (mensajeNormalizado === 'no') {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.DESPEDIDA());
      await this.finalizarConversacion(conversacionId);
      return;
    }

    const opcion = messageParser.parsearOpcionNumerica(mensaje, 4);

    if (opcion === 1) {
      // Ubicación
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.UBICACION());
      // Mantener en INICIAL para poder seguir con el flujo
    } else if (opcion === 2) {
      // Lista de precios
      const servicios = await serviciosService.listarActivos();
      const serviciosParaPlantilla: ServicioParaPlantilla[] = servicios.map(s => ({
        nombre: s.nombre,
        precio: s.precio,
        descripcion: s.descripcion ?? undefined,
      }));
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.LISTA_PRECIOS(serviciosParaPlantilla));
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.PUEDE_SERVIR_MAS());
      // Cambiar a estado de espera de confirmación
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_SERVICIO', contexto);
    } else if (opcion === 3) {
      // Agendar cita
      const barberos = await empleadosService.getAll();
      if (barberos.length === 0) {
        await whatsappMessagesService.enviarMensaje(telefono, 'Lo siento, no hay barberos disponibles en este momento.');
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.PUEDE_SERVIR_MAS());
        return;
      }
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ELEGIR_BARBERO(barberos));
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_BARBERO', contexto);
    } else if (opcion === 4) {
      // Cancelar cita
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SOLICITAR_RADICADO());
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_RADICADO', { ...contexto, flujo: 'cancelacion' });
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.BIENVENIDA());
    }
  }

  // NUEVO: Manejar respuesta después de mostrar servicios o ubicación
  private async manejarServicio(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (messageParser.esAfirmativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.BIENVENIDA());
      await this.actualizarConversacion(conversacionId, 'INICIAL', {});
    } else if (messageParser.esNegativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.DESPEDIDA());
      await this.finalizarConversacion(conversacionId);
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.PUEDE_SERVIR_MAS());
    }
  }

  private async manejarSeleccionBarbero(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    const barberos = await empleadosService.getAll();
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
      const barberosNuevo = await empleadosService.getAll();
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ELEGIR_BARBERO(barberosNuevo));
    }
  }

  private async manejarNombre(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (validarNombreCompleto(mensaje)) {
      contexto.nombre = mensaje;
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SOLICITAR_FECHA());
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_FECHA', contexto);
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.NOMBRE_INVALIDO());
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SOLICITAR_NOMBRE_COMPLETO());
    }
  }

  private async manejarFecha(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    const fecha = messageParser.parsearFecha(mensaje);

    if (fecha) {
      contexto.fecha = fecha.toISOString();
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.CONSULTANDO_AGENDA());
      
      const horarios = await citasService.calcularHorariosDisponibles(contexto.empleadoId!, fecha, 30);

      if (horarios.length > 0) {
        const horariosFormateados = horarios.map((hora, idx) => ({
          numero: idx + 1,
          hora: formatearHora(hora)
        }));
        
        contexto.horariosDisponibles = horariosFormateados;
        contexto.horariosRaw = horarios;
        
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.HORARIOS_DISPONIBLES(horariosFormateados));
        await this.actualizarConversacion(conversacionId, 'ESPERANDO_HORA', contexto);
      } else {
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.NO_HAY_HORARIOS());
        // Preguntar si quiere otra fecha o terminar
        await this.actualizarConversacion(conversacionId, 'ESPERANDO_FECHA', contexto);
      }
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SOLICITAR_FECHA());
    }
  }

  private async manejarHora(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (messageParser.normalizarRespuesta(mensaje) === 'cancelar') {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.DESPEDIDA());
      await this.finalizarConversacion(conversacionId);
      return;
    }

    const opcion = messageParser.parsearOpcionNumerica(mensaje, contexto.horariosDisponibles?.length || 0);

    if (opcion && contexto.horariosRaw) {
      const horaSeleccionada = contexto.horariosRaw[opcion - 1];
      contexto.hora = horaSeleccionada;

      const cliente = await clientesService.obtenerOCrear(telefono, contexto.nombre!);
      
      if (!cliente) {
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
        return;
      }

      const fechaHora = new Date(contexto.fecha!);
      const [horas, minutos] = horaSeleccionada.split(':');
      fechaHora.setHours(parseInt(horas), parseInt(minutos), 0, 0);

      const radicado = generarRadicado();
      
      const servicios = await serviciosService.listarActivos();
      if (servicios.length === 0) {
        await whatsappMessagesService.enviarMensaje(telefono, 'Lo siento, no hay servicios disponibles.');
        return;
      }
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
          hora: formatearHora(horaSeleccionada),
        })
      );

      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.PUEDE_SERVIR_MAS());
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_SERVICIO', {});
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
      if (contexto.horariosDisponibles) {
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.HORARIOS_DISPONIBLES(contexto.horariosDisponibles));
      }
    }
  }

  private async manejarRadicado(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (messageParser.esAfirmativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SOLICITAR_CODIGO_RADICADO());
      return;
    }

    if (messageParser.esNegativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SIN_RADICADO());
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.PUEDE_SERVIR_MAS());
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_SERVICIO', {});
      return;
    }

    const cita = await citasService.buscarPorRadicado(mensaje.trim().toUpperCase());

    if (cita && cita.cliente.telefono === telefono) {
      contexto.radicado = cita.radicado;
      contexto.citaId = cita.id;

      await whatsappMessagesService.enviarMensaje(
        telefono,
        MENSAJES.CONFIRMAR_CANCELACION({
          radicado: cita.radicado,
          servicio: cita.servicioNombre,
          fecha: formatearFecha(cita.fechaHora),
          hora: formatearHora(cita.fechaHora.toTimeString().substring(0, 5)),
        })
      );

      await this.actualizarConversacion(conversacionId, 'ESPERANDO_CONFIRMACION_CANCELACION', contexto);
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.RADICADO_NO_ENCONTRADO());
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SOLICITAR_CODIGO_RADICADO());
    }
  }

  private async manejarConfirmacionCancelacion(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    const normalizado = messageParser.normalizarRespuesta(mensaje);

    if (normalizado.includes('si') && normalizado.includes('cancelar')) {
      await citasService.cancelar(contexto.radicado!);
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.CITA_CANCELADA());
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.PUEDE_SERVIR_MAS());
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_SERVICIO', {});
    } else if (normalizado.includes('no') && normalizado.includes('conservar')) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.PUEDE_SERVIR_MAS());
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_SERVICIO', {});
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
    }
  }

  // Métodos auxiliares
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