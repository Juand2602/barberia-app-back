// src/app-admin.ts
// Entry point para el backend administrativo (Render)
// Incluye: todas las rutas REST del panel admin
// NO incluye: webhook WhatsApp ni cron del bot

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

process.env.TZ = 'America/Bogota';

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
import sellosRoutes from './routes/sellos.routes';
import inventarioRoutes from './routes/inventario.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ limit: '100kb', extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

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
app.use('/api/sellos', sellosRoutes);
app.use('/api/inventario', inventarioRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'barberia-admin',
  });
});

app.get('/', (req, res) => {
  res.json({
    message: '💈 API Admin Barbería',
    version: '1.0.0',
    endpoints: '/api/*',
  });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Admin API corriendo en puerto ${PORT}`);
  console.log(`🔌 Endpoints: http://localhost:${PORT}/api`);
});

export default app;
