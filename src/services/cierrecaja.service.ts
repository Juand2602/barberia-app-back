// src/services/cierrecaja.service.ts (Nuevo Backend - CORREGIDO)

import prisma from '../config/database';

interface DatosCierre {
  fecha: Date;
  efectivoInicial: number;
  ingresosEfectivo: number;
  egresosEfectivo: number;
  totalTransferencias: number;
  efectivoEsperado: number;
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

  // Calcular datos para el cierre del día
 // dentro de class CierreCajaService
  // Calcular datos para el cierre del día (ajustado para considerar AperturaCaja)
  async calcularDatosCierre(fecha: Date): Promise<DatosCierre> {
    const inicioDia = new Date(fecha);
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date(fecha);
    finDia.setHours(23, 59, 59, 999);

    // 1) Buscar apertura del día (si existe y está ABIERTA o incluso si está CERRADA)
    const aperturaDelDia = await prisma.aperturaCaja.findFirst({
      where: {
        fecha: { gte: inicioDia, lte: finDia },
      },
      orderBy: { fecha: 'desc' },
    });

    // 2) Determinar efectivoInicial:
    // - Si existe apertura en el día: usar su montoInicial
    // - Si no existe, usar el efectivoFinal del último cierre (comportamiento previo)
    const ultimoCierre = await this.getUltimoCierre();
    const efectivoInicial = aperturaDelDia
      ? aperturaDelDia.montoInicial
      : ultimoCierre
      ? ultimoCierre.efectivoFinal
      : 0;

    // Obtener transacciones del día
    const transacciones = await prisma.transaccion.findMany({
      where: {
        fecha: {
          gte: inicioDia,
          lte: finDia,
        },
      },
    });

    // Calcular totales
    let ingresosEfectivo = 0;
    let egresosEfectivo = 0;
    let totalTransferencias = 0;

    transacciones.forEach((trans) => {
      if (trans.metodoPago === 'EFECTIVO') {
        if (trans.tipo === 'INGRESO') {
          ingresosEfectivo += trans.total;
        } else {
          egresosEfectivo += trans.total;
        }
      } else if (trans.metodoPago === 'TRANSFERENCIA') {
        if (trans.tipo === 'INGRESO') {
          totalTransferencias += trans.total;
        }
      }
    });

    const efectivoEsperado = efectivoInicial + ingresosEfectivo - egresosEfectivo;

    return {
      fecha,
      efectivoInicial,
      ingresosEfectivo,
      egresosEfectivo,
      totalTransferencias,
      efectivoEsperado,
    };
  }


  // Crear un nuevo cierre de caja
    // Crear un nuevo cierre de caja (modificado para cerrar AperturaCaja del día)
  async create(data: any) {
    const fecha = data.fecha ? new Date(data.fecha) : new Date();

    // Verificar que no exista ya un cierre para esta fecha
    const cierreExistente = await this.getByFecha(fecha);
    if (cierreExistente) {
      throw new Error('Ya existe un cierre de caja para esta fecha');
    }

    // Calcular datos del cierre (esto ya considerará la apertura del día si existe)
    const datosCierre = await this.calcularDatosCierre(fecha);

    // Calcular diferencia
    const diferencia = data.efectivoFinal - datosCierre.efectivoEsperado;

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
        ingresos: datosCierre.ingresosEfectivo,
        egresos: datosCierre.egresosEfectivo,
        diferencia,
        totalTransferencias: datosCierre.totalTransferencias,
        notas: data.notas || null,
      },
    });

    // --- Cerrar la AperturaCaja del día si existe y está ABIERTA ---
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
        // No bloqueamos la creación del cierre si falla el cierre de apertura, solo logueamos.
        console.error('Error cerrando la apertura del día:', err);
      }
    }

    return cierre;
  }


  // Actualizar un cierre de caja
  async update(id: string, data: any) {
    const cierreExistente = await this.getById(id);

    // Recalcular diferencia si se cambia el efectivo final
    let diferencia = cierreExistente.diferencia;
    if (data.efectivoFinal !== undefined) {
      diferencia = data.efectivoFinal - cierreExistente.efectivoEsperado;

      if (Math.abs(diferencia) > 20000 && !data.notas && !cierreExistente.notas) {
        throw new Error(
          'Se requiere una justificación para diferencias mayores a $20,000'
        );
      }
    }

    const cierre = await prisma.cierreCaja.update({
      where: { id },
      data: {
        ...(data.efectivoFinal !== undefined && { 
          efectivoFinal: data.efectivoFinal,
          diferencia,
        }),
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

  // --- MÉTODOS AUXILIARES ---

  /**
   * Verificar si se puede hacer cierre hoy
   */
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

    // Crear una apertura de caja (POST /cierre-caja/open)
  async createApertura(data: { montoInicial: number; usuarioId?: number; notas?: string }) {
    const fecha = data ? new Date() : new Date();

    // Verificar si ya existe una apertura abierta para hoy (evitar duplicados)
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
        usuarioId: data.usuarioId,
        notas: data.notas || null,
        fecha,
        estado: 'ABIERTA',
      },
    });

    return apertura;
  }

  // Obtener apertura abierta para hoy (GET /cierre-caja/open)
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

    const apertura = await prisma.aperturaCaja.findFirst({ where, orderBy: { fecha: 'desc' } });
    return apertura;
  }
  // Listar aperturas (opcional: filtro por fecha)
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

  // Estadísticas: total de aperturas y suma de montos iniciales (ejemplo)
  async getAperturasEstadisticas(fechaInicio?: Date, fechaFin?: Date) {
    const where: any = {};
    if (fechaInicio || fechaFin) {
      where.fecha = {};
      if (fechaInicio) where.fecha.gte = fechaInicio;
      if (fechaFin) where.fecha.lte = fechaFin;
    }

    const totalAperturas = await prisma.aperturaCaja.count({ where });
    const sumaMontos = await prisma.aperturaCaja.aggregate({
      _sum: { montoInicial: true },
      where,
    });

    return {
      totalAperturas,
      sumaMontosIniciales: sumaMontos._sum.montoInicial || 0,
    };
  }

}

export const cierreCajaService = new CierreCajaService();