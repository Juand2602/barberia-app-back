// src/services/reportes.service.ts

import prisma from '../config/database';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export class ReportesService {
  // ==================== DASHBOARD GENERAL ====================
  async getDashboard(fechaInicio?: Date, fechaFin?: Date) {
    const inicio = fechaInicio ? startOfDay(fechaInicio) : startOfMonth(new Date());
    const fin = fechaFin ? endOfDay(fechaFin) : endOfMonth(new Date());

    const [
      ventasTotales,
      citasTotales,
      clientesNuevos,
      serviciosMasVendidos,
      empleadoTop,
      comparativaAnterior
    ] = await Promise.all([
      this.getVentasTotales(inicio, fin),
      this.getCitasTotales(inicio, fin),
      this.getClientesNuevos(inicio, fin),
      this.getServiciosMasVendidos(inicio, fin, 5),
      this.getEmpleadoTop(inicio, fin),
      this.getComparativaAnterior(inicio, fin)
    ]);

    return {
      periodo: { inicio, fin },
      ventas: ventasTotales,
      citas: citasTotales,
      clientes: clientesNuevos,
      serviciosMasVendidos,
      empleadoTop,
      comparativa: comparativaAnterior
    };
  }

  // ==================== REPORTES DE VENTAS ====================
  async getReporteVentas(fechaInicio: Date, fechaFin: Date) {
    const inicio = startOfDay(fechaInicio);
    const fin = endOfDay(fechaFin);

    // ✅ FILTRAR SOLO TRANSACCIONES PAGADAS
    const transacciones = await prisma.transaccion.findMany({
      where: { 
        tipo: 'INGRESO', 
        estadoPago: 'PAGADO',  // ✅ CRÍTICO: Solo transacciones pagadas
        fecha: { gte: inicio, lte: fin } 
      },
      include: { 
        items: { include: { servicio: true } }, 
        cliente: true, 
        empleado: true 
      },
      orderBy: { fecha: 'desc' }
    });

    const totalIngresos = transacciones.reduce((sum, t) => sum + t.total, 0);
    const promedioVenta = transacciones.length > 0 ? totalIngresos / transacciones.length : 0;

    const porMetodoPago = transacciones.reduce((acc, t) => {
      if (!acc[t.metodoPago]) acc[t.metodoPago] = { cantidad: 0, total: 0 };
      acc[t.metodoPago].cantidad++; 
      acc[t.metodoPago].total += t.total;
      return acc;
    }, {} as Record<string, { cantidad: number; total: number }>);

    const porDia = transacciones.reduce((acc, t) => {
      const fecha = startOfDay(t.fecha).toISOString();
      if (!acc[fecha]) acc[fecha] = { fecha, cantidad: 0, total: 0 };
      acc[fecha].cantidad++; 
      acc[fecha].total += t.total;
      return acc;
    }, {} as Record<string, { fecha: string; cantidad: number; total: number }>);

    return {
      periodo: { inicio, fin },
      resumen: { 
        totalIngresos, 
        cantidadVentas: transacciones.length, 
        promedioVenta, 
        porMetodoPago 
      },
      ventasPorDia: Object.values(porDia).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()),
      transacciones: transacciones.map(t => ({
        id: t.id, 
        fecha: t.fecha, 
        cliente: t.cliente?.nombre || 'Sin cliente',
        empleado: t.empleado?.nombre || 'Sin empleado',
        servicios: t.items.map(i => i.servicio.nombre).join(', '), 
        metodoPago: t.metodoPago,
        estadoPago: t.estadoPago,  // ✅ INCLUIR estadoPago
        total: t.total
      }))
    };
  }

  async getReporteVentasPorEmpleado(fechaInicio: Date, fechaFin: Date) {
    const inicio = startOfDay(fechaInicio); 
    const fin = endOfDay(fechaFin);
    
    // ✅ FILTRAR SOLO TRANSACCIONES PAGADAS
    const transacciones = await prisma.transaccion.findMany({
      where: { 
        tipo: 'INGRESO', 
        estadoPago: 'PAGADO',  // ✅ CRÍTICO
        fecha: { gte: inicio, lte: fin }, 
        empleadoId: { not: null } 
      },
      include: { empleado: true, items: { include: { servicio: true } } }
    });

    const porEmpleado = transacciones.reduce((acc, t) => {
      const empleadoId = t.empleadoId!; 
      const empleadoNombre = t.empleado!.nombre;
      if (!acc[empleadoId]) {
        acc[empleadoId] = { 
          empleadoId, 
          nombre: empleadoNombre, 
          cantidadVentas: 0, 
          totalVentas: 0, 
          servicios: {} as Record<string, number> 
        };
      }
      acc[empleadoId].cantidadVentas++; 
      acc[empleadoId].totalVentas += t.total;
      t.items.forEach(item => { 
        const servicio = item.servicio.nombre; 
        acc[empleadoId].servicios[servicio] = (acc[empleadoId].servicios[servicio] || 0) + item.cantidad; 
      });
      return acc;
    }, {} as Record<string, any>);

    return { 
      periodo: { inicio, fin }, 
      empleados: Object.values(porEmpleado).sort((a: any, b: any) => b.totalVentas - a.totalVentas) 
    };
  }

  async getReporteVentasPorServicio(fechaInicio: Date, fechaFin: Date) {
    const inicio = startOfDay(fechaInicio); 
    const fin = endOfDay(fechaFin);
    
    // ✅ FILTRAR SOLO ITEMS DE TRANSACCIONES PAGADAS
    const items = await prisma.transaccionItem.findMany({
      where: { 
        transaccion: { 
          tipo: 'INGRESO', 
          estadoPago: 'PAGADO',  // ✅ CRÍTICO
          fecha: { gte: inicio, lte: fin } 
        } 
      },
      include: { servicio: true }
    });

    const porServicio = items.reduce((acc, item) => {
      const servicioId = item.servicioId; 
      const servicioNombre = item.servicio.nombre;
      if (!acc[servicioId]) {
        acc[servicioId] = { 
          servicioId, 
          nombre: servicioNombre, 
          cantidadVendida: 0, 
          totalGenerado: 0 
        };
      }
      acc[servicioId].cantidadVendida += item.cantidad; 
      acc[servicioId].totalGenerado += item.subtotal;
      return acc;
    }, {} as Record<string, any>);

    return { 
      periodo: { inicio, fin }, 
      servicios: Object.values(porServicio).sort((a: any, b: any) => b.totalGenerado - a.totalGenerado) 
    };
  }

  // ==================== REPORTES DE CITAS ====================
  async getReporteCitas(fechaInicio: Date, fechaFin: Date) {
    const inicio = startOfDay(fechaInicio); 
    const fin = endOfDay(fechaFin);
    
    const citas = await prisma.cita.findMany({ 
      where: { fechaHora: { gte: inicio, lte: fin } }, 
      include: { cliente: true, empleado: true } 
    });

    const totalCitas = citas.length;
    const porEstado = citas.reduce((acc, c) => { 
      acc[c.estado] = (acc[c.estado] || 0) + 1; 
      return acc; 
    }, {} as Record<string, number>);

    const tasaCancelacion = totalCitas > 0 ? ((porEstado['CANCELADA'] || 0) / totalCitas) * 100 : 0;
    const tasaCompletadas = totalCitas > 0 ? ((porEstado['COMPLETADA'] || 0) / totalCitas) * 100 : 0;

    const porDia = citas.reduce((acc, c) => {
      const fecha = startOfDay(c.fechaHora).toISOString();
      if (!acc[fecha]) {
        acc[fecha] = { fecha, total: 0, completadas: 0, canceladas: 0, pendientes: 0 };
      }
      acc[fecha].total++; 
      if (c.estado === 'COMPLETADA') acc[fecha].completadas++; 
      if (c.estado === 'CANCELADA') acc[fecha].canceladas++;
      if (c.estado === 'PENDIENTE' || c.estado === 'CONFIRMADA') acc[fecha].pendientes++;
      return acc;
    }, {} as Record<string, any>);

    const porEmpleado = citas.reduce((acc, c) => {
      const empleadoId = c.empleadoId; 
      const empleadoNombre = c.empleado.nombre;
      if (!acc[empleadoId]) {
        acc[empleadoId] = { 
          empleadoId, 
          nombre: empleadoNombre, 
          totalCitas: 0, 
          completadas: 0, 
          canceladas: 0 
        };
      }
      acc[empleadoId].totalCitas++; 
      if (c.estado === 'COMPLETADA') acc[empleadoId].completadas++; 
      if (c.estado === 'CANCELADA') acc[empleadoId].canceladas++;
      return acc;
    }, {} as Record<string, any>);

    return { 
      periodo: { inicio, fin }, 
      resumen: { totalCitas, porEstado, tasaCancelacion, tasaCompletadas }, 
      citasPorDia: Object.values(porDia).sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()), 
      ocupacionPorEmpleado: Object.values(porEmpleado) 
    };
  }

  // ==================== REPORTES FINANCIEROS ====================
  async getReporteFinanciero(fechaInicio: Date, fechaFin: Date) {
    const inicio = startOfDay(fechaInicio); 
    const fin = endOfDay(fechaFin);
    
    // ✅ FILTRAR SOLO TRANSACCIONES PAGADAS PARA INGRESOS
    const [ingresos, egresos] = await Promise.all([
      prisma.transaccion.findMany({ 
        where: { 
          tipo: 'INGRESO', 
          estadoPago: 'PAGADO',  // ✅ CRÍTICO
          fecha: { gte: inicio, lte: fin } 
        } 
      }),
      prisma.transaccion.findMany({ 
        where: { 
          tipo: 'EGRESO', 
          fecha: { gte: inicio, lte: fin } 
        } 
      })
    ]);

    const totalIngresos = ingresos.reduce((sum, t) => sum + t.total, 0);
    const totalEgresos = egresos.reduce((sum, t) => sum + t.total, 0);
    const utilidad = totalIngresos - totalEgresos;
    const margenUtilidad = totalIngresos > 0 ? (utilidad / totalIngresos) * 100 : 0;

    const ingresosPorMetodo = ingresos.reduce((acc, t) => { 
      acc[t.metodoPago] = (acc[t.metodoPago] || 0) + t.total; 
      return acc; 
    }, {} as Record<string, number>);

    const egresosPorCategoria = egresos.reduce((acc, t) => { 
      const categoria = t.categoria || 'Sin categoría'; 
      acc[categoria] = (acc[categoria] || 0) + t.total; 
      return acc; 
    }, {} as Record<string, number>);

    const flujosDiarios = [...ingresos, ...egresos].reduce((acc, t) => {
      const fecha = startOfDay(t.fecha).toISOString();
      if (!acc[fecha]) acc[fecha] = { fecha, ingresos: 0, egresos: 0, neto: 0 };
      if (t.tipo === 'INGRESO') acc[fecha].ingresos += t.total; 
      else acc[fecha].egresos += t.total;
      acc[fecha].neto = acc[fecha].ingresos - acc[fecha].egresos; 
      return acc;
    }, {} as Record<string, any>);

    return { 
      periodo: { inicio, fin }, 
      resumen: { totalIngresos, totalEgresos, utilidad, margenUtilidad }, 
      ingresosPorMetodo, 
      egresosPorCategoria, 
      flujoDiario: Object.values(flujosDiarios).sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()) 
    };
  }

  // ==================== REPORTES DE CLIENTES ====================
  async getReporteClientes(fechaInicio: Date, fechaFin: Date) {
    const inicio = startOfDay(fechaInicio); 
    const fin = endOfDay(fechaFin);
    
    // ✅ FILTRAR SOLO TRANSACCIONES PAGADAS
    const [clientesNuevos, transacciones, citas] = await Promise.all([
      prisma.cliente.findMany({ 
        where: { fechaRegistro: { gte: inicio, lte: fin } } 
      }),
      prisma.transaccion.findMany({ 
        where: { 
          tipo: 'INGRESO', 
          estadoPago: 'PAGADO',  // ✅ CRÍTICO
          fecha: { gte: inicio, lte: fin }, 
          clienteId: { not: null } 
        }, 
        include: { cliente: true } 
      }),
      prisma.cita.findMany({ 
        where: { fechaHora: { gte: inicio, lte: fin } }, 
        include: { cliente: true } 
      })
    ]);

    const frecuenciaVisitas = citas.reduce((acc, c) => {
      const clienteId = c.clienteId; 
      const clienteNombre = c.cliente.nombre;
      if (!acc[clienteId]) {
        acc[clienteId] = { clienteId, nombre: clienteNombre, visitas: 0 };
      }
      acc[clienteId].visitas++; 
      return acc;
    }, {} as Record<string, any>);

    const gastoPorCliente = transacciones.reduce((acc, t) => {
      const clienteId = t.clienteId!; 
      const clienteNombre = t.cliente!.nombre;
      if (!acc[clienteId]) {
        acc[clienteId] = { 
          clienteId, 
          nombre: clienteNombre, 
          totalGastado: 0, 
          cantidadCompras: 0 
        };
      }
      acc[clienteId].totalGastado += t.total; 
      acc[clienteId].cantidadCompras++; 
      return acc;
    }, {} as Record<string, any>);

    const topClientes = Object.values(gastoPorCliente)
      .sort((a: any, b: any) => b.totalGastado - a.totalGastado)
      .slice(0, 10);
    
    const clientesFrecuentes = Object.values(frecuenciaVisitas)
      .sort((a: any, b: any) => b.visitas - a.visitas)
      .slice(0, 10);

    return {
      periodo: { inicio, fin }, 
      resumen: {
        clientesNuevos: clientesNuevos.length, 
        clientesActivos: Object.keys(frecuenciaVisitas).length,
        ticketPromedio: transacciones.length > 0 
          ? transacciones.reduce((sum, t) => sum + t.total, 0) / transacciones.length 
          : 0
      }, 
      topClientes, 
      clientesFrecuentes,
      nuevosClientes: clientesNuevos.map(c => ({ 
        id: c.id, 
        nombre: c.nombre, 
        telefono: c.telefono, 
        fechaRegistro: c.fechaRegistro 
      }))
    };
  }

  // ==================== MÉTODOS AUXILIARES ====================
  private async getVentasTotales(inicio: Date, fin: Date) {
    // ✅ FILTRAR SOLO TRANSACCIONES PAGADAS
    const transacciones = await prisma.transaccion.findMany({ 
      where: { 
        tipo: 'INGRESO', 
        estadoPago: 'PAGADO',  // ✅ CRÍTICO
        fecha: { gte: inicio, lte: fin } 
      } 
    });
    return { 
      total: transacciones.reduce((sum, t) => sum + t.total, 0), 
      cantidad: transacciones.length 
    };
  }

  private async getCitasTotales(inicio: Date, fin: Date) {
    const citas = await prisma.cita.findMany({ 
      where: { fechaHora: { gte: inicio, lte: fin } } 
    });
    const porEstado = citas.reduce((acc, c) => { 
      acc[c.estado] = (acc[c.estado] || 0) + 1; 
      return acc; 
    }, {} as Record<string, number>);
    return { total: citas.length, porEstado };
  }

  private async getClientesNuevos(inicio: Date, fin: Date) {
    const clientes = await prisma.cliente.count({ 
      where: { fechaRegistro: { gte: inicio, lte: fin } } 
    });
    return { cantidad: clientes };
  }

  private async getServiciosMasVendidos(inicio: Date, fin: Date, limit: number) {
    // ✅ FILTRAR SOLO ITEMS DE TRANSACCIONES PAGADAS
    const items = await prisma.transaccionItem.findMany({ 
      where: { 
        transaccion: { 
          tipo: 'INGRESO', 
          estadoPago: 'PAGADO',  // ✅ CRÍTICO
          fecha: { gte: inicio, lte: fin } 
        } 
      }, 
      include: { servicio: true } 
    });

    const servicios = items.reduce((acc, item) => { 
      const id = item.servicioId; 
      const nombre = item.servicio.nombre; 
      if (!acc[id]) { 
        acc[id] = { nombre, cantidad: 0, total: 0 }; 
      } 
      acc[id].cantidad += item.cantidad; 
      acc[id].total += item.subtotal; 
      return acc; 
    }, {} as Record<string, any>);

    return Object.values(servicios)
      .sort((a: any, b: any) => b.cantidad - a.cantidad)
      .slice(0, limit);
  }

  private async getEmpleadoTop(inicio: Date, fin: Date) {
    // ✅ FILTRAR SOLO TRANSACCIONES PAGADAS
    const transacciones = await prisma.transaccion.findMany({ 
      where: { 
        tipo: 'INGRESO', 
        estadoPago: 'PAGADO',  // ✅ CRÍTICO
        fecha: { gte: inicio, lte: fin }, 
        empleadoId: { not: null } 
      }, 
      include: { empleado: true } 
    });

    if (transacciones.length === 0) return null;

    const porEmpleado = transacciones.reduce((acc, t) => { 
      const id = t.empleadoId!; 
      const nombre = t.empleado!.nombre; 
      if (!acc[id]) { 
        acc[id] = { nombre, total: 0 }; 
      } 
      acc[id].total += t.total; 
      return acc; 
    }, {} as Record<string, any>);

    return Object.values(porEmpleado)
      .sort((a: any, b: any) => b.total - a.total)[0];
  }

  private async getComparativaAnterior(inicio: Date, fin: Date) {
    const diasDiferencia = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
    const inicioAnterior = new Date(inicio.getTime() - diasDiferencia * 24 * 60 * 60 * 1000);
    const finAnterior = new Date(fin.getTime() - diasDiferencia * 24 * 60 * 60 * 1000);

    const [actual, anterior] = await Promise.all([
      this.getVentasTotales(inicio, fin), 
      this.getVentasTotales(inicioAnterior, finAnterior)
    ]);

    const diferencia = actual.total - anterior.total;
    const porcentaje = anterior.total > 0 ? (diferencia / anterior.total) * 100 : 0;

    return { 
      actual: actual.total, 
      anterior: anterior.total, 
      diferencia, 
      porcentaje 
    };
  }

  // ==================== MÉTRICAS PRINCIPALES PARA EL DASHBOARD ====================
  async getMetricasDashboard() {
    const hoy = new Date();
    const inicioHoy = startOfDay(hoy);
    const finHoy = endOfDay(hoy);

    // ✅ FILTRAR SOLO TRANSACCIONES PAGADAS
    const [
      totalClientes,
      totalServicios,
      citasHoy,
      ingresosHoy,
      proximasCitas
    ] = await Promise.all([
      prisma.cliente.count({ where: { activo: true } }),
      prisma.servicio.count({ where: { activo: true } }),
      prisma.cita.count({ where: { fechaHora: { gte: inicioHoy, lte: finHoy } } }),
      prisma.transaccion.aggregate({
        where: { 
          tipo: 'INGRESO', 
          estadoPago: 'PAGADO',  // ✅ CRÍTICO
          fecha: { gte: inicioHoy, lte: finHoy } 
        },
        _sum: { total: true },
      }),
      prisma.cita.findMany({
        where: { 
          fechaHora: { gte: hoy }, 
          estado: { in: ['PENDIENTE', 'CONFIRMADA'] } 
        },
        take: 5,
        orderBy: { fechaHora: 'asc' },
        include: { cliente: true, empleado: true }
      })
    ]);

    return {
      clientesTotales: totalClientes,
      serviciosActivos: totalServicios,
      citasHoy: citasHoy,
      ingresosHoy: ingresosHoy._sum.total || 0,
      proximasCitas: proximasCitas.map(c => ({
        ...c,
        servicioNombre: c.servicioNombre
      }))
    };
  }

  async getServiciosPopulares(limit: number = 10) {
    const inicio = startOfMonth(new Date());
    const fin = endOfMonth(new Date());

    // ✅ FILTRAR SOLO ITEMS DE TRANSACCIONES PAGADAS
    const items = await prisma.transaccionItem.findMany({
      where: {
        transaccion: {
          tipo: 'INGRESO',
          estadoPago: 'PAGADO',  // ✅ CRÍTICO
          fecha: { gte: inicio, lte: fin }
        }
      },
      include: { servicio: true }
    });

    const porServicio = items.reduce((acc, item) => {
      const servicioId = item.servicioId;
      const servicioNombre = item.servicio.nombre;
      
      if (!acc[servicioId]) {
        acc[servicioId] = {
          servicioId,
          nombre: servicioNombre,
          cantidadVendida: 0,
          totalGenerado: 0
        };
      }
      
      acc[servicioId].cantidadVendida += item.cantidad;
      acc[servicioId].totalGenerado += item.subtotal;
      
      return acc;
    }, {} as Record<string, any>);

    return Object.values(porServicio)
      .sort((a: any, b: any) => b.cantidadVendida - a.cantidadVendida)
      .slice(0, limit);
  }
}

export const reportesService = new ReportesService();