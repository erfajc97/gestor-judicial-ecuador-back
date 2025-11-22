-- CreateEnum
CREATE TYPE "TipoParticipante" AS ENUM ('JUEZ', 'ABOGADO_DEMANDANTE', 'ABOGADO_DEFENSOR', 'ACUSADO', 'PERITO');

-- CreateEnum
CREATE TYPE "EstadoJuicio" AS ENUM ('PROGRAMADO', 'EN_CURSO', 'COMPLETADO', 'CANCELADO', 'REAGENDADO');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('CREACION', 'ACTUALIZACION', 'RECORDATORIO_24H', 'RECORDATORIO_1H', 'CANCELACION');

-- CreateTable
CREATE TABLE "juicios" (
    "id" TEXT NOT NULL,
    "numeroCaso" TEXT NOT NULL,
    "tipoJuicio" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora" TEXT NOT NULL,
    "sala" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "EstadoJuicio" NOT NULL DEFAULT 'PROGRAMADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "juicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participantes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "tipo" "TipoParticipante" NOT NULL,
    "telegramChatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "juicio_participantes" (
    "id" TEXT NOT NULL,
    "juicioId" TEXT NOT NULL,
    "participanteId" TEXT NOT NULL,
    "rol" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "juicio_participantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "juicioId" TEXT NOT NULL,
    "participanteId" TEXT,
    "tipo" "TipoNotificacion" NOT NULL,
    "mensaje" TEXT NOT NULL,
    "enviada" BOOLEAN NOT NULL DEFAULT false,
    "fechaEnvio" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "juicios_numeroCaso_key" ON "juicios"("numeroCaso");

-- CreateIndex
CREATE UNIQUE INDEX "juicio_participantes_juicioId_participanteId_key" ON "juicio_participantes"("juicioId", "participanteId");

-- AddForeignKey
ALTER TABLE "juicio_participantes" ADD CONSTRAINT "juicio_participantes_juicioId_fkey" FOREIGN KEY ("juicioId") REFERENCES "juicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "juicio_participantes" ADD CONSTRAINT "juicio_participantes_participanteId_fkey" FOREIGN KEY ("participanteId") REFERENCES "participantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_juicioId_fkey" FOREIGN KEY ("juicioId") REFERENCES "juicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_participanteId_fkey" FOREIGN KEY ("participanteId") REFERENCES "participantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
