// src/app-bot.ts
// Entry point para el servicio del bot de WhatsApp (Railway)
// Incluye: webhook WhatsApp + cron de limpieza de conversaciones
// NO incluye: rutas de admin, reportes, inventario, comisiones, cierre de caja, dashboard

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';

process.env.TZ = 'America/Bogota';

import webhookRoutes from './routes/webhook.routes';
import { limpiarConversacionesInactivas } from './services/whatsapp/bot.service';
import { enviarRecordatoriosPendientes } from './services/notificaciones.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ limit: '100kb', extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Webhook WhatsApp
app.use('/webhook', webhookRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'barberia-bot',
  });
});

app.get('/', (req, res) => {
  res.json({
    message: '💈 Bot WhatsApp Barbería',
    version: '1.0.0',
  });
});

// Limpiar conversaciones inactivas cada 5 minutos
cron.schedule('*/5 * * * *', async () => {
  try {
    await limpiarConversacionesInactivas();
  } catch (err) {
    console.error('❌ Error en cron de limpieza:', err);
  }
});

// Recordatorio de cita (~1 hora antes) cada 5 minutos
cron.schedule('*/5 * * * *', async () => {
  try {
    await enviarRecordatoriosPendientes();
  } catch (err) {
    console.error('❌ Error en cron de recordatorios:', err);
  }
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`🤖 Bot WhatsApp corriendo en puerto ${PORT}`);
  console.log(`📱 Webhook: http://localhost:${PORT}/webhook`);
});

export default app;
