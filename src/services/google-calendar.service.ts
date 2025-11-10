// src/services/google-calendar.service.ts - MEJORADO
// 🎯 MEJORAS:
// 1. ✅ Detectar eventos bloqueados en Google Calendar
// 2. ✅ Sincronizar bloqueos automáticamente
// 3. ✅ Excluir horarios bloqueados al calcular disponibilidad

import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../config/database';
import { addMinutes, startOfDay, endOfDay } from 'date-fns';

export class GoogleCalendarService {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Genera la URL para que el empleado autorice el acceso a su calendario
   */
  getAuthUrl(empleadoId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: empleadoId,
      prompt: 'consent',
    });
  }

  /**
   * Intercambia el código de autorización por tokens de acceso
   */
  async handleCallback(code: string, empleadoId: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      // Guardar tokens en la base de datos
      await prisma.empleado.update({
        where: { id: empleadoId },
        data: {
          googleAccessToken: tokens.access_token!,
          googleRefreshToken: tokens.refresh_token!,
          googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          calendarioSincronizado: true,
        },
      });

      return { success: true };
    } catch (error) {
      console.error('Error en callback de Google:', error);
      throw new Error('Error al autorizar Google Calendar');
    }
  }

  /**
   * Obtiene el cliente de Calendar API para un empleado
   */
  private async getCalendarClient(empleadoId: string): Promise<calendar_v3.Calendar | null> {
    const empleado = await prisma.empleado.findUnique({
      where: { id: empleadoId },
    });

    if (!empleado?.googleAccessToken || !empleado?.googleRefreshToken) {
      return null;
    }

    this.oauth2Client.setCredentials({
      access_token: empleado.googleAccessToken,
      refresh_token: empleado.googleRefreshToken,
      expiry_date: empleado.googleTokenExpiry?.getTime(),
    });

    // Verificar si el token expiró y renovarlo
    if (empleado.googleTokenExpiry && new Date() > empleado.googleTokenExpiry) {
      try {
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        
        await prisma.empleado.update({
          where: { id: empleadoId },
          data: {
            googleAccessToken: credentials.access_token!,
            googleTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
          },
        });

        this.oauth2Client.setCredentials(credentials);
      } catch (error) {
        console.error('Error al renovar token:', error);
        return null;
      }
    }

    return google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Crea un evento en Google Calendar cuando se agenda una cita
   */
  async crearEvento(citaId: string) {
    const cita = await prisma.cita.findUnique({
      where: { id: citaId },
      include: { cliente: true, empleado: true },
    });

    if (!cita) {
      throw new Error('Cita no encontrada');
    }

    const calendar = await this.getCalendarClient(cita.empleadoId);
    if (!calendar) {
      console.log(`Empleado ${cita.empleado.nombre} no tiene Google Calendar conectado`);
      return;
    }

    const fechaInicio = new Date(cita.fechaHora);
    const fechaFin = addMinutes(fechaInicio, cita.duracionMinutos);

    const evento: calendar_v3.Schema$Event = {
      summary: `${cita.servicioNombre} - ${cita.cliente.nombre}`,
      description: `
Cliente: ${cita.cliente.nombre}
Teléfono: ${cita.cliente.telefono}
Servicio: ${cita.servicioNombre}
Radicado: ${cita.radicado}
${cita.notas ? `Notas: ${cita.notas}` : ''}
      `.trim(),
      start: {
        dateTime: fechaInicio.toISOString(),
        timeZone: 'America/Bogota',
      },
      end: {
        dateTime: fechaFin.toISOString(),
        timeZone: 'America/Bogota',
      },
      colorId: '2', // Verde
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: evento,
      });

      await prisma.cita.update({
        where: { id: citaId },
        data: { googleEventId: response.data.id! },
      });

      console.log(`✅ Evento creado en Google Calendar: ${response.data.htmlLink}`);
      return response.data;
    } catch (error) {
      console.error('Error al crear evento en Google Calendar:', error);
      throw error;
    }
  }

  /**
   * Actualiza un evento en Google Calendar
   */
  async actualizarEvento(citaId: string) {
    const cita = await prisma.cita.findUnique({
      where: { id: citaId },
      include: { cliente: true, empleado: true },
    });

    if (!cita || !cita.googleEventId) {
      return;
    }

    const calendar = await this.getCalendarClient(cita.empleadoId);
    if (!calendar) {
      return;
    }

    const fechaInicio = new Date(cita.fechaHora);
    const fechaFin = addMinutes(fechaInicio, cita.duracionMinutos);

    // Color según estado
    let colorId = '2'; // Verde
    if (cita.estado === 'CANCELADA') colorId = '11'; // Rojo
    if (cita.estado === 'COMPLETADA') colorId = '10'; // Gris

    const evento: calendar_v3.Schema$Event = {
      summary: `${cita.servicioNombre} - ${cita.cliente.nombre}`,
      description: `
Cliente: ${cita.cliente.nombre}
Teléfono: ${cita.cliente.telefono}
Servicio: ${cita.servicioNombre}
Estado: ${cita.estado}
Radicado: ${cita.radicado}
${cita.notas ? `Notas: ${cita.notas}` : ''}
${cita.motivoCancelacion ? `Motivo cancelación: ${cita.motivoCancelacion}` : ''}
      `.trim(),
      start: {
        dateTime: fechaInicio.toISOString(),
        timeZone: 'America/Bogota',
      },
      end: {
        dateTime: fechaFin.toISOString(),
        timeZone: 'America/Bogota',
      },
      colorId,
    };

    try {
      await calendar.events.update({
        calendarId: 'primary',
        eventId: cita.googleEventId,
        requestBody: evento,
      });

      console.log(`✅ Evento actualizado en Google Calendar`);
    } catch (error) {
      console.error('Error al actualizar evento:', error);
    }
  }

  /**
   * 🌟 NUEVO: Obtiene todos los eventos del calendario en un rango de fechas
   * Útil para detectar bloqueos de horarios
   */
async obtenerEventosDelDia(empleadoId: string, fecha: Date): Promise<Array<{
    inicio: Date;
    fin: Date;
    resumen: string;
    esBloqueo: boolean;
  }>> {
    const calendar = await this.getCalendarClient(empleadoId);
    if (!calendar) {
      return [];
    }

    const inicioDia = startOfDay(fecha);
    const finDia = endOfDay(fecha);

    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: inicioDia.toISOString(),
        timeMax: finDia.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const eventos = response.data.items || [];

      return eventos
        .map(evento => {
          // 🔧 NUEVO: Manejar eventos de "todo el día" (date) y eventos con hora (dateTime)
          let inicio: Date;
          let fin: Date;

          if (evento.start?.date) {
            // Evento de TODO EL DÍA
            inicio = new Date(evento.start.date);
            inicio.setHours(0, 0, 0, 0);
            
            fin = new Date(evento.end?.date || evento.start.date);
            fin.setHours(23, 59, 59, 999);
            
            console.log(`📅 Evento TODO EL DÍA detectado: ${evento.summary} (${evento.start.date})`);
          } else if (evento.start?.dateTime && evento.end?.dateTime) {
            // Evento con HORA ESPECÍFICA
            inicio = new Date(evento.start.dateTime);
            fin = new Date(evento.end.dateTime);
          } else {
            // Evento sin información de tiempo válida, omitir
            return null;
          }

          const resumen = evento.summary || '';
          
          // Detectar si es un bloqueo (eventos que contienen palabras clave)
          const esBloqueo = this.esEventoDeBloqueo(resumen, evento.description);

          return {
            inicio,
            fin,
            resumen,
            esBloqueo,
          };
        })
        .filter((evento): evento is NonNullable<typeof evento> => evento !== null); // Filtrar nulls
    } catch (error) {
      console.error('Error al obtener eventos del calendario:', error);
      return [];
    }
  }

  /**
   * 🌟 NUEVO: Determina si un evento es un bloqueo de horario
   * Busca palabras clave como: bloqueado, ocupado, no disponible, etc.
   */
  private esEventoDeBloqueo(resumen: string, descripcion?: string | null): boolean {
    const texto = `${resumen} ${descripcion || ''}`.toLowerCase();
    
    const palabrasClave = [
      'bloqueado',
      'bloqueo',
      'ocupado',
      'no disponible',
      'cerrado',
      'personal',
      'privado',
      'fuera de oficina',
      'vacaciones',
      'día libre',
      'break',
      'descanso',
    ];

    return palabrasClave.some(palabra => texto.includes(palabra));
  }

  /**
   * 🌟 NUEVO: Obtiene los horarios bloqueados de un empleado para una fecha
   * Se integra con el cálculo de horarios disponibles
   */
  async obtenerHorariosBloqueados(
    empleadoId: string, 
    fecha: Date
  ): Promise<Array<{ inicio: Date; fin: Date }>> {
    const eventos = await this.obtenerEventosDelDia(empleadoId, fecha);
    
    // Filtrar solo eventos que NO son citas del sistema (bloqueos externos)
    const bloqueos = eventos
      .filter(evento => {
        // Si el evento contiene "Radicado:" es una cita del sistema, no un bloqueo
        return !evento.resumen.includes('RAD-') && evento.esBloqueo;
      })
      .map(evento => ({
        inicio: evento.inicio,
        fin: evento.fin,
      }));

    if (bloqueos.length > 0) {
      console.log(`🚫 ${bloqueos.length} bloqueos encontrados en Google Calendar para ${fecha.toLocaleDateString()}`);
    }

    return bloqueos;
  }

  /**
   * Desconecta el calendario de un empleado
   */
  async desconectarCalendario(empleadoId: string) {
    await prisma.empleado.update({
      where: { id: empleadoId },
      data: {
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
        googleCalendarId: null,
        calendarioSincronizado: false,
      },
    });
  }
}

export const googleCalendarService = new GoogleCalendarService();