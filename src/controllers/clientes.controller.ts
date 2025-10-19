// src/controllers/clientes.controller.ts (Nuevo Backend - CORREGIDO)

import { Request, Response } from 'express';
import { clientesService } from '../services/clientes.service';

export class ClientesController {
  // GET /api/clientes
  async getAll(req: Request, res: Response) {
    try {
      const { search, activo } = req.query;
      
      const clientes = await clientesService.getAll(
        search as string,
        activo === 'true' ? true : activo === 'false' ? false : undefined
      );

      res.json({
        success: true,
        data: clientes,
        total: clientes.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener clientes',
        error: error.message,
      });
    }
  }

  // GET /api/clientes/:id
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const cliente = await clientesService.getById(id);

      res.json({
        success: true,
        data: cliente,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  // GET /api/clientes/:id/estadisticas
  async getEstadisticas(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const estadisticas = await clientesService.getEstadisticas(id);

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

  // POST /api/clientes
  async create(req: Request, res: Response) {
    try {
      const cliente = await clientesService.create(req.body);

      res.status(201).json({
        success: true,
        message: 'Cliente creado exitosamente',
        data: cliente,
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
        message: 'Error al crear el cliente',
        error: error.message,
      });
    }
  }

  // PUT /api/clientes/:id
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const cliente = await clientesService.update(id, req.body);

      res.json({
        success: true,
        message: 'Cliente actualizado exitosamente',
        data: cliente,
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
        message: 'Error al actualizar el cliente',
        error: error.message,
      });
    }
  }

  // DELETE /api/clientes/:id
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await clientesService.delete(id);

      res.json({
        success: true,
        message: 'Cliente desactivado exitosamente',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export const clientesController = new ClientesController();