// src/services/whatsapp/bot.service.ts - CON MOSAICO A+B + CORRECCIONES
// 🎯 CAMBIOS:
// 1. ✅ Eliminadas todas las opciones numéricas del menú
// 2. ✅ Mosaico de barberos (Opción A) + Fotos individuales opcionales (Opción B)
// 3. ✅ Integración con sistema de notificaciones
// 4. 🌟 NUEVO: Filtrar horarios a partir de hora actual para citas del mismo día
// 5. 🌟 NUEVO: Restringir fechas a máximo 7 días de anticipación

import prisma from '../../config/database';
import { whatsappMessagesService } from './messages.service';
import { messageParser } from './parser.service';
import { MENSAJES, generarRadicado, formatearFecha, formatearHora, validarNombreCompleto, NOMBRE_PLACEHOLDER_CLIENTE } from './templates';
import { clientesService } from '../clientes.service';
import { serviciosService } from '../servicios.service';
import { empleadosService } from '../empleados.service';
import { citasService } from '../citas.service';
import { notificacionesService } from '../notificaciones.service';
import { ConversationState, ConversationContext } from '../../types';
import { botConfig, barberiaConfig } from '../../config/whatsapp';

// Meta permite máx. 10 filas por lista: 8 turnos + 2 filas de navegación (otra fecha / menú).
const MAX_TURNOS_EN_LISTA = 8;

// Y 9 barberos + 1 fila "Volver al menú". Con más se envía la lista numerada en el cuerpo.
const MAX_BARBEROS_EN_LISTA = 9;

// Ids de botones/filas del bot (menu_agendar, hora_3, cita_RAD-XXXX, si_mas...): una sola palabra con
// guion bajo. Si llega uno que el estado actual no espera (doble toque, botón de un mensaje viejo)
// se ignora sin responder, en vez de enviar un mensaje que no aporta.
const ID_INTERACTIVO = /^\S+_\S+$/;

// Botones de salida para pasos donde el usuario escribe texto libre. Los ids `volver` y `menu`
// los resuelve el manejo global de navegación (parser.esComandoVolver / esComandoMenu).
const botonesNavegacion = () => [
  { id: 'volver', title: '← Volver' },
  { id: 'menu', title: '📋 Menú principal' }
];

type ServicioParaPlantilla = {
  nombre: string;
  precio: number;
  descripcion?: string;
};

export class WhatsAppBotService {
  async procesarMensaje(telefono: string, mensaje: string, esBoton: boolean = false, buttonId?: string) {
    try {
      if (messageParser.esComandoMenu(mensaje)) {
        await this.manejarComandoMenu(telefono);
        return;
      }

      // "volver"/"atras" (escrito o como id de un botón/fila): un paso atrás desde cualquier estado
      if (messageParser.esComandoVolver(mensaje)) {
        await this.manejarComandoVolver(telefono);
        return;
      }

      if (messageParser.esComandoCancelacion(mensaje)) {
        await this.manejarCancelacionGlobal(telefono);
        return;
      }

      let conversacion = await this.obtenerConversacionActiva(telefono);

      if (!conversacion) {
        conversacion = await this.crearConversacion(telefono);
        await this.enviarMenuPrincipal(telefono, this.nombreClienteReal(conversacion.cliente.nombre));
        return;
      }

      if (!conversacion.cliente) {
        console.error(`Conversación ${conversacion.id} sin cliente asociado. Reiniciando.`);
        await this.finalizarConversacion(conversacion.id);
        const nuevaConversacion = await this.crearConversacion(telefono);
        await this.enviarMenuPrincipal(telefono, this.nombreClienteReal(nuevaConversacion.cliente.nombre));
        return;
      }

      await this.actualizarActividad(conversacion.id);

      const estado = conversacion.estado as ConversationState;
      const contexto: ConversationContext = JSON.parse(conversacion.contexto);
      contexto._nombreClienteDb = conversacion.cliente.nombre;

      const mensajeAProcesar = esBoton && buttonId ? buttonId : mensaje;

      await this.procesarEstado(telefono, mensajeAProcesar, estado, contexto, conversacion.id);

    } catch (error) {
      console.error('Error procesando mensaje:', error);
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
    }
  }

  private nombreClienteReal(nombre?: string | null): string | undefined {
    if (!nombre) return undefined;
    const normalizado = nombre.trim();
    if (!normalizado || normalizado.toLowerCase() === NOMBRE_PLACEHOLDER_CLIENTE.toLowerCase()) {
      return undefined;
    }
    return normalizado;
  }

  private async enviarMenuPrincipal(telefono: string, nombreCliente?: string) {
    // El saludo lleva el nombre real del cliente (si ya agendó antes) en TODOS los menús, no solo
    // al iniciar la conversación: si no llega como parámetro se consulta por teléfono.
    const nombre = nombreCliente ?? this.nombreClienteReal(
      (await prisma.cliente.findUnique({ where: { telefono }, select: { nombre: true } }))?.nombre
    );

    await whatsappMessagesService.enviarMensajeConLista(
      telefono,
      MENSAJES.BIENVENIDA(undefined, nombre),
      'Ver opciones',
      [{
        title: 'Menú principal',
        rows: [
          { id: 'menu_agendar', title: '📅 Agendar cita', description: 'Reserva tu turno' },
          { id: 'menu_cancelar', title: '❌ Cancelar cita', description: 'Cancela una cita activa' },
          { id: 'menu_ubicacion', title: '📍 Ubicación', description: 'Cómo llegar a la barbería' },
          { id: 'menu_precios', title: '💰 Precios', description: 'Conoce nuestros servicios' },
          { id: 'menu_equipo', title: '💈 Nuestro Equipo', description: 'Fotos de nuestros barberos' }
        ]
      }]
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
      case 'ESPERANDO_VER_FOTOS_BARBEROS':
        await this.manejarVerFotosBarberos(telefono, mensaje, contexto, conversacionId);
        break;
      case 'ESPERANDO_RESPUESTA_EQUIPO':
        await this.manejarRespuestaEquipo(telefono, mensaje, contexto, conversacionId);
        break;
      case 'ESPERANDO_RESPUESTA_EQUIPO_FIN':
        await this.manejarRespuestaEquipoFin(telefono, mensaje, contexto, conversacionId);
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
        await this.enviarOpcionInvalida(telefono, mensaje);
        await this.actualizarConversacion(conversacionId, 'INICIAL', contexto);
    }
  }

  private async manejarInicial(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (mensaje === 'menu_ubicacion') {
      await whatsappMessagesService.enviarMensajeConBotones(
        telefono,
        MENSAJES.UBICACION(),
        [
          { id: 'menu_agendar', title: '📅 Agendar Cita' },
          { id: 'menu_principal', title: '📋 Menú Principal' },
          { id: 'menu_salir', title: '👋 Salir' }
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
        await whatsappMessagesService.enviarMensajeConBotones(
          telefono,
          MENSAJES.LISTA_PRECIOS(serviciosParaPlantilla),
          [
            { id: 'menu_agendar', title: '📅 Agendar Cita' },
            { id: 'menu_principal', title: '📋 Menú Principal' },
            { id: 'menu_salir', title: '👋 Salir' }
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
        contexto.barberos = barberos.map(b => ({
          id: b.id,
          nombre: b.nombre,
          fotoUrl: b.fotoUrl,
          especialidades: b.especialidades
        }));

        await this.enviarListaBarberos(telefono, contexto, conversacionId);
      } catch (error) {
        console.error('Error obteniendo barberos:', error);
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
      }
      return;
    }

    if (mensaje === 'menu_equipo') {
      try {
        const barberos = await empleadosService.getAll(true);
        contexto.barberos = barberos.map(b => ({
          id: b.id,
          nombre: b.nombre,
          fotoUrl: b.fotoUrl,
          especialidades: b.especialidades
        }));

        const imagenMosaico = process.env.BARBEROS_MOSAICO_URL;

        // 📸 Enviar imagen del mosaico primero
        if (imagenMosaico) {
          await whatsappMessagesService.enviarImagen(
            telefono,
            imagenMosaico,
            '💈 *Nuestro Equipo de Profesionales*\n\nConoce a nuestros barberos:'
          );

          // ⏱️ Esperar 800ms para asegurar que la imagen llegue primero
          await new Promise(resolve => setTimeout(resolve, 800));
        } else {
          await whatsappMessagesService.enviarMensaje(
            telefono,
            '💈 *Nuestro Equipo de Profesionales*\n\nConoce a nuestros barberos:'
          );

          // ⏱️ Pequeña pausa
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 🔘 Ahora enviar los botones
        await whatsappMessagesService.enviarMensajeConBotones(
          telefono,
          '¿Deseas ver las fotos individuales de cada barbero?',
          [
            { id: 'ver_fotos_si', title: '👀 Sí, ver fotos' },
            { id: 'ver_fotos_no', title: '➡️ No, gracias' }
          ]
        );

        await this.actualizarConversacion(conversacionId, 'ESPERANDO_RESPUESTA_EQUIPO', contexto);
      } catch (error) {
        console.error('Error obteniendo barberos:', error);
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
      }
      return;
    }

    if (mensaje === 'menu_cancelar') {
      await this.buscarYMostrarCitasActivas(telefono, conversacionId, { ...contexto, flujo: 'cancelacion' });
      return;
    }

    // Texto libre en el menú: basta reenviar el menú (1 mensaje), sin "opción inválida" aparte.
    await this.enviarMenuPrincipal(telefono);
  }

  private async enviarListaBarberos(telefono: string, contexto: ConversationContext, conversacionId: string) {
    const barberos = contexto.barberos && contexto.barberos.length > 0
      ? contexto.barberos
      : (await empleadosService.getAll(true)).map(b => ({
          id: b.id,
          nombre: b.nombre,
          fotoUrl: b.fotoUrl,
          especialidades: b.especialidades
        }));

    contexto.barberos = barberos;

    const rows = barberos.map((barbero: any) => ({
      id: `barbero_${barbero.id}`,
      title: barbero.nombre.substring(0, 24),
      description: barbero.especialidades
        ? (Array.isArray(barbero.especialidades)
            ? barbero.especialidades.join(', ').substring(0, 72)
            : String(barbero.especialidades).substring(0, 72))
        : 'Barbero profesional'
    }));

    if (rows.length <= MAX_BARBEROS_EN_LISTA) {
      await whatsappMessagesService.enviarMensajeConLista(
        telefono,
        MENSAJES.ELEGIR_BARBERO_TEXTO(),
        'Ver barberos',
        [
          { title: 'Nuestros Profesionales', rows },
          { title: 'Otras opciones', rows: [{ id: 'menu', title: '📋 Volver al menú' }] }
        ]
      );
    } else {
      // No caben en una lista de Meta: lista numerada en el cuerpo + botón de salida (1 mensaje).
      await whatsappMessagesService.enviarMensajeConBotones(
        telefono,
        MENSAJES.ELEGIR_BARBERO(barberos),
        [{ id: 'menu', title: '📋 Volver al menú' }]
      );
    }

    await this.actualizarConversacion(conversacionId, 'ESPERANDO_BARBERO', contexto);
  }

  private async manejarRespuestaEquipo(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (mensaje === 'ver_fotos_si') {
      const barberos = contexto.barberos || [];

      // 📸 Enviar fotos individuales con espera entre cada una
      for (const barbero of barberos) {
        if (barbero.fotoUrl) {
          const especialidadesTexto = barbero.especialidades
            ? `✂️ ${Array.isArray(barbero.especialidades) ? barbero.especialidades.join(', ') : barbero.especialidades}`
            : '';

          try {
            await whatsappMessagesService.enviarImagen(
              telefono,
              barbero.fotoUrl,
              `👨‍🦲 *${barbero.nombre}*\n${especialidadesTexto}`
            );

            // ⏱️ Pausa de 1 segundo entre cada imagen para asegurar orden
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            console.error(`Error enviando foto de ${barbero.nombre}:`, error);
          }
        }
      }
    } else if (mensaje !== 'ver_fotos_no') {
      await this.enviarOpcionInvalida(telefono, mensaje);
      return;
    }

    await whatsappMessagesService.enviarMensajeConBotones(
      telefono,
      '¿Deseas agendar una cita con alguno de ellos?',
      [
        { id: 'menu_agendar', title: '📅 Agendar Cita' },
        { id: 'menu_principal', title: '📋 Menú Principal' },
        { id: 'menu_salir', title: '👋 Salir' }
      ]
    );

    await this.actualizarConversacion(conversacionId, 'ESPERANDO_RESPUESTA_EQUIPO_FIN', contexto);
  }

  private async manejarRespuestaEquipoFin(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (mensaje === 'menu_agendar') {
      await this.manejarInicial(telefono, 'menu_agendar', contexto, conversacionId);
      return;
    }

    if (mensaje === 'menu_principal') {
      await this.enviarMenuPrincipal(telefono);
      await this.actualizarConversacion(conversacionId, 'INICIAL', contexto);
    } else if (mensaje === 'menu_salir') {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.DESPEDIDA());
      await this.finalizarConversacion(conversacionId);
    } else {
      await this.enviarOpcionInvalida(telefono, mensaje);
    }
  }

  private async manejarVerFotosBarberos(
    telefono: string, 
    mensaje: string, 
    contexto: ConversationContext, 
    conversacionId: string
  ) {
    if (mensaje === 'ver_fotos_si') {
      const barberos = contexto.barberos || [];
      
      // 📸 Enviar fotos individuales con espera entre cada una
      for (const barbero of barberos) {
        if (barbero.fotoUrl) {
          const especialidadesTexto = barbero.especialidades 
            ? `✂️ ${Array.isArray(barbero.especialidades) ? barbero.especialidades.join(', ') : barbero.especialidades}`
            : '';
          
          try {
            // ⏳ Esperar a que la imagen se envíe completamente
            await whatsappMessagesService.enviarImagen(
              telefono,
              barbero.fotoUrl,
              `👨‍🦲 *${barbero.nombre}*\n${especialidadesTexto}`
            );
            
            // ⏱️ Pausa de 1 segundo entre cada imagen para asegurar orden
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            console.error(`Error enviando foto de ${barbero.nombre}:`, error);
            // Continuar con el siguiente barbero si hay error
          }
        }
      }
      
      // ⏳ Pausa adicional antes de enviar el siguiente mensaje
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } else if (mensaje === 'ver_fotos_no') {
      // ⏳ Esperar a que el mensaje se envíe
      await whatsappMessagesService.enviarMensaje(
        telefono,
        '✅ Perfecto, continuemos con tu cita'
      );
      
      // ⏱️ Pequeña pausa antes del siguiente mensaje
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const barberos = contexto.barberos || await empleadosService.getAll(true);
    
    // ⏳ Esperar a que la lista se envíe completamente
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
    if (mensaje === 'menu_agendar') {
      await this.manejarInicial(telefono, 'menu_agendar', contexto, conversacionId);
      return;
    }

    if (mensaje === 'menu_principal' || mensaje === 'si_mas' || messageParser.esAfirmativo(mensaje)) {
      await this.enviarMenuPrincipal(telefono);
      await this.actualizarConversacion(conversacionId, 'INICIAL', contexto);
    } else if (mensaje === 'menu_salir' || mensaje === 'no_mas' || messageParser.esNegativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.DESPEDIDA());
      await this.finalizarConversacion(conversacionId);
    } else {
      await this.enviarOpcionInvalida(telefono, mensaje);
    }
  }

  private async manejarRespuestaListaPrecios(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (mensaje === 'menu_agendar') {
      await this.manejarInicial(telefono, 'menu_agendar', contexto, conversacionId);
      return;
    }

    if (mensaje === 'menu_principal' || mensaje === 'si_mas' || messageParser.esAfirmativo(mensaje)) {
      await this.enviarMenuPrincipal(telefono);
      await this.actualizarConversacion(conversacionId, 'INICIAL', contexto);
    } else if (mensaje === 'menu_salir' || mensaje === 'no_mas' || messageParser.esNegativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.DESPEDIDA());
      await this.finalizarConversacion(conversacionId);
    } else {
      await this.enviarOpcionInvalida(telefono, mensaje);
    }
  }

  private async manejarRespuestaDespuesCita(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (mensaje === 'menu_agendar') {
      await this.manejarInicial(telefono, 'menu_agendar', contexto, conversacionId);
      return;
    }

    if (mensaje === 'menu_principal' || mensaje === 'si_mas' || messageParser.esAfirmativo(mensaje)) {
      await this.enviarMenuPrincipal(telefono);
      await this.actualizarConversacion(conversacionId, 'INICIAL', contexto);
    } else if (mensaje === 'menu_salir' || mensaje === 'no_mas' || messageParser.esNegativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.DESPEDIDA());
      await this.finalizarConversacion(conversacionId);
    } else {
      await this.enviarOpcionInvalida(telefono, mensaje);
    }
  }

  private async manejarRespuestaNoHayHorarios(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (mensaje === 'menu_principal') {
      await this.enviarMenuPrincipal(telefono);
      await this.actualizarConversacion(conversacionId, 'INICIAL', {});
      return;
    }

    // si_mas / no_mas: botones anteriores, se mantienen para conversaciones ya abiertas
    if (mensaje === 'otra_fecha' || mensaje === 'si_mas' || messageParser.esAfirmativo(mensaje)) {
      await this.avanzarAFecha(telefono, contexto, conversacionId);
    } else if (mensaje === 'menu_salir' || mensaje === 'no_mas' || messageParser.esNegativo(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.DESPEDIDA());
      await this.finalizarConversacion(conversacionId);
    } else {
      await this.enviarOpcionInvalida(telefono, mensaje);
    }
  }

  private async manejarSeleccionBarbero(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    try {
      const barberos = await empleadosService.getAll(true);
      
      let barberoId: string | undefined;
      if (mensaje.startsWith('barbero_')) {
        barberoId = mensaje.replace('barbero_', '');
      } else if ((contexto.barberos?.length ?? 0) > MAX_BARBEROS_EN_LISTA) {
        // Lista numerada en texto (no cupo en una lista de Meta): el usuario responde con el número
        const n = messageParser.parsearOpcionNumerica(mensaje, contexto.barberos!.length);
        if (n) barberoId = contexto.barberos![n - 1].id;
      }

      if (barberoId) {
        const barbero = barberos.find(b => b.id === barberoId);

        if (barbero) {
          contexto.empleadoId = barbero.id;
          contexto.empleadoNombre = barbero.nombre;

          // Nombre ya conocido: el registrado en BD (no el placeholder) o el que el usuario
          // ya escribió en esta conversación (p. ej. si volvió atrás y eligió otro barbero).
          const nombreBD = contexto._nombreClienteDb
            && contexto._nombreClienteDb.trim().toLowerCase() !== NOMBRE_PLACEHOLDER_CLIENTE.toLowerCase()
            && validarNombreCompleto(contexto._nombreClienteDb)
            ? contexto._nombreClienteDb
            : undefined;
          const nombreConocido = nombreBD
            ?? (contexto.nombre && validarNombreCompleto(contexto.nombre) ? contexto.nombre : undefined);

          if (nombreConocido) {
            contexto.nombre = nombreConocido;
            await this.avanzarAFecha(telefono, contexto, conversacionId);
          } else {
            await whatsappMessagesService.enviarMensajeConBotones(
              telefono,
              MENSAJES.SOLICITAR_NOMBRE_COMPLETO(),
              botonesNavegacion()
            );
            await this.actualizarConversacion(conversacionId, 'ESPERANDO_NOMBRE', contexto);
          }
          return;
        }
      }
      
      // "ninguno" ya no se anuncia ni cierra la conversación: lleva al menú, en silencio.
      if (messageParser.normalizarRespuesta(mensaje) === 'ninguno') {
        await this.manejarComandoMenu(telefono);
      } else {
        await this.enviarOpcionInvalida(telefono, mensaje);
      }
    } catch (error) {
      console.error('Error en manejarSeleccionBarbero:', error);
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
    }
  }

  private async manejarNombre(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (ID_INTERACTIVO.test(mensaje)) {
      console.log(`ℹ️ Botón/fila fuera de contexto ignorado: ${mensaje}`);
      return;
    }

    if (validarNombreCompleto(mensaje)) {
      contexto.nombre = mensaje.trim();
      await this.avanzarAFecha(telefono, contexto, conversacionId);
    } else {
      await whatsappMessagesService.enviarMensajeConBotones(
        telefono,
        MENSAJES.NOMBRE_INVALIDO(),
        botonesNavegacion()
      );
    }
  }

  private async avanzarAFecha(telefono: string, contexto: ConversationContext, conversacionId: string) {
    // Lista (no botones) para poder incluir "Volver" y "Menú" además de las 3 fechas.
    // Los ids `volver` y `menu` los resuelve el manejo global de navegación.
    await whatsappMessagesService.enviarMensajeConLista(
      telefono,
      MENSAJES.SOLICITAR_FECHA_TEXTO(),
      'Elegir fecha',
      [
        {
          title: 'Fecha de la cita',
          rows: [
            { id: 'fecha_hoy', title: '📅 Hoy' },
            { id: 'fecha_manana', title: '📅 Mañana' },
            { id: 'fecha_otro_dia', title: '📅 Otro día' }
          ]
        },
        {
          title: 'Otras opciones',
          rows: [
            { id: 'volver', title: '← Volver' },
            { id: 'menu', title: '📋 Menú principal' }
          ]
        }
      ]
    );

    await this.actualizarConversacion(conversacionId, 'ESPERANDO_FECHA', contexto);
  }

  private async manejarFecha(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    let fecha: Date | null = null;
    
    if (mensaje === 'fecha_hoy') {
      fecha = new Date();
    } else if (mensaje === 'fecha_manana') {
      fecha = new Date();
      fecha.setDate(fecha.getDate() + 1);
    } else if (mensaje === 'fecha_otro_dia') {
      await whatsappMessagesService.enviarMensajeConBotones(
        telefono,
        MENSAJES.SOLICITAR_FECHA_ESPECIFICA(),
        botonesNavegacion()
      );
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_FECHA_ESPECIFICA', contexto);
      return;
    } else {
      fecha = messageParser.parsearFecha(mensaje);
    }
    
    if (fecha) {
      await this.procesarFechaSeleccionada(telefono, fecha, contexto, conversacionId);
    } else {
      await this.enviarOpcionInvalida(telefono, mensaje);
    }
  }

  private async manejarFechaEspecifica(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    const fecha = messageParser.parsearFecha(mensaje);
    
    if (fecha) {
      await this.procesarFechaSeleccionada(telefono, fecha, contexto, conversacionId);
    } else {
      await whatsappMessagesService.enviarMensajeConBotones(
        telefono,
        MENSAJES.FECHA_NO_ENTENDIDA(mensaje),
        botonesNavegacion()
      );
    }
  }

  // 🌟 CORRECCIÓN 1 y 2: Validar límite de 7 días y filtrar horarios desde hora actual
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
      await whatsappMessagesService.enviarMensajeConBotones(
        telefono,
        '🧑🏾‍🦲 Lo siento, no puedo agendar citas en fechas pasadas.\n\nPor favor elija una fecha válida.',
        botonesNavegacion()
      );
      return;
    }
    
    // 🌟 CORRECCIÓN 2: Restringir a máximo 7 días de anticipación
    const maxFecha = new Date(hoy);
    maxFecha.setDate(maxFecha.getDate() + 7);
    
    if (fechaLocal > maxFecha) {
      await whatsappMessagesService.enviarMensajeConBotones(
        telefono,
        '🧑🏾‍🦲 Solo puede agendar citas con hasta *7 días* de anticipación.\n\n📅 La fecha límite para agendar es: ' + formatearFecha(maxFecha) + '\n\nPor favor elija una fecha más cercana.',
        botonesNavegacion()
      );
      return;
    }
    
    contexto.fecha = fechaLocal.toISOString();

    try {
      let horarios = await citasService.calcularHorariosDisponibles(contexto.empleadoId!, fechaLocal, 30);
      
      // 🌟 CORRECCIÓN 1: Si es HOY, filtrar solo horarios después de la hora actual
      const esHoy = fechaLocal.getTime() === hoy.getTime();
      if (esHoy) {
        const ahora = new Date();
        const horaActualMinutos = ahora.getHours() * 60 + ahora.getMinutes();
        
        horarios = horarios.filter(hora => {
          const [h, m] = hora.split(':').map(Number);
          const horarioMinutos = h * 60 + m;
          return horarioMinutos > horaActualMinutos;
        });
        
        console.log(`✅ Filtrados ${horarios.length} horarios disponibles después de las ${ahora.getHours()}:${ahora.getMinutes().toString().padStart(2, '0')}`);
      }
      
      if (horarios.length > 0) {
        await this.enviarHorariosDisponibles(telefono, horarios, contexto, conversacionId);
      } else {
        await this.enviarSinHorarios(telefono, contexto, conversacionId);
      }
    } catch (error) {
      console.error('Error consultando horarios disponibles:', error);
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
    }
  }

  private async enviarSinHorarios(
    telefono: string,
    contexto: ConversationContext,
    conversacionId: string,
    aviso?: string
  ) {
    await whatsappMessagesService.enviarMensajeConBotones(
      telefono,
      `${aviso ? `${aviso}\n\n` : ''}${MENSAJES.NO_HAY_HORARIOS()}`,
      [
        { id: 'otra_fecha', title: '📅 Otra fecha' },
        { id: 'menu_principal', title: '📋 Menú principal' },
        { id: 'menu_salir', title: '👋 Salir' }
      ]
    );
    await this.actualizarConversacion(conversacionId, 'ESPERANDO_RESPUESTA_NO_HAY_HORARIOS', contexto);
  }

  private async enviarHorariosDisponibles(
    telefono: string,
    horarios: string[],
    contexto: ConversationContext,
    conversacionId: string,
    aviso?: string
  ) {
    const horariosFormateados = horarios.map((hora, idx) => ({ numero: idx + 1, hora: formatearHora(hora) }));
    contexto.horariosDisponibles = horariosFormateados;
    contexto.horariosRaw = horarios;

    const prefijo = aviso ? `${aviso}\n\n` : '';

    if (horarios.length <= MAX_TURNOS_EN_LISTA) {
      // Lista de Meta: máx. 10 filas en total = turnos + 2 filas de navegación.
      await whatsappMessagesService.enviarMensajeConLista(
        telefono,
        `${prefijo}${MENSAJES.HORARIOS_DISPONIBLES_TEXTO()}`,
        'Ver horarios',
        [
          {
            title: 'Turnos disponibles',
            rows: horariosFormateados.map((h, idx) => ({ id: `hora_${idx}`, title: h.hora }))
          },
          {
            title: 'Otras opciones',
            rows: [
              { id: 'otra_fecha', title: '📅 Elegir otra fecha' },
              { id: 'menu_principal', title: '📋 Menú principal' }
            ]
          }
        ]
      );
    } else {
      // Con más turnos no caben en una lista: un mensaje con la lista numerada en el cuerpo
      // y botones de navegación (mismo costo: 1 mensaje). El usuario responde con el número.
      await whatsappMessagesService.enviarMensajeConBotones(
        telefono,
        `${prefijo}${MENSAJES.HORARIOS_DISPONIBLES(horariosFormateados)}`,
        [
          { id: 'otra_fecha', title: '📅 Otra fecha' },
          { id: 'menu_principal', title: '📋 Menú principal' }
        ]
      );
    }

    await this.actualizarConversacion(conversacionId, 'ESPERANDO_HORA', contexto);
  }

  private async manejarHora(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    if (messageParser.esComandoCancelacion(mensaje)) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.DESPEDIDA());
      await this.finalizarConversacion(conversacionId);
      return;
    }

    // Navegación: "otra fecha" vuelve a pedir el día; "menú" reabre el menú principal.
    // También se acepta escrito, en silencio, como respaldo de los botones.
    const escrito = messageParser.normalizarRespuesta(mensaje);
    if (mensaje === 'otra_fecha' || escrito === 'fecha' || escrito === 'otra fecha' || escrito === 'otro dia') {
      await this.avanzarAFecha(telefono, contexto, conversacionId);
      return;
    }

    if (mensaje === 'menu_principal') {
      await this.manejarComandoMenu(telefono);
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
    
    if (opcion && contexto.horariosRaw && contexto.horariosRaw[opcion - 1]) {
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
        
        const servicio = this.obtenerServicioPredeterminado(servicios);

        if (!servicio) {
          console.error('❌ No hay servicios activos para asignar a la cita de WhatsApp');
          await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
          return;
        }

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
          
          try {
            await notificacionesService.notificarCitaAgendada(citaCreada.id);
          } catch (notifError) {
            console.error('Error enviando notificaciones:', notifError);
          }
          
          await whatsappMessagesService.enviarMensajeConBotones(
            telefono,
            MENSAJES.CITA_CONFIRMADA({
              radicado,
              servicio: servicio.nombre,
              barbero: contexto.empleadoNombre!,
              fecha: formatearFecha(fechaHora),
              hora: formatearHora(horaSeleccionada),
            }),
            [
              { id: 'menu_agendar', title: '📅 Agendar otra' },
              { id: 'menu_principal', title: '📋 Menú Principal' },
              { id: 'menu_salir', title: '👋 No, gracias' }
            ]
          );
          await this.actualizarConversacion(conversacionId, 'ESPERANDO_RESPUESTA_DESPUES_CITA', contexto);
          
        } catch (createError: any) {
          if (createError.message.includes('ya no está disponible') || 
              createError.message.includes('ya está agendada') ||
              createError.message.includes('no está disponible')) {
            
            const horarios = await citasService.calcularHorariosDisponibles(
              contexto.empleadoId!,
              fechaBase,
              servicio.duracionMinutos
            );

            // El aviso viaja dentro del mismo mensaje que los horarios (1 envío, no 2)
            if (horarios.length > 0) {
              await this.enviarHorariosDisponibles(telefono, horarios, contexto, conversacionId, MENSAJES.HORARIO_YA_OCUPADO());
            } else {
              await this.enviarSinHorarios(telefono, contexto, conversacionId, MENSAJES.HORARIO_YA_OCUPADO());
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
      await this.enviarOpcionInvalida(telefono, mensaje);
    }
  }

  // Servicio con el que se agendan las citas de WhatsApp: barberiaConfig.servicioPredeterminado
  // (variable de entorno SERVICIO_PREDETERMINADO). Compara sin mayúsculas ni acentos.
  private obtenerServicioPredeterminado<T extends { nombre: string }>(servicios: T[]): T | undefined {
    const objetivo = messageParser.normalizarRespuesta(barberiaConfig.servicioPredeterminado);
    const encontrado = servicios.find(s => messageParser.normalizarRespuesta(s.nombre) === objetivo);

    if (!encontrado && servicios.length > 0) {
      console.warn(
        `⚠️ Servicio predeterminado "${barberiaConfig.servicioPredeterminado}" no encontrado entre los activos. ` +
        `Usando "${servicios[0].nombre}". Revisa la variable SERVICIO_PREDETERMINADO.`
      );
    }

    return encontrado ?? servicios[0];
  }

  private async buscarYMostrarCitasActivas(telefono: string, conversacionId: string, contexto: ConversationContext) {
    try {
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
        await whatsappMessagesService.enviarMensajeConBotones(
          telefono,
          MENSAJES.SIN_CITAS_ACTIVAS(),
          [
            { id: 'menu_agendar', title: '📅 Agendar Cita' },
            { id: 'menu_principal', title: '📋 Menú Principal' },
            { id: 'menu_salir', title: '👋 Salir' }
          ]
        );
        await this.actualizarConversacion(conversacionId, 'ESPERANDO_RESPUESTA_DESPUES_CITA', contexto);
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
          [
            {
              title: 'Citas Activas',
              rows: citasFormateadas.map(cita => ({
                id: `cita_${cita.radicado}`,
                title: cita.servicio.substring(0, 24),
                description: `${cita.fecha} - ${cita.hora}`.substring(0, 72)
              }))
            },
            { title: 'Otras opciones', rows: [{ id: 'menu', title: '📋 Volver al menú' }] }
          ]
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

    if (ID_INTERACTIVO.test(mensaje)) {
      console.log(`ℹ️ Botón/fila fuera de contexto ignorado: ${mensaje}`);
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
      
      await whatsappMessagesService.enviarMensajeConBotones(
        telefono,
        MENSAJES.RADICADO_NO_ENCONTRADO(),
        [{ id: 'menu', title: '📋 Menú principal' }]
      );
      
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
    
    await whatsappMessagesService.enviarMensajeConBotones(
      telefono,
      MENSAJES.CONFIRMAR_CANCELACION({
        radicado: cita.radicado,
        servicio: cita.servicioNombre,
        fecha: formatearFecha(cita.fechaHora),
        hora: formatearHora(cita.fechaHora.toTimeString().substring(0, 5)),
      }),
      [
        { id: 'confirmar_cancelar', title: '✅ Sí, cancelar' },
        { id: 'conservar_cita', title: '❌ No, conservar' }
      ]
    );

    await this.actualizarConversacion(conversacionId, 'ESPERANDO_CONFIRMACION_CANCELACION', contexto);
  }

  private async manejarConfirmacionCancelacion(telefono: string, mensaje: string, contexto: ConversationContext, conversacionId: string) {
    // Cancelar una cita es irreversible: un botón/fila de otro mensaje (p. ej. "Cancelar cita" del menú)
    // nunca cuenta como respuesta. Solo valen los botones de esta pregunta o una respuesta escrita clara.
    if (ID_INTERACTIVO.test(mensaje) && mensaje !== 'confirmar_cancelar' && mensaje !== 'conservar_cita') {
      console.log(`ℹ️ Botón/fila fuera de contexto ignorado: ${mensaje}`);
      return;
    }

    const palabras = messageParser.normalizarRespuesta(mensaje).split(/[^a-z0-9]+/).filter(Boolean);
    const dice = (...claves: string[]) => claves.some(c => palabras.includes(c));
    const niega = dice('no', 'nop', 'nope', 'negativo', 'conservar');
    const confirma = mensaje === 'confirmar_cancelar'
      || (!niega && dice('si', 'yes', 'ok', 'claro', 'sip', 'sep', 'confirmo', 'confirmar'));

    if (confirma) {
      try {
        await citasService.cancelar(contexto.radicado!);

        if (contexto.citaId) {
          try {
            await notificacionesService.notificarCitaCancelada(contexto.citaId);
          } catch (notifError) {
            console.error('Error enviando notificaciones de cancelación:', notifError);
          }
        }

        await whatsappMessagesService.enviarMensajeConBotones(
          telefono,
          MENSAJES.CITA_CANCELADA(),
          [
            { id: 'menu_agendar', title: '📅 Agendar Cita' },
            { id: 'menu_principal', title: '📋 Menú Principal' },
            { id: 'menu_salir', title: '👋 Salir' }
          ]
        );
        await this.actualizarConversacion(conversacionId, 'ESPERANDO_RESPUESTA_DESPUES_CITA', contexto);
      } catch (error) {
        console.error('Error cancelando cita:', error);
        await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.ERROR_SERVIDOR());
      }
    } else if (mensaje === 'conservar_cita' || niega) {
      await whatsappMessagesService.enviarMensajeConBotones(
        telefono,
        '💈 Perfecto, conservamos su cita. ¿Le puedo servir en algo más?',
        [
          { id: 'menu_agendar', title: '📅 Agendar Cita' },
          { id: 'menu_principal', title: '📋 Menú Principal' },
          { id: 'menu_salir', title: '👋 Salir' }
        ]
      );
      await this.actualizarConversacion(conversacionId, 'ESPERANDO_RESPUESTA_DESPUES_CITA', contexto);
    } else {
      await this.enviarOpcionInvalida(telefono, mensaje);
    }
  }

  private async manejarCancelacionGlobal(telefono: string) {
    const conversacion = await this.obtenerConversacionActiva(telefono);

    if (conversacion) {
      await whatsappMessagesService.enviarMensaje(telefono, MENSAJES.CANCELACION_CONFIRMADA());
      await this.finalizarConversacion(conversacion.id);
    } else {
      // Sin conversación activa (nunca escribió, o venció): abre una nueva junto con el menú,
      // para que el siguiente toque del menú tenga dónde apoyarse.
      await this.manejarComandoMenu(telefono);
    }
  }

  private async enviarOpcionInvalida(telefono: string, mensaje: string) {
    if (ID_INTERACTIVO.test(mensaje)) {
      console.log(`ℹ️ Botón/fila fuera de contexto ignorado: ${mensaje}`);
      return;
    }

    await whatsappMessagesService.enviarMensajeConBotones(
      telefono,
      MENSAJES.OPCION_INVALIDA(),
      botonesNavegacion()
    );
  }

  private async manejarComandoMenu(telefono: string) {
    const conversacion = await this.obtenerConversacionActiva(telefono);

    if (conversacion) {
      await this.actualizarConversacion(conversacion.id, 'INICIAL', {});
    } else {
      await this.crearConversacion(telefono);
    }

    await this.enviarMenuPrincipal(telefono);
  }

  private async manejarComandoVolver(telefono: string) {
    const conversacion = await this.obtenerConversacionActiva(telefono);

    if (!conversacion) {
      await this.manejarComandoMenu(telefono);
      return;
    }

    const contexto: ConversationContext = JSON.parse(conversacion.contexto);
    if (conversacion.cliente) {
      contexto._nombreClienteDb = conversacion.cliente.nombre;
    }

    await this.volverPaso(telefono, conversacion.estado as ConversationState, contexto, conversacion.id);
  }

  // Un paso atrás según el estado actual. Reagendar: barberos → (nombre) → fecha → hora.
  // Cancelar: citas → confirmación. Cualquier otro estado vuelve al menú principal.
  private async volverPaso(
    telefono: string,
    estado: ConversationState,
    contexto: ConversationContext,
    conversacionId: string
  ) {
    switch (estado) {
      case 'ESPERANDO_NOMBRE':
      case 'ESPERANDO_FECHA':
        await this.enviarListaBarberos(telefono, contexto, conversacionId);
        return;
      case 'ESPERANDO_FECHA_ESPECIFICA':
      case 'ESPERANDO_HORA':
      case 'ESPERANDO_RESPUESTA_NO_HAY_HORARIOS':
        await this.avanzarAFecha(telefono, contexto, conversacionId);
        return;
      case 'ESPERANDO_CONFIRMACION_CANCELACION':
        await this.buscarYMostrarCitasActivas(telefono, conversacionId, contexto);
        return;
      default:
        await this.enviarMenuPrincipal(telefono);
        await this.actualizarConversacion(conversacionId, 'INICIAL', {});
    }
  }

  private async obtenerConversacionActiva(telefono: string) {
    const conversacion = await prisma.conversacion.findFirst({
      where: { telefono, activa: true },
      include: { cliente: true },
      orderBy: { lastActivity: 'desc' },
    });

    if (!conversacion) return null;

    // Expiración exacta al recibir el mensaje: no depende de que el cron ya haya corrido (evita la
    // ventana de hasta 5 min tras el timeout y el caso de un servidor caído o reiniciado).
    // El cron queda solo como limpieza. Una conversación vencida se cierra y se trata como nueva.
    if (Date.now() - conversacion.lastActivity.getTime() > botConfig.timeoutConversacion) {
      await this.finalizarConversacion(conversacion.id);
      return null;
    }

    return conversacion;
  }

  private async crearConversacion(telefono: string) {
    const cliente = await clientesService.buscarOCrearAtomico(telefono, NOMBRE_PLACEHOLDER_CLIENTE);

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