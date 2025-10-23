-- AlterTable
ALTER TABLE "Empleado" ADD COLUMN     "porcentajeComision" DOUBLE PRECISION NOT NULL DEFAULT 50.0;

-- CreateTable
CREATE TABLE "PagoComision" (
    "id" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "totalVentas" DOUBLE PRECISION NOT NULL,
    "porcentaje" DOUBLE PRECISION NOT NULL,
    "montoComision" DOUBLE PRECISION NOT NULL,
    "montoPagado" DOUBLE PRECISION NOT NULL,
    "diferencia" DOUBLE PRECISION NOT NULL,
    "metodoPago" TEXT NOT NULL,
    "referencia" TEXT,
    "notas" TEXT,
    "transaccionIds" TEXT NOT NULL,
    "cantidadTransacciones" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PagoComision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PagoComision_empleadoId_fechaPago_idx" ON "PagoComision"("empleadoId", "fechaPago");

-- CreateIndex
CREATE INDEX "PagoComision_periodo_idx" ON "PagoComision"("periodo");

-- CreateIndex
CREATE UNIQUE INDEX "PagoComision_empleadoId_periodo_key" ON "PagoComision"("empleadoId", "periodo");

-- CreateIndex
CREATE INDEX "Transaccion_empleadoId_estadoPago_tipo_idx" ON "Transaccion"("empleadoId", "estadoPago", "tipo");

-- AddForeignKey
ALTER TABLE "PagoComision" ADD CONSTRAINT "PagoComision_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
