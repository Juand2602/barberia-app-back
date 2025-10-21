// src/services/citas.service.ts

import prisma from '../config/database';
import { empleadosService } from './empleados.service';

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

  // Crear una nueva cita
  async create(data: any) {
    const fechaHora = new Date(data.fechaHora);

    // Validar que la fecha no sea en el pasado
    if (fechaHora < new Date()) {
      throw new Error('No se pueden crear citas en el pasado');
    }

    // Verificar disponibilidad del empleado
    const disponibilidad = await empleadosService.verificarDisponibilidad(
      data.empleadoId,
      fechaHora,
      data.duracionMinutos
    );

    if (!disponibilidad.disponible) {
      throw new Error(disponibilidad.motivo || 'El empleado no está disponible en ese horario');
    }

    // Verificar que el cliente existe
    const cliente = await prisma.cliente.findUnique({
      where: { id: data.clienteId },
    });

    if (!cliente) {
      throw new Error('Cliente no encontrado');
    }

    // Crear la cita
    const cita = await prisma.cita.create({
      data: {
        radicado: `CIT-${Date.now()}`,
        clienteId: data.clienteId,
        empleadoId: data.empleadoId,
        servicioNombre: data.servicioNombre,
        fechaHora,
        duracionMinutos: data.duracionMinutos,
        origen: data.origen || 'MANUAL',
        notas: data.notas || null,
        estado: 'PENDIENTE',
      },
      include: {
        cliente: true,
        empleado: true,
      },
    });

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

    return cita;
  }

  // Cambiar estado de una cita
  async cambiarEstado(id: string, data: { estado: string; motivoCancelacion?: string }) {
    const cita = await this.getById(id);

    // Validaciones de transiciones de estado
    if (cita.estado === 'COMPLETADA') {
      throw new Error('No se puede modificar una cita completada');
    }

    if (cita.estado === 'CANCELADA' && data.estado !== 'PENDIENTE') {
      throw new Error('Solo se puede reactivar una cita cancelada a estado PENDIENTE');
    }

    // Si se cancela, requiere motivo
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

    return citaActualizada;
  }

  // Eliminar una cita
  async delete(id: string) {
    const cita = await this.getById(id);

    if (cita.estado === 'COMPLETADA') {
      throw new Error('No se puede eliminar una cita completada');
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

  // --- MÉTODOS AUXILIARES PARA EL BOT DE WHATSAPP ---

  /**
   * Busca una cita por su radicado.
   * Usado por el bot de WhatsApp.
   */
  async buscarPorRadicado(radicado: string) {
    return prisma.cita.findUnique({
      where: { radicado },
      include: {
        cliente: true,
        empleado: true,
      },
    });
  }

  /**
   * Cancela una cita por su radicado.
   * Usado por el bot de WhatsApp.
   */
  async cancelar(radicado: string) {
    return prisma.cita.update({
      where: { radicado },
      data: {
        estado: 'CANCELADA',
        motivoCancelacion: 'Cancelado por WhatsApp',
      },
    });
  }

  /**
   * Calcula los horarios disponibles para un empleado en una fecha.
   * Usado por el bot de WhatsApp.
   */
  async calcularHorariosDisponibles(empleadoId: string, fecha: Date, duracionMinutos: number = 30) {
    const citasExistentes = await this.getByFecha(fecha, empleadoId).then(citas => 
        citas.filter(c => ['PENDIENTE', 'CONFIRMADA'].includes(c.estado))
    );
    
    const empleado = await empleadosService.getById(empleadoId);
    if (!empleado) return [];

    const diaSemana = fecha.getDay();
    const diasMap: any = {
      0: 'horarioDomingo', 1: 'horarioLunes', 2: 'horarioMartes',
      3: 'horarioMiercoles', 4: 'horarioJueves', 5: 'horarioViernes', 6: 'horarioSabado',
    };

    const horarioDia = (empleado as any)[diasMap[diaSemana]];
    if (!horarioDia) return [];

    const [horaInicio, minInicio] = horarioDia.inicio.split(':').map(Number);
    const [horaFin, minFin] = horarioDia.fin.split(':').map(Number);

    const slots: string[] = [];

    // Base date para la fecha dada, con la hora de inicio/fin ajustadas
    const fechaBase = new Date(fecha);
    fechaBase.setHours(0, 0, 0, 0);

    let minutoActual = horaInicio * 60 + minInicio;
    const minutoFinTotal = horaFin * 60 + minFin;

    while (minutoActual + duracionMinutos <= minutoFinTotal) {
        const h = Math.floor(minutoActual / 60);
        const m = minutoActual % 60;

        // Construir Date objects para comparar intervalos
        const slotStart = new Date(
          fechaBase.getFullYear(),
          fechaBase.getMonth(),
          fechaBase.getDate(),
          h,
          m,
          0,
          0
        );
        const slotEnd = new Date(slotStart.getTime() + duracionMinutos * 60000);

        // Comprobar solapamiento con cualquier cita existente
        let solapa = false;
        for (const cita of citasExistentes) {
          const citaStart = new Date(cita.fechaHora);
          const citaEnd = new Date(citaStart.getTime() + (cita.duracionMinutos || 30) * 60000);

          // overlap if slotStart < citaEnd && slotEnd > citaStart
          if (slotStart < citaEnd && slotEnd > citaStart) {
            solapa = true;
            break;
          }
        }

        if (!solapa) {
          const horaStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
          slots.push(horaStr);
        }

        minutoActual += duracionMinutos;
    }

    return slots;
  }

  /**
   * Verifica si ya existe una cita para un empleado en un horario específico.
   * Usado por el bot de WhatsApp.
   */
  async verificarCitaExistente(empleadoId: string, fechaHora: Date, duracionMinutos: number) {
    const finServicio = new Date(fechaHora.getTime() + duracionMinutos * 60000);
    
    // Obtener todas las citas del empleado para ese día
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
    
    // Verificar si alguna de las citas existentes se solapa con la nueva cita
    for (const citaExistente of citasDelDia) {
      const finCitaExistente = new Date(citaExistente.fechaHora.getTime() + (citaExistente.duracionMinutos || 30) * 60000);
      
      // Si la nueva cita comienza antes de que termine la cita existente
      // Y la nueva cita termina después de que comience la cita existente
      if (
        (fechaHora < finCitaExistente && finServicio > citaExistente.fechaHora)
      ) {
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

    // Obtener todas las citas del empleado ese día (excluyendo la cita actual)
    const inicioDia = new Date(fecha);
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date(fecha);
    finDia.setHours(23, 59, 59, 999);

    const citasDelDia = await prisma.cita.findMany({
      where: {
        empleadoId,
        id: { not: citaId },
        estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
        fechaHora: {
          gte: inicioDia,
          lte: finDia,
        },
      },
    });

    for (const citaExistente of citasDelDia) {
      const inicioExistente = new Date(citaExistente.fechaHora);
      const finExistente = new Date(inicioExistente.getTime() + (citaExistente.duracionMinutos || 30) * 60000);

      // Si la nueva cita comienza antes de que termine la cita existente
      // y la nueva cita termina después de que comience la cita existente -> solapan
      if (fecha < finExistente && finServicio > inicioExistente) {
        return { disponible: false, motivo: 'Ya tiene una cita agendada en ese horario' };
      }
    }

    return { disponible: true };
  }
}

export const citasService = new CitasService();
