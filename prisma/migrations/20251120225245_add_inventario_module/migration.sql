-- CreateTable
CREATE TABLE "ProductoInventario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "precioCompra" DOUBLE PRECISION NOT NULL,
    "precioVenta" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 5,
    "unidadMedida" TEXT NOT NULL DEFAULT 'UNIDAD',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompraInventario" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proveedor" TEXT,
    "factura" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompraInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentaInventario" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metodoPago" TEXT NOT NULL DEFAULT 'EFECTIVO',
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentaInventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductoInventario_activo_idx" ON "ProductoInventario"("activo");

-- CreateIndex
CREATE INDEX "ProductoInventario_categoria_idx" ON "ProductoInventario"("categoria");

-- CreateIndex
CREATE INDEX "ProductoInventario_stock_idx" ON "ProductoInventario"("stock");

-- CreateIndex
CREATE INDEX "CompraInventario_productoId_fecha_idx" ON "CompraInventario"("productoId", "fecha");

-- CreateIndex
CREATE INDEX "CompraInventario_fecha_idx" ON "CompraInventario"("fecha");

-- CreateIndex
CREATE INDEX "VentaInventario_productoId_fecha_idx" ON "VentaInventario"("productoId", "fecha");

-- CreateIndex
CREATE INDEX "VentaInventario_fecha_idx" ON "VentaInventario"("fecha");

-- AddForeignKey
ALTER TABLE "CompraInventario" ADD CONSTRAINT "CompraInventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "ProductoInventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaInventario" ADD CONSTRAINT "VentaInventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "ProductoInventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
