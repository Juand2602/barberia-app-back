-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "sellos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sellosCanjeados" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ultimoSello" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "HistorialSello" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motivo" TEXT,
    "sellosTotales" INTEGER NOT NULL,
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialSello_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionPremio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "sellosRequeridos" INTEGER NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionPremio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistorialSello_clienteId_createdAt_idx" ON "HistorialSello"("clienteId", "createdAt");

-- CreateIndex
CREATE INDEX "HistorialSello_tipo_idx" ON "HistorialSello"("tipo");

-- CreateIndex
CREATE INDEX "ConfiguracionPremio_activo_orden_idx" ON "ConfiguracionPremio"("activo", "orden");

-- CreateIndex
CREATE INDEX "Cliente_sellos_idx" ON "Cliente"("sellos");

-- AddForeignKey
ALTER TABLE "HistorialSello" ADD CONSTRAINT "HistorialSello_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
