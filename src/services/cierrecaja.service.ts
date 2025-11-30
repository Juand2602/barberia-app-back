// src/services/cierrecaja.service.ts - CON SOPORTE TRANSFERENCIAS

import prisma from '../config/database';

interface DatosCierre {
  fecha: Date;
  efectivoInicial: number;
  ingresosEfectivo: number;
  egresosEfectivo: number;
  efectivoEsperado: number;
  transferenciasInicial: number;
  ingresosTransferencias: number;
  egresosTransferencias: number;
  transferenciasEsperadas: number;
  totalTransferencias: number;
}

export class CierreCajaService {
  // Obtener todos los cierres
  async getAll(fechaInicio?: Date, fechaFin?: Date) {
    const where: any = {};

    if (fechaInicio || fechaFin) {
      where.fecha = {};
      if (fechaInicio) where.fecha.gte = fechaInicio;
      if (fechaFin) where.fecha.lte = fechaFin;
    }

    const cierres = await prisma.cierreCaja.findMany({
      where,
      orderBy: { fecha: 'desc' },
    });

    return cierres;
  }

  // Obtener un cierre por ID
  async getById(id: string) {
    const cierre = await prisma.cierreCaja.findUnique({
      where: { id },
    });

    if (!cierre) {
      throw new Error('Cierre de caja no encontrado');
    }

    return cierre;
  }

  // Obtener cierre por fecha específica
  async getByFecha(fecha: Date) {
    const inicioDia = new Date(fecha);
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date(fecha);
    finDia.setHours(23, 59, 59, 999);

    const cierre = await prisma.cierreCaja.findFirst({
      where: {
        fecha: {
          gte: inicioDia,
          lte: finDia,
        },
      },
    });

    return cierre;
  }

  // Obtener el último cierre
  async getUltimoCierre() {
    const cierre = await prisma.cierreCaja.findFirst({
      orderBy: { fecha: 'desc' },
    });

    return cierre;
  }

  // Calcular datos para el cierre del día (CON TRANSFERENCIAS)
  async calcularDatosCierre(fecha: Date): Promise<DatosCierre> {
    const inicioDia = new Date(fecha);
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date(fecha);
    finDia.setHours(23, 59, 59, 999);

    // 1) Buscar apertura del día
    const aperturaDelDia = await prisma.aperturaCaja.findFirst({
      where: {
        fecha: { gte: inicioDia, lte: finDia },
      },
      orderBy: { fecha: 'desc' },
    });

    // 2) Determinar montos iniciales
    const ultimoCierre = await this.getUltimoCierre();
    
    const efectivoInicial = aperturaDelDia
      ? aperturaDelDia.montoInicial
      : ultimoCierre
      ? ultimoCierre.efectivoFinal
      : 0;

    const transferenciasInicial = aperturaDelDia
      ? (aperturaDelDia.montoTransferencias || 0)
      : ultimoCierre
      ? (ultimoCierre.transferenciasFinal || 0)
      : 0;

    // 3) Obtener transacciones del día
    const transacciones = await prisma.transaccion.findMany({
      where: {
        fecha: {
          gte: inicioDia,
          lte: finDia,
        },
      },
    });

    // 4) Calcular totales separados por método de pago
    let ingresosEfectivo = 0;
    let egresosEfectivo = 0;
    let ingresosTransferencias = 0;
    let egresosTransferencias = 0;

    transacciones.forEach((trans) => {
      // EFECTIVO
      if (trans.metodoPago === 'EFECTIVO') {
        if (trans.tipo === 'INGRESO') {
          ingresosEfectivo += trans.total;
        } else {
          egresosEfectivo += trans.total;
        }
      } 
      // TRANSFERENCIA
      else if (trans.metodoPago === 'TRANSFERENCIA') {
        if (trans.tipo === 'INGRESO') {
          ingresosTransferencias += trans.total;
        } else {
          egresosTransferencias += trans.total;
        }
      }
      // MIXTO - dividir entre efectivo y transferencia
      else if (trans.metodoPago === 'MIXTO') {
        const montoEfectivo = trans.montoEfectivo || 0;
        const montoTransferencia = trans.montoTransferencia || 0;

        if (trans.tipo === 'INGRESO') {
          ingresosEfectivo += montoEfectivo;
          ingresosTransferencias += montoTransferencia;
        } else {
          egresosEfectivo += montoEfectivo;
          egresosTransferencias += montoTransferencia;
        }
      }
    });

    const efectivoEsperado = efectivoInicial + ingresosEfectivo - egresosEfectivo;
    const transferenciasEsperadas = transferenciasInicial + ingresosTransferencias - egresosTransferencias;
    const totalTransferencias = ingresosTransferencias;

    return {
      fecha,
      efectivoInicial,
      ingresosEfectivo,
      egresosEfectivo,
      efectivoEsperado,
      transferenciasInicial,
      ingresosTransferencias,
      egresosTransferencias,
      transferenciasEsperadas,
      totalTransferencias,
    };
  }

  // Crear un nuevo cierre de caja (CON TRANSFERENCIAS)
  async create(data: any) {
    const fecha = data.fecha ? new Date(data.fecha) : new Date();

    // Verificar que no exista ya un cierre para esta fecha
    const cierreExistente = await this.getByFecha(fecha);
    if (cierreExistente) {
      throw new Error('Ya existe un cierre de caja para esta fecha');
    }

    // Calcular datos del cierre
    const datosCierre = await this.calcularDatosCierre(fecha);

    // Calcular diferencias
    const diferenciaEfectivo = data.efectivoFinal - datosCierre.efectivoEsperado;
    const diferenciaTransferencias = (data.transferenciasFinal || 0) - datosCierre.transferenciasEsperadas;
    const diferencia = diferenciaEfectivo + diferenciaTransferencias;

    // Validar diferencia significativa
    if (Math.abs(diferencia) > 20000 && !data.notas) {
      throw new Error(
        'Se requiere una justificación para diferencias mayores a $20,000'
      );
    }

    // Crear el cierre
    const cierre = await prisma.cierreCaja.create({
      data: {
        fecha,
        efectivoInicial: datosCierre.efectivoInicial,
        efectivoFinal: data.efectivoFinal,
        efectivoEsperado: datosCierre.efectivoEsperado,
        transferenciasInicial: datosCierre.transferenciasInicial,
        transferenciasFinal: data.transferenciasFinal || 0,
        transferenciasEsperadas: datosCierre.transferenciasEsperadas,
        ingresos: datosCierre.ingresosEfectivo,
        egresos: datosCierre.egresosEfectivo,
        diferencia,
        totalTransferencias: datosCierre.totalTransferencias,
        notas: data.notas || null,
      },
    });

    // Cerrar la AperturaCaja del día si existe y está ABIERTA
    const inicioDia = new Date(fecha);
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date(fecha);
    finDia.setHours(23, 59, 59, 999);

    const aperturaDelDia = await prisma.aperturaCaja.findFirst({
      where: {
        fecha: { gte: inicioDia, lte: finDia },
        estado: 'ABIERTA',
      },
      orderBy: { fecha: 'desc' },
    });

    if (aperturaDelDia) {
      try {
        await prisma.aperturaCaja.update({
          where: { id: aperturaDelDia.id },
          data: { estado: 'CERRADA', updatedAt: new Date() },
        });
      } catch (err) {
        console.error('Error cerrando la apertura del día:', err);
      }
    }

    return cierre;
  }

  // Actualizar un cierre de caja
  async update(id: string, data: any) {
    const cierreExistente = await this.getById(id);

    // Recalcular diferencia si se cambia algún valor final
    let diferencia = cierreExistente.diferencia;
    
    if (data.efectivoFinal !== undefined || data.transferenciasFinal !== undefined) {
      const efectivoFinal = data.efectivoFinal ?? cierreExistente.efectivoFinal;
      const transferenciasFinal = data.transferenciasFinal ?? (cierreExistente.transferenciasFinal || 0);
      
      const diferenciaEfectivo = efectivoFinal - cierreExistente.efectivoEsperado;
      const diferenciaTransferencias = transferenciasFinal - (cierreExistente.transferenciasEsperadas || 0);
      diferencia = diferenciaEfectivo + diferenciaTransferencias;

      if (Math.abs(diferencia) > 20000 && !data.notas && !cierreExistente.notas) {
        throw new Error(
          'Se requiere una justificación para diferencias mayores a $20,000'
        );
      }
    }

    const cierre = await prisma.cierreCaja.update({
      where: { id },
      data: {
        ...(data.efectivoFinal !== undefined && { efectivoFinal: data.efectivoFinal }),
        ...(data.transferenciasFinal !== undefined && { transferenciasFinal: data.transferenciasFinal }),
        ...(data.efectivoInicial !== undefined && { efectivoInicial: data.efectivoInicial }),
        ...(data.transferenciasInicial !== undefined && { transferenciasInicial: data.transferenciasInicial }),
        diferencia,
        ...(data.notas !== undefined && { notas: data.notas || null }),
      },
    });

    return cierre;
  }

  // Eliminar un cierre de caja
  async delete(id: string) {
    await this.getById(id); // Verificar que existe
    await prisma.cierreCaja.delete({
      where: { id },
    });
  }

  // Obtener estadísticas de cierres
  async getEstadisticas(fechaInicio?: Date, fechaFin?: Date) {
    const where: any = {};

    if (fechaInicio || fechaFin) {
      where.fecha = {};
      if (fechaInicio) where.fecha.gte = fechaInicio;
      if (fechaFin) where.fecha.lte = fechaFin;
    }

    const [totalCierres, estadisticas] = await Promise.all([
      prisma.cierreCaja.count({ where }),
      prisma.cierreCaja.aggregate({
        where,
        _sum: {
          ingresos: true,
          egresos: true,
          diferencia: true,
          totalTransferencias: true,
        },
        _avg: {
          diferencia: true,
        },
      }),
    ]);

    // Obtener cierres con diferencias significativas
    const cierresConDiferencias = await prisma.cierreCaja.count({
      where: {
        ...where,
        OR: [
          { diferencia: { gt: 20000 } },
          { diferencia: { lt: -20000 } },
        ],
      },
    });

    return {
      totalCierres,
      totalIngresos: estadisticas._sum.ingresos || 0,
      totalEgresos: estadisticas._sum.egresos || 0,
      totalTransferencias: estadisticas._sum.totalTransferencias || 0,
      diferenciaTotal: estadisticas._sum.diferencia || 0,
      diferenciaPromedio: estadisticas._avg.diferencia || 0,
      cierresConDiferenciasSignificativas: cierresConDiferencias,
    };
  }

  // Verificar si se puede hacer cierre hoy
  async puedeCerrarHoy(): Promise<{
    puede: boolean;
    motivo?: string;
    datos?: DatosCierre;
  }> {
    const hoy = new Date();

    // Verificar si ya existe un cierre para hoy
    const cierreHoy = await this.getByFecha(hoy);
    if (cierreHoy) {
      return {
        puede: false,
        motivo: 'Ya existe un cierre de caja para el día de hoy',
      };
    }

    // Calcular datos del cierre
    const datos = await this.calcularDatosCierre(hoy);

    return {
      puede: true,
      datos,
    };
  }

  // Crear una apertura de caja (CON TRANSFERENCIAS)
  async createApertura(data: { 
    montoInicial: number; 
    montoTransferencias?: number;
    usuarioId?: number; 
    notas?: string 
  }) {
    const fecha = new Date();

    // Verificar si ya existe una apertura abierta para hoy
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date();
    finDia.setHours(23, 59, 59, 999);

    const aperturaExistente = await prisma.aperturaCaja.findFirst({
      where: {
        fecha: { gte: inicioDia, lte: finDia },
        estado: 'ABIERTA',
      },
    });

    if (aperturaExistente) {
      throw new Error('Ya existe una apertura de caja abierta para el día de hoy');
    }

    const apertura = await prisma.aperturaCaja.create({
      data: {
        montoInicial: data.montoInicial,
        montoTransferencias: data.montoTransferencias || 0,
        usuarioId: data.usuarioId,
        notas: data.notas || null,
        fecha,
        estado: 'ABIERTA',
      },
    });

    return apertura;
  }

  // Obtener apertura abierta para hoy
  async getAperturaAbierta(usuarioId?: number) {
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date();
    finDia.setHours(23, 59, 59, 999);

    const where: any = {
      fecha: { gte: inicioDia, lte: finDia },
      estado: 'ABIERTA',
    };
    if (usuarioId) where.usuarioId = usuarioId;

    const apertura = await prisma.aperturaCaja.findFirst({ 
      where, 
      orderBy: { fecha: 'desc' } 
    });
    return apertura;
  }

  // Listar aperturas
  async getAperturas(fechaInicio?: Date, fechaFin?: Date) {
    const where: any = {};
    if (fechaInicio || fechaFin) {
      where.fecha = {};
      if (fechaInicio) where.fecha.gte = fechaInicio;
      if (fechaFin) where.fecha.lte = fechaFin;
    }
    const aperturas = await prisma.aperturaCaja.findMany({
      where,
      orderBy: { fecha: 'desc' },
    });
    return aperturas;
  }

  // Estadísticas de aperturas
  async getAperturasEstadisticas(fechaInicio?: Date, fechaFin?: Date) {
    const where: any = {};
    if (fechaInicio || fechaFin) {
      where.fecha = {};
      if (fechaInicio) where.fecha.gte = fechaInicio;
      if (fechaFin) where.fecha.lte = fechaFin;
    }

    const totalAperturas = await prisma.aperturaCaja.count({ where });
    const sumaMontos = await prisma.aperturaCaja.aggregate({
      _sum: { 
        montoInicial: true,
        montoTransferencias: true,
      },
      where,
    });

    return {
      totalAperturas,
      sumaMontosIniciales: sumaMontos._sum.montoInicial || 0,
      sumaTransferenciasIniciales: sumaMontos._sum.montoTransferencias || 0,
    };
  }
}

export const cierreCajaService = new CierreCajaService();