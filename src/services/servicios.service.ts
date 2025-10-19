import prisma from '../config/database';

export class ServiciosService {
  /**
   * Lista solo los servicios marcados como activos.
   */
  async listarActivos() {
    return prisma.servicio.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
  }

  /**
   * Lista solo los servicios marcados como inactivos.
   */
  async listarInactivos() {
    return prisma.servicio.findMany({
      where: { activo: false },
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
  }

  /**
   * Lista todos los servicios, sin importar su estado.
   */
  async listarTodos() {
    return prisma.servicio.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
  }

  async obtenerPorId(id: string) {
    return prisma.servicio.findUnique({
      where: { id },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
  }

  async crear(data: {
    nombre: string;
    descripcion?: string;
    precio: number;
    duracionMinutos: number;
  }) {
    return prisma.servicio.create({
      data: {
        ...data,
        activo: true,
      },
    });
  }

  async actualizar(id: string, data: Partial<{
    nombre: string;
    descripcion: string;
    precio: number;
    duracionMinutos: number;
  }>) {
    return prisma.servicio.update({
      where: { id },
      data,
    });
  }

  async eliminar(id: string) {
    // Soft delete: desactiva el servicio en lugar de borrarlo.
    return prisma.servicio.update({
      where: { id },
      data: { activo: false },
    });
  }
}

export const serviciosService = new ServiciosService();
