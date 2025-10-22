// src/services/whatsapp/templates.ts

import { barberiaConfig } from '../../config/whatsapp';

export const MENSAJES = {
  BIENVENIDA: (nombreBarberia: string = barberiaConfig.nombre) => 
    `💈 Hola, te saluda de ${nombreBarberia} es un gusto atenderte 💈

¿Necesitas información de...?

Por favor responda con una de las siguientes opciones:

1️⃣ Dónde estamos
2️⃣ Lista de precios
3️⃣ Agendar una cita
4️⃣ Cancelar una cita

Escribe "cancelar" en cualquier momento para salir del proceso.`,

  UBICACION: (direccion: string = barberiaConfig.direccion) =>
    `🧑🏾‍🦲 Estamos ubicados en ${direccion}

🧑🏾‍🦲 ¿Le puedo servir en algo más?

Por favor responda con una de las siguientes opciones:

👉🏾 Si
👉🏾 No`,

  LISTA_PRECIOS: (servicios: Array<{ nombre: string; precio: number; descripcion?: string }>) => {
    let mensaje = `🧑🏾‍🦲 Todos nuestros servicios incluyen como obsequio una mascarilla para puntos negros:\n\n`;
    
    servicios.forEach(servicio => {
      mensaje += `* ${servicio.nombre} ${formatearPrecio(servicio.precio)}`;
      if (servicio.descripcion) {
        mensaje += ` (${servicio.descripcion})`;
      }
      mensaje += `\n\n`;
    });
    
    return mensaje.trim();
  },

  PUEDE_SERVIR_MAS: () =>
    `🧑🏾‍🦲 ¿Le puedo servir en algo más?

Por favor responda con una de las siguientes opciones:

👉🏾 Si
👉🏾 No`,

  ELEGIR_BARBERO: (barberos: Array<{ id: string; nombre: string }>) => {
    let mensaje = `🧑🏾‍🦲 ¿Con cual de nuestros profesionales desea su cita?\n\nNuestros Profesionales\n\n`;
    mensaje += `🧑🏾‍🦲 Por favor envíeme de ésta lista el número que corresponde al profesional con el cual desea su cita\n\n`;
    
    barberos.forEach((barbero, index) => {
      mensaje += `👉🏾 ${index + 1} ${barbero.nombre}\n`;
    });
    
    mensaje += `\nEn caso que no sea ninguno de los anteriores por favor responda Ninguno`;
    mensaje += `\n\nEscribe "cancelar" en cualquier momento para salir del proceso.`;
    
    return mensaje;
  },

  SOLICITAR_NOMBRE_COMPLETO: () =>
    `🧑🏾‍🦲 ¿Podría indicarme su nombre completo por favor?

Escribe "cancelar" en cualquier momento para salir del proceso.`,

  NOMBRE_INVALIDO: () =>
    `🧑🏾‍🦲 Por favor lea con atención y responda correctamente

Intente de nuevo por favor

Escribe "cancelar" en cualquier momento para salir del proceso.`,

  SOLICITAR_FECHA: () =>
    `🧑🏾‍🦲 ¿Para cuando desea su cita?

Por favor responda con una de las siguientes opciones:

👉🏾 Hoy
👉🏾 Mañana
👉🏾 Pasado mañana

También puede escribir una fecha específica (ej: 25/12/2023) o un día de la semana (ej: viernes)

Escribe "cancelar" en cualquier momento para salir del proceso.`,

  CONSULTANDO_AGENDA: () =>
    `🧑🏾‍🦲 Un momento por favor, voy a consultar la agenda...`,

  HORARIOS_DISPONIBLES: (horarios: Array<{ numero: number; hora: string }>) => {
    let mensaje = `Tengo los siguientes turnos disponibles:\n\n`;
    
    horarios.forEach(horario => {
      mensaje += `👉🏾 ${horario.numero}. ${horario.hora}\n\n`;
    });
    
    mensaje += `🧑🏾‍🦲 Por favor envíeme el número del turno que desea.\n\n`;
    mensaje += `Si no desea ninguno de los turnos disponibles envíeme la palabra Cancelar`;
    
    return mensaje;
  },

  NO_HAY_HORARIOS: () =>
    `🧑🏾‍🦲 Lo siento, no hay turnos disponibles para ese día.

¿Desea intentar con otra fecha?

👉🏾 Si
👉🏾 No

Escribe "cancelar" en cualquier momento para salir del proceso.`,

  HORARIO_YA_OCUPADO: () =>
    `🧑🏾‍🦲 Lo siento, ese horario ya ha sido ocupado por otro cliente.

Por favor seleccione otro horario de la lista disponible.`,

  CITA_CONFIRMADA: (datos: {
    radicado: string;
    servicio: string;
    barbero: string;
    fecha: string;
    hora: string;
  }) =>
    `✅ *Su cita ha sido agendada exitosamente*

✂️ Servicio: ${datos.servicio}
👤 Barbero: ${datos.barbero}
📅 Fecha: ${datos.fecha}
⏰ Hora: ${datos.hora}

━━━━━━━━━━━━━━━━
📋 *Código de cita:*

*${datos.radicado}*
━━━━━━━━━━━━━━━━

💡 _Mantén presionado el código para copiarlo_
🔖 _Guárdalo para modificar o cancelar tu cita_

¡Le esperamos! 💈`,

  SOLICITAR_RADICADO: () =>
    `🧑🏾‍🦲 Para cancelar su cita necesito el código de radicado

¿Tiene con usted el código de su cita?

Por favor responda:

👉🏾 Sí (envíeme el código)
👉🏾 No (buscaré sus citas)

Escribe "cancelar" en cualquier momento para salir del proceso.`,

  SIN_RADICADO_BUSCAR_CITAS: () =>
    `🧑🏾‍🦲 No hay problema, déjeme buscar sus citas activas...`,

  MOSTRAR_CITAS_ACTIVAS: (citas: Array<{
    numero: number;
    radicado: string;
    servicio: string;
    fecha: string;
    hora: string;
  }>) => {
    let mensaje = `📋 *Sus citas activas:*\n\n`;
    
    citas.forEach(cita => {
      mensaje += `${cita.numero}. ${cita.servicio}\n`;
      mensaje += `   📅 ${cita.fecha}\n`;
      mensaje += `   ⏰ ${cita.hora}\n`;
      mensaje += `   🔖 ${cita.radicado}\n\n`;
    });
    
    mensaje += `🧑🏾‍🦲 Envíe el *número* de la cita que desea cancelar\n\n`;
    mensaje += `_O puede copiar y enviar el código de la cita_`;
    
    return mensaje;
  },

  SIN_CITAS_ACTIVAS: () =>
    `🧑🏾‍🦲 No encontré citas activas asociadas a su número de teléfono

Si está seguro de que tiene una cita, por favor verifique el código de radicado y envíemelo directamente`,

  SOLICITAR_CODIGO_RADICADO: () =>
    `🧑🏾‍🦲 Por favor envíeme el código de su cita

_Puede copiar el código del mensaje de confirmación_

💡 También puede enviar solo los números (ej: 123456) y lo buscaré

Escribe "cancelar" en cualquier momento para salir del proceso.`,

  RADICADO_NO_ENCONTRADO: () =>
    `🧑🏾‍🦲 No encontré ninguna cita con ese código

Por favor verifique e intente nuevamente, o responda "no" para ver sus citas activas

Escribe "cancelar" en cualquier momento para salir del proceso.`,

  CONFIRMAR_CANCELACION: (datos: {
    radicado: string;
    servicio: string;
    fecha: string;
    hora: string;
  }) =>
    `⚠️ *¿Está seguro que desea cancelar esta cita?*

✂️ Servicio: ${datos.servicio}
📅 Fecha: ${datos.fecha}
⏰ Hora: ${datos.hora}
🔖 Código: ${datos.radicado}

Por favor responda:

👉🏾 Sí, cancelar
👉🏾 No, conservar

Escribe "cancelar" en cualquier momento para salir del proceso.`,

  CITA_CANCELADA: () =>
    `✅ *Su cita ha sido cancelada exitosamente*

🧑🏾‍🦲 Si desea agendar una nueva cita, puede escribirnos cuando guste`,

  DESPEDIDA: () =>
    `🧑🏾‍🦲 Ha sido un placer servirle, espero que mi atención haya sido de su agrado, le deseo un feliz resto de día`,

  OPCION_INVALIDA: () =>
    `🧑🏾‍🦲 Por favor lea con atención y responda correctamente

Intente de nuevo por favor`,

  ERROR_SERVIDOR: () =>
    `🧑🏾‍🦲 Lo siento, hubo un problema técnico. Por favor intente nuevamente en unos momentos.`,

  CANCELACION_CONFIRMADA: () =>
    `🧑🏾‍🦲 Proceso cancelado. Si necesita ayuda en el futuro, no dude en contactarnos.`,
};

// ==================== HELPERS ====================

export const formatearPrecio = (precio: number): string => {
  return `${(precio / 1000).toLocaleString('es-CO')} mil pesos`;
};

export const formatearFecha = (fecha: Date): string => {
  const fechaLocal = new Date(fecha);
  
  const opciones: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Bogota'
  };
  
  return fechaLocal.toLocaleDateString('es-CO', opciones);
};

export const formatearHora = (hora: string): string => {
  const [hh, mm] = hora.split(':');
  const horas = parseInt(hh);
  const periodo = horas >= 12 ? 'PM' : 'AM';
  const horas12 = horas % 12 || 12;
  return `${horas12}:${mm} ${periodo}`;
};

/**
 * Genera un radicado corto y fácil de copiar
 * Formato: RAD-XXXXXX (donde X son 6 caracteres alfanuméricos)
 * Ejemplo: RAD-4K7M2P
 */
export const generarRadicado = (): string => {
  const timestamp = Date.now().toString();
  // Tomar los últimos 6 dígitos del timestamp
  const numeros = timestamp.slice(-6);
  // Convertir a base 36 para hacerlo más corto y agregar letras
  const codigo = parseInt(numeros).toString(36).toUpperCase().padStart(6, '0');
  return `RAD-${codigo}`;
};

export const validarNombreCompleto = (nombre: string): boolean => {
  const palabras = nombre.trim().split(/\s+/);
  return palabras.length >= 2 && palabras.every(p => p.length >= 2);
};