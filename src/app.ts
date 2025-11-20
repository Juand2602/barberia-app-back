// src/app.ts - ACTUALIZADO CON SISTEMA DE SELLOS

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';

// Configurar zona horaria
process.env.TZ = 'America/Bogota';

// Routes
import webhookRoutes from './routes/webhook.routes';
import citasRoutes from './routes/citas.routes';
import clientesRoutes from './routes/clientes.routes';
import empleadosRoutes from './routes/empleados.routes';
import serviciosRoutes from './routes/servicios.routes';
import transaccionesRoutes from './routes/transacciones.routes';
import cierreCajaRoutes from './routes/cierrecaja.routes';
import reportesRoutes from './routes/reportes.routes';
import comisionesRoutes from './routes/comisiones.routes';
import adminRoutes from './routes/admin.routes';
import calendarRoutes from './routes/calendar.routes';
import dashboardRoutes from './routes/dashboard.routes';
import sellosRoutes from './routes/sellos.routes'; // 🌟 NUEVO: Sistema de Sellos

// Services
import { limpiarConversacionesInactivas } from './services/whatsapp/bot.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARES ====================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ==================== RUTAS ====================
app.use('/webhook', webhookRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/empleados', empleadosRoutes);
app.use('/api/servicios', serviciosRoutes);
app.use('/api/transacciones', transaccionesRoutes);
app.use('/api/cierre-caja', cierreCajaRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/comisiones', comisionesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sellos', sellosRoutes); // 🌟 NUEVO: Sistema de Sellos

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'barberia-whatsapp-api'
  });
});

// Root
app.get('/', (req, res) => {
  res.json({ 
    message: '💈 API Barbería WhatsApp',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      webhook: '/webhook',
      api: '/api/*'
    }
  });
});

// ==================== CRON JOBS ====================
// Limpiar conversaciones inactivas cada 5 minutos
cron.schedule('*/5 * * * *', async () => {
  console.log('🧹 Ejecutando limpieza de conversaciones inactivas...');
  await limpiarConversacionesInactivas();
});

// ==================== ERROR HANDLER ====================
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ==================== INICIAR SERVIDOR ====================
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📱 Webhook WhatsApp: http://localhost:${PORT}/webhook`);
  console.log(`🔌 API REST: http://localhost:${PORT}/api`);
  console.log(`🎁 Sistema de Sellos: http://localhost:${PORT}/api/sellos`); // 🌟 NUEVO
});

export default app;