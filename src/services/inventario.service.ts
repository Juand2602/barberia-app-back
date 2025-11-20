// src/services/inventario.service.ts

import prisma from '../config/database';
import { startOfDay, endOfDay } from 'date-fns';

export class InventarioService {
  // ==================== PRODUCTOS ====================
  
  /**
   * Obtener todos los productos con filtros opcionales
   */
  async getAllProductos(filters?: {
    categoria?: string;
    activo?: boolean;
    stockBajo?: boolean;
  }) {
    const where: any = {};

    if (filters?.categoria) {
      where.categoria = filters.categoria;
    }

    if (filters?.activo !== undefined) {
      where.activo = filters.activo;
    }

    const productos = await prisma.productoInventario.findMany({
      where,
      include: {
        _count: {
          select: {
            compras: true,
            ventas: true,
          },
        },
      },
      orderBy: [
        { activo: 'desc' },
        { nombre: 'asc' },
      ],
    });

    return productos;
  }

  /**
   * Obtener producto por ID
   */
  async getProductoById(id: string) {
    const producto = await prisma.productoInventario.findUnique({
      where: { id },
      include: {
        compras: {
          orderBy: { fecha: 'desc' },
          take: 10,
        },
        ventas: {
          orderBy: { fecha: 'desc' },
          take: 10,
        },
      },
    });

    if (!producto) {
      throw new Error('Producto no encontrado');
    }

    return producto;
  }

  /**
   * Crear nuevo producto
   */
  async createProducto(data: {
    nombre: string;
    categoria: string;
    precioCompra: number;
    precioVenta: number;
    stock?: number;
    stockMinimo?: number;
    unidadMedida?: string;
  }) {
    // Validaciones
    if (!data.nombre || data.nombre.trim() === '') {
      throw new Error('El nombre del producto es obligatorio');
    }

    if (data.precioCompra < 0 || data.precioVenta < 0) {
      throw new Error('Los precios no pueden ser negativos');
    }

    if (data.precioVenta < data.precioCompra) {
      console.warn('⚠️ Advertencia: El precio de venta es menor que el precio de compra');
    }

    const producto = await prisma.productoInventario.create({
      data: {
        nombre: data.nombre.trim(),
        categoria: data.categoria,
        precioCompra: Number(data.precioCompra),
        precioVenta: Number(data.precioVenta),
        stock: data.stock || 0,
        stockMinimo: data.stockMinimo || 5,
        unidadMedida: data.unidadMedida || 'UNIDAD',
      },
    });

    console.log(`✅ Producto creado: ${producto.nombre} (${producto.id})`);
    return producto;
  }

  /**
   * Actualizar producto
   */
  async updateProducto(id: string, data: any) {
    await this.getProductoById(id);

    if (data.precioVenta !== undefined && data.precioCompra !== undefined) {
      if (data.precioVenta < data.precioCompra) {
        console.warn('⚠️ Advertencia: El precio de venta es menor que el precio de compra');
      }
    }

    const producto = await prisma.productoInventario.update({
      where: { id },
      data: {
        ...(data.nombre && { nombre: data.nombre.trim() }),
        ...(data.categoria && { categoria: data.categoria }),
        ...(data.precioCompra !== undefined && { precioCompra: Number(data.precioCompra) }),
        ...(data.precioVenta !== undefined && { precioVenta: Number(data.precioVenta) }),
        ...(data.stockMinimo !== undefined && { stockMinimo: Number(data.stockMinimo) }),
        ...(data.unidadMedida && { unidadMedida: data.unidadMedida }),
        ...(data.activo !== undefined && { activo: data.activo }),
      },
    });

    console.log(`✅ Producto actualizado: ${producto.nombre}`);
    return producto;
  }

  /**
   * Eliminar producto (solo si no tiene movimientos)
   */
  async deleteProducto(id: string) {
    const producto = await prisma.productoInventario.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            compras: true,
            ventas: true,
          },
        },
      },
    });

    if (!producto) {
      throw new Error('Producto no encontrado');
    }

    if (producto._count.compras > 0 || producto._count.ventas > 0) {
      throw new Error('No se puede eliminar un producto con movimientos registrados. Desactívalo en su lugar.');
    }

    await prisma.productoInventario.delete({ where: { id } });
    console.log(`✅ Producto eliminado: ${producto.nombre}`);
  }

  // ==================== COMPRAS ====================

  /**
   * Registrar compra de productos
   */
  async registrarCompra(data: {
    productoId: string;
    cantidad: number;
    precioUnitario: number;
    fecha?: Date;
    proveedor?: string;
    factura?: string;
    notas?: string;
  }) {
    // Validar producto existe
    const producto = await this.getProductoById(data.productoId);

    if (data.cantidad <= 0) {
      throw new Error('La cantidad debe ser mayor a 0');
    }

    const total = Number(data.cantidad) * Number(data.precioUnitario);

    // Crear compra y actualizar stock en transacción
    const compra = await prisma.$transaction(async (tx) => {
      // Crear registro de compra
      const nuevaCompra = await tx.compraInventario.create({
        data: {
          productoId: data.productoId,
          cantidad: Number(data.cantidad),
          precioUnitario: Number(data.precioUnitario),
          total,
          fecha: data.fecha || new Date(),
          proveedor: data.proveedor || null,
          factura: data.factura || null,
          notas: data.notas || null,
        },
        include: {
          producto: true,
        },
      });

      // Actualizar stock y precio de compra del producto
      await tx.productoInventario.update({
        where: { id: data.productoId },
        data: {
          stock: { increment: Number(data.cantidad) },
          precioCompra: Number(data.precioUnitario), // Actualizar al último precio de compra
        },
      });

      return nuevaCompra;
    });

    console.log(`✅ Compra registrada: ${data.cantidad}x ${producto.nombre} - Total: $${total}`);
    return compra;
  }

  /**
   * Obtener todas las compras con filtros
   */
  async getAllCompras(filters?: {
    fechaInicio?: Date;
    fechaFin?: Date;
    productoId?: string;
  }) {
    const where: any = {};

    if (filters?.fechaInicio || filters?.fechaFin) {
      where.fecha = {};
      if (filters.fechaInicio) where.fecha.gte = startOfDay(filters.fechaInicio);
      if (filters.fechaFin) where.fecha.lte = endOfDay(filters.fechaFin);
    }

    if (filters?.productoId) {
      where.productoId = filters.productoId;
    }

    const compras = await prisma.compraInventario.findMany({
      where,
      include: {
        producto: true,
      },
      orderBy: { fecha: 'desc' },
    });

    return compras;
  }

  /**
   * Eliminar compra (revierte el stock)
   */
  async deleteCompra(id: string) {
    const compra = await prisma.compraInventario.findUnique({
      where: { id },
      include: { producto: true },
    });

    if (!compra) {
      throw new Error('Compra no encontrada');
    }

    // Verificar que haya suficiente stock para revertir
    if (compra.producto.stock < compra.cantidad) {
      throw new Error('No hay suficiente stock para revertir esta compra');
    }

    await prisma.$transaction([
      // Restar del stock
      prisma.productoInventario.update({
        where: { id: compra.productoId },
        data: { stock: { decrement: compra.cantidad } },
      }),
      // Eliminar compra
      prisma.compraInventario.delete({ where: { id } }),
    ]);

    console.log(`✅ Compra eliminada: ${compra.cantidad}x ${compra.producto.nombre}`);
  }

  // ==================== VENTAS ====================

  /**
   * Registrar venta de productos
   */
  async registrarVenta(data: {
    productoId: string;
    cantidad: number;
    metodoPago?: string;
    notas?: string;
  }) {
    // Validar producto existe y tiene stock
    const producto = await this.getProductoById(data.productoId);

    if (data.cantidad <= 0) {
      throw new Error('La cantidad debe ser mayor a 0');
    }

    if (producto.stock < data.cantidad) {
      throw new Error(`Stock insuficiente. Disponible: ${producto.stock} ${producto.unidadMedida}`);
    }

    const total = Number(data.cantidad) * producto.precioVenta;

    // Crear venta y actualizar stock en transacción
    const venta = await prisma.$transaction(async (tx) => {
      // Crear registro de venta
      const nuevaVenta = await tx.ventaInventario.create({
        data: {
          productoId: data.productoId,
          cantidad: Number(data.cantidad),
          precioUnitario: producto.precioVenta,
          total,
          metodoPago: data.metodoPago || 'EFECTIVO',
          notas: data.notas || null,
        },
        include: {
          producto: true,
        },
      });

      // Actualizar stock del producto
      await tx.productoInventario.update({
        where: { id: data.productoId },
        data: {
          stock: { decrement: Number(data.cantidad) },
        },
      });

      return nuevaVenta;
    });

    console.log(`✅ Venta registrada: ${data.cantidad}x ${producto.nombre} - Total: $${total}`);
    return venta;
  }

  /**
   * Obtener todas las ventas con filtros
   */
  async getAllVentas(filters?: {
    fechaInicio?: Date;
    fechaFin?: Date;
    productoId?: string;
  }) {
    const where: any = {};

    if (filters?.fechaInicio || filters?.fechaFin) {
      where.fecha = {};
      if (filters.fechaInicio) where.fecha.gte = startOfDay(filters.fechaInicio);
      if (filters.fechaFin) where.fecha.lte = endOfDay(filters.fechaFin);
    }

    if (filters?.productoId) {
      where.productoId = filters.productoId;
    }

    const ventas = await prisma.ventaInventario.findMany({
      where,
      include: {
        producto: true,
      },
      orderBy: { fecha: 'desc' },
    });

    return ventas;
  }

  /**
   * Eliminar venta (revierte el stock)
   */
  async deleteVenta(id: string) {
    const venta = await prisma.ventaInventario.findUnique({
      where: { id },
      include: { producto: true },
    });

    if (!venta) {
      throw new Error('Venta no encontrada');
    }

    await prisma.$transaction([
      // Devolver al stock
      prisma.productoInventario.update({
        where: { id: venta.productoId },
        data: { stock: { increment: venta.cantidad } },
      }),
      // Eliminar venta
      prisma.ventaInventario.delete({ where: { id } }),
    ]);

    console.log(`✅ Venta eliminada: ${venta.cantidad}x ${venta.producto.nombre}`);
  }

  // ==================== ESTADÍSTICAS Y REPORTES ====================

  /**
   * Obtener estadísticas generales del inventario
   */
  async getEstadisticas() {
    const [productos, compras, ventas] = await Promise.all([
      prisma.productoInventario.count({ where: { activo: true } }),
      prisma.compraInventario.aggregate({ _sum: { total: true } }),
      prisma.ventaInventario.aggregate({ _sum: { total: true } }),
    ]);

    // Calcular productos con stock bajo
    const todosProductosActivos = await prisma.productoInventario.findMany({
      where: { activo: true },
      select: { stock: true, stockMinimo: true, precioCompra: true },
    });

    const productosStockBajo = todosProductosActivos.filter(
      (p) => p.stock <= p.stockMinimo
    ).length;

    // Calcular valor total del stock
    const valorTotalStock = todosProductosActivos.reduce(
      (sum, p) => sum + p.stock * p.precioCompra,
      0
    );

    // Producto más vendido
    const productoMasVendido = await prisma.ventaInventario.groupBy({
      by: ['productoId'],
      _sum: {
        cantidad: true,
        total: true,
      },
      orderBy: {
        _sum: {
          cantidad: 'desc',
        },
      },
      take: 1,
    });

    let productoTop = null;
    if (productoMasVendido.length > 0) {
      const producto = await prisma.productoInventario.findUnique({
        where: { id: productoMasVendido[0].productoId },
      });

      if (producto) {
        productoTop = {
          producto,
          cantidadVendida: productoMasVendido[0]._sum.cantidad || 0,
          totalVentas: productoMasVendido[0]._sum.total || 0,
        };
      }
    }

    return {
      totalProductos: productos,
      productosActivos: productos,
      productosStockBajo,
      valorTotalStock,
      totalCompras: compras._sum.total || 0,
      totalVentas: ventas._sum.total || 0,
      gananciaTotal: (ventas._sum.total || 0) - (compras._sum.total || 0),
      productoMasVendido: productoTop,
    };
  }

  /**
   * Obtener reporte detallado de inventario
   */
  async getReporte(fechaInicio?: Date, fechaFin?: Date) {
    const where: any = {};
    if (fechaInicio || fechaFin) {
      where.fecha = {};
      if (fechaInicio) where.fecha.gte = startOfDay(fechaInicio);
      if (fechaFin) where.fecha.lte = endOfDay(fechaFin);
    }

    const [ventas, ventasPorCategoria, ventasPorMetodoPago] = await Promise.all([
      // Todas las ventas del período
      prisma.ventaInventario.findMany({
        where,
        include: { producto: true },
      }),

      // Ventas agrupadas por categoría
      prisma.ventaInventario.groupBy({
        by: ['productoId'],
        where,
        _sum: {
          cantidad: true,
          total: true,
        },
      }),

      // Ventas por método de pago
      prisma.ventaInventario.groupBy({
        by: ['metodoPago'],
        where,
        _sum: {
          cantidad: true,
          total: true,
        },
      }),
    ]);

    // Calcular totales
    const totalVentas = ventas.length;
    const cantidadVendida = ventas.reduce((sum, v) => sum + v.cantidad, 0);
    const ingresosBrutos = ventas.reduce((sum, v) => sum + v.total, 0);
    const costoProductos = ventas.reduce(
      (sum, v) => sum + v.cantidad * v.producto.precioCompra,
      0
    );
    const gananciaTotal = ingresosBrutos - costoProductos;
    const margenPromedio = ingresosBrutos > 0 ? (gananciaTotal / ingresosBrutos) * 100 : 0;

    // Productos más vendidos
    const productosMasVendidos = await Promise.all(
      ventasPorCategoria.slice(0, 10).map(async (item) => {
        const producto = await prisma.productoInventario.findUnique({
          where: { id: item.productoId },
        });

        const ventasProducto = ventas.filter((v) => v.productoId === item.productoId);
        const costo = ventasProducto.reduce(
          (sum, v) => sum + v.cantidad * v.producto.precioCompra,
          0
        );

        return {
          producto,
          cantidadVendida: item._sum.cantidad || 0,
          ingresos: item._sum.total || 0,
          ganancia: (item._sum.total || 0) - costo,
        };
      })
    );

    // Agrupar por categoría
    const categorias = [...new Set(ventas.map((v) => v.producto.categoria))];
    const ventasPorCat = categorias.map((cat) => {
      const ventasCat = ventas.filter((v) => v.producto.categoria === cat);
      const ingresos = ventasCat.reduce((sum, v) => sum + v.total, 0);
      const costo = ventasCat.reduce(
        (sum, v) => sum + v.cantidad * v.producto.precioCompra,
        0
      );

      return {
        categoria: cat,
        cantidad: ventasCat.reduce((sum, v) => sum + v.cantidad, 0),
        ingresos,
        ganancia: ingresos - costo,
      };
    });

    return {
      periodo: {
        inicio: fechaInicio?.toISOString() || '',
        fin: fechaFin?.toISOString() || '',
      },
      resumen: {
        totalVentas,
        cantidadVendida,
        ingresosBrutos,
        costoProductos,
        gananciaTotal,
        margenPromedio,
      },
      ventasPorCategoria: ventasPorCat,
      productosMasVendidos,
      ventasPorMetodoPago: ventasPorMetodoPago.map((item) => ({
        metodoPago: item.metodoPago,
        cantidad: item._sum.cantidad || 0,
        total: item._sum.total || 0,
      })),
    };
  }

  /**
   * Obtener productos con stock bajo
   */
  async getProductosStockBajo() {
    const productos = await prisma.productoInventario.findMany({
      where: {
        activo: true,
      },
      orderBy: { stock: 'asc' },
    });

    // Filtrar en JavaScript los que tienen stock <= stockMinimo
    return productos.filter((p) => p.stock <= p.stockMinimo);
  }
}

export const inventarioService = new InventarioService();