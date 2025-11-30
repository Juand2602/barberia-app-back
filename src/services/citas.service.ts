// src/services/citas.service.ts - CON GOOGLE CALENDAR Y HORA DE ALMUERZO

import prisma from '../config/database';
import { empleadosService } from './empleados.service';
import { transaccionesService } from './transacciones.service';
import { serviciosService } from './servicios.service';
import { googleCalendarService } from './google-calendar.service';
import { notificacionesService } from './notificaciones.service';

// 🍽️ CONFIGURACIÓN HORA DE ALMUERZO (FIJA PARA TODOS)
const HORA_ALMUERZO_INICIO = '13:00'; // 1:30 PM
const HORA_ALMUERZO_FIN = '14:30';    // 2:30 PM

export class CitasService {
  // Obtener todas las citas con filtros
  async getAll(filters?: {
    fechaInicio?: Date;
    fechaFin?: Date;
    empleadoId?: string;
    clienteId?: string;
    estado?: string;
  }) {
    const where: any = {};

    if (filters) {
      if (filters.fechaInicio || filters.fechaFin) {
        where.fechaHora = {};
        if (filters.fechaInicio) {
          where.fechaHora.gte = filters.fechaInicio;
        }
        if (filters.fechaFin) {
          where.fechaHora.lte = filters.fechaFin;
        }
      }

      if (filters.empleadoId) {
        where.empleadoId = filters.empleadoId;
      }

      if (filters.clienteId) {
        where.clienteId = filters.clienteId;
      }

      if (filters.estado) {
        where.estado = filters.estado;
      }
    }

    const citas = await prisma.cita.findMany({
      where,
      include: {
        cliente: true,
        empleado: true,
      },
      orderBy: { fechaHora: 'asc' },
    });

    return citas;
  }

  // Obtener citas por fecha específica
  async getByFecha(fecha: Date, empleadoId?: string) {
    const inicioDia = new Date(fecha);
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date(fecha);
    finDia.setHours(23, 59, 59, 999);

    const where: any = {
      fechaHora: {
        gte: inicioDia,
        lte: finDia,
      },
    };

    if (empleadoId) {
      where.empleadoId = empleadoId;
    }

    const citas = await prisma.cita.findMany({
      where,
      include: {
        cliente: true,
        empleado: true,
      },
      orderBy: { fechaHora: 'asc' },
    });

    return citas;
  }

  // Obtener citas de una semana
  async getBySemana(fechaInicio: Date, empleadoId?: string) {
    const fechaFin = new Date(fechaInicio);
    fechaFin.setDate(fechaFin.getDate() + 7);

    return this.getAll({
      fechaInicio,
      fechaFin,
      empleadoId,
    });
  }

  // Obtener citas de un mes
  async getByMes(year: number, month: number, empleadoId?: string) {
    const fechaInicio = new Date(year, month - 1, 1);
    const fechaFin = new Date(year, month, 0, 23, 59, 59);

    return this.getAll({
      fechaInicio,
      fechaFin,
      empleadoId,
    });
  }

  // Obtener una cita por ID
  async getById(id: string) {
    const cita = await prisma.cita.findUnique({
      where: { id },
      include: {
        cliente: true,
        empleado: true,
      },
    });

    if (!cita) {
      throw new Error('Cita no encontrada');
    }

    return cita;
  }

  // 🍽️ NUEVA FUNCIÓN: Verificar si un horario cae en hora de almuerzo
  private estaEnHoraAlmuerzo(horaMinutos: number): boolean {
    const [almuerzoInicioH, almuerzoInicioM] = HORA_ALMUERZO_INICIO.split(':').map(Number);
    const [almuerzoFinH, almuerzoFinM] = HORA_ALMUERZO_FIN.split(':').map(Number);
    
    const almuerzoInicioMinutos = almuerzoInicioH * 60 + almuerzoInicioM;
    const almuerzoFinMinutos = almuerzoFinH * 60 + almuerzoFinM;
    
    return horaMinutos >= almuerzoInicioMinutos && horaMinutos < almuerzoFinMinutos;
  }

  // 🍽️ NUEVA FUNCIÓN: Verificar si una cita se solapa con hora de almuerzo
  private seSolapaConAlmuerzo(inicioMinutos: number, duracionMinutos: number): boolean {
    const finMinutos = inicioMinutos + duracionMinutos;
    
    const [almuerzoInicioH, almuerzoInicioM] = HORA_ALMUERZO_INICIO.split(':').map(Number);
    const [almuerzoFinH, almuerzoFinM] = HORA_ALMUERZO_FIN.split(':').map(Number);
    
    const almuerzoInicioMinutos = almuerzoInicioH * 60 + almuerzoInicioM;
    const almuerzoFinMinutos = almuerzoFinH * 60 + almuerzoFinM;
    
    // Verifica si hay solapamiento
    return inicioMinutos < almuerzoFinMinutos && finMinutos > almuerzoInicioMinutos;
  }

  // Crear una nueva cita
  async create(data: any) {
    const fechaHora = new Date(data.fechaHora);

    // Validar que la fecha no sea en el pasado
    if (fechaHora < new Date()) {
      throw new Error('No se pueden crear citas en el pasado');
    }

    // 🍽️ NUEVO: Validar que no esté en hora de almuerzo
    const horaMinutos = fechaHora.getHours() * 60 + fechaHora.getMinutes();
    if (this.seSolapaConAlmuerzo(horaMinutos, data.duracionMinutos)) {
      throw new Error('No se pueden agendar citas durante la hora de almuerzo (1:30 PM - 2:30 PM)');
    }

    // Verificar que no haya solapamiento con citas existentes
    const citaExistente = await this.verificarCitaExistente(
      data.empleadoId,
      fechaHora,
      data.duracionMinutos
    );

    if (citaExistente) {
      throw new Error('Lo siento, ese horario ya no está disponible. Por favor elige otro horario.');
    }

    // Verificar que el empleado trabaja en ese horario
    const empleado = await empleadosService.getById(data.empleadoId);
    if (!empleado) {
      throw new Error('Empleado no encontrado');
    }

    const diaSemana = fechaHora.getDay();
    const diasMap: any = {
      0: 'horarioDomingo', 1: 'horarioLunes', 2: 'horarioMartes',
      3: 'horarioMiercoles', 4: 'horarioJueves', 5: 'horarioViernes', 6: 'horarioSabado',
    };

    const horarioDia = (empleado as any)[diasMap[diaSemana]];
    if (!horarioDia) {
      throw new Error('El empleado no trabaja ese día');
    }

    // Verificar que la hora está dentro del horario laboral
    const [horaInicio, minInicio] = horarioDia.inicio.split(':').map(Number);
    const [horaFin, minFin] = horarioDia.fin.split(':').map(Number);
    const inicioMinutos = horaInicio * 60 + minInicio;
    const finMinutos = horaFin * 60 + minFin;

    if (horaMinutos < inicioMinutos || horaMinutos + data.duracionMinutos > finMinutos) {
      throw new Error('La hora está fuera del horario laboral del empleado');
    }

    // Verificar que el cliente existe
    const cliente = await prisma.cliente.findUnique({
      where: { id: data.clienteId },
    });

    if (!cliente) {
      throw new Error('Cliente no encontrado');
    }

    // Determinar el estado inicial según el origen
    const estadoInicial = data.origen === 'WHATSAPP' ? 'CONFIRMADA' : 'PENDIENTE';

    // Crear la cita
    const cita = await prisma.cita.create({
      data: {
        radicado: data.radicado || `CIT-${Date.now()}`,
        clienteId: data.clienteId,
        empleadoId: data.empleadoId,
        servicioNombre: data.servicioNombre,
        fechaHora,
        duracionMinutos: data.duracionMinutos,
        origen: data.origen || 'MANUAL',
        notas: data.notas || null,
        estado: estadoInicial,
      },
      include: {
        cliente: true,
        empleado: true,
      },
    });

    // Sincronizar con Google Calendar
    try {
      await googleCalendarService.crearEvento(cita.id);
    } catch (error) {
      console.error('❌ Error al sincronizar con Google Calendar:', error);
    }

    // Crear transacción pendiente automáticamente
    try {
      const servicios = await serviciosService.listarActivos();
      const servicio = servicios.find((s: any) => s.nombre === data.servicioNombre);

      if (servicio) {
        await transaccionesService.crearTransaccionDesdeCita({
          citaId: cita.id,
          clienteId: cita.clienteId,
          empleadoId: cita.empleadoId,
          servicioId: servicio.id,
          servicioNombre: servicio.nombre,
          precio: servicio.precio,
          fecha: fechaHora,
        });
      } else {
        console.warn(`⚠️ No se encontró el servicio "${data.servicioNombre}" para crear la transacción`);
      }
    } catch (error) {
      console.error('Error creando transacción automática:', error);
    }

    return cita;
  }

  // Actualizar una cita (reprogramar)
  async update(id: string, data: any) {
    // Si se está cambiando la fecha/hora o empleado, validar disponibilidad
    if (data.fechaHora || data.empleadoId || data.duracionMinutos) {
      const citaActual = await this.getById(id);

      const nuevaFechaHora = data.fechaHora 
        ? new Date(data.fechaHora) 
        : citaActual.fechaHora;
      
      const nuevoEmpleadoId = data.empleadoId || citaActual.empleadoId;
      const nuevaDuracion = data.duracionMinutos || citaActual.duracionMinutos;

      // Validar que la nueva fecha no sea en el pasado
      if (nuevaFechaHora < new Date()) {
        throw new Error('No se pueden reprogramar citas en el pasado');
      }

      // 🍽️ NUEVO: Validar hora de almuerzo
      const horaMinutos = nuevaFechaHora.getHours() * 60 + nuevaFechaHora.getMinutes();
      if (this.seSolapaConAlmuerzo(horaMinutos, nuevaDuracion)) {
        throw new Error('No se pueden agendar citas durante la hora de almuerzo (1:30 PM - 2:30 PM)');
      }

      // Verificar disponibilidad del empleado (excluyendo la cita actual)
      const disponibilidad = await this.verificarDisponibilidadParaActualizar(
        id,
        nuevoEmpleadoId,
        nuevaFechaHora,
        nuevaDuracion
      );

      if (!disponibilidad.disponible) {
        throw new Error(disponibilidad.motivo || 'El empleado no está disponible');
      }
    }

    const cita = await prisma.cita.update({
      where: { id },
      data: {
        ...(data.clienteId && { clienteId: data.clienteId }),
        ...(data.empleadoId && { empleadoId: data.empleadoId }),
        ...(data.servicioNombre && { servicioNombre: data.servicioNombre }),
        ...(data.fechaHora && { fechaHora: new Date(data.fechaHora) }),
        ...(data.duracionMinutos && { duracionMinutos: data.duracionMinutos }),
        ...(data.estado && { estado: data.estado }),
        ...(data.notas !== undefined && { notas: data.notas || null }),
        ...(data.motivoCancelacion !== undefined && { 
          motivoCancelacion: data.motivoCancelacion || null 
        }),
      },
      include: {
        cliente: true,
        empleado: true,
      },
    });

    // Actualizar en Google Calendar
    try {
      await googleCalendarService.actualizarEvento(id);
    } catch (error) {
      console.error('❌ Error al actualizar en Google Calendar:', error);
    }

    return cita;
  }

  // Cambiar estado de una cita
  async cambiarEstado(id: string, data: { estado: string; motivoCancelacion?: string }) {
    const cita = await this.getById(id);

    if (cita.estado === 'COMPLETADA') {
      throw new Error('No se puede modificar una cita completada');
    }

    if (cita.estado === 'CANCELADA' && data.estado !== 'PENDIENTE') {
      throw new Error('Solo se puede reactivar una cita cancelada a estado PENDIENTE');
    }

    if (data.estado === 'CANCELADA' && !data.motivoCancelacion) {
      throw new Error('Debe proporcionar un motivo de cancelación');
    }

    const citaActualizada = await prisma.cita.update({
      where: { id },
      data: {
        estado: data.estado,
        motivoCancelacion: data.motivoCancelacion || null,
      },
      include: {
        cliente: true,
        empleado: true,
      },
    });

    try {
      await googleCalendarService.actualizarEvento(id);
    } catch (error) {
      console.error('❌ Error al actualizar en Google Calendar:', error);
    }

    if (data.estado === 'CANCELADA') {
      try {
        const transaccion = await transaccionesService.obtenerPorCitaId(id);
        if (transaccion && transaccion.estadoPago === 'PENDIENTE') {
          await transaccionesService.delete(transaccion.id);
          console.log(`✅ Transacción pendiente eliminada para cita cancelada ${id}`);
        }
      } catch (error) {
        console.error('Error eliminando transacción de cita cancelada:', error);
      }
    }

    return citaActualizada;
  }

  // Eliminar una cita
  async delete(id: string) {
    const cita = await this.getById(id);

    if (cita.estado === 'COMPLETADA') {
      throw new Error('No se puede eliminar una cita completada');
    }

    try {
      const transaccion = await transaccionesService.obtenerPorCitaId(id);
      if (transaccion && transaccion.estadoPago === 'PENDIENTE') {
        await transaccionesService.delete(transaccion.id);
      }
    } catch (error) {
      console.error('Error eliminando transacción al borrar cita:', error);
    }

    await prisma.cita.delete({
      where: { id },
    });
  }

  // Obtener estadísticas de citas
  async getEstadisticas(fechaInicio?: Date, fechaFin?: Date) {
    const where: any = {};

    if (fechaInicio || fechaFin) {
      where.fechaHora = {};
      if (fechaInicio) where.fechaHora.gte = fechaInicio;
      if (fechaFin) where.fechaHora.lte = fechaFin;
    }

    const [total, pendientes, confirmadas, completadas, canceladas] = await Promise.all([
      prisma.cita.count({ where }),
      prisma.cita.count({ where: { ...where, estado: 'PENDIENTE' } }),
      prisma.cita.count({ where: { ...where, estado: 'CONFIRMADA' } }),
      prisma.cita.count({ where: { ...where, estado: 'COMPLETADA' } }),
      prisma.cita.count({ where: { ...where, estado: 'CANCELADA' } }),
    ]);

    return {
      total,
      pendientes,
      confirmadas,
      completadas,
      canceladas,
    };
  }

  // Obtener próximas citas
  async getProximas(limite: number = 10, empleadoId?: string) {
    const where: any = {
      fechaHora: {
        gte: new Date(),
      },
      estado: {
        in: ['PENDIENTE', 'CONFIRMADA'],
      },
    };

    if (empleadoId) {
      where.empleadoId = empleadoId;
    }

    const citas = await prisma.cita.findMany({
      where,
      include: {
        cliente: true,
        empleado: true,
      },
      orderBy: { fechaHora: 'asc' },
      take: limite,
    });

    return citas;
  }

  // Buscar una cita por su radicado
  async buscarPorRadicado(radicado: string) {
    return prisma.cita.findUnique({
      where: { radicado },
      include: {
        cliente: true,
        empleado: true,
      },
    });
  }

  // Cancelar una cita por su radicado
  async cancelar(radicado: string) {
    const cita = await prisma.cita.update({
      where: { radicado },
      data: {
        estado: 'CANCELADA',
        motivoCancelacion: 'Cancelado por WhatsApp',
      },
    });

    try {
      await googleCalendarService.actualizarEvento(cita.id);
    } catch (error) {
      console.error('Error al actualizar en Google Calendar:', error);
    }

    try {
      const transaccion = await transaccionesService.obtenerPorCitaId(cita.id);
      if (transaccion && transaccion.estadoPago === 'PENDIENTE') {
        await transaccionesService.delete(transaccion.id);
        console.log(`✅ Transacción pendiente eliminada para cita cancelada ${cita.id}`);
      }
    } catch (error) {
      console.error('Error eliminando transacción:', error);
    }

    return cita;
  }

  /**
   * 🍽️ ACTUALIZADO: Calcula los horarios disponibles excluyendo la hora de almuerzo
   */
  async calcularHorariosDisponibles(
    empleadoId: string, 
    fecha: Date, 
    duracionMinutos: number = 30
  ): Promise<string[]> {
    // 1. Obtener citas existentes en el sistema
    const citasExistentes = await this.getByFecha(fecha, empleadoId).then(citas => 
      citas.filter(c => ['PENDIENTE', 'CONFIRMADA'].includes(c.estado))
    );
    
    const empleado = await empleadosService.getById(empleadoId);
    if (!empleado) return [];

    // 2. Obtener horario laboral del día
    const diaSemana = fecha.getDay();
    const diasMap: any = {
      0: 'horarioDomingo', 
      1: 'horarioLunes', 
      2: 'horarioMartes',
      3: 'horarioMiercoles', 
      4: 'horarioJueves', 
      5: 'horarioViernes', 
      6: 'horarioSabado',
    };

    const horarioDia = (empleado as any)[diasMap[diaSemana]];
    if (!horarioDia) return [];

    const [horaInicio, minInicio] = horarioDia.inicio.split(':').map(Number);
    const [horaFin, minFin] = horarioDia.fin.split(':').map(Number);

    // 3. Generar todos los slots posibles
    const slots: string[] = [];
    let horaActual = horaInicio * 60 + minInicio;
    const horaFinTotal = horaFin * 60 + minFin;

    while (horaActual + duracionMinutos <= horaFinTotal) {
      const h = Math.floor(horaActual / 60);
      const m = horaActual % 60;
      const horaStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      slots.push(horaStr);
      horaActual += duracionMinutos;
    }

    // 4. Crear rangos ocupados de citas existentes
    const rangosOcupados: Array<{ inicio: number; fin: number }> = citasExistentes.map(c => {
      const inicio = c.fechaHora.getHours() * 60 + c.fechaHora.getMinutes();
      const fin = inicio + c.duracionMinutos;
      return { inicio, fin };
    });

    // 🍽️ 5. NUEVO: Agregar rango de hora de almuerzo a los rangos ocupados
    const [almuerzoInicioH, almuerzoInicioM] = HORA_ALMUERZO_INICIO.split(':').map(Number);
    const [almuerzoFinH, almuerzoFinM] = HORA_ALMUERZO_FIN.split(':').map(Number);
    
    rangosOcupados.push({
      inicio: almuerzoInicioH * 60 + almuerzoInicioM,
      fin: almuerzoFinH * 60 + almuerzoFinM,
    });
    
    console.log(`🍽️ Hora de almuerzo bloqueada: ${HORA_ALMUERZO_INICIO} - ${HORA_ALMUERZO_FIN}`);

    // 6. Obtener bloqueos de Google Calendar
    try {
      const bloqueos = await googleCalendarService.obtenerHorariosBloqueados(empleadoId, fecha);
      
      bloqueos.forEach(bloqueo => {
        const inicio = bloqueo.inicio.getHours() * 60 + bloqueo.inicio.getMinutes();
        const fin = bloqueo.fin.getHours() * 60 + bloqueo.fin.getMinutes();
        
        rangosOcupados.push({ inicio, fin });
        
        console.log(`🚫 Bloqueo agregado: ${bloqueo.inicio.toTimeString().substring(0, 5)} - ${bloqueo.fin.toTimeString().substring(0, 5)}`);
      });
    } catch (error) {
      console.error('Error obteniendo bloqueos de Google Calendar:', error);
    }

    // 7. Filtrar slots que NO se solapen con ningún rango ocupado
    const slotsDisponibles = slots.filter(slot => {
      const [h, m] = slot.split(':').map(Number);
      const inicioSlot = h * 60 + m;
      const finSlot = inicioSlot + duracionMinutos;

      // Verificar que no se solape con ningún rango ocupado
      const hayConflicto = rangosOcupados.some(rango => {
        return inicioSlot < rango.fin && finSlot > rango.inicio;
      });

      return !hayConflicto;
    });

    console.log(`✅ ${slotsDisponibles.length} horarios disponibles (de ${slots.length} slots) para ${fecha.toLocaleDateString()}`);
    
    return slotsDisponibles;
  }

  /**
   * Verifica si ya existe una cita que se solape con el horario propuesto.
   */
  async verificarCitaExistente(empleadoId: string, fechaHora: Date, duracionMinutos: number) {
    const finServicio = new Date(fechaHora.getTime() + duracionMinutos * 60000);
    
    const inicioDia = new Date(fechaHora);
    inicioDia.setHours(0, 0, 0, 0);
    
    const finDia = new Date(fechaHora);
    finDia.setHours(23, 59, 59, 999);
    
    const citasDelDia = await prisma.cita.findMany({
      where: {
        empleadoId,
        estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
        fechaHora: {
          gte: inicioDia,
          lte: finDia,
        },
      },
    });
    
    for (const citaExistente of citasDelDia) {
      const finCitaExistente = new Date(
        citaExistente.fechaHora.getTime() + citaExistente.duracionMinutos * 60000
      );
      
      if (fechaHora < finCitaExistente && finServicio > citaExistente.fechaHora) {
        return citaExistente;
      }
    }
    
    return null;
  }

  // Verificar disponibilidad para actualizar (excluyendo la cita actual)
  private async verificarDisponibilidadParaActualizar(
    citaId: string,
    empleadoId: string,
    fecha: Date,
    duracionMinutos: number
  ) {
    const finServicio = new Date(fecha.getTime() + duracionMinutos * 60000);

    const citasConflicto = await prisma.cita.count({
      where: {
        empleadoId,
        id: { not: citaId },
        estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
        OR: [
          { fechaHora: { lt: fecha, gte: new Date(fecha.getTime() - 2 * 60 * 60000) } },
          { fechaHora: { gte: fecha, lt: finServicio } },
        ],
      },
    });

    if (citasConflicto > 0) {
      return { disponible: false, motivo: 'Ya tiene una cita agendada en ese horario' };
    }

    return { disponible: true };
  }
}

export const citasService = new CitasService();