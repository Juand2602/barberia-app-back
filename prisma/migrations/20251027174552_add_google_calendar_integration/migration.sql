-- AlterTable
ALTER TABLE "Cita" ADD COLUMN     "googleEventId" TEXT;

-- AlterTable
ALTER TABLE "Empleado" ADD COLUMN     "calendarioSincronizado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "googleAccessToken" TEXT,
ADD COLUMN     "googleCalendarId" TEXT,
ADD COLUMN     "googleRefreshToken" TEXT,
ADD COLUMN     "googleTokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Cita_googleEventId_idx" ON "Cita"("googleEventId");

-- CreateIndex
CREATE INDEX "Empleado_calendarioSincronizado_idx" ON "Empleado"("calendarioSincronizado");
