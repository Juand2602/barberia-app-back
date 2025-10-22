// src/services/clientes.service.ts - MEJORADO

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
    if (!data.nombre || typeof data.nombre !== 'string' || data.nombre.trim() === '') {
      throw new Error('El nombre del cliente es obligatorio y no puede estar vacío.');
    }
    if (!data.telefono || typeof data.telefono !== 'string' || data.telefono.trim() === '') {
      throw new Error('El teléfono del cliente es obligatorio y no puede estar vacío.');
    }

    const nombreNormalizado = data.nombre.trim();
    const telefonoNormalizado = data.telefono.trim();

    const existente = await prisma.cliente.findUnique({
      where: { telefono: telefonoNormalizado },
    });

    if (existente) {
      throw new Error('Ya existe un cliente con ese número de teléfono');
    }

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
    if (data.nombre !== undefined && data.nombre.trim() === '') {
      throw new Error('El nombre, si se proporciona, no puede estar vacío.');
    }
    if (data.telefono !== undefined && data.telefono.trim() === '') {
      throw new Error('El teléfono, si se proporciona, no puede estar vacío.');
    }

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
   * Busca un cliente por su número de teléfono
   */
  async buscarPorTelefono(telefono: string) {
    return prisma.cliente.findUnique({
      where: { telefono },
    });
  }

  /**
   * Crea un nuevo cliente con datos mínimos
   */
  async crear(data: { nombre: string; telefono: string; email?: string }) {
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
   * Determina si un nombre nuevo es más completo que el anterior
   * @param nombreAnterior Nombre actual en BD
   * @param nombreNuevo Nombre proporcionado por el usuario
   * @returns true si el nuevo nombre es más completo
   */
  private esNombreMasCompleto(nombreAnterior: string, nombreNuevo: string): boolean {
    const anteriorNormalizado = nombreAnterior.toLowerCase().trim();
    const nuevoNormalizado = nombreNuevo.toLowerCase().trim();
    
    // Nombres genéricos que siempre deben ser reemplazados
    const nombresGenericos = ['cliente whatsapp', 'cliente', 'usuario', 'user', 'sin nombre'];
    if (nombresGenericos.includes(anteriorNormalizado)) {
      return true;
    }
    
    // Si el nuevo nombre es genérico, NO actualizar
    if (nombresGenericos.includes(nuevoNormalizado)) {
      return false;
    }
    
    // Contar palabras (aproximación simple de nombre completo)
    const palabrasAnterior = anteriorNormalizado.split(/\s+/).filter(p => p.length >= 2);
    const palabrasNuevo = nuevoNormalizado.split(/\s+/).filter(p => p.length >= 2);
    
    // Si el nuevo tiene más palabras y contiene el anterior, es más completo
    if (palabrasNuevo.length > palabrasAnterior.length) {
      // Verificar que el nuevo nombre contiene todas las palabras del anterior
      const todasContenidas = palabrasAnterior.every(palabra => 
        nuevoNormalizado.includes(palabra)
      );
      
      if (todasContenidas) {
        return true;
      }
    }
    
    // Si tienen el mismo número de palabras pero el nuevo es más largo
    if (palabrasNuevo.length === palabrasAnterior.length && 
        nuevoNormalizado.length > anteriorNormalizado.length + 3) {
      return true;
    }
    
    return false;
  }

  /**
   * Busca un cliente por teléfono y lo crea o actualiza inteligentemente
   * @param telefono Número de teléfono del cliente
   * @param nombre Nombre proporcionado
   * @returns Cliente encontrado o creado
   */
  async obtenerOCrear(telefono: string, nombre?: string) {
    let cliente = await this.buscarPorTelefono(telefono);
    
    if (!cliente && nombre) {
      // Cliente no existe, crear uno nuevo
      cliente = await this.crear({ nombre, telefono });
      console.log(`✅ Cliente creado: ${nombre} (${telefono})`);
    } else if (cliente && nombre) {
      // Cliente existe, verificar si actualizar nombre
      if (this.esNombreMasCompleto(cliente.nombre, nombre)) {
        cliente = await this.update(cliente.id, { nombre });
        console.log(`✅ Nombre actualizado: ${cliente.nombre} → ${nombre}`);
      } else {
        console.log(`ℹ️ Nombre conservado: ${cliente.nombre} (nuevo: ${nombre})`);
      }
    }
    
    return cliente;
  }
}

export const clientesService = new ClientesService();