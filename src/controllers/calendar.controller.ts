// src/controllers/calendar.controller.ts

import { Request, Response } from 'express';
import { googleCalendarService } from '../services/google-calendar.service';

export class CalendarController {
  // GET /api/calendar/auth/:empleadoId
  async iniciarAutorizacion(req: Request, res: Response) {
    try {
      const { empleadoId } = req.params;
      const authUrl = googleCalendarService.getAuthUrl(empleadoId);
      
      res.json({
        success: true,
        authUrl,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // GET /api/calendar/callback
  async callback(req: Request, res: Response) {
    try {
      const { code, state: empleadoId } = req.query;

      if (!code || !empleadoId) {
        return res.status(400).send('Faltan parámetros');
      }

      await googleCalendarService.handleCallback(
        code as string,
        empleadoId as string
      );

      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Conectado</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                text-align: center;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              }
              .success-icon {
                font-size: 64px;
                color: #10b981;
                margin-bottom: 20px;
              }
              h1 {
                color: #1f2937;
                margin-bottom: 10px;
              }
              p {
                color: #6b7280;
                font-size: 16px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✅</div>
              <h1>Google Calendar Conectado</h1>
              <p>Tus citas ahora se sincronizarán automáticamente</p>
              <p style="margin-top: 20px; font-size: 14px;">Puedes cerrar esta ventana</p>
            </div>
            <script>
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Error</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                text-align: center;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              }
              .error-icon {
                font-size: 64px;
                margin-bottom: 20px;
              }
              h1 {
                color: #1f2937;
                margin-bottom: 10px;
              }
              p {
                color: #6b7280;
                font-size: 16px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error-icon">❌</div>
              <h1>Error al Conectar</h1>
              <p>${error.message}</p>
              <p style="margin-top: 20px; font-size: 14px;">Puedes cerrar esta ventana e intentar nuevamente</p>
            </div>
          </body>
        </html>
      `);
    }
  }

  // POST /api/calendar/disconnect/:empleadoId
  async desconectar(req: Request, res: Response) {
    try {
      const { empleadoId } = req.params;
      await googleCalendarService.desconectarCalendario(empleadoId);

      res.json({
        success: true,
        message: 'Google Calendar desconectado',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export const calendarController = new CalendarController();