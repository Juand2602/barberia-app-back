// src/services/google-calendar.service.ts - VERSIÓN MEJORADA 🔥

import { calendar, calendar_v3, auth as googleAuth } from '@googleapis/calendar';
import type { OAuth2Client } from 'google-auth-library';
import prisma from '../config/database';
import { addMinutes, startOfDay, endOfDay } from 'date-fns';

interface TokenCache {
  accessToken: string;
  refreshToken: string;
  expiry: number; // timestamp ms
}

export class GoogleCalendarService {
  private oauth2Client: InstanceType<typeof googleAuth.OAuth2>;
  // Caché en memoria para evitar queries a BD en cada operación de calendario
  private tokenCache = new Map<string, TokenCache>();
  private readonly CACHE_BUFFER_MS = 5 * 60 * 1000; // 5 minutos de margen

  constructor() {
    this.oauth2Client = new googleAuth.OAuth2(
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
      prompt: 'consent', // Esto fuerza a que siempre devuelva refresh_token
    });
  }

  /**
   * Intercambia el código de autorización por tokens de acceso
   */
  async handleCallback(code: string, empleadoId: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      console.log('✅ Tokens obtenidos de Google:', {
        has_access_token: !!tokens.access_token,
        has_refresh_token: !!tokens.refresh_token,
        expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      });

      if (!tokens.refresh_token) {
        console.error('⚠️ WARNING: No se recibió refresh_token. Esto puede causar problemas.');
      }

      // Guardar tokens en la base de datos
      await prisma.empleado.update({
        where: { id: empleadoId },
        data: {
          googleAccessToken: tokens.access_token!,
          googleRefreshToken: tokens.refresh_token || undefined, // Solo actualizar si existe
          googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          calendarioSincronizado: true,
        },
      });

      console.log(`✅ Calendario conectado para empleado ${empleadoId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error en callback de Google:', error);
      throw new Error('Error al autorizar Google Calendar');
    }
  }

  /**
   * 🔥 MEJORADO: Verifica y renueva el token de manera proactiva.
   * Usa caché en memoria para evitar queries a BD cuando el token aún es válido.
   */
  private async renovarTokenSiEsNecesario(empleadoId: string): Promise<boolean> {
    try {
      const ahora = Date.now();

      // Revisar caché primero — evita query a BD si el token sigue vigente
      const cached = this.tokenCache.get(empleadoId);
      if (cached && cached.expiry - ahora > this.CACHE_BUFFER_MS) {
        return true;
      }

      const empleado = await prisma.empleado.findUnique({
        where: { id: empleadoId },
        select: {
          googleAccessToken: true,
          googleRefreshToken: true,
          googleTokenExpiry: true,
          nombre: true,
        },
      });

      if (!empleado?.googleAccessToken || !empleado?.googleRefreshToken) {
        console.log(`⚠️ Empleado ${empleado?.nombre || empleadoId} no tiene tokens de Google Calendar`);
        return false;
      }

      const expiraProximamente = empleado.googleTokenExpiry
        ? empleado.googleTokenExpiry.getTime() - ahora < this.CACHE_BUFFER_MS
        : true;

      if (expiraProximamente) {
        console.log(`🔄 Renovando token para ${empleado.nombre}`);

        this.oauth2Client.setCredentials({
          refresh_token: empleado.googleRefreshToken,
        });

        const { credentials } = await this.oauth2Client.refreshAccessToken();

        await prisma.empleado.update({
          where: { id: empleadoId },
          data: {
            googleAccessToken: credentials.access_token!,
            googleTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
            ...(credentials.refresh_token && { googleRefreshToken: credentials.refresh_token }),
          },
        });

        // Actualizar caché con los nuevos tokens
        this.tokenCache.set(empleadoId, {
          accessToken: credentials.access_token!,
          refreshToken: credentials.refresh_token || empleado.googleRefreshToken,
          expiry: credentials.expiry_date || ahora + 3600 * 1000,
        });

        console.log(`✅ Token renovado para ${empleado.nombre}`);
        return true;
      }

      // Token vigente — guardar en caché para evitar próximas queries
      this.tokenCache.set(empleadoId, {
        accessToken: empleado.googleAccessToken,
        refreshToken: empleado.googleRefreshToken,
        expiry: empleado.googleTokenExpiry?.getTime() || ahora + 3600 * 1000,
      });

      return true;

    } catch (error: any) {
      console.error(`❌ Error renovando token para empleado ${empleadoId}:`, {
        message: error.message,
        code: error.code,
      });

      if (error.code === 'invalid_grant' || error.message?.includes('invalid_grant')) {
        console.error(`🚨 Refresh token inválido para empleado ${empleadoId}. Desconectando calendario...`);
        this.tokenCache.delete(empleadoId);
        await this.desconectarCalendario(empleadoId);
      }

      return false;
    }
  }

  /**
   * 🔥 MEJORADO: Obtiene el cliente de Calendar API usando caché de tokens.
   * Evita la segunda query a BD gracias al caché actualizado en renovarTokenSiEsNecesario.
   */
  private async getCalendarClient(empleadoId: string): Promise<calendar_v3.Calendar | null> {
    const tokenValido = await this.renovarTokenSiEsNecesario(empleadoId);
    if (!tokenValido) {
      return null;
    }

    const cached = this.tokenCache.get(empleadoId);
    if (!cached) {
      return null;
    }

    this.oauth2Client.setCredentials({
      access_token: cached.accessToken,
      refresh_token: cached.refreshToken,
      expiry_date: cached.expiry,
    });

    return calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * 🔥 NUEVO: Wrapper para ejecutar operaciones con manejo de errores de autenticación
   */
  private async ejecutarConReintentos<T>(
    empleadoId: string,
    operacion: (calendar: calendar_v3.Calendar) => Promise<T>,
    nombreOperacion: string
  ): Promise<T | null> {
    try {
      const calendar = await this.getCalendarClient(empleadoId);
      if (!calendar) {
        console.log(`⚠️ No se pudo obtener cliente de calendario para ${nombreOperacion}`);
        return null;
      }

      return await operacion(calendar);

    } catch (error: any) {
      // Si es error de autenticación (401/403), intentar renovar y reintentar UNA vez
      if (error.code === 401 || error.code === 403 || error.message?.includes('invalid_grant')) {
        console.log(`🔄 Error de autenticación en ${nombreOperacion}, renovando token y reintentando...`);
        
        const tokenRenovado = await this.renovarTokenSiEsNecesario(empleadoId);
        if (tokenRenovado) {
          const calendar = await this.getCalendarClient(empleadoId);
          if (calendar) {
            try {
              return await operacion(calendar);
            } catch (error2: any) {
              console.error(`❌ Error en reintento de ${nombreOperacion}:`, error2.message);
              return null;
            }
          }
        }
      }

      console.error(`❌ Error en ${nombreOperacion}:`, error.message);
      return null;
    }
  }

  /**
   * 🔥 MEJORADO: Crea un evento con manejo de errores robusto
   */
  async crearEvento(citaId: string) {
    const cita = await prisma.cita.findUnique({
      where: { id: citaId },
      include: { cliente: true, empleado: true },
    });

    if (!cita) {
      throw new Error('Cita no encontrada');
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

    const resultado = await this.ejecutarConReintentos(
      cita.empleadoId,
      async (calendar) => {
        const response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: evento,
        });
        return response.data;
      },
      'crearEvento'
    );

    if (resultado) {
      await prisma.cita.update({
        where: { id: citaId },
        data: { googleEventId: resultado.id! },
      });

      console.log(`✅ Evento creado en Google Calendar: ${resultado.htmlLink}`);
      return resultado;
    } else {
      console.log(`⚠️ No se pudo crear evento en Google Calendar para cita ${cita.radicado}`);
    }
  }

  /**
   * 🔥 MEJORADO: Actualiza un evento con manejo de errores
   */
  async actualizarEvento(citaId: string) {
    const cita = await prisma.cita.findUnique({
      where: { id: citaId },
      include: { cliente: true, empleado: true },
    });

    if (!cita || !cita.googleEventId) {
      return;
    }

    const fechaInicio = new Date(cita.fechaHora);
    const fechaFin = addMinutes(fechaInicio, cita.duracionMinutos);

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

    await this.ejecutarConReintentos(
      cita.empleadoId,
      async (calendar) => {
        await calendar.events.update({
          calendarId: 'primary',
          eventId: cita.googleEventId!,
          requestBody: evento,
        });
        return true;
      },
      'actualizarEvento'
    );
  }

  /**
   * 🔥 MEJORADO: Obtiene eventos con manejo de errores
   */
  async obtenerEventosDelDia(empleadoId: string, fecha: Date): Promise<Array<{
    inicio: Date;
    fin: Date;
    resumen: string;
    esBloqueo: boolean;
  }>> {
    const inicioDia = startOfDay(fecha);
    const finDia = endOfDay(fecha);

    const resultado = await this.ejecutarConReintentos(
      empleadoId,
      async (calendar) => {
        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin: inicioDia.toISOString(),
          timeMax: finDia.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
        });
        return response.data.items || [];
      },
      'obtenerEventosDelDia'
    );

    if (!resultado) {
      return [];
    }

    return resultado
      .map(evento => {
        let inicio: Date;
        let fin: Date;

        if (evento.start?.date) {
          inicio = new Date(evento.start.date);
          inicio.setHours(0, 0, 0, 0);
          
          fin = new Date(evento.end?.date || evento.start.date);
          fin.setHours(23, 59, 59, 999);
          
          console.log(`📅 Evento TODO EL DÍA detectado: ${evento.summary} (${evento.start.date})`);
        } else if (evento.start?.dateTime && evento.end?.dateTime) {
          inicio = new Date(evento.start.dateTime);
          fin = new Date(evento.end.dateTime);
        } else {
          return null;
        }

        const resumen = evento.summary || '';
        const esBloqueo = this.esEventoDeBloqueo(resumen, evento.description);

        return { inicio, fin, resumen, esBloqueo };
      })
      .filter((evento): evento is NonNullable<typeof evento> => evento !== null);
  }

  private esEventoDeBloqueo(resumen: string, descripcion?: string | null): boolean {
    const texto = `${resumen} ${descripcion || ''}`.toLowerCase();
    
    const palabrasClave = [
      'bloqueado', 'bloqueo', 'ocupado', 'no disponible',
      'cerrado', 'personal', 'privado', 'fuera de oficina',
      'vacaciones', 'día libre', 'break', 'descanso',
    ];

    return palabrasClave.some(palabra => texto.includes(palabra));
  }

  async obtenerHorariosBloqueados(
    empleadoId: string, 
    fecha: Date
  ): Promise<Array<{ inicio: Date; fin: Date }>> {
    const eventos = await this.obtenerEventosDelDia(empleadoId, fecha);
    
    const bloqueos = eventos
      .filter(evento => !evento.resumen.includes('RAD-') && evento.esBloqueo)
      .map(evento => ({ inicio: evento.inicio, fin: evento.fin }));

    if (bloqueos.length > 0) {
      console.log(`🚫 ${bloqueos.length} bloqueos encontrados en Google Calendar para ${fecha.toLocaleDateString()}`);
    }

    return bloqueos;
  }

  async desconectarCalendario(empleadoId: string) {
    this.tokenCache.delete(empleadoId);
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

    console.log(`🔌 Calendario desconectado para empleado ${empleadoId}`);
  }

  async sincronizarCitaExistente(citaId: string) {
    const cita = await prisma.cita.findUnique({
      where: { id: citaId },
      include: { cliente: true, empleado: true },
    });

    if (!cita) {
      throw new Error('Cita no encontrada');
    }

    if (cita.googleEventId) {
      console.log(`⚠️ Cita ${citaId} ya tiene evento en Google Calendar, actualizando...`);
      return await this.actualizarEvento(citaId);
    }

    const fechaInicio = new Date(cita.fechaHora);
    const fechaFin = addMinutes(fechaInicio, cita.duracionMinutos);

    let colorId = '2';
    if (cita.estado === 'CANCELADA') colorId = '11';
    if (cita.estado === 'COMPLETADA') colorId = '10';
    if (cita.estado === 'PENDIENTE') colorId = '5';

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
      start: { dateTime: fechaInicio.toISOString(), timeZone: 'America/Bogota' },
      end: { dateTime: fechaFin.toISOString(), timeZone: 'America/Bogota' },
      colorId,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    const resultado = await this.ejecutarConReintentos(
      cita.empleadoId,
      async (calendar) => {
        const response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: evento,
        });
        return response.data;
      },
      'sincronizarCitaExistente'
    );

    if (resultado) {
      await prisma.cita.update({
        where: { id: citaId },
        data: { googleEventId: resultado.id! },
      });

      console.log(`✅ Cita sincronizada a Google Calendar: ${cita.radicado}`);
      return { success: true, eventId: resultado.id, htmlLink: resultado.htmlLink };
    } else {
      return { success: false, motivo: 'Error al sincronizar con Google Calendar' };
    }
  }

  async sincronizarCitasFuturas(empleadoId: string) {
    try {
      const empleado = await prisma.empleado.findUnique({
        where: { id: empleadoId },
      });

      if (!empleado?.calendarioSincronizado) {
        throw new Error('El empleado no tiene Google Calendar conectado');
      }

      const citasFuturas = await prisma.cita.findMany({
        where: {
          empleadoId,
          googleEventId: null,
          fechaHora: { gte: new Date() },
          estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
        },
        include: { cliente: true, empleado: true },
        orderBy: { fechaHora: 'asc' },
      });

      console.log(`📅 Encontradas ${citasFuturas.length} citas futuras para sincronizar`);

      const resultados = {
        total: citasFuturas.length,
        sincronizadas: 0,
        errores: 0,
        detalles: [] as any[],
      };

      for (const cita of citasFuturas) {
        try {
          await this.sincronizarCitaExistente(cita.id);
          resultados.sincronizadas++;
          resultados.detalles.push({
            radicado: cita.radicado,
            fecha: cita.fechaHora,
            cliente: cita.cliente.nombre,
            estado: 'sincronizada',
          });
        } catch (error: any) {
          resultados.errores++;
          resultados.detalles.push({
            radicado: cita.radicado,
            fecha: cita.fechaHora,
            cliente: cita.cliente.nombre,
            estado: 'error',
            error: error.message,
          });
          console.error(`❌ Error sincronizando cita ${cita.radicado}:`, error.message);
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`✅ Sincronización completada: ${resultados.sincronizadas}/${resultados.total} exitosas`);
      return resultados;
    } catch (error) {
      console.error('❌ Error en sincronización masiva:', error);
      throw error;
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();