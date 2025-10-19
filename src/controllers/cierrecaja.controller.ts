// src/controllers/cierrecaja.controller.ts (Nuevo Backend - CORREGIDO)

import { Request, Response } from 'express';
import { cierreCajaService } from '../services/cierrecaja.service';

export class CierreCajaController {
  // GET /api/cierre-caja
  async getAll(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;

      const cierres = await cierreCajaService.getAll(
        fechaInicio ? new Date(fechaInicio as string) : undefined,
        fechaFin ? new Date(fechaFin as string) : undefined
      );

      res.json({
        success: true,
        data: cierres,
        total: cierres.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener cierres de caja',
        error: error.message,
      });
    }
  }

  // GET /api/cierre-caja/ultimo
  async getUltimo(req: Request, res: Response) {
    try {
      const cierre = await cierreCajaService.getUltimoCierre();

      if (!cierre) {
        return res.json({
          success: true,
          data: null,
          message: 'No hay cierres de caja registrados',
        });
      }

      res.json({
        success: true,
        data: cierre,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener último cierre',
        error: error.message,
      });
    }
  }

  // GET /api/cierre-caja/puede-cerrar
  async puedeCerrar(req: Request, res: Response) {
    try {
      const resultado = await cierreCajaService.puedeCerrarHoy();

      res.json({
        success: true,
        data: resultado,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al verificar cierre',
        error: error.message,
      });
    }
  }

  // GET /api/cierre-caja/calcular
  async calcularDatos(req: Request, res: Response) {
    try {
      const { fecha } = req.query;
      const fechaCierre = fecha ? new Date(fecha as string) : new Date();

      const datos = await cierreCajaService.calcularDatosCierre(fechaCierre);

      res.json({
        success: true,
        data: datos,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al calcular datos de cierre',
        error: error.message,
      });
    }
  }

  // GET /api/cierre-caja/estadisticas
  async getEstadisticas(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;

      const estadisticas = await cierreCajaService.getEstadisticas(
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

  // GET /api/cierre-caja/fecha/:fecha
  async getByFecha(req: Request, res: Response) {
    try {
      const { fecha } = req.params;
      const cierre = await cierreCajaService.getByFecha(new Date(fecha));

      if (!cierre) {
        return res.status(404).json({
          success: false,
          message: 'No se encontró cierre para esta fecha',
        });
      }

      res.json({
        success: true,
        data: cierre,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener cierre',
        error: error.message,
      });
    }
  }

  // GET /api/cierre-caja/:id
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const cierre = await cierreCajaService.getById(id);

      res.json({
        success: true,
        data: cierre,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  // POST /api/cierre-caja
  async create(req: Request, res: Response) {
    try {
      const cierre = await cierreCajaService.create(req.body);

      res.status(201).json({
        success: true,
        message: 'Cierre de caja registrado exitosamente',
        data: cierre,
      });
    } catch (error: any) {
      if (error.message.includes('Ya existe') || error.message.includes('requiere')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al crear el cierre de caja',
        error: error.message,
      });
    }
  }

  // PUT /api/cierre-caja/:id
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const cierre = await cierreCajaService.update(id, req.body);

      res.json({
        success: true,
        message: 'Cierre de caja actualizado exitosamente',
        data: cierre,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // DELETE /api/cierre-caja/:id
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await cierreCajaService.delete(id);

      res.json({
        success: true,
        message: 'Cierre de caja eliminado exitosamente',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

    // POST /api/cierre-caja/open
  async open(req: Request, res: Response) {
    try {
      const { montoInicial, usuarioId, notas } = req.body;
      if (montoInicial == null) {
        return res.status(400).json({ success: false, message: 'montoInicial requerido' });
      }

      const apertura = await cierreCajaService.createApertura({
        montoInicial: Number(montoInicial),
        usuarioId: usuarioId ? Number(usuarioId) : undefined,
        notas,
      });

      res.status(201).json({ success: true, data: apertura, message: 'Apertura creada' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Error al crear apertura' });
    }
  }

  // GET /api/cierre-caja/open
  async getOpen(req: Request, res: Response) {
    try {
      const { usuarioId } = req.query;
      const apertura = await cierreCajaService.getAperturaAbierta(usuarioId ? Number(usuarioId) : undefined);
      res.json({ success: true, data: apertura });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
  // GET /api/cierre-caja/aperturas
  async getAperturas(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      const aperturas = await cierreCajaService.getAperturas(
        fechaInicio ? new Date(fechaInicio as string) : undefined,
        fechaFin ? new Date(fechaFin as string) : undefined
      );
      res.json({ success: true, data: aperturas });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /api/cierre-caja/aperturas/estadisticas
  async getAperturasEstadisticas(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      const stats = await cierreCajaService.getAperturasEstadisticas(
        fechaInicio ? new Date(fechaInicio as string) : undefined,
        fechaFin ? new Date(fechaFin as string) : undefined
      );
      res.json({ success: true, data: stats });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

}

export const cierreCajaController = new CierreCajaController();