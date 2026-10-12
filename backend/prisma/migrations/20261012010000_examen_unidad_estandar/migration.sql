
-- CreateEnum
CREATE TYPE "EstadoRespuesta" AS ENUM ('correcta', 'parcial', 'incorrecta');

-- AlterTable
ALTER TABLE "configuracion_sistema" ALTER COLUMN "subir_nivel_preguntas" SET DEFAULT 10,
ALTER COLUMN "examen_unidad_preguntas" SET DEFAULT 10,
ALTER COLUMN "min_practica_intermedio" SET DEFAULT 10,
ALTER COLUMN "min_practica_avanzado" SET DEFAULT 10;

-- AlterTable
ALTER TABLE "ejercicios" ADD COLUMN     "temas_integrados" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "examenes_unidad" ADD COLUMN     "detalle" JSONB;

-- AlterTable
ALTER TABLE "intentos" ADD COLUMN     "estado" "EstadoRespuesta" NOT NULL DEFAULT 'incorrecta',
ADD COLUMN     "puntaje" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "preguntas_generadas" ADD COLUMN     "banco" "Banco" NOT NULL DEFAULT 'practica',
ADD COLUMN     "nivel_dificultad" "NivelDificultad" NOT NULL DEFAULT 'basico',
ADD COLUMN     "temas_integrados" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "habilitaciones_examen" (
    "usuario_id" INTEGER NOT NULL,
    "unidad_id" INTEGER NOT NULL,
    "docente_id" INTEGER,
    "promedio" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habilitaciones_examen_pkey" PRIMARY KEY ("usuario_id","unidad_id")
);

-- CreateIndex
CREATE INDEX "habilitaciones_examen_unidad_id_idx" ON "habilitaciones_examen"("unidad_id");

-- AddForeignKey
ALTER TABLE "habilitaciones_examen" ADD CONSTRAINT "habilitaciones_examen_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habilitaciones_examen" ADD CONSTRAINT "habilitaciones_examen_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habilitaciones_examen" ADD CONSTRAINT "habilitaciones_examen_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Datos ──
-- Los intentos existentes eran binarios: se traducen al resultado graduado.
UPDATE "intentos" SET "estado" = 'correcta', "puntaje" = 1 WHERE "correcto" = true;

-- Estandarización: 10 preguntas por evaluación y 10 ejercicios por nivel.
UPDATE "configuracion_sistema"
SET "subir_nivel_preguntas" = 10, "examen_unidad_preguntas" = 10, "subir_nivel_umbral" = 80,
    "min_practica_basico" = 10, "min_practica_intermedio" = 10, "min_practica_avanzado" = 10
WHERE "id" = 1;
