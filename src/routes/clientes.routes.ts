// src/routes/clientes.routes.ts (Nuevo Backend - CORREGIDO)

import { Router } from 'express';
import { clientesController } from '../controllers/clientes.controller';

const router = Router();

// Rutas especiales primero
router.get('/:id/estadisticas', (req, res) => clientesController.getEstadisticas(req, res));
router.delete('/:id/permanent', (req, res) => clientesController.permanentDelete(req, res));

// Rutas CRUD
router.get('/', (req, res) => clientesController.getAll(req, res));
router.get('/:id', (req, res) => clientesController.getById(req, res));
router.post('/', (req, res) => clientesController.create(req, res));
router.put('/:id', (req, res) => clientesController.update(req, res));
router.delete('/:id', (req, res) => clientesController.delete(req, res));

export default router;