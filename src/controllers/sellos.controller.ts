// src/controllers/sellos.controller.ts

import { Request, Response } from 'express';
import { sellosService } from '../services/sellos.service';

export class SellosController {
  // POST /api/sellos/agregar
  async agregarSellos(req: Request, res: Response) {
    try {
      const { clienteId, cantidad, motivo } = req.body;

      if (!clienteId || !cantidad) {
        return res.status(400).json({
          success: false,
          message: 'clienteId y cantidad son requeridos',
        });
      }

      if (cantidad <= 0) {
        return res.status(400).json({
          success: false,
          message: 'La cantidad debe ser mayor a 0',
        });
      }

      const resultado = await sellosService.agregarSellos({
        clienteId,
        cantidad,
        motivo,
      });

      res.json({
        success: true,
        message: `${cantidad} sello(s) agregado(s) exitosamente`,
        data: resultado,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al agregar sellos',
      });
    }
  }

  // POST /api/sellos/canjear
  async canjearSellos(req: Request, res: Response) {
    try {
      const { clienteId, premioId } = req.body;

      if (!clienteId || !premioId) {
        return res.status(400).json({
          success: false,
          message: 'clienteId y premioId son requeridos',
        });
      }

      const resultado = await sellosService.canjearSellos({
        clienteId,
        premioId,
      });

      res.json({
        success: true,
        message: `Premio "${resultado.premio.nombre}" canjeado exitosamente`,
        data: resultado,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Error al canjear sellos',
      });
    }
  }

  // GET /api/sellos/historial/:clienteId
  async getHistorial(req: Request, res: Response) {
    try {
      const { clienteId } = req.params;
      const { limit } = req.query;

      const historial = await sellosService.getHistorial(
        clienteId,
        limit ? parseInt(limit as string) : undefined
      );

      res.json({
        success: true,
        data: historial,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener historial de sellos',
      });
    }
  }

  // GET /api/sellos/premios
  async getPremios(req: Request, res: Response) {
    try {
      const premios = await sellosService.getPremios();

      res.json({
        success: true,
        data: premios,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener premios',
      });
    }
  }

  // GET /api/sellos/estadisticas/:clienteId
  async getEstadisticas(req: Request, res: Response) {
    try {
      const { clienteId } = req.params;

      const estadisticas = await sellosService.getEstadisticas(clienteId);

      res.json({
        success: true,
        data: estadisticas,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message || 'Error al obtener estadísticas',
      });
    }
  }

  // POST /api/sellos/premios
  async crearPremio(req: Request, res: Response) {
    try {
      const premio = await sellosService.crearPremio(req.body);

      res.status(201).json({
        success: true,
        message: 'Premio creado exitosamente',
        data: premio,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al crear premio',
      });
    }
  }

  // PUT /api/sellos/premios/:id
  async actualizarPremio(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const premio = await sellosService.actualizarPremio(id, req.body);

      res.json({
        success: true,
        message: 'Premio actualizado exitosamente',
        data: premio,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al actualizar premio',
      });
    }
  }

  // DELETE /api/sellos/premios/:id
  async eliminarPremio(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await sellosService.eliminarPremio(id);

      res.json({
        success: true,
        message: 'Premio eliminado exitosamente',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al eliminar premio',
      });
    }
  }
}

export const sellosController = new SellosController();