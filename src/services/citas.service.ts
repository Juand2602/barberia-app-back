// src/services/citas.service.ts (corregido con manejo consistente de zona horaria/barbería)
import prisma from '../config/database';
import { empleadosService } from './empleados.service';

/**
 * CitasService (corregido)
 *
 * - Usa BARBERIA_UTC_OFFSET_MINUTES para convertir entre UTC <-> hora local de la barbería.
 * - Se asume que en la BD las fechas (fechaHora) se almacenan como instantes UTC.
 * - Las funciones que reciben una "fecha" para seleccionar día la interpretan como la fecha en la zona local de la barbería.
 */

type CreateCitaPayload = {
  radicado: string;
  clienteId: string;
  empleadoId: string;
  servicioNombre: string;
  fechaHora: Date; // instante UTC a almacenar
  duracionMinutos: number;
  origen?: string;
  notas?: string | null;
};

function obtenerOffsetMinutes(): number {
  const v = process.env.BARBERIA_UTC_OFFSET_MINUTES || '300';
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 300 : n;
}

/**
 * Convierte un instante UTC (Date) a la fecha/hora local de la barbería (Date).
 * equivalente: fechaLocal = fechaUtc - offsetMinutes
 */
function convertirUtcAFechaLocalBarberia(fechaUtc: Date, offsetMinutes: number): Date {
  return new Date(fechaUtc.getTime() - offsetMinutes * 60_000);
}

/**
 * Convierte una fecha que representa "midnight local" a su rango UTC para consulta:
 * Dado year,month,day en la zona local de barbería, la hora UTC que corresponde a esa
 * medianoche local es Date.UTC(...) + offsetMinutes.
 *
 * startUtc = Date.UTC(year,month,day,0,0,0) + offsetMinutes*60_000
 * endUtc   = startUtc + 24h - 1ms
 */
function rangoUtcParaFechaLocal(fechaLocal: Date, offsetMinutes: number): { startUtc: Date; endUtc: Date } {
  const y = fechaLocal.getFullYear();
  const mo = fechaLocal.getMonth();
  const d = fechaLocal.getDate();
  const startLocalMidnightAsUtcMs = Date.UTC(y, mo, d, 0, 0, 0);
  const startUtcMs = startLocalMidnightAsUtcMs + offsetMinutes * 60_000;
  const startUtc = new Date(startUtcMs);
  const endUtc = new Date(startUtcMs + 24 * 60 * 60_000 - 1);
  return { startUtc, endUtc };
}

function horaStringAMinutos(h: string): number {
  const [hh = '0', mm = '0'] = h.split(':');
  return parseInt(hh, 10) * 60 + parseInt(mm, 10);
}

function minutosAHoraString(minutos: number): string {
  const hh = Math.floor(minutos / 60).toString().padStart(2, '0');
  const mm = (minutos % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

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

  // Obtener citas por fecha específica (interpreta `fecha` como fecha en zona local de barbería)
  async getByFecha(fecha: Date, empleadoId?: string) {
    const offset = obtenerOffsetMinutes();

    // Construir una fecha local (sin hora) usando los componentes de `fecha`
    const fechaLocal = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, 0, 0);

    // Obtener rango UTC que cubre ese día en la zona local de la barbería
    const { startUtc, endUtc } = rangoUtcParaFechaLocal(fechaLocal, offset);

    const where: any = {
      fechaHora: {
        gte: startUtc,
        lte: endUtc,
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
    // Asegurar que fechaHora sea Date
    const fechaHora = new Date(data.fechaHora);
    const offset = obtenerOffsetMinutes();

    // Validar que la fecha no sea en el pasado (comparando instantes)
    if (fechaHora.getTime() < Date.now()) {
      throw new Error('No se pueden crear citas en el pasado');
    }

    // Validar horario laboral del empleado en hora local de la barbería
    const empleado = await empleadosService.getById(data.empleadoId);
    if (!empleado) {
      throw new Error('Empleado no encontrado');
    }

    // decidir qué campo de horario usar según día local
    const fechaLocalDeLaCita = convertirUtcAFechaLocalBarberia(fechaHora, offset);
    const diaSemana = fechaLocalDeLaCita.getDay(); // 0..6
    const diasMap: any = {
      0: 'horarioDomingo', 1: 'horarioLunes', 2: 'horarioMartes',
      3: 'horarioMiercoles', 4: 'horarioJueves', 5: 'horarioViernes', 6: 'horarioSabado',
    };
    const horarioDia = (empleado as any)[diasMap[diaSemana]];
    if (!horarioDia) {
      throw new Error('Empleado no trabaja este día');
    }

    // horarioDia se espera como { inicio: "09:00", fin: "18:00" } (ajusta si tu schema es distinto)
    const aperturaStr = horarioDia.inicio;
    const cierreStr = horarioDia.fin;
    const aperturaMin = horaStringAMinutos(aperturaStr);
    const cierreMin = horaStringAMinutos(cierreStr);

    const minutosLocal = fechaLocalDeLaCita.getHours() * 60 + fechaLocalDeLaCita.getMinutes();

    if (minutosLocal < aperturaMin || minutosLocal >= cierreMin) {
      throw new Error(`Horario laboral: ${aperturaStr} - ${cierreStr}`);
    }

    // Verificar disponibilidad del empleado (solapamientos)
    // Usamos el servicio existente para chequear (si tu empleadosService.verificarDisponibilidad
    // espera la fecha en UTC o local, en la mayoría de implementaciones de tu proyecto
    // debería aceptar el Date UTC; si no, hay que adaptarlo).
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

    // Crear la cita (se almacena fechaHora tal cual en UTC)
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
        estado: data.estado || 'PENDIENTE',
      },
      include: {
        cliente: true,
        empleado: true,
      },
    });

    console.log('✅ Cita creada:', { id: cita.id, radicado: cita.radicado });
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
      if (nuevaFechaHora.getTime() < Date.now()) {
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
    return prisma.cita.findFirst({
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
   *
   * - `fecha` se interpreta como fecha local de la barbería (día que el usuario indicó).
   * - Retorna un array de strings "HH:mm" (hora local).
   */
  async calcularHorariosDisponibles(empleadoId: string, fecha: Date, duracionMinutos: number = 30) {
    const offset = obtenerOffsetMinutes();

    // Obtener horario del empleado para ese día (en hora local)
    const empleado = await empleadosService.getById(empleadoId);
    if (!empleado) return [];

    // Interpretar 'fecha' como fecha local de barbería (ignorar la parte hora si la tuviera)
    const fechaLocal = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, 0, 0);
    const diaSemana = fechaLocal.getDay();

    const diasMap: any = {
      0: 'horarioDomingo', 1: 'horarioLunes', 2: 'horarioMartes',
      3: 'horarioMiercoles', 4: 'horarioJueves', 5: 'horarioViernes', 6: 'horarioSabado',
    };

    const horarioDia = (empleado as any)[diasMap[diaSemana]];
    if (!horarioDia) return [];

    const [horaInicioStr, horaFinStr] = [horarioDia.inicio, horarioDia.fin];
    const inicioMin = horaStringAMinutos(horaInicioStr);
    const finMin = horaStringAMinutos(horaFinStr);

    // Obtener citas existentes del día (buscamos con getByFecha que hace la conversión correcta)
    const citasExistentes = await this.getByFecha(fechaLocal, empleadoId).then(citas =>
      citas.filter(c => ['PENDIENTE', 'CONFIRMADA'].includes(c.estado))
    );

    // Construir set de horarios ocupados en hora local (string "HH:mm")
    const ocupados = new Set<string>();
    for (const c of citasExistentes) {
      // c.fechaHora está en UTC en la BD -> convertir a hora local de barbería
      const fechaLocalCita = convertirUtcAFechaLocalBarberia(c.fechaHora, offset);
      const h = fechaLocalCita.getHours().toString().padStart(2, '0');
      const m = fechaLocalCita.getMinutes().toString().padStart(2, '0');
      ocupados.add(`${h}:${m}`);
    }

    // Generar slots en hora local y filtrar ocupados
    const slots: string[] = [];
    let pointer = inicioMin;
    while (pointer + duracionMinutos <= finMin) {
      const slotStr = minutosAHoraString(pointer);
      if (!ocupados.has(slotStr)) slots.push(slotStr);
      pointer += duracionMinutos;
    }

    // Mapear a formato que usa tu bot (numero, hora)
    return slots.map((s, idx) => ({ numero: idx + 1, hora: s }));
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
        id: { not: citaId }, // Excluir la cita actual
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
