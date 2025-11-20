// src/controllers/inventario.controller.ts

import { Request, Response } from 'express';
import { inventarioService } from '../services/inventario.service';

export class InventarioController {
  // ==================== PRODUCTOS ====================

  // GET /api/inventario/productos
  async getAllProductos(req: Request, res: Response) {
    try {
      const { categoria, activo, stockBajo } = req.query;

      const filters: any = {};
      if (categoria) filters.categoria = categoria as string;
      if (activo !== undefined) filters.activo = activo === 'true';
      if (stockBajo !== undefined) filters.stockBajo = stockBajo === 'true';

      const productos = await inventarioService.getAllProductos(filters);

      res.json({
        success: true,
        data: productos,
        total: productos.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener productos',
        error: error.message,
      });
    }
  }

  // GET /api/inventario/productos/:id
  async getProductoById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const producto = await inventarioService.getProductoById(id);

      res.json({
        success: true,
        data: producto,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  // POST /api/inventario/productos
  async createProducto(req: Request, res: Response) {
    try {
      const producto = await inventarioService.createProducto(req.body);

      res.status(201).json({
        success: true,
        message: 'Producto creado exitosamente',
        data: producto,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // PUT /api/inventario/productos/:id
  async updateProducto(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const producto = await inventarioService.updateProducto(id, req.body);

      res.json({
        success: true,
        message: 'Producto actualizado exitosamente',
        data: producto,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // DELETE /api/inventario/productos/:id
  async deleteProducto(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await inventarioService.deleteProducto(id);

      res.json({
        success: true,
        message: 'Producto eliminado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // GET /api/inventario/productos/stock-bajo
  async getProductosStockBajo(req: Request, res: Response) {
    try {
      const productos = await inventarioService.getProductosStockBajo();

      res.json({
        success: true,
        data: productos,
        total: productos.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // ==================== COMPRAS ====================

  // GET /api/inventario/compras
  async getAllCompras(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin, productoId } = req.query;

      const filters: any = {};
      if (fechaInicio) filters.fechaInicio = new Date(fechaInicio as string);
      if (fechaFin) filters.fechaFin = new Date(fechaFin as string);
      if (productoId) filters.productoId = productoId as string;

      const compras = await inventarioService.getAllCompras(filters);

      res.json({
        success: true,
        data: compras,
        total: compras.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener compras',
        error: error.message,
      });
    }
  }

  // POST /api/inventario/compras
  async registrarCompra(req: Request, res: Response) {
    try {
      const compra = await inventarioService.registrarCompra(req.body);

      res.status(201).json({
        success: true,
        message: 'Compra registrada exitosamente',
        data: compra,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // DELETE /api/inventario/compras/:id
  async deleteCompra(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await inventarioService.deleteCompra(id);

      res.json({
        success: true,
        message: 'Compra eliminada exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // ==================== VENTAS ====================

  // GET /api/inventario/ventas
  async getAllVentas(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin, productoId } = req.query;

      const filters: any = {};
      if (fechaInicio) filters.fechaInicio = new Date(fechaInicio as string);
      if (fechaFin) filters.fechaFin = new Date(fechaFin as string);
      if (productoId) filters.productoId = productoId as string;

      const ventas = await inventarioService.getAllVentas(filters);

      res.json({
        success: true,
        data: ventas,
        total: ventas.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener ventas',
        error: error.message,
      });
    }
  }

  // POST /api/inventario/ventas
  async registrarVenta(req: Request, res: Response) {
    try {
      const venta = await inventarioService.registrarVenta(req.body);

      res.status(201).json({
        success: true,
        message: 'Venta registrada exitosamente',
        data: venta,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // DELETE /api/inventario/ventas/:id
  async deleteVenta(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await inventarioService.deleteVenta(id);

      res.json({
        success: true,
        message: 'Venta eliminada exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // ==================== ESTADÍSTICAS Y REPORTES ====================

  // GET /api/inventario/estadisticas
  async getEstadisticas(req: Request, res: Response) {
    try {
      const estadisticas = await inventarioService.getEstadisticas();

      res.json({
        success: true,
        data: estadisticas,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
        error: error.message,
      });
    }
  }

  // GET /api/inventario/reporte
  async getReporte(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;

      const reporte = await inventarioService.getReporte(
        fechaInicio ? new Date(fechaInicio as string) : undefined,
        fechaFin ? new Date(fechaFin as string) : undefined
      );

      res.json({
        success: true,
        data: reporte,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al generar reporte',
        error: error.message,
      });
    }
  }
}

export const inventarioController = new InventarioController();