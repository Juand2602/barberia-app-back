// src/routes/calendar.routes.ts

import { Router } from 'express';
import { calendarController } from '../controllers/calendar.controller';

const router = Router();

router.get('/auth/:empleadoId', (req, res) =>
  calendarController.iniciarAutorizacion(req, res)
);

router.get('/callback', (req, res) =>
  calendarController.callback(req, res)
);

router.post('/disconnect/:empleadoId', (req, res) =>
  calendarController.desconectar(req, res)
);

export default router;