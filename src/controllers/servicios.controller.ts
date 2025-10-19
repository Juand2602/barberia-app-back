import { Request, Response } from 'express';
import { serviciosService } from '../services/servicios.service';

export class ServiciosController {
  /**
   * GET /api/servicios
   * Lista todos los servicios, con opción de filtrar por estado activo.
   * El frontend espera una respuesta con la estructura { success: true, data: [...] }
   */
  async listar(req: Request, res: Response) {
    try {
      const { activo } = req.query;
      
      let servicios;
      if (activo === 'true') {
        servicios = await serviciosService.listarActivos();
      } else if (activo === 'false') {
        servicios = await serviciosService.listarInactivos();
      } else {
        servicios = await serviciosService.listarTodos();
      }
      
      // Estructura de respuesta compatible con el frontend
      res.json({
        success: true,
        data: servicios,
        total: servicios.length,
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false,
        message: 'Error al obtener servicios',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/servicios/:id
   * Obtiene un servicio por su ID.
   */
  async obtenerPorId(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const servicio = await serviciosService.obtenerPorId(id);
      
      if (!servicio) {
        return res.status(404).json({ 
          success: false,
          message: 'Servicio no encontrado' 
        });
      }

      res.json({
        success: true,
        data: servicio,
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false,
        message: 'Error al obtener el servicio',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/servicios
   * Crea un nuevo servicio.
   */
  async crear(req: Request, res: Response) {
    try {
      const servicio = await serviciosService.crear(req.body);
      res.status(201).json({
        success: true,
        message: 'Servicio creado exitosamente',
        data: servicio,
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false,
        message: 'Error al crear el servicio',
        error: error.message,
      });
    }
  }

  /**
   * PUT /api/servicios/:id
   * Actualiza un servicio existente.
   */
  async actualizar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const servicio = await serviciosService.actualizar(id, req.body);
      res.json({
        success: true,
        message: 'Servicio actualizado exitosamente',
        data: servicio,
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false,
        message: 'Error al actualizar el servicio',
        error: error.message,
      });
    }
  }

  /**
   * DELETE /api/servicios/:id
   * Elimina (desactiva) un servicio.
   */
  async eliminar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await serviciosService.eliminar(id);
      res.json({
        success: true,
        message: 'Servicio eliminado exitosamente',
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false,
        message: 'Error al eliminar el servicio',
        error: error.message,
      });
    }
  }
}

export const serviciosController = new ServiciosController();
