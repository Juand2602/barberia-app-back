// src/services/comisiones.service.ts

import prisma from '../config/database';
import { format } from 'date-fns';

export class ComisionesService {
  /**
   * Calcula las comisiones pendientes de un empleado en un periodo
   */
  async calcularComisionesPendientes(empleadoId: string, fechaInicio: Date, fechaFin: Date) {
    const empleado = await prisma.empleado.findUnique({
      where: { id: empleadoId },
    });

    if (!empleado) {
      throw new Error('Empleado no encontrado');
    }

    const transacciones = await prisma.transaccion.findMany({
      where: {
        empleadoId,
        tipo: 'INGRESO',
        estadoPago: 'PAGADO',
        fecha: {
          gte: fechaInicio,
          lte: fechaFin,
        },
      },
      include: {
        cliente: true,
        items: {
          include: {
            servicio: true,
          },
        },
      },
      orderBy: { fecha: 'asc' },
    });

    const totalVentas = transacciones.reduce((sum, t) => sum + t.total, 0);
    const montoComision = (totalVentas * empleado.porcentajeComision) / 100;

    return {
      empleado: {
        id: empleado.id,
        nombre: empleado.nombre,
        porcentajeComision: empleado.porcentajeComision,
      },
      periodo: {
        inicio: fechaInicio,
        fin: fechaFin,
      },
      totalVentas,
      montoComision,
      cantidadTransacciones: transacciones.length,
      transacciones: transacciones.map(t => ({
        id: t.id,
        fecha: t.fecha,
        total: t.total,
        metodoPago: t.metodoPago,
        cliente: t.cliente?.nombre || 'Sin cliente',
        items: t.items.map(item => ({
          servicio: item.servicio.nombre,
          cantidad: item.cantidad,
          precio: item.precioUnitario,
        })),
      })),
    };
  }

  /**
   * Registra el pago de comisión a un empleado
   */
  async registrarPago(data: {
    empleadoId: string;
    periodo: string;
    fechaInicio: Date;
    fechaFin: Date;
    metodoPago: 'EFECTIVO' | 'TRANSFERENCIA';
    referencia?: string;
    notas?: string;
    ajuste?: number;
  }) {
    const pagoExistente = await prisma.pagoComision.findUnique({
      where: {
        empleadoId_periodo: {
          empleadoId: data.empleadoId,
          periodo: data.periodo,
        },
      },
    });

    if (pagoExistente) {
      throw new Error('Ya existe un pago registrado para este periodo');
    }

    const calculo = await this.calcularComisionesPendientes(
      data.empleadoId,
      data.fechaInicio,
      data.fechaFin
    );

    const ajuste = data.ajuste || 0;
    const montoPagado = calculo.montoComision + ajuste;
    const transaccionIds = calculo.transacciones.map(t => t.id);

    const pago = await prisma.pagoComision.create({
      data: {
        empleadoId: data.empleadoId,
        periodo: data.periodo,
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
        totalVentas: calculo.totalVentas,
        porcentaje: calculo.empleado.porcentajeComision,
        montoComision: calculo.montoComision,
        montoPagado,
        diferencia: ajuste,
        metodoPago: data.metodoPago,
        referencia: data.referencia,
        notas: data.notas,
        transaccionIds: JSON.stringify(transaccionIds),
        cantidadTransacciones: calculo.cantidadTransacciones,
      },
      include: {
        empleado: true,
      },
    });

    return pago;
  }

  /**
   * Obtiene el historial de pagos de comisiones de un empleado
   */
  async obtenerHistorialPagos(empleadoId: string) {
    const pagos = await prisma.pagoComision.findMany({
      where: { empleadoId },
      include: {
        empleado: true,
      },
      orderBy: { fechaPago: 'desc' },
    });

    return pagos.map(pago => ({
      ...pago,
      transaccionIds: JSON.parse(pago.transaccionIds),
    }));
  }
}

export const comisionesService = new ComisionesService();