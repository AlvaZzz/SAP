-- Subir de nivel exige 8 ejercicios resueltos del nivel (antes 10). Completar el
-- tema sigue exigiendo los 10 de su nivel (regla en common/niveles/desbloqueo.ts).

-- AlterTable: nuevos valores por defecto.
ALTER TABLE "configuracion_sistema" ALTER COLUMN "min_practica_basico" SET DEFAULT 8,
ALTER COLUMN "min_practica_intermedio" SET DEFAULT 8,
ALTER COLUMN "min_practica_avanzado" SET DEFAULT 8;

-- Solo cambia lo que seguía en el valor de fábrica (10): un ajuste del admin se respeta.
UPDATE "configuracion_sistema" SET "min_practica_basico" = 8 WHERE "min_practica_basico" = 10;
UPDATE "configuracion_sistema" SET "min_practica_intermedio" = 8 WHERE "min_practica_intermedio" = 10;
UPDATE "configuracion_sistema" SET "min_practica_avanzado" = 8 WHERE "min_practica_avanzado" = 10;
