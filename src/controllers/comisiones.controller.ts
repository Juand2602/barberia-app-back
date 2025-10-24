// src/controllers/comisiones.controller.ts

import { Request, Response } from 'express';
import { comisionesService } from '../services/comisiones.service';

export class ComisionesController {
  // GET /api/comisiones/empleado/:empleadoId/pendientes
  async calcularPendientes(req: Request, res: Response) {
    try {
      const { empleadoId } = req.params;
      const { fechaInicio, fechaFin } = req.query;

      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({
          success: false,
          message: 'fechaInicio y fechaFin son requeridos',
        });
      }

      const comisiones = await comisionesService.calcularComisionesPendientes(
        empleadoId,
        new Date(fechaInicio as string),
        new Date(fechaFin as string)
      );

      res.json({
        success: true,
        data: comisiones,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // GET /api/comisiones/empleado/:empleadoId/historial
  async obtenerHistorial(req: Request, res: Response) {
    try {
      const { empleadoId } = req.params;

      const historial = await comisionesService.obtenerHistorialPagos(empleadoId);

      res.json({
        success: true,
        data: historial,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // POST /api/comisiones/empleado/:empleadoId/pagar
  async registrarPago(req: Request, res: Response) {
    try {
      const { empleadoId } = req.params;
      const { periodo, fechaInicio, fechaFin, metodoPago, referencia, notas, ajuste } = req.body;

      if (!periodo || !fechaInicio || !fechaFin || !metodoPago) {
        return res.status(400).json({
          success: false,
          message: 'Faltan datos requeridos',
        });
      }

      if (!['EFECTIVO', 'TRANSFERENCIA'].includes(metodoPago)) {
        return res.status(400).json({
          success: false,
          message: 'Método de pago inválido',
        });
      }

      const pago = await comisionesService.registrarPago({
        empleadoId,
        periodo,
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        metodoPago,
        referencia,
        notas,
        ajuste: ajuste ? parseFloat(ajuste) : 0,
      });

      res.status(201).json({
        success: true,
        message: 'Pago de comisión registrado exitosamente',
        data: pago,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export const comisionesController = new ComisionesController();