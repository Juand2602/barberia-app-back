// src/controllers/reportes.controller.ts - ACTUALIZADO CON INVENTARIO

import { Request, Response } from 'express';
import { reportesService } from '../services/reportes.service';

export class ReportesController {
  // GET /api/reportes/dashboard
  async getDashboard(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      
      const dashboard = await reportesService.getDashboard(
        fechaInicio ? new Date(fechaInicio as string) : undefined,
        fechaFin ? new Date(fechaFin as string) : undefined
      );

      res.json(dashboard);
    } catch (error: any) {
      console.error('Error al obtener dashboard:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/reportes/ventas
  async getReporteVentas(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      
      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ error: 'Fechas requeridas' });
      }

      const reporte = await reportesService.getReporteVentas(
        new Date(fechaInicio as string),
        new Date(fechaFin as string)
      );

      res.json(reporte);
    } catch (error: any) {
      console.error('Error al obtener reporte de ventas:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/reportes/ventas/por-empleado
  async getReporteVentasPorEmpleado(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      
      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ error: 'Fechas requeridas' });
      }

      const reporte = await reportesService.getReporteVentasPorEmpleado(
        new Date(fechaInicio as string),
        new Date(fechaFin as string)
      );

      res.json(reporte);
    } catch (error: any) {
      console.error('Error al obtener reporte de ventas por empleado:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/reportes/ventas/por-servicio
  async getReporteVentasPorServicio(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      
      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ error: 'Fechas requeridas' });
      }

      const reporte = await reportesService.getReporteVentasPorServicio(
        new Date(fechaInicio as string),
        new Date(fechaFin as string)
      );

      res.json(reporte);
    } catch (error: any) {
      console.error('Error al obtener reporte de ventas por servicio:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/reportes/citas
  async getReporteCitas(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      
      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ error: 'Fechas requeridas' });
      }

      const reporte = await reportesService.getReporteCitas(
        new Date(fechaInicio as string),
        new Date(fechaFin as string)
      );

      res.json(reporte);
    } catch (error: any) {
      console.error('Error al obtener reporte de citas:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/reportes/financiero
  async getReporteFinanciero(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      
      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ error: 'Fechas requeridas' });
      }

      // ✅ MODIFICADO: Usar método con inventario
      const reporte = await reportesService.getReporteFinancieroConInventario(
        new Date(fechaInicio as string),
        new Date(fechaFin as string)
      );

      res.json(reporte);
    } catch (error: any) {
      console.error('Error al obtener reporte financiero:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ✅ NUEVO: GET /api/reportes/inventario
  async getReporteInventario(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      
      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ error: 'Fechas requeridas' });
      }

      const reporte = await reportesService.getReporteInventario(
        new Date(fechaInicio as string),
        new Date(fechaFin as string)
      );

      res.json(reporte);
    } catch (error: any) {
      console.error('Error al obtener reporte de inventario:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/reportes/clientes
  async getReporteClientes(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      
      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ error: 'Fechas requeridas' });
      }

      const reporte = await reportesService.getReporteClientes(
        new Date(fechaInicio as string),
        new Date(fechaFin as string)
      );

      res.json(reporte);
    } catch (error: any) {
      console.error('Error al obtener reporte de clientes:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getMetricasDashboard(req: Request, res: Response) {
    try {
      const metricas = await reportesService.getMetricasDashboard();
      res.json(metricas);
    } catch (error: any) {
      console.error('Error al obtener métricas del dashboard:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getServiciosPopulares(req: Request, res: Response) {
    try {
      const { limit } = req.query;
      const servicios = await reportesService.getServiciosPopulares(
        limit ? parseInt(limit as string) : 10
      );
      res.json(servicios);
    } catch (error: any) {
      console.error('Error al obtener servicios populares:', error);
      res.status(500).json({ error: error.message });
    }
  }

}

export const reportesController = new ReportesController();