// src/services/empleados.service.ts (Backend - ACTUALIZADO)

import prisma from '../config/database';

export class EmpleadosService {
  // Obtener todos los empleados
  async getAll(activo?: boolean) {
    const where: any = {};
    if (activo !== undefined) {
      where.activo = activo;
    }

    const empleados = await prisma.empleado.findMany({
      where,
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: {
            citas: true,
            transacciones: true,
          },
        },
      },
    });

    return empleados.map(emp => ({
      ...emp,
      especialidades: JSON.parse(emp.especialidades || '[]'),
      horarioLunes: emp.horarioLunes ? JSON.parse(emp.horarioLunes) : null,
      horarioMartes: emp.horarioMartes ? JSON.parse(emp.horarioMartes) : null,
      horarioMiercoles: emp.horarioMiercoles ? JSON.parse(emp.horarioMiercoles) : null,
      horarioJueves: emp.horarioJueves ? JSON.parse(emp.horarioJueves) : null,
      horarioViernes: emp.horarioViernes ? JSON.parse(emp.horarioViernes) : null,
      horarioSabado: emp.horarioSabado ? JSON.parse(emp.horarioSabado) : null,
      horarioDomingo: emp.horarioDomingo ? JSON.parse(emp.horarioDomingo) : null,
    }));
  }

  // Obtener un empleado por ID
  async getById(id: string) {
    const empleado = await prisma.empleado.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            citas: true,
            transacciones: true,
          },
        },
        citas: {
          take: 10,
          orderBy: { fechaHora: 'desc' },
          include: {
            cliente: true,
          },
        },
      },
    });

    if (!empleado) {
      throw new Error('Empleado no encontrado');
    }

    return {
      ...empleado,
      especialidades: JSON.parse(empleado.especialidades || '[]'),
      horarioLunes: empleado.horarioLunes ? JSON.parse(empleado.horarioLunes) : null,
      horarioMartes: empleado.horarioMartes ? JSON.parse(empleado.horarioMartes) : null,
      horarioMiercoles: empleado.horarioMiercoles ? JSON.parse(empleado.horarioMiercoles) : null,
      horarioJueves: empleado.horarioJueves ? JSON.parse(empleado.horarioJueves) : null,
      horarioViernes: empleado.horarioViernes ? JSON.parse(empleado.horarioViernes) : null,
      horarioSabado: empleado.horarioSabado ? JSON.parse(empleado.horarioSabado) : null,
      horarioDomingo: empleado.horarioDomingo ? JSON.parse(empleado.horarioDomingo) : null,
    };
  }

  // Crear un nuevo empleado
  async create(data: any) {
    // Validaciones
    if (!data.nombre || typeof data.nombre !== 'string' || data.nombre.trim() === '') {
      throw new Error('El nombre del empleado es obligatorio y no puede estar vacío.');
    }
    if (!data.telefono || typeof data.telefono !== 'string' || data.telefono.trim() === '') {
      throw new Error('El teléfono del empleado es obligatorio y no puede estar vacío.');
    }

    const nombreNormalizado = data.nombre.trim();
    const telefonoNormalizado = data.telefono.trim();

    const existentePorNombre = await prisma.empleado.findFirst({ 
      where: { nombre: nombreNormalizado } 
    });
    if (existentePorNombre) throw new Error('Ya existe un empleado con ese nombre.');

    const existentePorTelefono = await prisma.empleado.findFirst({ 
      where: { telefono: telefonoNormalizado } 
    });
    if (existentePorTelefono) throw new Error('Ya existe un empleado con ese número de teléfono.');

    // ✅ Validar porcentaje de comisión
    const porcentajeComision = data.porcentajeComision !== undefined 
      ? parseFloat(data.porcentajeComision) 
      : 50.0;

    if (porcentajeComision < 0 || porcentajeComision > 100) {
      throw new Error('El porcentaje de comisión debe estar entre 0 y 100.');
    }

    // Crear el empleado
    const empleado = await prisma.empleado.create({
      data: {
        nombre: nombreNormalizado,
        telefono: telefonoNormalizado,
        porcentajeComision, // ✅ NUEVO
        especialidades: JSON.stringify(data.especialidades || []),
        horarioLunes: data.horarioLunes ? JSON.stringify(data.horarioLunes) : null,
        horarioMartes: data.horarioMartes ? JSON.stringify(data.horarioMartes) : null,
        horarioMiercoles: data.horarioMiercoles ? JSON.stringify(data.horarioMiercoles) : null,
        horarioJueves: data.horarioJueves ? JSON.stringify(data.horarioJueves) : null,
        horarioViernes: data.horarioViernes ? JSON.stringify(data.horarioViernes) : null,
        horarioSabado: data.horarioSabado ? JSON.stringify(data.horarioSabado) : null,
        horarioDomingo: data.horarioDomingo ? JSON.stringify(data.horarioDomingo) : null,
      },
    });

    return empleado;
  }

  // Actualizar un empleado
  async update(id: string, data: any) {
    // Validaciones
    if (data.nombre !== undefined) {
      if (!data.nombre || typeof data.nombre !== 'string' || data.nombre.trim() === '') {
        throw new Error('El nombre, si se proporciona, no puede estar vacío.');
      }
      const existente = await prisma.empleado.findFirst({ 
        where: { nombre: data.nombre.trim(), NOT: { id } } 
      });
      if (existente) throw new Error('Ya existe otro empleado con ese nombre.');
    }

    if (data.telefono !== undefined) {
      if (!data.telefono || typeof data.telefono !== 'string' || data.telefono.trim() === '') {
        throw new Error('El teléfono, si se proporciona, no puede estar vacío.');
      }
      const existente = await prisma.empleado.findFirst({ 
        where: { telefono: data.telefono.trim(), NOT: { id } } 
      });
      if (existente) throw new Error('Ya existe otro empleado con ese teléfono.');
    }

    // ✅ Validar porcentaje de comisión si se proporciona
    if (data.porcentajeComision !== undefined) {
      const porcentaje = parseFloat(data.porcentajeComision);
      if (porcentaje < 0 || porcentaje > 100) {
        throw new Error('El porcentaje de comisión debe estar entre 0 y 100.');
      }
    }
    
    // Preparar datos para la actualización
    const updateData: any = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre.trim();
    if (data.telefono !== undefined) updateData.telefono = data.telefono.trim();
    if (data.porcentajeComision !== undefined) updateData.porcentajeComision = parseFloat(data.porcentajeComision); // ✅ NUEVO
    if (data.especialidades !== undefined) updateData.especialidades = JSON.stringify(data.especialidades || []);
    if (data.horarioLunes !== undefined) updateData.horarioLunes = data.horarioLunes ? JSON.stringify(data.horarioLunes) : null;
    if (data.horarioMartes !== undefined) updateData.horarioMartes = data.horarioMartes ? JSON.stringify(data.horarioMartes) : null;
    if (data.horarioMiercoles !== undefined) updateData.horarioMiercoles = data.horarioMiercoles ? JSON.stringify(data.horarioMiercoles) : null;
    if (data.horarioJueves !== undefined) updateData.horarioJueves = data.horarioJueves ? JSON.stringify(data.horarioJueves) : null;
    if (data.horarioViernes !== undefined) updateData.horarioViernes = data.horarioViernes ? JSON.stringify(data.horarioViernes) : null;
    if (data.horarioSabado !== undefined) updateData.horarioSabado = data.horarioSabado ? JSON.stringify(data.horarioSabado) : null;
    if (data.horarioDomingo !== undefined) updateData.horarioDomingo = data.horarioDomingo ? JSON.stringify(data.horarioDomingo) : null;
    if (data.activo !== undefined) updateData.activo = data.activo;

    const empleado = await prisma.empleado.update({
      where: { id },
      data: updateData,
    });

    return empleado;
  }

  // Eliminar un empleado (soft delete)
  async delete(id: string) {
    const empleado = await prisma.empleado.update({
      where: { id },
      data: { activo: false },
    });
    return empleado;
  }

  // Obtener estadísticas de un empleado
  async getEstadisticas(id: string) {
    const [totalCitas, totalIngresos] = await Promise.all([
      prisma.cita.count({
        where: { empleadoId: id, estado: 'COMPLETADA' },
      }),
      prisma.transaccion.aggregate({
        where: { empleadoId: id, tipo: 'INGRESO', estadoPago: 'PAGADO' },
        _sum: { total: true },
      }),
    ]);

    return {
      totalCitas,
      totalIngresos: totalIngresos._sum.total || 0,
    };
  }

  async verificarDisponibilidad(empleadoId: string, fecha: Date, duracionMinutos: number) {
    const diaSemana = fecha.getDay();
    const hora = fecha.getHours();
    const minutos = fecha.getMinutes();

    const empleado = await this.getById(empleadoId);
    if (!empleado) {
      return { disponible: false, motivo: 'Empleado no encontrado' };
    }
    
    const diasSemana = [
      'horarioDomingo', 'horarioLunes', 'horarioMartes', 'horarioMiercoles',
      'horarioJueves', 'horarioViernes', 'horarioSabado',
    ];

    const horarioDiaKey = diasSemana[diaSemana];
    const horarioDia = (empleado as any)[horarioDiaKey];

    if (!horarioDia || typeof horarioDia !== 'object' || !horarioDia.inicio || !horarioDia.fin) {
      return { disponible: false, motivo: 'El empleado no trabaja este día o su horario está mal configurado' };
    }

    const [horaInicio, minInicio] = horarioDia.inicio.split(':').map(Number);
    const [horaFin, minFin] = horarioDia.fin.split(':').map(Number);

    const minutosActuales = hora * 60 + minutos;
    const minutosInicio = horaInicio * 60 + minInicio;
    const minutosFin = horaFin * 60 + minFin;
    const minutosFinServicio = minutosActuales + duracionMinutos;

    if (minutosActuales < minutosInicio || minutosFinServicio > minutosFin) {
      const motivo = `Horario laboral: ${horarioDia.inicio} - ${horarioDia.fin}`;
      return { disponible: false, motivo };
    }

    const finServicio = new Date(fecha.getTime() + duracionMinutos * 60000);
    const citasConflicto = await prisma.cita.count({
      where: {
        empleadoId,
        estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
        OR: [
          { fechaHora: { lt: finServicio, gte: fecha } },
          { fechaHora: { lte: fecha, gte: new Date(fecha.getTime() - 2 * 60 * 60000) } },
        ],
      },
    });

    if (citasConflicto > 0) {
      return { disponible: false, motivo: 'Ya tiene una cita agendada en ese horario' };
    }

    return { disponible: true };
  }
}

export const empleadosService = new EmpleadosService();