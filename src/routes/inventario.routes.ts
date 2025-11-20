// src/routes/inventario.routes.ts

import { Router } from 'express';
import { inventarioController } from '../controllers/inventario.controller';

const router = Router();

// ==================== PRODUCTOS ====================
router.get('/productos', inventarioController.getAllProductos.bind(inventarioController));
router.get('/productos/stock-bajo', inventarioController.getProductosStockBajo.bind(inventarioController));
router.get('/productos/:id', inventarioController.getProductoById.bind(inventarioController));
router.post('/productos', inventarioController.createProducto.bind(inventarioController));
router.put('/productos/:id', inventarioController.updateProducto.bind(inventarioController));
router.delete('/productos/:id', inventarioController.deleteProducto.bind(inventarioController));

// ==================== COMPRAS ====================
router.get('/compras', inventarioController.getAllCompras.bind(inventarioController));
router.post('/compras', inventarioController.registrarCompra.bind(inventarioController));
router.delete('/compras/:id', inventarioController.deleteCompra.bind(inventarioController));

// ==================== VENTAS ====================
router.get('/ventas', inventarioController.getAllVentas.bind(inventarioController));
router.post('/ventas', inventarioController.registrarVenta.bind(inventarioController));
router.delete('/ventas/:id', inventarioController.deleteVenta.bind(inventarioController));

// ==================== ESTADÍSTICAS Y REPORTES ====================
router.get('/estadisticas', inventarioController.getEstadisticas.bind(inventarioController));
router.get('/reporte', inventarioController.getReporte.bind(inventarioController));

export default router;