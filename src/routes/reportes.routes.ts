// src/routes/reportes.routes.ts

import { Router } from 'express';
import { reportesController } from '../controllers/reportes.controller';

const router = Router();

// Dashboard general
router.get('/dashboard', (req, res) => reportesController.getDashboard(req, res));

// Reportes de ventas
router.get('/ventas', (req, res) => reportesController.getReporteVentas(req, res));
router.get('/ventas/por-empleado', (req, res) => reportesController.getReporteVentasPorEmpleado(req, res));
router.get('/ventas/por-servicio', (req, res) => reportesController.getReporteVentasPorServicio(req, res));

// Reportes de citas
router.get('/citas', (req, res) => reportesController.getReporteCitas(req, res));

// Reportes financieros
router.get('/financiero', (req, res) => reportesController.getReporteFinanciero(req, res));

// Reportes de clientes
router.get('/clientes', (req, res) => reportesController.getReporteClientes(req, res));


router.get('/metricas-dashboard', (req, res) => reportesController.getMetricasDashboard(req, res));

router.get('/servicios-populares', (req, res) => reportesController.getServiciosPopulares(req, res));

export default router;