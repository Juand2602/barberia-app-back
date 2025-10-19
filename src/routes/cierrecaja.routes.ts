// src/routes/cierrecaja.routes.ts
import { Router } from 'express';
import { cierreCajaController } from '../controllers/cierrecaja.controller';

const router = Router();

/**
 * Rutas concretas / especiales — deben ir primero
 * (siempre antes de rutas con parámetros como '/:id')
 */
router.get('/ultimo', (req, res) => cierreCajaController.getUltimo(req, res));
router.get('/puede-cerrar', (req, res) => cierreCajaController.puedeCerrar(req, res));
router.get('/calcular', (req, res) => cierreCajaController.calcularDatos(req, res));
router.get('/estadisticas', (req, res) => cierreCajaController.getEstadisticas(req, res));
router.get('/fecha/:fecha', (req, res) => cierreCajaController.getByFecha(req, res));

// --- Endpoints de apertura y aperturas (también concretos) ---
router.get('/open', (req, res) => cierreCajaController.getOpen(req, res));
router.post('/open', (req, res) => cierreCajaController.open(req, res));
router.get('/aperturas', (req, res) => cierreCajaController.getAperturas(req, res));
router.get('/aperturas/estadisticas', (req, res) => cierreCajaController.getAperturasEstadisticas(req, res));

/**
 * Rutas CRUD generales — '/' y luego '/:id' al final
 */
router.get('/', (req, res) => cierreCajaController.getAll(req, res));
router.post('/', (req, res) => cierreCajaController.create(req, res));
router.put('/:id', (req, res) => cierreCajaController.update(req, res));
router.delete('/:id', (req, res) => cierreCajaController.delete(req, res));
router.get('/:id', (req, res) => cierreCajaController.getById(req, res));

export default router;
