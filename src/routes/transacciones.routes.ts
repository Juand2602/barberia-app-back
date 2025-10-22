// src/routes/transacciones.routes.ts

import { Router } from 'express';
import { transaccionesController } from '../controllers/transacciones.controller';

const router = Router();

// Rutas de transacciones
router.get('/', transaccionesController.getAll.bind(transaccionesController));
router.get('/pendientes', transaccionesController.getPendientes.bind(transaccionesController));
router.get('/estadisticas', transaccionesController.getEstadisticas.bind(transaccionesController));
router.get('/cita/:citaId', transaccionesController.getByCitaId.bind(transaccionesController));
router.get('/:id', transaccionesController.getById.bind(transaccionesController));

router.post('/', transaccionesController.create.bind(transaccionesController));
router.post('/:id/marcar-pagada', transaccionesController.marcarComoPagada.bind(transaccionesController));

router.put('/:id', transaccionesController.update.bind(transaccionesController));

router.delete('/:id', transaccionesController.delete.bind(transaccionesController));

export default router;