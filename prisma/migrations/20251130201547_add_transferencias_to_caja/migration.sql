-- AlterTable
ALTER TABLE "AperturaCaja" ADD COLUMN     "montoTransferencias" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CierreCaja" ADD COLUMN     "transferenciasEsperadas" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "transferenciasFinal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "transferenciasInicial" DOUBLE PRECISION NOT NULL DEFAULT 0;
