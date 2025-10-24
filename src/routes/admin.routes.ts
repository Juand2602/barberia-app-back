// src/routes/admin.routes.ts (CREAR ESTE ARCHIVO)

import { Router } from 'express';
import prisma from '../config/database';

const router = Router();

// ⚠️ ENDPOINT TEMPORAL - ELIMINAR DESPUÉS DE USAR
router.post('/clean-database', async (req, res) => {
  // 🔒 CONTRASEÑA DE SEGURIDAD
  const { password } = req.body;
  
  if (password !== 'LIMPIAR_BASE_DATOS_2025') {
    return res.status(403).json({
      success: false,
      message: 'Contraseña incorrecta',
    });
  }

  try {
    console.log('🧹 Iniciando limpieza de base de datos...');

    // Eliminar en orden correcto (por dependencias)
    const deletedItems = await prisma.transaccionItem.deleteMany();
    console.log(`✓ ${deletedItems.count} items de transacción eliminados`);

    const deletedTransacciones = await prisma.transaccion.deleteMany();
    console.log(`✓ ${deletedTransacciones.count} transacciones eliminadas`);

    const deletedPagos = await prisma.pagoComision.deleteMany();
    console.log(`✓ ${deletedPagos.count} pagos de comisión eliminados`);

    const deletedCitas = await prisma.cita.deleteMany();
    console.log(`✓ ${deletedCitas.count} citas eliminadas`);

    const deletedConversaciones = await prisma.conversacion.deleteMany();
    console.log(`✓ ${deletedConversaciones.count} conversaciones eliminadas`);

    const deletedCierres = await prisma.cierreCaja.deleteMany();
    console.log(`✓ ${deletedCierres.count} cierres de caja eliminados`);

    const deletedAperturas = await prisma.aperturaCaja.deleteMany();
    console.log(`✓ ${deletedAperturas.count} aperturas de caja eliminadas`);

    const deletedClientes = await prisma.cliente.deleteMany();
    console.log(`✓ ${deletedClientes.count} clientes eliminados`);

    const deletedEmpleados = await prisma.empleado.deleteMany();
    console.log(`✓ ${deletedEmpleados.count} empleados eliminados`);

    const deletedServicios = await prisma.servicio.deleteMany();
    console.log(`✓ ${deletedServicios.count} servicios eliminados`);

    const deletedConfig = await prisma.configuracion.deleteMany();
    console.log(`✓ ${deletedConfig.count} configuraciones eliminadas`);

    console.log('✅ Base de datos limpiada exitosamente');

    res.json({
      success: true,
      message: 'Base de datos limpiada exitosamente',
      registrosEliminados: {
        transaccionItems: deletedItems.count,
        transacciones: deletedTransacciones.count,
        pagosComision: deletedPagos.count,
        citas: deletedCitas.count,
        conversaciones: deletedConversaciones.count,
        cierresCaja: deletedCierres.count,
        aperturasCaja: deletedAperturas.count,
        clientes: deletedClientes.count,
        empleados: deletedEmpleados.count,
        servicios: deletedServicios.count,
        configuraciones: deletedConfig.count,
      },
    });
  } catch (error: any) {
    console.error('❌ Error limpiando base de datos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al limpiar la base de datos',
      error: error.message,
    });
  }
});

export default router;