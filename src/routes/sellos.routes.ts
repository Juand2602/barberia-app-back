// src/routes/sellos.routes.ts

import { Router } from 'express';
import { sellosController } from '../controllers/sellos.controller';

const router = Router();

// Gestión de sellos de clientes
router.post('/agregar', (req, res) => sellosController.agregarSellos(req, res));
router.post('/canjear', (req, res) => sellosController.canjearSellos(req, res));
router.get('/historial/:clienteId', (req, res) => sellosController.getHistorial(req, res));
router.get('/estadisticas/:clienteId', (req, res) => sellosController.getEstadisticas(req, res));

// Gestión de premios
router.get('/premios', (req, res) => sellosController.getPremios(req, res));
router.post('/premios', (req, res) => sellosController.crearPremio(req, res));
router.put('/premios/:id', (req, res) => sellosController.actualizarPremio(req, res));
router.delete('/premios/:id', (req, res) => sellosController.eliminarPremio(req, res));

export default router;