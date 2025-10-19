// src/routes/transacciones.routes.ts (Nuevo Backend - CORREGIDO)

import { Router } from 'express';
import { transaccionesController } from '../controllers/transacciones.controller';

const router = Router();

// Rutas especiales primero
router.get('/estadisticas', (req, res) => transaccionesController.getEstadisticas(req, res));
router.get('/servicios-mas-vendidos', (req, res) => transaccionesController.getServiciosMasVendidos(req, res));
router.get('/ingresos-por-empleado', (req, res) => transaccionesController.getIngresosPorEmpleado(req, res));
router.get('/fecha/:fecha', (req, res) => transaccionesController.getByFecha(req, res));
router.post('/desde-cita/:citaId', (req, res) => transaccionesController.registrarDesdeCita(req, res));

// Rutas CRUD
router.get('/', (req, res) => transaccionesController.getAll(req, res));
router.get('/:id', (req, res) => transaccionesController.getById(req, res));
router.post('/', (req, res) => transaccionesController.create(req, res));
router.put('/:id', (req, res) => transaccionesController.update(req, res));
router.delete('/:id', (req, res) => transaccionesController.delete(req, res));

export default router;