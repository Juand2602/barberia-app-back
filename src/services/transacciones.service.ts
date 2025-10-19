// src/services/transacciones.service.ts (Nuevo Backend - CORREGIDO)

import { PrismaClient } from '@prisma/client';
import { CitasService } from './citas.service';
import { ServiciosService } from './servicios.service';

const prisma = new PrismaClient();
const citasService = new CitasService();
const serviciosService = new ServiciosService();

export class TransaccionesService {
  // Obtener todas las transacciones con filtros
  async getAll(filters?: {
    fechaInicio?: Date;
    fechaFin?: Date;
    tipo?: string;
    metodoPago?: string;
    empleadoId?: string;
    clienteId?: string;
  }) {
    const where: any = {};

    if (filters) {
      if (filters.fechaInicio || filters.fechaFin) {
        where.fecha = {};
        if (filters.fechaInicio) {
          where.fecha.gte = filters.fechaInicio;
        }
        if (filters.fechaFin) {
          where.fecha.lte = filters.fechaFin;
        }
      }

      if (filters.tipo) {
        where.tipo = filters.tipo;
      }

      if (filters.metodoPago) {
        where.metodoPago = filters.metodoPago;
      }

      if (filters.empleadoId) {
        where.empleadoId = filters.empleadoId;
      }

      if (filters.clienteId) {
        where.clienteId = filters.clienteId;
      }
    }

    const transacciones = await prisma.transaccion.findMany({
      where,
      include: {
        cliente: true,
        empleado: true,
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

  // Obtener transacciones por fecha
  async getByFecha(fecha: Date) {
    const inicioDia = new Date(fecha);
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date(fecha);
    finDia.setHours(23, 59, 59, 999);

    return this.getAll({
      fechaInicio: inicioDia,
      fechaFin: finDia,
    });
  }

  // Obtener una transacción por ID
  async getById(id: string) {
    const transaccion = await prisma.transaccion.findUnique({
      where: { id },
      include: {
        cliente: true,
        empleado: true,
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

    // Validar que el total coincida con la suma de items
    const totalCalculado = Array.isArray(data.items)
      ? data.items.reduce((sum: number, item: any) => sum + Number(item.subtotal || 0), 0)
      : 0;

    if (Array.isArray(data.items) && data.items.length > 0) {
      if (Math.abs(totalCalculado - Number(data.total)) > 0.01) {
        throw new Error('El total no coincide con la suma de los items');
      }
    }

    // Preparar items para crear con la estructura que Prisma espera
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

    // Crear la transacción con sus items
    const transaccion = await prisma.transaccion.create({
      data: {
        tipo: data.tipo,
        clienteId: data.clienteId || null,
        empleadoId: data.empleadoId || null,
        fecha: data.fecha ? new Date(data.fecha) : new Date(),
        total: data.total,
        metodoPago: data.metodoPago,
        referencia: data.referencia || null,
        concepto: data.concepto || null,
        categoria: data.categoria || null,
        notas: data.notas || null,
        items: { create: itemsToCreate },
      },
      include: {
        cliente: true,
        empleado: true,
        items: { include: { servicio: true } },
      },
    });

    return transaccion;
  }

  // Actualizar una transacción
  async update(id: string, data: any) {
    await this.getById(id); // Verificar que existe

    const transaccion = await prisma.transaccion.update({
      where: { id },
      data: {
        ...(data.tipo && { tipo: data.tipo }),
        ...(data.clienteId !== undefined && { clienteId: data.clienteId }),
        ...(data.empleadoId !== undefined && { empleadoId: data.empleadoId }),
        ...(data.fecha && { fecha: new Date(data.fecha) }),
        ...(data.total && { total: data.total }),
        ...(data.metodoPago && { metodoPago: data.metodoPago }),
        ...(data.referencia !== undefined && { referencia: data.referencia }),
        ...(data.concepto !== undefined && { concepto: data.concepto }),
        ...(data.categoria !== undefined && { categoria: data.categoria }),
        ...(data.notas !== undefined && { notas: data.notas }),
      },
      include: {
        cliente: true,
        empleado: true,
        items: { include: { servicio: true } },
      },
    });

    return transaccion;
  }

  // Eliminar una transacción
  async delete(id: string) {
    await this.getById(id); // Verificar que existe
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

    const [
      totalIngresos,
      totalEgresos,
      totalEfectivo,
      totalTransferencias,
      totalTransacciones,
    ] = await Promise.all([
      prisma.transaccion.aggregate({ where: { ...where, tipo: 'INGRESO' }, _sum: { total: true }, _count: true }),
      prisma.transaccion.aggregate({ where: { ...where, tipo: 'EGRESO' }, _sum: { total: true }, _count: true }),
      prisma.transaccion.aggregate({ where: { ...where, metodoPago: 'EFECTIVO' }, _sum: { total: true } }),
      prisma.transaccion.aggregate({ where: { ...where, metodoPago: 'TRANSFERENCIA' }, _sum: { total: true } }),
      prisma.transaccion.count({ where }),
    ]);

    const ingresos = totalIngresos._sum.total || 0;
    const egresos = totalEgresos._sum.total || 0;
    const balance = ingresos - egresos;

    return {
      totalTransacciones,
      cantidadIngresos: totalIngresos._count,
      cantidadEgresos: totalEgresos._count,
      totalIngresos: ingresos,
      totalEgresos: egresos,
      balance,
      totalEfectivo: totalEfectivo._sum.total || 0,
      totalTransferencias: totalTransferencias._sum.total || 0,
    };
  }

  // Obtener servicios más vendidos
  async getServiciosMasVendidos(limite: number = 10, fechaInicio?: Date, fechaFin?: Date) {
    const where: any = { tipo: 'INGRESO' };
    if (fechaInicio || fechaFin) {
      where.fecha = {};
      if (fechaInicio) where.fecha.gte = fechaInicio;
      if (fechaFin) where.fecha.lte = fechaFin;
    }

    const items = await prisma.transaccionItem.findMany({
      where: { transaccion: where },
      include: { servicio: true },
    });

    const serviciosMap = new Map();
    items.forEach(item => {
      const key = item.servicioId;
      if (serviciosMap.has(key)) {
        const existing = serviciosMap.get(key);
        existing.cantidad += item.cantidad;
        existing.total += item.subtotal;
      } else {
        serviciosMap.set(key, {
          servicioId: item.servicioId,
          nombre: item.servicio.nombre,
          cantidad: item.cantidad,
          total: item.subtotal,
        });
      }
    });

    return Array.from(serviciosMap.values())
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, limite);
  }

  // Obtener ingresos por empleado
  async getIngresosPorEmpleado(fechaInicio?: Date, fechaFin?: Date) {
    const where: any = { tipo: 'INGRESO', empleadoId: { not: null } };
    if (fechaInicio || fechaFin) {
      where.fecha = {};
      if (fechaInicio) where.fecha.gte = fechaInicio;
      if (fechaFin) where.fecha.lte = fechaFin;
    }

    const transacciones = await prisma.transaccion.findMany({
      where,
      include: { empleado: true },
    });

    const empleadosMap = new Map();
    transacciones.forEach(trans => {
      if (!trans.empleadoId || !trans.empleado) return;
      const key = trans.empleadoId;
      if (empleadosMap.has(key)) {
        const existing = empleadosMap.get(key);
        existing.totalTransacciones += 1;
        existing.totalIngresos += trans.total;
      } else {
        empleadosMap.set(key, {
          empleadoId: trans.empleadoId,
          nombre: trans.empleado.nombre,
          totalTransacciones: 1,
          totalIngresos: trans.total,
        });
      }
    });

    return Array.from(empleadosMap.values())
      .sort((a, b) => b.totalIngresos - a.totalIngresos);
  }

  // --- MÉTODO AUXILIAR PARA EL BOT DE WHATSAPP ---
  async registrarVentaDesdeCita(citaId: string) {
    const cita = await citasService.getById(citaId);
    if (!cita) throw new Error('Cita no encontrada');
    if (cita.estado !== 'COMPLETADA') throw new Error('Solo se pueden registrar ventas de citas completadas');

    // Línea CORREGIDA Y TIPEADA
  // Línea CORREGIDA
  const servicios = await serviciosService.listarTodos();
  const servicio = servicios.find((ser: any) => ser.nombre === cita.servicioNombre);
    if (!servicio) throw new Error(`Servicio "${cita.servicioNombre}" no encontrado`);

    return this.create({
      tipo: 'INGRESO',
      clienteId: cita.clienteId,
      empleadoId: cita.empleadoId,
      fecha: cita.fechaHora.toISOString(),
      total: servicio.precio,
      metodoPago: 'EFECTIVO',
      notas: `Generado automáticamente desde cita ${citaId}`,
      items: [{ servicioId: servicio.id, cantidad: 1, precioUnitario: servicio.precio, subtotal: servicio.precio }],
    });
  }
}

export const transaccionesService = new TransaccionesService();