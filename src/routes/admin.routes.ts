// src/routes/admin.routes.ts
// 🧹 Script de limpieza de base de datos para entregar app limpia al cliente

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
    
    // 1. Módulo de Inventario (primero las dependencias)
    const deletedVentas = await prisma.ventaInventario.deleteMany();
    console.log(`✓ ${deletedVentas.count} ventas de inventario eliminadas`);

    const deletedCompras = await prisma.compraInventario.deleteMany();
    console.log(`✓ ${deletedCompras.count} compras de inventario eliminadas`);

    const deletedProductos = await prisma.productoInventario.deleteMany();
    console.log(`✓ ${deletedProductos.count} productos de inventario eliminados`);

    // 2. Módulo de Transacciones
    const deletedItems = await prisma.transaccionItem.deleteMany();
    console.log(`✓ ${deletedItems.count} items de transacción eliminados`);

    const deletedTransacciones = await prisma.transaccion.deleteMany();
    console.log(`✓ ${deletedTransacciones.count} transacciones eliminadas`);

    // 3. Módulo de Comisiones
    const deletedPagos = await prisma.pagoComision.deleteMany();
    console.log(`✓ ${deletedPagos.count} pagos de comisión eliminados`);

    // 4. Módulo de Citas
    const deletedCitas = await prisma.cita.deleteMany();
    console.log(`✓ ${deletedCitas.count} citas eliminadas`);

    // 5. Módulo de WhatsApp
    const deletedConversaciones = await prisma.conversacion.deleteMany();
    console.log(`✓ ${deletedConversaciones.count} conversaciones eliminadas`);

    // 6. Módulo de Caja
    const deletedCierres = await prisma.cierreCaja.deleteMany();
    console.log(`✓ ${deletedCierres.count} cierres de caja eliminados`);

    const deletedAperturas = await prisma.aperturaCaja.deleteMany();
    console.log(`✓ ${deletedAperturas.count} aperturas de caja eliminadas`);

    // 7. Módulo de Sellos (sistema de fidelización integrado en Cliente)
    const deletedHistorialSellos = await prisma.historialSello.deleteMany();
    console.log(`✓ ${deletedHistorialSellos.count} registros de historial de sellos eliminados`);

    const deletedConfigPremios = await prisma.configuracionPremio.deleteMany();
    console.log(`✓ ${deletedConfigPremios.count} configuraciones de premios eliminadas`);

    // 8. Entidades principales
    const deletedClientes = await prisma.cliente.deleteMany();
    console.log(`✓ ${deletedClientes.count} clientes eliminados`);

    const deletedEmpleados = await prisma.empleado.deleteMany();
    console.log(`✓ ${deletedEmpleados.count} empleados eliminados`);

    const deletedServicios = await prisma.servicio.deleteMany();
    console.log(`✓ ${deletedServicios.count} servicios eliminados`);

    // 9. Configuración
    const deletedConfig = await prisma.configuracion.deleteMany();
    console.log(`✓ ${deletedConfig.count} configuraciones eliminadas`);

    console.log('✅ Base de datos limpiada exitosamente');

    res.json({
      success: true,
      message: 'Base de datos limpiada exitosamente',
      registrosEliminados: {
        // Inventario
        ventasInventario: deletedVentas.count,
        comprasInventario: deletedCompras.count,
        productosInventario: deletedProductos.count,
        // Transacciones
        transaccionItems: deletedItems.count,
        transacciones: deletedTransacciones.count,
        // Comisiones
        pagosComision: deletedPagos.count,
        // Citas
        citas: deletedCitas.count,
        // WhatsApp
        conversaciones: deletedConversaciones.count,
        // Caja
        cierresCaja: deletedCierres.count,
        aperturasCaja: deletedAperturas.count,
        // Sellos
        historialSellos: deletedHistorialSellos.count,
        configuracionesPremios: deletedConfigPremios.count,
        // Principales
        clientes: deletedClientes.count,
        empleados: deletedEmpleados.count,
        servicios: deletedServicios.count,
        // Config
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

// 📊 ENDPOINT PARA VER ESTADÍSTICAS DE LA BASE DE DATOS
router.get('/database-stats', async (req, res) => {
  try {
    const stats = {
      // Inventario
      ventasInventario: await prisma.ventaInventario.count(),
      comprasInventario: await prisma.compraInventario.count(),
      productosInventario: await prisma.productoInventario.count(),
      // Transacciones
      transaccionItems: await prisma.transaccionItem.count(),
      transacciones: await prisma.transaccion.count(),
      // Comisiones
      pagosComision: await prisma.pagoComision.count(),
      // Citas
      citas: await prisma.cita.count(),
      // WhatsApp
      conversaciones: await prisma.conversacion.count(),
      // Caja
      cierresCaja: await prisma.cierreCaja.count(),
      aperturasCaja: await prisma.aperturaCaja.count(),
      // Sellos
      historialSellos: await prisma.historialSello.count(),
      configuracionesPremios: await prisma.configuracionPremio.count(),
      // Principales
      clientes: await prisma.cliente.count(),
      empleados: await prisma.empleado.count(),
      servicios: await prisma.servicio.count(),
      // Config
      configuraciones: await prisma.configuracion.count(),
    };

    const total = Object.values(stats).reduce((sum: number, count) => sum + (count as number), 0);

    res.json({
      success: true,
      registrosTotales: total,
      detalles: stats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message,
    });
  }
});

export default router;