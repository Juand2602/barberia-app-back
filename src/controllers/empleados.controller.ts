// src/controllers/empleados.controller.ts (Nuevo Backend - CORREGIDO)

import { Request, Response } from 'express';
import { empleadosService } from '../services/empleados.service';

export class EmpleadosController {
  // GET /api/empleados
  async getAll(req: Request, res: Response) {
    try {
      const { activo } = req.query;
      
      const empleados = await empleadosService.getAll(
        activo === 'true' ? true : activo === 'false' ? false : undefined
      );

      res.json({
        success: true,
        data: empleados,
        total: empleados.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener empleados',
        error: error.message,
      });
    }
  }

  // GET /api/empleados/:id
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const empleado = await empleadosService.getById(id);

      res.json({
        success: true,
        data: empleado,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  // GET /api/empleados/:id/estadisticas
  async getEstadisticas(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const estadisticas = await empleadosService.getEstadisticas(id);

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

  // POST /api/empleados/:id/verificar-disponibilidad
  async verificarDisponibilidad(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { fecha, duracionMinutos } = req.body;

      if (!fecha || !duracionMinutos) {
        return res.status(400).json({
          success: false,
          message: 'Fecha y duración son requeridos',
        });
      }

      const resultado = await empleadosService.verificarDisponibilidad(
        id,
        new Date(fecha),
        duracionMinutos
      );

      res.json({
        success: true,
        data: resultado,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al verificar disponibilidad',
        error: error.message,
      });
    }
  }

  // POST /api/empleados
  async create(req: Request, res: Response) {
    try {
      // El servicio ahora se encargará de la validación y normalización
      const empleado = await empleadosService.create(req.body);

      res.status(201).json({
        success: true,
        message: 'Empleado creado exitosamente',
        data: empleado,
      });
    } catch (error: any) {
      // Si el error es de validación (lanzado por el servicio), es un 400
      if (error.message.includes('obligatorio') || error.message.includes('Ya existe')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      // Otros errores son del servidor (500)
      res.status(500).json({
        success: false,
        message: 'Error al crear el empleado',
        error: error.message,
      });
    }
  }

  // PUT /api/empleados/:id
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const empleado = await empleadosService.update(id, req.body);

      res.json({
        success: true,
        message: 'Empleado actualizado exitosamente',
        data: empleado,
      });
    } catch (error: any) {
      if (error.message.includes('obligatorio') || error.message.includes('Ya existe')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al actualizar el empleado',
        error: error.message,
      });
    }
  }

  // DELETE /api/empleados/:id
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await empleadosService.delete(id);

      res.json({
        success: true,
        message: 'Empleado desactivado exitosamente',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export const empleadosController = new EmpleadosController();