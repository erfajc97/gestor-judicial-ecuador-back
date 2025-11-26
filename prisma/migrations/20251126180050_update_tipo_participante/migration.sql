-- Paso 1: Eliminar registros con ACUSADO (no es un tipo válido)
DELETE FROM "participantes" WHERE "tipo" = 'ACUSADO';

-- Paso 2: Cambiar la columna a text temporalmente para poder actualizar los valores
ALTER TABLE "participantes" ALTER COLUMN "tipo" TYPE text;

-- Paso 3: Actualizar los valores PERITO a FORENSE
UPDATE "participantes" SET "tipo" = 'FORENSE' WHERE "tipo" = 'PERITO';

-- Paso 4: Recrear el enum con los nuevos valores
-- Eliminar el enum antiguo
DROP TYPE "TipoParticipante";

-- Crear el nuevo enum con los valores correctos
CREATE TYPE "TipoParticipante" AS ENUM ('JUEZ', 'ABOGADO_DEMANDANTE', 'ABOGADO_DEFENSOR', 'SECRETARIO', 'PSICOLOGO', 'FORENSE');

-- Paso 5: Cambiar la columna de vuelta al enum
ALTER TABLE "participantes" ALTER COLUMN "tipo" TYPE "TipoParticipante" USING ("tipo"::"TipoParticipante");

