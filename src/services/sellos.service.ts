// src/services/sellos.service.ts

import prisma from '../config/database';
import { AgregarSelloDTO, CanjearSelloDTO } from '../types';

export class SellosService {
  /**
   * Agregar sellos a un cliente
   */
  async agregarSellos(data: AgregarSelloDTO) {
    const { clienteId, cantidad, motivo } = data;

    // Validar cliente
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
    });

    if (!cliente) {
      throw new Error('Cliente no encontrado');
    }

    // Actualizar sellos del cliente
    const nuevoTotal = cliente.sellos + cantidad;

    const [clienteActualizado, historial] = await prisma.$transaction([
      prisma.cliente.update({
        where: { id: clienteId },
        data: {
          sellos: nuevoTotal,
          ultimoSello: new Date(),
        },
      }),
      prisma.historialSello.create({
        data: {
          clienteId,
          tipo: 'AGREGADO',
          cantidad,
          motivo: motivo || `Sellos agregados`,
          sellosTotales: nuevoTotal,
        },
      }),
    ]);

    return {
      cliente: clienteActualizado,
      historial,
    };
  }

  /**
   * Canjear sellos por un premio
   */
  async canjearSellos(data: CanjearSelloDTO) {
    const { clienteId, premioId } = data;

    // Validar cliente
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
    });

    if (!cliente) {
      throw new Error('Cliente no encontrado');
    }

    // Validar premio
    const premio = await prisma.configuracionPremio.findUnique({
      where: { id: premioId },
    });

    if (!premio || !premio.activo) {
      throw new Error('Premio no encontrado o no disponible');
    }

    // Validar que el cliente tiene suficientes sellos
    if (cliente.sellos < premio.sellosRequeridos) {
      throw new Error(
        `Sellos insuficientes. Necesitas ${premio.sellosRequeridos} sellos y tienes ${cliente.sellos}`
      );
    }

    // Calcular nuevo total
    const nuevoTotal = cliente.sellos - premio.sellosRequeridos;
    const nuevosCanjeados = cliente.sellosCanjeados + premio.sellosRequeridos;

    // Actualizar cliente y crear historial
    const [clienteActualizado, historial] = await prisma.$transaction([
      prisma.cliente.update({
        where: { id: clienteId },
        data: {
          sellos: nuevoTotal,
          sellosCanjeados: nuevosCanjeados,
        },
      }),
      prisma.historialSello.create({
        data: {
          clienteId,
          tipo: 'CANJEADO',
          cantidad: premio.sellosRequeridos,
          motivo: `Premio canjeado: ${premio.nombre}`,
          sellosTotales: nuevoTotal,
        },
      }),
    ]);

    return {
      cliente: clienteActualizado,
      premio,
      historial,
    };
  }

  /**
   * Obtener historial de sellos de un cliente
   */
  async getHistorial(clienteId: string, limit = 20) {
    const historial = await prisma.historialSello.findMany({
      where: { clienteId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return historial;
  }

  /**
   * Obtener configuración de premios disponibles
   */
  async getPremios() {
    const premios = await prisma.configuracionPremio.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
    });

    return premios;
  }

  /**
   * Crear un nuevo premio
   */
  async crearPremio(data: {
    nombre: string;
    sellosRequeridos: number;
    descripcion?: string;
    orden?: number;
  }) {
    const premio = await prisma.configuracionPremio.create({
      data: {
        nombre: data.nombre,
        sellosRequeridos: data.sellosRequeridos,
        descripcion: data.descripcion,
        orden: data.orden || 0,
        activo: true,
      },
    });

    return premio;
  }

  /**
   * Actualizar un premio
   */
  async actualizarPremio(
    id: string,
    data: {
      nombre?: string;
      sellosRequeridos?: number;
      descripcion?: string;
      activo?: boolean;
      orden?: number;
    }
  ) {
    const premio = await prisma.configuracionPremio.update({
      where: { id },
      data,
    });

    return premio;
  }

  /**
   * Eliminar un premio
   */
  async eliminarPremio(id: string) {
    await prisma.configuracionPremio.delete({
      where: { id },
    });
  }

  /**
   * Obtener estadísticas de sellos de un cliente
   */
  async getEstadisticas(clienteId: string) {
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: {
        sellos: true,
        sellosCanjeados: true,
        ultimoSello: true,
      },
    });

    if (!cliente) {
      throw new Error('Cliente no encontrado');
    }

    const totalAgregados = await prisma.historialSello.aggregate({
      where: {
        clienteId,
        tipo: 'AGREGADO',
      },
      _sum: {
        cantidad: true,
      },
    });

    const premios = await this.getPremios();
    const proximoPremio = premios.find(p => p.sellosRequeridos > cliente.sellos);

    return {
      sellosActuales: cliente.sellos,
      sellosCanjeados: cliente.sellosCanjeados,
      totalAcumulados: totalAgregados._sum.cantidad || 0,
      ultimoSello: cliente.ultimoSello,
      proximoPremio: proximoPremio
        ? {
            nombre: proximoPremio.nombre,
            sellosRequeridos: proximoPremio.sellosRequeridos,
            sellosRestantes: proximoPremio.sellosRequeridos - cliente.sellos,
          }
        : null,
    };
  }
}

export const sellosService = new SellosService();