// src/routes/citas.routes.ts (Nuevo Backend - CORREGIDO)

import { Router } from 'express';
import { citasController } from '../controllers/citas.controller';

const router = Router();

// Rutas especiales primero (deben ir antes de las rutas con :id)
router.get('/proximas', (req, res) => citasController.getProximas(req, res));
router.get('/estadisticas', (req, res) => citasController.getEstadisticas(req, res));
router.get('/fecha/:fecha', (req, res) => citasController.getByFecha(req, res));
router.get('/semana/:fechaInicio', (req, res) => citasController.getBySemana(req, res));
router.get('/mes/:year/:month', (req, res) => citasController.getByMes(req, res));

// Rutas CRUD
router.get('/', (req, res) => citasController.getAll(req, res));
router.get('/:id', (req, res) => citasController.getById(req, res));
router.post('/', (req, res) => citasController.create(req, res));
router.put('/:id', (req, res) => citasController.update(req, res));
router.patch('/:id/estado', (req, res) => citasController.cambiarEstado(req, res));
router.delete('/:id', (req, res) => citasController.delete(req, res));

export default router;