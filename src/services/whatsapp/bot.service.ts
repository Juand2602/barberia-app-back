// src/services/whatsapp/bot.service.ts - CON MOSAICO A+B
// 🎯 CAMBIOS:
// 1. ✅ Eliminadas todas las opciones numéricas del menú
// 2. ✅ Mosaico de barberos (Opción A) + Fotos individuales opcionales (Opción B)
// 3. ✅ Integración con sistema de notificaciones

import prisma from '../../config/database';
import { whatsappMessagesService } from './messages.service';
import { messageParser } from './parser.service';
import { MENSAJES, generarRadicado, formatearFecha, formatearHora, validarNombreCompleto } from './templates';
import { clientesService } from '../clientes.service';
import { serviciosService } from '../servicios.service';
import { empleadosService } from '../empleados.service';
import { citasService } from '../citas.service';
import { notificacionesService } from '../notificaciones.service';
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
      case 'ESPERANDO_VER_FOTOS_BARBEROS': // 🌟 NUEVO
        await this.manejarVerFotosBarberos(telefono, mensaje, contexto, conversacionId);
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
      case 'ESPERANDO_FECHA_ESPECIFICA':
        await this.manejarFechaEspecifica(telefono, mensaje, contexto, conversacionId);
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

  // 🌟 MODIFICADO: Solo botones, sin opciones numéricas
  private async manejarInicial(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    // ✅ Opción 1: Ubicación
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

    // ✅ Opción 2: Lista de precios
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

    // ✅ Opción 3: Agendar cita - 🌟 NUEVO: Mosaico (Opción A) + Fotos opcionales (Opción B)
    if (mensaje === 'menu_agendar') {
      try {
        const barberos = await empleadosService.getAll(true);
        
        // 📸 OPCIÓN A: Enviar UNA imagen mosaico
        const imagenMosaico = process.env.BARBEROS_MOSAICO_URL;
        
        if (imagenMosaico) {
          await whatsappMessagesService.enviarImagen(
            telefono,
            imagenMosaico,
            '💈 *Nuestro Equipo de Profesionales*\n\nSelecciona tu barbero de confianza:'
          );
        } else {
          // Fallback si no hay mosaico configurado
          await whatsappMessagesService.enviarMensaje(
            telefono,
            '💈 *Nuestro Equipo de Profesionales*\n\nSelecciona tu barbero de confianza:'
          );
        }
        
        // Botón para ver fotos individuales (Opción B)
        await whatsappMessagesService.enviarMensajeConBotones(
          telefono,
          '¿Deseas ver las fotos individuales de cada barbero?',
          [
            { id: 'ver_fotos_si', title: '👀 Sí, ver fotos' },
            { id: 'ver_fotos_no', title: '➡️ No, continuar' }
          ]
        );
        
        // Guardar barberos en contexto
        contexto.barberos = barberos.map(b => ({
          id: b.id,
          nombre: b.nombre,
          fotoUrl: b.fotoUrl,
          especialidades: b.especialidades
        }));
        
        await this.actualizarConversacion(conversacionId, 'ESPERANDO_VER_FOTOS_BARBEROS', contexto);
      } catch (error) {
        console.error('Error obteniendo barberos:', error);
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
      }
      return;
    }

    // ✅ Opción 4: Cancelar cita
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

    // Si no reconoce el mensaje, mostrar opción inválida
    await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
    await this.enviarMenuPrincipal(telefono);
  }

  // 🌟 NUEVO: Manejar respuesta de ver fotos (Opción B)
  private async manejarVerFotosBarberos(
    telefono: string, 
    mensaje: string, 
    contexto: ConversationContext, 
    conversacionId: string
  ) {
    if (mensaje === 'ver_fotos_si') {
      // 📸 OPCIÓN B: Enviar fotos individuales
      const barberos = contexto.barberos || [];
      
      for (const barbero of barberos) {
        if (barbero.fotoUrl) {
          const especialidadesTexto = barbero.especialidades 
            ? `✂️ ${Array.isArray(barbero.especialidades) ? barbero.especialidades.join(', ') : barbero.especialidades}`
            : '';
          
          await whatsappMessagesService.enviarImagen(
            telefono,
            barbero.fotoUrl,
            `👨‍🦲 *${barbero.nombre}*\n${especialidadesTexto}`
          );
          
          // Pequeña pausa entre fotos (500ms)
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } else if (mensaje === 'ver_fotos_no') {
      // Usuario no quiere ver fotos individuales, continuar directo
      await whatsappMessagesService.enviarMensaje(
        telefono,
        '✅ Perfecto, continuemos con tu cita'
      );
    }
    
    // Mostrar lista de barberos
    const barberos = contexto.barberos || await empleadosService.getAll(true);
    
    await whatsappMessagesService.enviarMensajeConLista(
      telefono,
      MENSAJES.ELEGIR_BARBERO_TEXTO(),
      'Ver barberos',
      [{
        title: 'Nuestros Profesionales',
        rows: barberos.map((barbero: any) => ({
          id: `barbero_${barbero.id}`,
          title: barbero.nombre.substring(0, 24),
          description: barbero.especialidades 
            ? (Array.isArray(barbero.especialidades) 
                ? barbero.especialidades.join(', ').substring(0, 72)
                : String(barbero.especialidades).substring(0, 72))
            : 'Barbero profesional'
        }))
      }]
    );
    
    await this.actualizarConversacion(conversacionId, 'ESPERANDO_BARBERO', contexto);
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
          { id: 'fecha_otro_dia', title: '📅 Otro día' }
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

  // 🌟 MODIFICADO: Solo selección por ID de lista interactiva, sin opciones numéricas
  private async manejarSeleccionBarbero(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    try {
      const barberos = await empleadosService.getAll(true);
      
      // Solo aceptar selección por ID de lista interactiva
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
      
      // Si escribe "ninguno"
      if (messageParser.normalizarRespuesta(mensaje) === 'ninguno') {
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
          { id: 'fecha_otro_dia', title: '📅 Otro día' }
        ]
      );
      
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_FECHA', contexto);
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.NOMBRE_INVALIDO());
    }
  }

  private async manejarFecha(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    let fecha: Date | null = null;
    
    if (mensaje === 'fecha_hoy') {
      fecha = new Date();
    } else if (mensaje === 'fecha_manana') {
      fecha = new Date();
      fecha.setDate(fecha.getDate() + 1);
    } else if (mensaje === 'fecha_otro_dia') {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.SOLICITAR_FECHA_ESPECIFICA());
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_FECHA_ESPECIFICA', contexto);
      return;
    } else {
      fecha = messageParser.parsearFecha(mensaje);
    }
    
    if (fecha) {
      await this.procesarFechaSeleccionada(telefono, fecha, contexto, conversacionId);
    } else {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.OPCION_INVALIDA());
    }
  }

  private async manejarFechaEspecifica(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    const fecha = messageParser.parsearFecha(mensaje);
    
    if (fecha) {
      await this.procesarFechaSeleccionada(telefono, fecha, contexto, conversacionId);
    } else {
      await whatsappMessagesService.enviarMensaje(
        telefono,
        `🧑🏾‍🦲 No entendí la fecha "${mensaje}".\n\nPor favor intente con:\n• Un día de la semana: "viernes", "sábado"\n• Una fecha específica: "25/12/2024"\n• Formato corto: "25 dic", "15 de marzo"\n\nO escriba *"cancelar"* para salir.`
      );
    }
  }

  private async procesarFechaSeleccionada(
    telefono: string, 
    fecha: Date, 
    contexto: ConversationContext, 
    conversacionId: string
  ) {
    const fechaLocal = new Date(fecha);
    fechaLocal.setHours(0, 0, 0, 0);
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    if (fechaLocal < hoy) {
      await whatsappMessagesService.enviarMensaje(
        telefono,
        '🧑🏾‍🦲 Lo siento, no puedo agendar citas en fechas pasadas.\n\nPor favor seleccione una fecha válida o escriba *"cancelar"* para salir.'
      );
      return;
    }
    
    const maxFecha = new Date();
    maxFecha.setMonth(maxFecha.getMonth() + 3);
    
    if (fechaLocal > maxFecha) {
      await whatsappMessagesService.enviarMensaje(
        telefono,
        '🧑🏾‍🦲 Solo puede agendar citas con hasta 3 meses de anticipación.\n\nPor favor seleccione una fecha más cercana.'
      );
      return;
    }
    
    contexto.fecha = fechaLocal.toISOString();
    await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.CONSULTANDO_AGENDA());
    
    try {
      const horarios = await citasService.calcularHorariosDisponibles(contexto.empleadoId!, fechaLocal, 30);
      
      if (horarios.length > 0) {
        const horariosFormateados = horarios.map((hora, idx) => ({ numero: idx + 1, hora: formatearHora(hora) }));
        contexto.horariosDisponibles = horariosFormateados;
        contexto.horariosRaw = horarios;
        
        await whatsappMessagesService.enviarMensaje(
          telefono,
          MENSAJES.HORARIOS_DISPONIBLES(horariosFormateados)
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
  }

  // 🌟 MODIFICADO: Agregar notificaciones al crear cita
  private async manejarHora(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (messageParser.esComandoCancelacion(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.DESPEDIDA());
      await this.finalizarConversacion(conversacionId);
      return;
    }
    
    let opcion: number | null = null;
    
    if (mensaje.startsWith('hora_')) {
      const index = parseInt(mensaje.replace('hora_', ''));
      if (!isNaN(index)) {
        opcion = index + 1;
      }
    } else {
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
        
        const servicio = servicios.find(s => 
          s.nombre.toLowerCase().includes('corte básico') || 
          s.nombre.toLowerCase().includes('corte basico')
        ) || servicios[0];
        
        console.log(`📌 Servicio predeterminado seleccionado: ${servicio.nombre}`);
        
        try {
          const citaCreada = await citasService.create({
            radicado, 
            clienteId: cliente.id, 
            empleadoId: contexto.empleadoId!,
            servicioNombre: servicio.nombre, 
            fechaHora, 
            duracionMinutos: servicio.duracionMinutos, 
            origen: 'WHATSAPP',
          });
          
          // 🌟 NUEVO: Enviar notificaciones
          try {
            await notificacionesService.notificarCitaAgendada(citaCreada.id);
          } catch (notifError) {
            console.error('Error enviando notificaciones:', notifError);
            // No fallar la cita si falla la notificación
          }
          
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
              
              await whatsappMessagesService.enviarMensaje(
                telefono,
                MENSAJES.HORARIOS_DISPONIBLES(horariosFormateados)
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
      
      if (citasActivas.length <= 10) {
        await whatsappMessagesService.enviarMensajeConLista(
          telefono,
          MENSAJES.MOSTRAR_CITAS_ACTIVAS_TEXTO(),
          'Ver mis citas',
          [{
            title: 'Citas Activas',
            rows: citasFormateadas.map(cita => ({
              id: `cita_${cita.radicado}`,
              title: cita.servicio.substring(0, 24),
              description: `${cita.fecha} - ${cita.hora}`.substring(0, 72)
            }))
          }]
        );
      } else {
        await whatsappMessagesService.enviarMensaje(
          telefono,
          MENSAJES.MOSTRAR_CITAS_ACTIVAS(citasFormateadas)
        );
      }
      
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_SELECCION_CITA_CANCELAR', contexto);
      
    } catch (error) {
      console.error('Error buscando citas activas:', error);
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
    }
  }

  private async manejarSeleccionCitaCancelar(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (mensaje.startsWith('cita_')) {
      const radicado = mensaje.replace('cita_', '');
      await this.buscarCitaPorRadicado(telefono, radicado, contexto, conversacionId);
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