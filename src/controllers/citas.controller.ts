// src/controllers/citas.controller.ts (Nuevo Backend - CORREGIDO)

import { Request, Response } from 'express';
import { citasService } from '../services/citas.service';

export class CitasController {
  // GET /api/citas
  async getAll(req: Request, res: Response) {
    try {
      const { 
        fechaInicio, 
        fechaFin, 
        empleadoId, 
        clienteId, 
        estado 
      } = req.query;

      const filters: any = {};

      if (fechaInicio) {
        filters.fechaInicio = new Date(fechaInicio as string);
      }
      if (fechaFin) {
        filters.fechaFin = new Date(fechaFin as string);
      }
      if (empleadoId) {
        filters.empleadoId = empleadoId as string;
      }
      if (clienteId) {
        filters.clienteId = clienteId as string;
      }
      if (estado) {
        filters.estado = estado as string;
      }

      const citas = await citasService.getAll(filters);

      res.json({
        success: true,
        data: citas,
        total: citas.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener citas',
        error: error.message,
      });
    }
  }

  // GET /api/citas/fecha/:fecha
  async getByFecha(req: Request, res: Response) {
    try {
      const { fecha } = req.params;
      const { empleadoId } = req.query;

      const citas = await citasService.getByFecha(
        new Date(fecha),
        empleadoId as string | undefined
      );

      res.json({
        success: true,
        data: citas,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener citas',
        error: error.message,
      });
    }
  }

  // GET /api/citas/semana/:fechaInicio
  async getBySemana(req: Request, res: Response) {
    try {
      const { fechaInicio } = req.params;
      const { empleadoId } = req.query;

      const citas = await citasService.getBySemana(
        new Date(fechaInicio),
        empleadoId as string | undefined
      );

      res.json({
        success: true,
        data: citas,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener citas',
        error: error.message,
      });
    }
  }

  // GET /api/citas/mes/:year/:month
  async getByMes(req: Request, res: Response) {
    try {
      const { year, month } = req.params;
      const { empleadoId } = req.query;

      const citas = await citasService.getByMes(
        parseInt(year),
        parseInt(month),
        empleadoId as string | undefined
      );

      res.json({
        success: true,
        data: citas,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener citas',
        error: error.message,
      });
    }
  }

  // GET /api/citas/proximas
  async getProximas(req: Request, res: Response) {
    try {
      const { limite, empleadoId } = req.query;

      const citas = await citasService.getProximas(
        limite ? parseInt(limite as string) : 10,
        empleadoId as string | undefined
      );

      res.json({
        success: true,
        data: citas,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener próximas citas',
        error: error.message,
      });
    }
  }

  // GET /api/citas/estadisticas
  async getEstadisticas(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;

      const estadisticas = await citasService.getEstadisticas(
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

  // GET /api/citas/:id
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const cita = await citasService.getById(id);

      res.json({
        success: true,
        data: cita,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  // POST /api/citas
  async create(req: Request, res: Response) {
    try {
      const cita = await citasService.create(req.body);

      res.status(201).json({
        success: true,
        message: 'Cita creada exitosamente',
        data: cita,
      });
    } catch (error: any) {
      if (error.message.includes('obligatorio') || error.message.includes('no está disponible')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al crear la cita',
        error: error.message,
      });
    }
  }

  // PUT /api/citas/:id
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const cita = await citasService.update(id, req.body);

      res.json({
        success: true,
        message: 'Cita actualizada exitosamente',
        data: cita,
      });
    } catch (error: any) {
      if (error.message.includes('obligatorio') || error.message.includes('no está disponible')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al actualizar la cita',
        error: error.message,
      });
    }
  }

  // PATCH /api/citas/:id/estado
  async cambiarEstado(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { estado, motivoCancelacion } = req.body;
      
      const cita = await citasService.cambiarEstado(id, { estado, motivoCancelacion });

      res.json({
        success: true,
        message: 'Estado de cita actualizado',
        data: cita,
      });
    } catch (error: any) {
      if (error.message.includes('obligatorio') || error.message.includes('no se puede modificar')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al cambiar estado',
        error: error.message,
      });
    }
  }

  // DELETE /api/citas/:id
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await citasService.delete(id);

      res.json({
        success: true,
        message: 'Cita eliminada exitosamente',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export const citasController = new CitasController();