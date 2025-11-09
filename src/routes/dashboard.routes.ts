// src/routes/dashboard.routes.ts - NUEVO

import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';

const router = Router();

// Dashboard principal
router.get('/citas-hoy', dashboardController.getCitasHoy);

// Notificaciones (badge)
router.get('/notificaciones-pendientes', dashboardController.getNotificacionesPendientes);

// Resumen semanal
router.get('/resumen-semanal', dashboardController.getResumenSemanal);

export default router;