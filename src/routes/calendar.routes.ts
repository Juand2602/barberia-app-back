import { Router } from 'express';
import { calendarController } from '../controllers/calendar.controller';

const router = Router();

// Rutas existentes
router.get('/auth/:empleadoId', (req, res) =>
  calendarController.iniciarAutorizacion(req, res)
);

router.get('/callback', (req, res) =>
  calendarController.callback(req, res)
);

router.post('/disconnect/:empleadoId', (req, res) =>
  calendarController.desconectar(req, res)
);

// 🌟 NUEVAS RUTAS para sincronización
router.post('/sync-existing/:empleadoId', (req, res) =>
  calendarController.sincronizarCitasExistentes(req, res)
);

router.post('/sync-single/:citaId', (req, res) =>
  calendarController.sincronizarCitaUnica(req, res)
);

export default router;