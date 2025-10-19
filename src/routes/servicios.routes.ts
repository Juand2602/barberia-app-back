import { Router } from 'express';
import { serviciosController } from '../controllers/servicios.controller';

const router = Router();

router.get('/', (req, res) => serviciosController.listar(req, res));
router.get('/:id', (req, res) => serviciosController.obtenerPorId(req, res));
router.post('/', (req, res) => serviciosController.crear(req, res));
router.put('/:id', (req, res) => serviciosController.actualizar(req, res));
router.delete('/:id', (req, res) => serviciosController.eliminar(req, res));

export default router;
