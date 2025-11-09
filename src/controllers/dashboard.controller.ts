// src/controllers/dashboard.controller.ts - CORREGIDO

import { Request, Response } from 'express';
import { citasService } from '../services/citas.service';
import { empleadosService } from '../services/empleados.service';

export class DashboardController {
  /**
   * GET /api/dashboard/citas-hoy
   * Obtiene resumen de citas del día para el dashboard
   */
  async getCitasHoy(req: Request, res: Response) {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);

      // Obtener todas las citas de hoy
      const citas = await citasService.getAll({
        fechaInicio: hoy,
        fechaFin: manana,
      });

      // Agrupar por estado
      const nuevas = citas.filter(c => 
        c.estado === 'CONFIRMADA' && 
        c.createdAt > new Date(Date.now() - 30 * 60000) // Últimos 30 min
      );
      
      const confirmadas = citas.filter(c => 
        c.estado === 'CONFIRMADA' || c.estado === 'PENDIENTE'
      );
      
      const completadas = citas.filter(c => c.estado === 'COMPLETADA');
      const canceladas = citas.filter(c => c.estado === 'CANCELADA');

      // Estadísticas
      const stats = {
        total: citas.length,
        nuevas: nuevas.length,
        confirmadas: confirmadas.length,
        completadas: completadas.length,
        canceladas: canceladas.length,
        enCurso: citas.filter(c => {
          const ahora = new Date();
          const inicio = new Date(c.fechaHora);
          const fin = new Date(inicio.getTime() + c.duracionMinutos * 60000);
          return ahora >= inicio && ahora <= fin;
        }).length,
      };

      // Por barbero
      const porBarbero = await Promise.all(
        (await empleadosService.getAll(true)).map(async (emp) => {
          const citasBarbero = citas.filter(c => c.empleadoId === emp.id);
          return {
            barbero: emp.nombre,
            total: citasBarbero.length,
            completadas: citasBarbero.filter(c => c.estado === 'COMPLETADA').length,
            pendientes: citasBarbero.filter(c => 
              c.estado === 'CONFIRMADA' || c.estado === 'PENDIENTE'
            ).length,
          };
        })
      );

      res.json({
        success: true,
        fecha: hoy,
        stats,
       nuevas: nuevas.map(this.formatearCita.bind(this)),
       confirmadas: confirmadas.map(this.formatearCita.bind(this)),
       completadas: completadas.map(this.formatearCita.bind(this)),
       canceladas: canceladas.map(this.formatearCita.bind(this)),
       porBarbero,
      });
    } catch (error: any) {
      console.error('❌ Error en getCitasHoy:', error); // 🔧 AGREGADO: log
      res.status(500).json({
        success: false,
        message: 'Error al obtener citas del día',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/dashboard/notificaciones-pendientes
   * Para mostrar badge con número de citas nuevas
   */
  async getNotificacionesPendientes(req: Request, res: Response) {
    try {
      const hace30Min = new Date(Date.now() - 30 * 60000);

      const citasNuevas = await citasService.getAll({
        fechaInicio: hace30Min,
      });

      const pendientes = citasNuevas.filter(c => 
        c.estado === 'CONFIRMADA' && c.createdAt > hace30Min
      );

      res.json({
        success: true,
        count: pendientes.length,
        citas: pendientes.map(c => this.formatearCita(c)), // 🔧 CORREGIDO
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener notificaciones',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/dashboard/resumen-semanal
   */
  async getResumenSemanal(req: Request, res: Response) {
    try {
      const hoy = new Date();
      const hace7Dias = new Date();
      hace7Dias.setDate(hace7Dias.getDate() - 7);

      const citas = await citasService.getAll({
        fechaInicio: hace7Dias,
        fechaFin: hoy,
      });

      // Agrupar por día
      const porDia = Array.from({ length: 7 }, (_, i) => {
        const dia = new Date(hace7Dias);
        dia.setDate(dia.getDate() + i);
        
        const citasDia = citas.filter(c => {
          const fechaCita = new Date(c.fechaHora);
          return fechaCita.toDateString() === dia.toDateString();
        });

        return {
          fecha: dia.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }),
          total: citasDia.length,
          completadas: citasDia.filter(c => c.estado === 'COMPLETADA').length,
          canceladas: citasDia.filter(c => c.estado === 'CANCELADA').length,
        };
      });

      res.json({
        success: true,
        porDia,
        totales: {
          citas: citas.length,
          completadas: citas.filter(c => c.estado === 'COMPLETADA').length,
          canceladas: citas.filter(c => c.estado === 'CANCELADA').length,
          tasa_completadas: citas.length > 0 
            ? ((citas.filter(c => c.estado === 'COMPLETADA').length / citas.length) * 100).toFixed(1)
            : '0.0',
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener resumen semanal',
        error: error.message,
      });
    }
  }

  // 🔧 CORREGIDO: Cambiar a arrow function para mantener contexto
  private formatearCita(cita: any) {
    return {
      id: cita.id,
      radicado: cita.radicado,
      cliente: cita.cliente.nombre,
      telefono: cita.cliente.telefono,
      empleado: cita.empleado.nombre,
      servicio: cita.servicioNombre,
      fecha: cita.fechaHora,
      hora: new Date(cita.fechaHora).toLocaleTimeString('es-CO', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      duracion: cita.duracionMinutos,
      estado: cita.estado,
      origen: cita.origen,
      notas: cita.notas,
      esNueva: cita.createdAt > new Date(Date.now() - 30 * 60000),
    };
  }
}

export const dashboardController = new DashboardController();