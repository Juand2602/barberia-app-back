// src/services/transacciones.service.ts - MEJORADO CON EMPLEADO DE CITA

import prisma from '../config/database';

export class TransaccionesService {
  // Obtener todas las transacciones con filtros
  async getAll(filters?: {
    fechaInicio?: Date;
    fechaFin?: Date;
    tipo?: string;
    metodoPago?: string;
    estadoPago?: string;
    empleadoId?: string;
    clienteId?: string;
    citaId?: string;
  }) {
    const where: any = {};

    if (filters) {
      if (filters.fechaInicio || filters.fechaFin) {
        where.fecha = {};
        if (filters.fechaInicio) where.fecha.gte = filters.fechaInicio;
        if (filters.fechaFin) where.fecha.lte = filters.fechaFin;
      }

      if (filters.tipo) where.tipo = filters.tipo;
      if (filters.metodoPago) where.metodoPago = filters.metodoPago;
      if (filters.estadoPago) where.estadoPago = filters.estadoPago;
      if (filters.empleadoId) where.empleadoId = filters.empleadoId;
      if (filters.clienteId) where.clienteId = filters.clienteId;
      if (filters.citaId) where.citaId = filters.citaId;
    }

    const transacciones = await prisma.transaccion.findMany({
      where,
      include: {
        cliente: true,
        empleado: true,
        cita: {
          include: {
            empleado: true, // ← IMPORTANTE: Incluir empleado de la cita
          }
        },
        items: {
          include: {
            servicio: true,
          },
        },
      },
      orderBy: { fecha: 'desc' },
    });

    return transacciones;
  }

  // Obtener una transacción por ID
  async getById(id: string) {
    const transaccion = await prisma.transaccion.findUnique({
      where: { id },
      include: {
        cliente: true,
        empleado: true,
        cita: {
          include: {
            empleado: true, // ← IMPORTANTE: Incluir empleado de la cita
          }
        },
        items: {
          include: {
            servicio: true,
          },
        },
      },
    });

    if (!transaccion) {
      throw new Error('Transacción no encontrada');
    }

    return transaccion;
  }

  // Crear una nueva transacción
  async create(data: any) {
    // Validar que si es transferencia, tenga referencia
    if (data.metodoPago === 'TRANSFERENCIA' && !data.referencia) {
      throw new Error('Las transferencias requieren número de referencia');
    }

    // Validar que si es egreso, tenga concepto
    if (data.tipo === 'EGRESO' && !data.concepto) {
      throw new Error('Los egresos requieren un concepto');
    }

    // Preparar items
    const itemsToCreate =
      Array.isArray(data.items) && data.items.length > 0
        ? data.items.map((it: any) => {
            if (!it.servicioId) {
              throw new Error('Cada item debe tener un servicioId válido');
            }
            return {
              servicio: { connect: { id: it.servicioId } },
              cantidad: it.cantidad,
              precioUnitario: it.precioUnitario,
              subtotal: it.subtotal,
            };
          })
        : [];

    // Determinar el estado de pago automáticamente
    let estadoPago = data.estadoPago || 'PENDIENTE';
    
    if (data.tipo === 'EGRESO') {
      estadoPago = 'PAGADO';
    } else if (data.tipo === 'INGRESO' && !data.citaId) {
      estadoPago = 'PAGADO';
    }

    // Crear la transacción
    const transaccion = await prisma.transaccion.create({
      data: {
        tipo: data.tipo,
        clienteId: data.clienteId || null,
        empleadoId: data.empleadoId || null,
        citaId: data.citaId || null,
        fecha: data.fecha ? new Date(data.fecha) : new Date(),
        total: data.total,
        metodoPago: data.metodoPago,
        estadoPago: estadoPago,
        referencia: data.referencia || null,
        concepto: data.concepto || null,
        categoria: data.categoria || null,
        notas: data.notas || null,
        items: { create: itemsToCreate },
      },
      include: {
        cliente: true,
        empleado: true,
        cita: {
          include: {
            empleado: true, // ← Incluir empleado de la cita
          }
        },
        items: { include: { servicio: true } },
      },
    });

    return transaccion;
  }

  // Actualizar una transacción
  async update(id: string, data: any) {
    await this.getById(id);

    const transaccion = await prisma.transaccion.update({
      where: { id },
      data: {
        ...(data.tipo && { tipo: data.tipo }),
        ...(data.clienteId !== undefined && { clienteId: data.clienteId }),
        ...(data.empleadoId !== undefined && { empleadoId: data.empleadoId }),
        ...(data.citaId !== undefined && { citaId: data.citaId }),
        ...(data.fecha && { fecha: new Date(data.fecha) }),
        ...(data.total !== undefined && { total: data.total }),
        ...(data.metodoPago && { metodoPago: data.metodoPago }),
        ...(data.estadoPago && { estadoPago: data.estadoPago }),
        ...(data.referencia !== undefined && { referencia: data.referencia }),
        ...(data.concepto !== undefined && { concepto: data.concepto }),
        ...(data.categoria !== undefined && { categoria: data.categoria }),
        ...(data.notas !== undefined && { notas: data.notas }),
      },
      include: {
        cliente: true,
        empleado: true,
        cita: {
          include: {
            empleado: true, // ← Incluir empleado de la cita
          }
        },
        items: { include: { servicio: true } },
      },
    });

    return transaccion;
  }

  // Eliminar una transacción
  async delete(id: string) {
    await this.getById(id);
    await prisma.transaccion.delete({ where: { id } });
  }

  // Obtener estadísticas de transacciones
  async getEstadisticas(fechaInicio?: Date, fechaFin?: Date) {
    const where: any = {};
    if (fechaInicio || fechaFin) {
      where.fecha = {};
      if (fechaInicio) where.fecha.gte = fechaInicio;
      if (fechaFin) where.fecha.lte = fechaFin;
    }

    const wherePagado = { ...where, estadoPago: 'PAGADO' };

    const [
      totalIngresos,
      totalEgresos,
      totalEfectivo,
      totalTransferencias,
      totalPagado,
      totalPendiente,
      totalTransacciones,
      totalTransaccionesPagadas,
    ] = await Promise.all([
      prisma.transaccion.aggregate({ 
        where: { ...wherePagado, tipo: 'INGRESO' }, 
        _sum: { total: true }, 
        _count: true 
      }),
      prisma.transaccion.aggregate({ 
        where: { ...wherePagado, tipo: 'EGRESO' }, 
        _sum: { total: true }, 
        _count: true 
      }),
      prisma.transaccion.aggregate({ 
        where: { ...wherePagado, metodoPago: 'EFECTIVO' }, 
        _sum: { total: true } 
      }),
      prisma.transaccion.aggregate({ 
        where: { ...wherePagado, metodoPago: 'TRANSFERENCIA' }, 
        _sum: { total: true } 
      }),
      prisma.transaccion.aggregate({ 
        where: { ...where, estadoPago: 'PAGADO' }, 
        _sum: { total: true } 
      }),
      prisma.transaccion.aggregate({ 
        where: { ...where, estadoPago: 'PENDIENTE' }, 
        _sum: { total: true } 
      }),
      prisma.transaccion.count({ where }),
      prisma.transaccion.count({ where: wherePagado }),
    ]);

    const ingresos = totalIngresos._sum.total || 0;
    const egresos = totalEgresos._sum.total || 0;
    const balance = ingresos - egresos;

    return {
      totalTransacciones,
      totalTransaccionesPagadas,
      cantidadIngresos: totalIngresos._count,
      cantidadEgresos: totalEgresos._count,
      totalIngresos: ingresos,
      totalEgresos: egresos,
      balance,
      totalEfectivo: totalEfectivo._sum.total || 0,
      totalTransferencias: totalTransferencias._sum.total || 0,
      totalPagado: totalPagado._sum.total || 0,
      totalPendiente: totalPendiente._sum.total || 0,
    };
  }

  /**
   * Crea una transacción pendiente automáticamente al crear una cita
   */
  async crearTransaccionDesdeCita(citaData: {
    citaId: string;
    clienteId: string;
    empleadoId: string;
    servicioId: string;
    servicioNombre: string;
    precio: number;
    fecha: Date;
  }) {
    try {
      const transaccion = await this.create({
        tipo: 'INGRESO',
        clienteId: citaData.clienteId,
        empleadoId: citaData.empleadoId,
        citaId: citaData.citaId,
        fecha: citaData.fecha,
        total: citaData.precio,
        metodoPago: 'PENDIENTE',
        estadoPago: 'PENDIENTE',
        concepto: `Cita: ${citaData.servicioNombre}`,
        notas: 'Transacción creada automáticamente desde cita de WhatsApp',
        items: [
          {
            servicioId: citaData.servicioId,
            cantidad: 1,
            precioUnitario: citaData.precio,
            subtotal: citaData.precio,
          },
        ],
      });

      console.log(`✅ Transacción pendiente creada para cita ${citaData.citaId}`);
      return transaccion;
    } catch (error) {
      console.error('Error creando transacción desde cita:', error);
      throw error;
    }
  }

  /**
   * Marca una transacción como pagada y actualiza la cita a COMPLETADA
   */
  async marcarComoPagada(transaccionId: string, datos: {
    metodoPago: 'EFECTIVO' | 'TRANSFERENCIA';
    referencia?: string;
  }) {
    try {
      const transaccion = await this.getById(transaccionId);

      if (transaccion.estadoPago === 'PAGADO') {
        throw new Error('La transacción ya está marcada como pagada');
      }

      const transaccionActualizada = await this.update(transaccionId, {
        estadoPago: 'PAGADO',
        metodoPago: datos.metodoPago,
        referencia: datos.referencia || null,
      });

      if (transaccion.citaId) {
        await prisma.cita.update({
          where: { id: transaccion.citaId },
          data: { estado: 'COMPLETADA' },
        });

        console.log(`✅ Cita ${transaccion.citaId} marcada como COMPLETADA`);
      }

      console.log(`✅ Transacción ${transaccionId} marcada como PAGADA`);
      return transaccionActualizada;
    } catch (error) {
      console.error('Error marcando transacción como pagada:', error);
      throw error;
    }
  }

  /**
   * Obtiene la transacción asociada a una cita
   */
  async obtenerPorCitaId(citaId: string) {
    return prisma.transaccion.findFirst({
      where: { citaId },
      include: {
        cliente: true,
        empleado: true,
        cita: {
          include: {
            empleado: true, // ← Incluir empleado de la cita
          }
        },
        items: {
          include: {
            servicio: true,
          },
        },
      },
    });
  }

  /**
   * Obtiene todas las transacciones pendientes
   */
  async obtenerPendientes() {
    return this.getAll({ estadoPago: 'PENDIENTE' });
  }
}

export const transaccionesService = new TransaccionesService();