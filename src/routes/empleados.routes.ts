// src/routes/empleados.routes.ts (Nuevo Backend - CORREGIDO)

import { Router } from 'express';
import { empleadosController } from '../controllers/empleados.controller';

const router = Router();

// Rutas especiales primero (antes de las rutas con :id)
router.get('/:id/estadisticas', (req, res) => empleadosController.getEstadisticas(req, res));
router.post('/:id/verificar-disponibilidad', (req, res) => empleadosController.verificarDisponibilidad(req, res));

// Rutas CRUD
router.get('/', (req, res) => empleadosController.getAll(req, res));
router.get('/:id', (req, res) => empleadosController.getById(req, res));
router.post('/', (req, res) => empleadosController.create(req, res));
router.put('/:id', (req, res) => empleadosController.update(req, res));
router.delete('/:id', (req, res) => empleadosController.delete(req, res));

export default router;