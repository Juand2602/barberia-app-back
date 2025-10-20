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

// Tipo usado por la plantilla de mensajes (descripcion nunca será null aquí)
type ServicioParaPlantilla = {
  nombre: string;
  precio: number;
  descripcion?: string;
};

export class WhatsAppBotService {
  async procesarMensaje(telefono: string, mensaje: string) {
    try {
      // Obtener o crear conversación
      let conversacion = await this.obtenerConversacionActiva(telefono);

      if (!conversacion) {
        conversacion = await this.crearConversacion(telefono);
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.BIENVENIDA());
        return;
      }

      // Si por algún motivo la conversación no tiene cliente incluido (defensa)
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

      // Procesar según el estado
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

  private async manejarInicial(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    const opcion = messageParser.parsearOpcionNumerica(mensaje, 4);
    if (opcion === 1) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.UBICACION());
      await this.actualizarConversacion(conversacionId, 'INICIAL', contexto);
    } else if (opcion === 2) {
      const servicios = await serviciosService.listarActivos();
      const serviciosParaPlantilla: ServicioParaPlantilla[] = servicios.map(s => ({
        nombre: s.nombre,
        precio: s.precio,
        // Convertir null a undefined para cumplir tipos
        descripcion: (s.descripcion ?? undefined) as string | undefined,
      }));
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.LISTA_PRECIOS(serviciosParaPlantilla));
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.PUEDE_SERVIR_MAS());
      await this.actualizarConversacion(conversacionId, 'INICIAL', contexto);
    } else if (opcion === 3) {
      const barberos = await empleadosService.getAll(true);
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ELEGIR_BARBERO(barberos));
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_BARBERO', contexto);
    } else if (opcion === 4) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SOLICITAR_RADICADO());
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_RADICADO', { ...contexto, flujo: 'cancelacion' });
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
    }
  }

  private async manejarSeleccionBarbero(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
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

  private async manejarNombre(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (validarNombreCompleto(mensaje)) {
      contexto.nombre = mensaje;
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SOLICITAR_FECHA());
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_FECHA', contexto);
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.NOMBRE_INVALIDO());
    }
  }

  private async manejarFecha(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    const fecha = messageParser.parsearFecha(mensaje);
    if (fecha) {
      // Guardamos la fecha en formato ISO (YYYY-MM-DD) para luego combinar con hora seleccionada
      contexto.fecha = fecha.toISOString().split('T')[0];
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.CONSULTANDO_AGENDA());
      const horarios = await citasService.calcularHorariosDisponibles(contexto.empleadoId!, fecha, 30);
      if (horarios.length > 0) {
        const horariosFormateados = horarios.map((hora, idx) => ({ numero: idx + 1, hora: formatearHora(hora) }));
        contexto.horariosDisponibles = horariosFormateados;
        contexto.horariosRaw = horarios;
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.HORARIOS_DISPONIBLES(horariosFormateados));
        await this.actualizarConversacion(conversacionId, 'ESPERANDO_HORA', contexto);
      } else {
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.NO_HAY_HORARIOS());
        await this.actualizarConversacion(conversacionId, 'ESPERANDO_FECHA', contexto);
      }
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
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
      const horaSeleccionada = contexto.horariosRaw[opcion - 1]; // e.g. "11:00"
      contexto.hora = horaSeleccionada;

      // Obtener/crear cliente
      const cliente = await clientesService.obtenerOCrear(telefono, contexto.nombre!);
      if (!cliente) {
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
        return;
      }

      // --- CORRECCIÓN DE ZONA HORARIA ---
      // contexto.fecha está guardado como "YYYY-MM-DD"
      // horaSeleccionada es "HH:mm"
      // Construimos un Date con esos componentes **en la zona local deseada** y lo convertimos
      // a UTC para que Prisma/DB almacene el instante correcto.
      // Esto evita desplazamientos cuando el servidor está en UTC.
      const [yearStr, monthStr, dayStr] = (contexto.fecha || '').split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);
      const [horasStr, minutosStr] = horaSeleccionada.split(':');
      const horas = parseInt(horasStr, 10);
      const minutos = parseInt(minutosStr, 10);

      // Crear fecha en la hora local (usando constructor new Date(year, monthIndex, day, h, m))
      // Esto crea un objeto Date con la hora en la zona local del entorno de Node.
      // Para almacenar el instante equivalente en UTC (evitar desfases) restamos el offset local.
      let fechaHoraLocal = new Date(year, month - 1, day, horas, minutos, 0, 0);

      // Convertir de hora local a UTC timestamp (asumiendo la hora seleccionada es en la zona "local" que quieras tratar).
      // El siguiente ajuste convierte la fecha local a UTC para que la DB guarde el instante correcto.
      const fechaHoraUtcMs = fechaHoraLocal.getTime() - (fechaHoraLocal.getTimezoneOffset() * 60000);
      const fechaHora = new Date(fechaHoraUtcMs);

      // FIN CORRECCIÓN ZONA HORARIA

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

      // Al enviar la confirmación mostramos la hora formateada basada en la hora seleccionada
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.CITA_CONFIRMADA({
        radicado,
        servicio: servicio.nombre,
        barbero: contexto.empleadoNombre!,
        fecha: formatearFecha(fechaHora), // formatearFecha debe mostrar correctamente según tu helper
        hora: formatearHora(horaSeleccionada),
      }));

      // indicar que se puede seguir conversando
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.PUEDE_SERVIR_MAS());
      await this.actualizarConversacion(conversacionId, 'INICIAL', {});
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
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
      await this.actualizarConversacion(conversacionId, 'INICIAL', {});
      return;
    }
    const cita = await citasService.buscarPorRadicado(mensaje.trim().toUpperCase());
    if (cita && cita.cliente.telefono === telefono) {
      contexto.radicado = cita.radicado;
      contexto.citaId = cita.id;
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.CONFIRMAR_CANCELACION({
        radicado: cita.radicado,
        servicio: cita.servicioNombre,
        // formateo correcto de fecha/hora
        fecha: formatearFecha(cita.fechaHora),
        hora: formatearHora(cita.fechaHora.toTimeString().substring(0, 5)),
      }));
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_CONFIRMACION_CANCELACION', contexto);
    } else {
      // Si no se encuentra, sugerimos volver al menú principal
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.RADICADO_NO_ENCONTRADO());
      // En lugar de dejar en el mismo estado, damos opción de volver al menú para evitar bucle
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.PUEDE_SERVIR_MAS());
      await this.actualizarConversacion(conversacionId, 'INICIAL', {});
    }
  }

  private async manejarConfirmacionCancelacion(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    const normalizado = messageParser.normalizarRespuesta(mensaje);
    if (normalizado.includes('si') && normalizado.includes('cancelar')) {
      await citasService.cancelar(contexto.radicado!);
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.CITA_CANCELADA());
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.PUEDE_SERVIR_MAS());
      await this.actualizarConversacion(conversacionId, 'INICIAL', {});
    } else if (normalizado.includes('no') && normalizado.includes('conservar')) {
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
 * Limpieza de conversaciones inactivas (se exporta igual que antes)
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
