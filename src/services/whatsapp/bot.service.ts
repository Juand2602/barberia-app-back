// src/services/whatsapp/bot.service.ts

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
  async procesarMensaje(telefono: string, mensaje: string, esBoton: boolean = false, buttonId?: string) {
    try {
      if (messageParser.esComandoCancelacion(mensaje)) {
        await this.manejarCancelacionGlobal(telefono);
        return;
      }

      let conversacion = await this.obtenerConversacionActiva(telefono);
      
      if (!conversacion) {
        conversacion = await this.crearConversacion(telefono);
        await this.enviarMenuPrincipal(telefono);
        return;
      }

      if (!conversacion.cliente) {
        console.error(`Conversación ${conversacion.id} sin cliente asociado. Reiniciando.`);
        await this.finalizarConversacion(conversacion.id);
        const nuevaConversacion = await this.crearConversacion(telefono);
        await this.enviarMenuPrincipal(telefono);
        return;
      }

      await this.actualizarActividad(conversacion.id);

      const estado = conversacion.estado as ConversationState;
      const contexto: ConversationContext = JSON.parse(conversacion.contexto);

      // Si es un botón, usar el ID del botón como mensaje
      const mensajeAProcesar = esBoton && buttonId ? buttonId : mensaje;

      await this.procesarEstado(telefono, mensajeAProcesar, estado, contexto, conversacion.id);

    } catch (error) {
      console.error('Error procesando mensaje:', error);
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
    }
  }

  private async enviarMenuPrincipal(telefono: string) {
    await whatsappMessagesService.enviarMensajeConBotones(
      telefono,
      MENSAJES.BIENVENIDA(),
      [
        { id: 'menu_ubicacion', title: '📍 Ubicación' },
        { id: 'menu_precios', title: '💰 Precios' },
        { id: 'menu_agendar', title: '📅 Agendar' }
      ]
    );
    
    // Enviar el botón de cancelar por separado
    await whatsappMessagesService.enviarMensajeConBotones(
      telefono,
      'También puedes:',
      [{ id: 'menu_cancelar', title: '❌ Cancelar cita' }]
    );
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
      case 'ESPERANDO_SELECCION_CITA_CANCELAR':
        await this.manejarSeleccionCitaCancelar(telefono, mensaje, contexto, conversacionId);
        break;
      case 'ESPERANDO_CONFIRMACION_CANCELACION':
        await this.manejarConfirmacionCancelacion(telefono, mensaje, contexto, conversacionId);
        break;
      case 'ESPERANDO_RESPUESTA_UBICACION':
        await this.manejarRespuestaUbicacion(telefono, mensaje, contexto, conversacionId);
        break;
      case 'ESPERANDO_RESPUESTA_LISTA_PRECIOS':
        await this.manejarRespuestaListaPrecios(telefono, mensaje, contexto, conversacionId);
        break;
      case 'ESPERANDO_RESPUESTA_DESPUES_CITA':
        await this.manejarRespuestaDespuesCita(telefono, mensaje, contexto, conversacionId);
        break;
      case 'ESPERANDO_RESPUESTA_NO_HAY_HORARIOS':
        await this.manejarRespuestaNoHayHorarios(telefono, mensaje, contexto, conversacionId);
        break;
      default:
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
        await this.actualizarConversacion(conversacionId, 'INICIAL', contexto);
    }
  }

  private async manejarInicial(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    // Manejar IDs de botones del menú principal
    if (mensaje === 'menu_ubicacion') {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.UBICACION());
      await whatsappMessagesService.enviarMensajeConBotones(
        telefono,
        '¿Le puedo servir en algo más?',
        [
          { id: 'si_mas', title: '✅ Sí' },
          { id: 'no_mas', title: '❌ No' }
        ]
      );
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_RESPUESTA_UBICACION', contexto);
      return;
    }

    if (mensaje === 'menu_precios') {
      try {
        const servicios = await serviciosService.listarActivos();
        const serviciosParaPlantilla: ServicioParaPlantilla[] = servicios.map(s => ({
          nombre: s.nombre,
          precio: s.precio,
          descripcion: s.descripcion ?? undefined,
        }));
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.LISTA_PRECIOS(serviciosParaPlantilla));
        await whatsappMessagesService.enviarMensajeConBotones(
          telefono,
          '¿Le puedo servir en algo más?',
          [
            { id: 'si_mas', title: '✅ Sí' },
            { id: 'no_mas', title: '❌ No' }
          ]
        );
        await this.actualizarConversacion(conversacionId, 'ESPERANDO_RESPUESTA_LISTA_PRECIOS', contexto);
      } catch (error) {
        console.error('Error obteniendo servicios:', error);
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
      }
      return;
    }

    if (mensaje === 'menu_agendar') {
      try {
        const barberos = await empleadosService.getAll(true);
        
        // Usar lista desplegable para barberos
        await whatsappMessagesService.enviarMensajeConLista(
          telefono,
          MENSAJES.ELEGIR_BARBERO_TEXTO(),
          'Ver barberos',
          [{
            title: 'Nuestros Profesionales',
            rows: barberos.map((barbero, index) => ({
              id: `barbero_${barbero.id}`,
              title: barbero.nombre,
              description: `Opción ${index + 1}`
            }))
          }]
        );
        
        await this.actualizarConversacion(conversacionId, 'ESPERANDO_BARBERO', contexto);
      } catch (error) {
        console.error('Error obteniendo barberos:', error);
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
      }
      return;
    }

    if (mensaje === 'menu_cancelar') {
      await whatsappMessagesService.enviarMensajeConBotones(
        telefono,
        MENSAJES.SOLICITAR_RADICADO(),
        [
          { id: 'tengo_radicado', title: '✅ Sí, lo tengo' },
          { id: 'no_radicado', title: '❌ No lo tengo' }
        ]
      );
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_RADICADO', { ...contexto, flujo: 'cancelacion' });
      return;
    }

    // Mantener compatibilidad con opciones numéricas
    const opcion = messageParser.parsearOpcionNumerica(mensaje, 4);
    
    if (opcion === 1) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.UBICACION());
      await whatsappMessagesService.enviarMensajeConBotones(
        telefono,
        '¿Le puedo servir en algo más?',
        [
          { id: 'si_mas', title: '✅ Sí' },
          { id: 'no_mas', title: '❌ No' }
        ]
      );
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_RESPUESTA_UBICACION', contexto);
    } else if (opcion === 2) {
      try {
        const servicios = await serviciosService.listarActivos();
        const serviciosParaPlantilla: ServicioParaPlantilla[] = servicios.map(s => ({
          nombre: s.nombre,
          precio: s.precio,
          descripcion: s.descripcion ?? undefined,
        }));
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.LISTA_PRECIOS(serviciosParaPlantilla));
        await whatsappMessagesService.enviarMensajeConBotones(
          telefono,
          '¿Le puedo servir en algo más?',
          [
            { id: 'si_mas', title: '✅ Sí' },
            { id: 'no_mas', title: '❌ No' }
          ]
        );
        await this.actualizarConversacion(conversacionId, 'ESPERANDO_RESPUESTA_LISTA_PRECIOS', contexto);
      } catch (error) {
        console.error('Error obteniendo servicios:', error);
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
      }
    } else if (opcion === 3) {
      try {
        const barberos = await empleadosService.getAll(true);
        
        await whatsappMessagesService.enviarMensajeConLista(
          telefono,
          MENSAJES.ELEGIR_BARBERO_TEXTO(),
          'Ver barberos',
          [{
            title: 'Nuestros Profesionales',
            rows: barberos.map((barbero, index) => ({
              id: `barbero_${barbero.id}`,
              title: barbero.nombre,
              description: `Opción ${index + 1}`
            }))
          }]
        );
        
        await this.actualizarConversacion(conversacionId, 'ESPERANDO_BARBERO', contexto);
      } catch (error) {
        console.error('Error obteniendo barberos:', error);
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
      }
    } else if (opcion === 4) {
      await whatsappMessagesService.enviarMensajeConBotones(
        telefono,
        MENSAJES.SOLICITAR_RADICADO(),
        [
          { id: 'tengo_radicado', title: '✅ Sí, lo tengo' },
          { id: 'no_radicado', title: '❌ No lo tengo' }
        ]
      );
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_RADICADO', { ...contexto, flujo: 'cancelacion' });
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
    }
  }

  private async manejarRespuestaUbicacion(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (mensaje === 'si_mas' || messageParser.esAfirmativo(mensaje)) {
      await this.enviarMenuPrincipal(telefono);
      await this.actualizarConversacion(conversacionId, 'INICIAL', contexto);
    } else if (mensaje === 'no_mas' || messageParser.esNegativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.DESPEDIDA());
      await this.finalizarConversacion(conversacionId);
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
    }
  }

  private async manejarRespuestaListaPrecios(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (mensaje === 'si_mas' || messageParser.esAfirmativo(mensaje)) {
      await this.enviarMenuPrincipal(telefono);
      await this.actualizarConversacion(conversacionId, 'INICIAL', contexto);
    } else if (mensaje === 'no_mas' || messageParser.esNegativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.DESPEDIDA());
      await this.finalizarConversacion(conversacionId);
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
    }
  }

  private async manejarRespuestaDespuesCita(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (mensaje === 'si_mas' || messageParser.esAfirmativo(mensaje)) {
      await this.enviarMenuPrincipal(telefono);
      await this.actualizarConversacion(conversacionId, 'INICIAL', contexto);
    } else if (mensaje === 'no_mas' || messageParser.esNegativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.DESPEDIDA());
      await this.finalizarConversacion(conversacionId);
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
    }
  }

  private async manejarRespuestaNoHayHorarios(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (mensaje === 'si_mas' || messageParser.esAfirmativo(mensaje)) {
      await whatsappMessagesService.enviarMensajeConBotones(
        telefono,
        MENSAJES.SOLICITAR_FECHA_TEXTO(),
        [
          { id: 'fecha_hoy', title: '📅 Hoy' },
          { id: 'fecha_manana', title: '📅 Mañana' },
          { id: 'fecha_pasado', title: '📅 Pasado mañana' }
        ]
      );
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_FECHA', contexto);
    } else if (mensaje === 'no_mas' || messageParser.esNegativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.DESPEDIDA());
      await this.finalizarConversacion(conversacionId);
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
    }
  }

  private async manejarSeleccionBarbero(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    try {
      const barberos = await empleadosService.getAll(true);
      
      // Verificar si es una selección de lista (ID con formato barbero_XXX)
      if (mensaje.startsWith('barbero_')) {
        const barberoId = mensaje.replace('barbero_', '');
        const barbero = barberos.find(b => b.id === barberoId);
        
        if (barbero) {
          contexto.empleadoId = barbero.id;
          contexto.empleadoNombre = barbero.nombre;
          await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SOLICITAR_NOMBRE_COMPLETO());
          await this.actualizarConversacion(conversacionId, 'ESPERANDO_NOMBRE', contexto);
          return;
        }
      }
      
      // Compatibilidad con selección numérica
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
    } catch (error) {
      console.error('Error en manejarSeleccionBarbero:', error);
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
    }
  }

  private async manejarNombre(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (validarNombreCompleto(mensaje)) {
      contexto.nombre = mensaje;
      await whatsappMessagesService.enviarMensajeConBotones(
        telefono,
        MENSAJES.SOLICITAR_FECHA_TEXTO(),
        [
          { id: 'fecha_hoy', title: '📅 Hoy' },
          { id: 'fecha_manana', title: '📅 Mañana' },
          { id: 'fecha_pasado', title: '📅 Pasado mañana' }
        ]
      );
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_FECHA', contexto);
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.NOMBRE_INVALIDO());
    }
  }

  private async manejarFecha(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    let fecha: Date | null = null;
    
    // Manejar botones de fecha
    if (mensaje === 'fecha_hoy') {
      fecha = new Date();
    } else if (mensaje === 'fecha_manana') {
      fecha = new Date();
      fecha.setDate(fecha.getDate() + 1);
    } else if (mensaje === 'fecha_pasado') {
      fecha = new Date();
      fecha.setDate(fecha.getDate() + 2);
    } else {
      // Parsear fecha tradicional
      fecha = messageParser.parsearFecha(mensaje);
    }
    
    if (fecha) {
      const fechaLocal = new Date(fecha);
      fechaLocal.setHours(0, 0, 0, 0);
      
      contexto.fecha = fechaLocal.toISOString();
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.CONSULTANDO_AGENDA());
      
      try {
        const horarios = await citasService.calcularHorariosDisponibles(contexto.empleadoId!, fechaLocal, 30);
        
        if (horarios.length > 0) {
          const horariosFormateados = horarios.map((hora, idx) => ({ numero: idx + 1, hora: formatearHora(hora) }));
          contexto.horariosDisponibles = horariosFormateados;
          contexto.horariosRaw = horarios;
          
          // Usar lista desplegable para horarios
          await whatsappMessagesService.enviarMensajeConLista(
            telefono,
            MENSAJES.HORARIOS_DISPONIBLES_TEXTO(),
            'Ver horarios',
            [{
              title: 'Horarios Disponibles',
              rows: horarios.slice(0, 10).map((hora, idx) => ({
                id: `hora_${idx}`,
                title: formatearHora(hora),
                description: `Turno ${idx + 1}`
              }))
            }]
          );
          
          await this.actualizarConversacion(conversacionId, 'ESPERANDO_HORA', contexto);
        } else {
          await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.NO_HAY_HORARIOS());
          await whatsappMessagesService.enviarMensajeConBotones(
            telefono,
            '¿Desea intentar con otra fecha?',
            [
              { id: 'si_mas', title: '✅ Sí' },
              { id: 'no_mas', title: '❌ No' }
            ]
          );
          await this.actualizarConversacion(conversacionId, 'ESPERANDO_RESPUESTA_NO_HAY_HORARIOS', contexto);
        }
      } catch (error) {
        console.error('Error consultando horarios disponibles:', error);
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
      }
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
    }
  }

  private async manejarHora(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (messageParser.esComandoCancelacion(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.DESPEDIDA());
      await this.finalizarConversacion(conversacionId);
      return;
    }
    
    let opcion: number | null = null;
    
    // Verificar si es una selección de lista (ID con formato hora_X)
    if (mensaje.startsWith('hora_')) {
      const index = parseInt(mensaje.replace('hora_', ''));
      if (!isNaN(index)) {
        opcion = index + 1;
      }
    } else {
      // Compatibilidad con selección numérica
      opcion = messageParser.parsearOpcionNumerica(mensaje, contexto.horariosDisponibles?.length || 0);
    }
    
    if (opcion && contexto.horariosRaw) {
      const horaSeleccionada = contexto.horariosRaw[opcion - 1];
      contexto.hora = horaSeleccionada;
      
      try {
        const cliente = await clientesService.obtenerOCrear(telefono, contexto.nombre!);
        
        if (!cliente) {
          await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
          return;
        }
        
        const fechaBase = new Date(contexto.fecha!);
        const [horas, minutos] = horaSeleccionada.split(':').map(Number);
        
        const fechaHora = new Date(
          fechaBase.getFullYear(),
          fechaBase.getMonth(),
          fechaBase.getDate(),
          horas,
          minutos,
          0,
          0
        );
        
        const radicado = generarRadicado();
        const servicios = await serviciosService.listarActivos();
        const servicio = servicios[0];
        
        try {
          await citasService.create({
            radicado, 
            clienteId: cliente.id, 
            empleadoId: contexto.empleadoId!,
            servicioNombre: servicio.nombre, 
            fechaHora, 
            duracionMinutos: servicio.duracionMinutos, 
            origen: 'WHATSAPP',
          });
          
          await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.CITA_CONFIRMADA({
            radicado, 
            servicio: servicio.nombre, 
            barbero: contexto.empleadoNombre!,
            fecha: formatearFecha(fechaHora), 
            hora: formatearHora(horaSeleccionada),
          }));
          
          await whatsappMessagesService.enviarMensajeConBotones(
            telefono,
            '¿Le puedo servir en algo más?',
            [
              { id: 'si_mas', title: '✅ Sí' },
              { id: 'no_mas', title: '❌ No' }
            ]
          );
          await this.actualizarConversacion(conversacionId, 'ESPERANDO_RESPUESTA_DESPUES_CITA', contexto);
          
        } catch (createError: any) {
          if (createError.message.includes('ya no está disponible') || 
              createError.message.includes('ya está agendada') ||
              createError.message.includes('no está disponible')) {
            
            await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.HORARIO_YA_OCUPADO());
            
            const horarios = await citasService.calcularHorariosDisponibles(
              contexto.empleadoId!, 
              fechaBase, 
              servicio.duracionMinutos
            );
            
            if (horarios.length > 0) {
              const horariosFormateados = horarios.map((hora, idx) => ({ 
                numero: idx + 1, 
                hora: formatearHora(hora) 
              }));
              
              contexto.horariosDisponibles = horariosFormateados;
              contexto.horariosRaw = horarios;
              
              await whatsappMessagesService.enviarMensajeConLista(
                telefono,
                MENSAJES.HORARIOS_DISPONIBLES_TEXTO(),
                'Ver horarios',
                [{
                  title: 'Horarios Disponibles',
                  rows: horarios.slice(0, 10).map((hora, idx) => ({
                    id: `hora_${idx}`,
                    title: formatearHora(hora),
                    description: `Turno ${idx + 1}`
                  }))
                }]
              );
              
              await this.actualizarConversacion(conversacionId, 'ESPERANDO_HORA', contexto);
            } else {
              await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.NO_HAY_HORARIOS());
              await whatsappMessagesService.enviarMensajeConBotones(
                telefono,
                '¿Desea intentar con otra fecha?',
                [
                  { id: 'si_mas', title: '✅ Sí' },
                  { id: 'no_mas', title: '❌ No' }
                ]
              );
              await this.actualizarConversacion(conversacionId, 'ESPERANDO_RESPUESTA_NO_HAY_HORARIOS', contexto);
            }
          } else {
            throw createError;
          }
        }
        
      } catch (error) {
        console.error('Error creando cita:', error);
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
      }
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
    }
  }

  private async manejarRadicado(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (mensaje === 'tengo_radicado' || messageParser.esAfirmativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SOLICITAR_CODIGO_RADICADO());
      return;
    }
    
    if (mensaje === 'no_radicado' || messageParser.esNegativo(mensaje)) {
      await this.buscarYMostrarCitasActivas(telefono, conversacionId, contexto);
      return;
    }
    
    await this.buscarCitaPorRadicado(telefono, mensaje, contexto, conversacionId);
  }

  private async buscarYMostrarCitasActivas(telefono: string, conversacionId: string, contexto: ConversationContext) {
    try {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SIN_RADICADO_BUSCAR_CITAS());
      
      const citasActivas = await prisma.cita.findMany({
        where: {
          cliente: { telefono: telefono },
          estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
          fechaHora: { gte: new Date() }
        },
        include: {
          cliente: true,
          empleado: true,
        },
        orderBy: { fechaHora: 'asc' },
        take: 5
      });
      
      if (citasActivas.length === 0) {
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SIN_CITAS_ACTIVAS());
        await whatsappMessagesService.enviarMensajeConBotones(
          telefono,
          '¿Le puedo servir en algo más?',
          [
            { id: 'si_mas', title: '✅ Sí' },
            { id: 'no_mas', title: '❌ No' }
          ]
        );
        await this.actualizarConversacion(conversacionId, 'ESPERANDO_RESPUESTA_DESPUES_CITA', {});
        return;
      }
      
      const citasFormateadas = citasActivas.map((cita, index) => ({
        numero: index + 1,
        radicado: cita.radicado,
        servicio: cita.servicioNombre,
        fecha: formatearFecha(cita.fechaHora),
        hora: formatearHora(cita.fechaHora.toTimeString().substring(0, 5)),
      }));
      
      contexto.citasDisponibles = citasFormateadas;
      
      // Usar lista desplegable para mostrar citas
      await whatsappMessagesService.enviarMensajeConLista(
        telefono,
        MENSAJES.MOSTRAR_CITAS_ACTIVAS_TEXTO(),
        'Ver mis citas',
        [{
          title: 'Citas Activas',
          rows: citasFormateadas.map(cita => ({
            id: `cita_${cita.radicado}`,
            title: cita.servicio,
            description: `${cita.fecha} - ${cita.hora}`
          }))
        }]
      );
      
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_SELECCION_CITA_CANCELAR', contexto);
      
    } catch (error) {
      console.error('Error buscando citas activas:', error);
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
    }
  }

  private async manejarSeleccionCitaCancelar(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    // Verificar si es una selección de lista (ID con formato cita_XXX)
    if (mensaje.startsWith('cita_')) {
      const radicado = mensaje.replace('cita_', '');
      await this.buscarCitaPorRadicado(telefono, radicado, contexto, conversacionId);
      return;
    }
    
    // Compatibilidad con selección numérica
    const opcion = messageParser.parsearOpcionNumerica(mensaje, contexto.citasDisponibles?.length || 0);
    
    if (opcion && contexto.citasDisponibles) {
      const citaSeleccionada = contexto.citasDisponibles[opcion - 1];
      await this.buscarCitaPorRadicado(telefono, citaSeleccionada.radicado, contexto, conversacionId);
      return;
    }
    
    await this.buscarCitaPorRadicado(telefono, mensaje, contexto, conversacionId);
  }

  private async buscarCitaPorRadicado(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    try {
      let radicado = messageParser.extraerRadicado(mensaje);
      
      if (radicado) {
        const cita = await citasService.buscarPorRadicado(radicado);
        
        if (cita && cita.cliente.telefono === telefono) {
          await this.confirmarCancelacionCita(telefono, cita, contexto, conversacionId);
          return;
        }
      }
      
      const busquedaParcial = messageParser.extraerBusquedaParcial(mensaje);
      
      if (busquedaParcial) {
        const citasCoincidentes = await prisma.cita.findMany({
          where: {
            cliente: { telefono: telefono },
            estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
            radicado: {
              contains: busquedaParcial,
              mode: 'insensitive'
            }
          },
          include: {
            cliente: true,
            empleado: true,
          },
          orderBy: { fechaHora: 'desc' },
          take: 1
        });
        
        if (citasCoincidentes.length > 0) {
          await this.confirmarCancelacionCita(telefono, citasCoincidentes[0], contexto, conversacionId);
          return;
        }
      }
      
      const todasLasCitas = await prisma.cita.findMany({
        where: {
          cliente: { telefono: telefono },
          estado: { in: ['PENDIENTE', 'CONFIRMADA'] }
        },
        include: {
          cliente: true,
          empleado: true,
        },
        orderBy: { fechaHora: 'desc' },
        take: 5
      });
      
      const mensajeNormalizado = mensaje.toUpperCase().replace(/\s+/g, '');
      
      for (const cita of todasLasCitas) {
        const radicadoNormalizado = cita.radicado.replace(/\s+/g, '');
        if (radicadoNormalizado.includes(mensajeNormalizado) || 
            mensajeNormalizado.includes(radicadoNormalizado)) {
          await this.confirmarCancelacionCita(telefono, cita, contexto, conversacionId);
          return;
        }
      }
      
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.RADICADO_NO_ENCONTRADO());
      
    } catch (error) {
      console.error('Error buscando cita por radicado:', error);
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
    }
  }

  private async confirmarCancelacionCita(
    telefono: string, 
    cita: any, 
    contexto: ConversationContext, 
    conversacionId: string
  ) {
    contexto.radicado = cita.radicado;
    contexto.citaId = cita.id;
    
    await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.CONFIRMAR_CANCELACION({
      radicado: cita.radicado,
      servicio: cita.servicioNombre,
      fecha: formatearFecha(cita.fechaHora),
      hora: formatearHora(cita.fechaHora.toTimeString().substring(0, 5)),
    }));
    
    await whatsappMessagesService.enviarMensajeConBotones(
      telefono,
      'Por favor confirme:',
      [
        { id: 'confirmar_cancelar', title: '✅ Sí, cancelar' },
        { id: 'conservar_cita', title: '❌ No, conservar' }
      ]
    );
    
    await this.actualizarConversacion(conversacionId, 'ESPERANDO_CONFIRMACION_CANCELACION', contexto);
  }

  private async manejarConfirmacionCancelacion(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    const normalizado = messageParser.normalizarRespuesta(mensaje);
    
    if (mensaje === 'confirmar_cancelar' || messageParser.esAfirmativo(normalizado) || normalizado.includes('cancelar')) {
      try {
        await citasService.cancelar(contexto.radicado!);
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.CITA_CANCELADA());
        await whatsappMessagesService.enviarMensajeConBotones(
          telefono,
          '¿Le puedo servir en algo más?',
          [
            { id: 'si_mas', title: '✅ Sí' },
            { id: 'no_mas', title: '❌ No' }
          ]
        );
        await this.actualizarConversacion(conversacionId, 'ESPERANDO_RESPUESTA_DESPUES_CITA', {});
      } catch (error) {
        console.error('Error cancelando cita:', error);
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
      }
    } else if (mensaje === 'conservar_cita' || messageParser.esNegativo(normalizado) || normalizado.includes('conservar')) {
      await whatsappMessagesService.enviarMensajeConBotones(
        telefono,
        '¿Le puedo servir en algo más?',
        [
          { id: 'si_mas', title: '✅ Sí' },
          { id: 'no_mas', title: '❌ No' }
        ]
      );
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_RESPUESTA_DESPUES_CITA', {});
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
    }
  }

  private async manejarCancelacionGlobal(telefono: string) {
    const conversacion = await this.obtenerConversacionActiva(telefono);
    
    if (conversacion) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.CANCELACION_CONFIRMADA());
      await this.finalizarConversacion(conversacion.id);
    } else {
      await this.enviarMenuPrincipal(telefono);
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

export async function limpiarConversacionesInactivas() {
  const timeout = botConfig.timeoutConversacion;
  const fechaLimite = new Date(Date.now() - timeout);
  
  try {
    const result = await prisma.conversacion.updateMany({
      where: { activa: true, lastActivity: { lt: fechaLimite } },
      data: { activa: false },
    });
    
    if (result.count > 0) {
      console.log(`✅ ${result.count} conversaciones inactivas limpiadas`);
    }
  } catch (error) {
    console.error('Error limpiando conversaciones inactivas:', error);
  }
}