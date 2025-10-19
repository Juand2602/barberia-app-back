// src/controllers/transacciones.controller.ts (Nuevo Backend - CORREGIDO)

import { Request, Response } from 'express';
import { transaccionesService } from '../services/transacciones.service';

export class TransaccionesController {
  // GET /api/transacciones
  async getAll(req: Request, res: Response) {
    try {
      const {
        fechaInicio,
        fechaFin,
        tipo,
        metodoPago,
        empleadoId,
        clienteId,
      } = req.query;

      const filters: any = {};

      if (fechaInicio) {
        filters.fechaInicio = new Date(fechaInicio as string);
      }
      if (fechaFin) {
        filters.fechaFin = new Date(fechaFin as string);
      }
      if (tipo) {
        filters.tipo = tipo as string;
      }
      if (metodoPago) {
        filters.metodoPago = metodoPago as string;
      }
      if (empleadoId) {
        filters.empleadoId = empleadoId as string;
      }
      if (clienteId) {
        filters.clienteId = clienteId as string;
      }

      const transacciones = await transaccionesService.getAll(filters);

      res.json({
        success: true,
        data: transacciones,
        total: transacciones.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener transacciones',
        error: error.message,
      });
    }
  }

  // GET /api/transacciones/fecha/:fecha
  async getByFecha(req: Request, res: Response) {
    try {
      const { fecha } = req.params;
      const transacciones = await transaccionesService.getByFecha(new Date(fecha));

      res.json({
        success: true,
        data: transacciones,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener transacciones',
        error: error.message,
      });
    }
  }

  // GET /api/transacciones/estadisticas
  async getEstadisticas(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;

      const estadisticas = await transaccionesService.getEstadisticas(
        fechaInicio ? new Date(fechaInicio as string) : undefined,
        fechaFin ? new Date(fechaFin as string) : undefined
      );

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

  // GET /api/transacciones/servicios-mas-vendidos
  async getServiciosMasVendidos(req: Request, res: Response) {
    try {
      const { limite, fechaInicio, fechaFin } = req.query;

      const servicios = await transaccionesService.getServiciosMasVendidos(
        limite ? parseInt(limite as string) : 10,
        fechaInicio ? new Date(fechaInicio as string) : undefined,
        fechaFin ? new Date(fechaFin as string) : undefined
      );

      res.json({
        success: true,
        data: servicios,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener servicios más vendidos',
        error: error.message,
      });
    }
  }

  // GET /api/transacciones/ingresos-por-empleado
  async getIngresosPorEmpleado(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;

      const ingresos = await transaccionesService.getIngresosPorEmpleado(
        fechaInicio ? new Date(fechaInicio as string) : undefined,
        fechaFin ? new Date(fechaFin as string) : undefined
      );

      res.json({
        success: true,
        data: ingresos,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener ingresos por empleado',
        error: error.message,
      });
    }
  }

  // GET /api/transacciones/:id
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const transaccion = await transaccionesService.getById(id);

      res.json({
        success: true,
        data: transaccion,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  // POST /api/transacciones
  async create(req: Request, res: Response) {
    try {
      const transaccion = await transaccionesService.create(req.body);

      res.status(201).json({
        success: true,
        message: 'Transacción creada exitosamente',
        data: transaccion,
      });
    } catch (error: any) {
      if (error.message.includes('obligatorio') || error.message.includes('no encontrado') || error.message.includes('requiere')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al crear la transacción',
        error: error.message,
      });
    }
  }

  // POST /api/transacciones/desde-cita/:citaId
  async registrarDesdeCita(req: Request, res: Response) {
    try {
      const { citaId } = req.params;
      const transaccion = await transaccionesService.registrarVentaDesdeCita(citaId);

      res.status(201).json({
        success: true,
        message: 'Venta registrada exitosamente desde cita',
        data: transaccion,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // PUT /api/transacciones/:id
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const transaccion = await transaccionesService.update(id, req.body);

      res.json({
        success: true,
        message: 'Transacción actualizada exitosamente',
        data: transaccion,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // DELETE /api/transacciones/:id
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await transaccionesService.delete(id);

      res.json({
        success: true,
        message: 'Transacción eliminada exitosamente',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export const transaccionesController = new TransaccionesController();