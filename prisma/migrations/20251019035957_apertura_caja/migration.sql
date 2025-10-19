-- CreateTable
CREATE TABLE "AperturaCaja" (
    "id" TEXT NOT NULL,
    "usuarioId" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montoInicial" DOUBLE PRECISION NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AperturaCaja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AperturaCaja_usuarioId_idx" ON "AperturaCaja"("usuarioId");
