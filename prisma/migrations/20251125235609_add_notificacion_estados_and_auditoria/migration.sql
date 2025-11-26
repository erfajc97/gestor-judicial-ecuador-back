-- CreateEnum
CREATE TYPE "EstadoNotificacion" AS ENUM ('ENVIADO', 'ENTREGADO', 'LEIDO');

-- CreateEnum
CREATE TYPE "TipoError" AS ENUM ('NOTIFICACION_TELEGRAM_ID_INVALIDO', 'NOTIFICACION_BOT_BLOQUEADO', 'NOTIFICACION_API_ERROR', 'PARTICIPANTE_VALIDACION', 'PARTICIPANTE_DUPLICADO', 'JUICIO_VALIDACION', 'JUICIO_PARTICIPANTE_NO_ENCONTRADO', 'TELEGRAM_API_ERROR', 'DATABASE_ERROR', 'OTRO');

-- AlterTable
ALTER TABLE "notificaciones" ADD COLUMN     "estado" "EstadoNotificacion" NOT NULL DEFAULT 'ENVIADO',
ADD COLUMN     "fechaEntrega" TIMESTAMP(3),
ADD COLUMN     "fechaLectura" TIMESTAMP(3),
ADD COLUMN     "messageId" TEXT;

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "tipoError" "TipoError" NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "mensaje" TEXT NOT NULL,
    "detalles" JSONB,
    "stackTrace" TEXT,
    "resuelto" BOOLEAN NOT NULL DEFAULT false,
    "fechaResolucion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auditoria_tipoError_idx" ON "auditoria"("tipoError");

-- CreateIndex
CREATE INDEX "auditoria_entidad_idx" ON "auditoria"("entidad");

-- CreateIndex
CREATE INDEX "auditoria_createdAt_idx" ON "auditoria"("createdAt");

-- CreateIndex
CREATE INDEX "auditoria_resuelto_idx" ON "auditoria"("resuelto");
