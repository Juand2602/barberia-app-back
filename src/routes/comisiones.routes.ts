// src/routes/comisiones.routes.ts

import { Router } from 'express';
import { comisionesController } from '../controllers/comisiones.controller';

const router = Router();

// Rutas para comisiones por empleado
router.get('/empleado/:empleadoId/pendientes', (req, res) => 
  comisionesController.calcularPendientes(req, res)
);

router.get('/empleado/:empleadoId/historial', (req, res) => 
  comisionesController.obtenerHistorial(req, res)
);

router.post('/empleado/:empleadoId/pagar', (req, res) => 
  comisionesController.registrarPago(req, res)
);

export default router;