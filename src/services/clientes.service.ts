// src/services/clientes.service.ts (Nuevo Backend - CORREGIDO Y COMPLETO)

import prisma from '../config/database';

export class ClientesService {
  // Obtener todos los clientes
  async getAll(search?: string, activo?: boolean) {
    const where: any = {};

    if (activo !== undefined) {
      where.activo = activo;
    }

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { telefono: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const clientes = await prisma.cliente.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            citas: true,
            transacciones: true,
          },
        },
      },
    });

    return clientes;
  }

  // Obtener un cliente por ID
  async getById(id: string) {
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        citas: {
          orderBy: { fechaHora: 'desc' },
          take: 10,
          include: {
            empleado: true,
          },
        },
        transacciones: {
          orderBy: { fecha: 'desc' },
          take: 10,
          include: {
            items: {
              include: {
                servicio: true,
              },
            },
          },
        },
      },
    });

    if (!cliente) {
      throw new Error('Cliente no encontrado');
    }

    return cliente;
  }

  // Crear un nuevo cliente
  async create(data: any) {
    // 1. Validaciones
    if (!data.nombre || typeof data.nombre !== 'string' || data.nombre.trim() === '') {
      throw new Error('El nombre del cliente es obligatorio y no puede estar vacío.');
    }
    if (!data.telefono || typeof data.telefono !== 'string' || data.telefono.trim() === '') {
      throw new Error('El teléfono del cliente es obligatorio y no puede estar vacío.');
    }

    const nombreNormalizado = data.nombre.trim();
    const telefonoNormalizado = data.telefono.trim();

    // 2. Verificar si el teléfono ya existe
    const existente = await prisma.cliente.findUnique({
      where: { telefono: telefonoNormalizado },
    });

    if (existente) {
      throw new Error('Ya existe un cliente con ese número de teléfono');
    }

    // 3. Crear el cliente
    const cliente = await prisma.cliente.create({
      data: {
        nombre: nombreNormalizado,
        telefono: telefonoNormalizado,
        email: data.email && data.email.trim() !== "" ? data.email.trim() : null,
        notas: data.notas && data.notas.trim() !== "" ? data.notas.trim() : null,
      },
    });

    return cliente;
  }

  // Actualizar un cliente
  async update(id: string, data: any) {
    // Validaciones si se proporcionan los datos
    if (data.nombre !== undefined && data.nombre.trim() === '') {
      throw new Error('El nombre, si se proporciona, no puede estar vacío.');
    }
    if (data.telefono !== undefined && data.telefono.trim() === '') {
      throw new Error('El teléfono, si se proporciona, no puede estar vacío.');
    }

    // Si se está actualizando el teléfono, verificar que no exista
    if (data.telefono) {
      const existente = await prisma.cliente.findFirst({
        where: {
          telefono: data.telefono.trim(),
          NOT: { id },
        },
      });

      if (existente) {
        throw new Error('Ya existe otro cliente con ese número de teléfono');
      }
    }

    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        ...(data.nombre && { nombre: data.nombre.trim() }),
        ...(data.telefono && { telefono: data.telefono.trim() }),
        ...(data.email !== undefined && { email: data.email.trim() || null }),
        ...(data.notas !== undefined && { notas: data.notas.trim() || null }),
        ...(data.activo !== undefined && { activo: data.activo }),
      },
    });

    return cliente;
  }

  // Eliminar un cliente (soft delete)
  async delete(id: string) {
    const cliente = await prisma.cliente.update({
      where: { id },
      data: { activo: false },
    });
    return cliente;
  }

  // Obtener estadísticas de un cliente
  async getEstadisticas(id: string) {
    const [totalCitas, totalGastado, ultimaVisita] = await Promise.all([
      prisma.cita.count({
        where: { clienteId: id, estado: 'COMPLETADA' },
      }),
      prisma.transaccion.aggregate({
        where: { clienteId: id, tipo: 'INGRESO' },
        _sum: { total: true },
      }),
      prisma.cita.findFirst({
        where: { clienteId: id, estado: 'COMPLETADA' },
        orderBy: { fechaHora: 'desc' },
      }),
    ]);

    return {
      totalCitas,
      totalGastado: totalGastado._sum.total || 0,
      ultimaVisita: ultimaVisita?.fechaHora || null,
    };
  }

  // --- MÉTODOS AUXILIARES PARA EL BOT DE WHATSAPP ---

  /**
   * Busca un cliente por su número de teléfono.
   * Usado por el bot de WhatsApp.
   */
  async buscarPorTelefono(telefono: string) {
    return prisma.cliente.findUnique({
      where: { telefono },
    });
  }

  /**
   * Crea un nuevo cliente con datos mínimos.
   * Usado por el bot de WhatsApp.
   */
  async crear(data: { nombre: string; telefono: string; email?: string }) {
    // Reutilizamos las validaciones del método create principal
    if (!data.nombre || data.nombre.trim() === '') {
      throw new Error('El nombre del cliente es obligatorio.');
    }
    if (!data.telefono || data.telefono.trim() === '') {
      throw new Error('El teléfono del cliente es obligatorio.');
    }

    const cliente = await prisma.cliente.create({
      data: {
        nombre: data.nombre.trim(),
        telefono: data.telefono.trim(),
        email: data.email && data.email.trim() !== "" ? data.email.trim() : null,
        activo: true,
      },
    });

    return cliente;
  }

  /**
   * Busca un cliente por teléfono, y si no lo encuentra, lo crea.
   * Usado por el bot de WhatsApp.
   */
  async obtenerOCrear(telefono: string, nombre?: string) {
    let cliente = await this.buscarPorTelefono(telefono);
    
    if (!cliente && nombre) {
      cliente = await this.crear({ nombre, telefono });
    }
    
    return cliente;
  }
}

export const clientesService = new ClientesService();