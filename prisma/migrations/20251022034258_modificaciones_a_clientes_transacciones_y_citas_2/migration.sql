-- AlterTable
ALTER TABLE "Transaccion" ADD COLUMN     "citaId" TEXT,
ADD COLUMN     "estadoPago" TEXT NOT NULL DEFAULT 'PENDIENTE';

-- CreateIndex
CREATE INDEX "Transaccion_estadoPago_idx" ON "Transaccion"("estadoPago");

-- CreateIndex
CREATE INDEX "Transaccion_citaId_idx" ON "Transaccion"("citaId");

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "Cita"("id") ON DELETE SET NULL ON UPDATE CASCADE;
