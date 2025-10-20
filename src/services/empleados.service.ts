import prisma from '../config/database';

export class EmpleadosService {
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

  async create(data: any) {
    if (!data.nombre || typeof data.nombre !== 'string' || data.nombre.trim() === '') {
      throw new Error('El nombre del empleado es obligatorio y no puede estar vacío.');
    }
    if (!data.telefono || typeof data.telefono !== 'string' || data.telefono.trim() === '') {
      throw new Error('El teléfono del empleado es obligatorio y no puede estar vacío.');
    }

    const nombreNormalizado = data.nombre.trim();
    const telefonoNormalizado = data.telefono.trim();

    const existentePorNombre = await prisma.empleado.findFirst({ where: { nombre: nombreNormalizado } });
    if (existentePorNombre) throw new Error('Ya existe un empleado con ese nombre.');

    const existentePorTelefono = await prisma.empleado.findFirst({ where: { telefono: telefonoNormalizado } });
    if (existentePorTelefono) throw new Error('Ya existe un empleado con ese número de teléfono.');

    const empleado = await prisma.empleado.create({
      data: {
        nombre: nombreNormalizado,
        telefono: telefonoNormalizado,
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

  async update(id: string, data: any) {
    if (data.nombre !== undefined) {
      if (!data.nombre || typeof data.nombre !== 'string' || data.nombre.trim() === '') {
        throw new Error('El nombre, si se proporciona, no puede estar vacío.');
      }
      const existente = await prisma.empleado.findFirst({ where: { nombre: data.nombre.trim(), NOT: { id } } });
      if (existente) throw new Error('Ya existe otro empleado con ese nombre.');
    }
    if (data.telefono !== undefined) {
      if (!data.telefono || typeof data.telefono !== 'string' || data.telefono.trim() === '') {
        throw new Error('El teléfono, si se proporciona, no puede estar vacío.');
      }
      const existente = await prisma.empleado.findFirst({ where: { telefono: data.telefono.trim(), NOT: { id } } });
      if (existente) throw new Error('Ya existe otro empleado con ese teléfono.');
    }
    
    const updateData: any = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre.trim();
    if (data.telefono !== undefined) updateData.telefono = data.telefono.trim();
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

  async delete(id: string) {
    const empleado = await prisma.empleado.update({
      where: { id },
      data: { activo: false },
    });
    return empleado;
  }

  async getEstadisticas(id: string) {
    const [totalCitas, totalIngresos] = await Promise.all([
      prisma.cita.count({
        where: { empleadoId: id, estado: 'COMPLETADA' },
      }),
      prisma.transaccion.aggregate({
        where: { empleadoId: id, tipo: 'INGRESO' },
        _sum: { total: true },
      }),
    ]);

    return {
      totalCitas,
      totalIngresos: totalIngresos._sum.total || 0,
    };
  }

  // 🔥 CORREGIDO: Lógica de verificación de disponibilidad
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
      return { disponible: false, motivo: 'El empleado no trabaja este día' };
    }

    // Verificar si está dentro del horario laboral
    const [horaInicio, minInicio] = horarioDia.inicio.split(':').map(Number);
    const [horaFin, minFin] = horarioDia.fin.split(':').map(Number);

    const minutosActuales = hora * 60 + minutos;
    const minutosInicio = horaInicio * 60 + minInicio;
    const minutosFin = horaFin * 60 + minFin;
    const minutosFinServicio = minutosActuales + duracionMinutos;

    if (minutosActuales < minutosInicio || minutosFinServicio > minutosFin) {
      return { 
        disponible: false, 
        motivo: `Fuera del horario laboral (${horarioDia.inicio} - ${horarioDia.fin})` 
      };
    }

    // 🔥 CORREGIDO: Verificar solapamiento de citas
    const inicioNuevaCita = fecha;
    const finNuevaCita = new Date(fecha.getTime() + duracionMinutos * 60000);

    // Buscar citas que se solapen con el nuevo horario
    const citasConflicto = await prisma.cita.findMany({
      where: {
        empleadoId,
        estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
        // Una cita se solapa si:
        // - Empieza antes de que termine la nueva Y termina después de que empiece la nueva
        AND: [
          { fechaHora: { lt: finNuevaCita } }, // La cita existente empieza antes de que termine la nueva
          { 
            // Calculamos cuándo termina la cita existente
            fechaHora: { 
              gte: new Date(inicioNuevaCita.getTime() - 2 * 60 * 60000) // Buscar en un rango razonable
            }
          }
        ]
      },
      select: {
        id: true,
        fechaHora: true,
        duracionMinutos: true,
      }
    });

    // Verificar manualmente si hay solapamiento real
    for (const cita of citasConflicto) {
      const inicioCitaExistente = cita.fechaHora;
      const finCitaExistente = new Date(cita.fechaHora.getTime() + cita.duracionMinutos * 60000);

      // Hay solapamiento si:
      // (inicio1 < fin2) AND (inicio2 < fin1)
      const haySolapamiento = (
        inicioNuevaCita < finCitaExistente && 
        inicioCitaExistente < finNuevaCita
      );

      if (haySolapamiento) {
        const horaExistente = inicioCitaExistente.toTimeString().substring(0, 5);
        return { 
          disponible: false, 
          motivo: `Ya tiene una cita a las ${horaExistente}` 
        };
      }
    }

    return { disponible: true };
  }
}

export const empleadosService = new EmpleadosService();