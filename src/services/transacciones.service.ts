// src/services/transacciones.service.ts - CON SELLOS AUTOMÁTICOS Y PAGO MIXTO

import prisma from '../config/database';
import { sellosService } from './sellos.service';

export class TransaccionesService {
  // Obtener todas las transacciones con filtros.
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
            empleado: true,
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
            empleado: true,
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
    if (
      data.metodoPago === "TRANSFERENCIA" &&
      data.referencia &&
      data.referencia.trim() === ""
    ) {
      data.referencia = null;
    }

    // Validar que si es egreso, tenga concepto
    if (data.tipo === 'EGRESO' && !data.concepto) {
      throw new Error('Los egresos requieren un concepto');
    }

    // ✅ NUEVO: Validación para pago mixto
    if (data.metodoPago === 'MIXTO') {
      if (!data.montoEfectivo || !data.montoTransferencia) {
        throw new Error('Para pago mixto se requieren montoEfectivo y montoTransferencia');
      }

      const suma = Number(data.montoEfectivo) + Number(data.montoTransferencia);
      if (Math.abs(suma - data.total) > 0.01) {
        throw new Error(
          `La suma de efectivo ($${data.montoEfectivo}) y transferencia ($${data.montoTransferencia}) debe ser igual al total ($${data.total})`
        );
      }
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
        // ✅ NUEVO: Guardar montos de pago mixto
        montoEfectivo: data.metodoPago === 'MIXTO' ? Number(data.montoEfectivo) : null,
        montoTransferencia: data.metodoPago === 'MIXTO' ? Number(data.montoTransferencia) : null,
        items: { create: itemsToCreate },
      },
      include: {
        cliente: true,
        empleado: true,
        cita: {
          include: {
            empleado: true,
          }
        },
        items: { include: { servicio: true } },
      },
    });

    // 🌟 ORIGINAL: Si es ingreso pagado y tiene cliente, agregar sello automáticamente
    if (
      transaccion.tipo === 'INGRESO' && 
      transaccion.estadoPago === 'PAGADO' && 
      transaccion.clienteId
    ) {
      try {
        const serviciosNombres = transaccion.items
          .map(item => item.servicio.nombre)
          .join(', ');

        await sellosService.agregarSellos({
          clienteId: transaccion.clienteId,
          cantidad: 1,
          motivo: `Servicio completado: ${serviciosNombres}`,
        });

        console.log(`✅ Sello agregado automáticamente al cliente ${transaccion.clienteId}`);
      } catch (error) {
        console.error('⚠️ Error agregando sello automático:', error);
        // No lanzamos el error para que no falle la transacción
      }
    }

    return transaccion;
  }

  // Actualizar una transacción
  async update(id: string, data: any) {
    await this.getById(id);

    // ✅ NUEVO: Validación para pago mixto en actualización
    if (data.metodoPago === 'MIXTO') {
      if (data.montoEfectivo !== undefined && data.montoTransferencia !== undefined) {
        const transaccionActual = await prisma.transaccion.findUnique({ where: { id } });
        const total = data.total !== undefined ? data.total : transaccionActual?.total || 0;
        
        const suma = Number(data.montoEfectivo) + Number(data.montoTransferencia);
        if (Math.abs(suma - total) > 0.01) {
          throw new Error('La suma de efectivo y transferencia debe ser igual al total');
        }
      }
    }

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
        // ✅ NUEVO: Actualizar montos de pago mixto
        ...(data.metodoPago === 'MIXTO' && data.montoEfectivo !== undefined && {
          montoEfectivo: Number(data.montoEfectivo),
        }),
        ...(data.metodoPago === 'MIXTO' && data.montoTransferencia !== undefined && {
          montoTransferencia: Number(data.montoTransferencia),
        }),
      },
      include: {
        cliente: true,
        empleado: true,
        cita: {
          include: {
            empleado: true,
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
      totalPagado,
      totalPendiente,
      totalTransacciones,
      totalTransaccionesPagadas,
      // ✅ CAMBIO: Ya no usamos aggregate para efectivo/transferencias porque hay pago mixto
      transaccionesPagadas,
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
        where: { ...where, estadoPago: 'PAGADO' }, 
        _sum: { total: true } 
      }),
      prisma.transaccion.aggregate({ 
        where: { ...where, estadoPago: 'PENDIENTE' }, 
        _sum: { total: true } 
      }),
      prisma.transaccion.count({ where }),
      prisma.transaccion.count({ where: wherePagado }),
      // ✅ NUEVO: Obtener todas las transacciones pagadas para calcular efectivo/transferencias
      prisma.transaccion.findMany({
        where: { ...wherePagado, tipo: 'INGRESO' },
        select: {
          metodoPago: true,
          total: true,
          montoEfectivo: true,
          montoTransferencia: true,
        },
      }),
    ]);

    // ✅ NUEVO: Calcular efectivo y transferencias considerando pago mixto
    let totalEfectivo = 0;
    let totalTransferencias = 0;

    transaccionesPagadas.forEach((t) => {
      if (t.metodoPago === 'EFECTIVO') {
        totalEfectivo += t.total;
      } else if (t.metodoPago === 'TRANSFERENCIA') {
        totalTransferencias += t.total;
      } else if (t.metodoPago === 'MIXTO') {
        // ✅ NUEVO: Sumar desglosado para pago mixto
        totalEfectivo += t.montoEfectivo || 0;
        totalTransferencias += t.montoTransferencia || 0;
      }
    });

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
      totalEfectivo, // ✅ Ahora incluye desglose de mixtos
      totalTransferencias, // ✅ Ahora incluye desglose de mixtos
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
   * 🌟 ACTUALIZADO: Ahora también agrega sello automáticamente y soporta pago mixto
   */
  async marcarComoPagada(transaccionId: string, datos: {
    metodoPago: 'EFECTIVO' | 'TRANSFERENCIA' | 'MIXTO'; // ✅ NUEVO: Agregar MIXTO
    referencia?: string;
    montoEfectivo?: number;      // ✅ NUEVO
    montoTransferencia?: number; // ✅ NUEVO
  }) {
    try {
      const transaccion = await this.getById(transaccionId);

      if (transaccion.estadoPago === 'PAGADO') {
        throw new Error('La transacción ya está marcada como pagada');
      }

      // ✅ NUEVO: Validación para pago mixto
      if (datos.metodoPago === 'MIXTO') {
        if (!datos.montoEfectivo || !datos.montoTransferencia) {
          throw new Error('Para pago mixto se requieren montoEfectivo y montoTransferencia');
        }

        const suma = Number(datos.montoEfectivo) + Number(datos.montoTransferencia);
        if (Math.abs(suma - transaccion.total) > 0.01) {
          throw new Error(
            `La suma de efectivo ($${datos.montoEfectivo}) y transferencia ($${datos.montoTransferencia}) debe ser igual al total ($${transaccion.total})`
          );
        }
      }

      // Actualizar transacción
      const transaccionActualizada = await this.update(transaccionId, {
        estadoPago: 'PAGADO',
        metodoPago: datos.metodoPago,
        referencia: datos.referencia || null,
        // ✅ NUEVO: Actualizar montos de pago mixto
        ...(datos.metodoPago === 'MIXTO' && {
          montoEfectivo: datos.montoEfectivo,
          montoTransferencia: datos.montoTransferencia,
        }),
      });

      // Actualizar cita si existe
      if (transaccion.citaId) {
        await prisma.cita.update({
          where: { id: transaccion.citaId },
          data: { estado: 'COMPLETADA' },
        });

        console.log(`✅ Cita ${transaccion.citaId} marcada como COMPLETADA`);
      }

      // 🌟 ORIGINAL: Agregar sello automáticamente si tiene cliente
      if (transaccion.clienteId) {
        try {
          const serviciosNombres = transaccion.items
            .map(item => item.servicio.nombre)
            .join(', ');

          await sellosService.agregarSellos({
            clienteId: transaccion.clienteId,
            cantidad: 1,
            motivo: `Servicio completado: ${serviciosNombres}`,
          });

          console.log(`🎁 Sello agregado automáticamente al cliente ${transaccion.clienteId}`);
        } catch (error) {
          console.error('⚠️ Error agregando sello automático:', error);
          // No lanzamos el error para que no falle el pago
        }
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
            empleado: true,
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