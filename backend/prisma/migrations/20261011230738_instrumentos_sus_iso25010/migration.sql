-- AlterTable
ALTER TABLE "configuracion_sistema" ADD COLUMN     "criterio_precision_min" INTEGER NOT NULL DEFAULT 70,
ADD COLUMN     "criterio_sus_min" INTEGER NOT NULL DEFAULT 69,
ADD COLUMN     "fase_evaluacion_activa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nivel_aceptable_calidad" DOUBLE PRECISION NOT NULL DEFAULT 4;

-- CreateTable
CREATE TABLE "respuestas_instrumento" (
    "usuario_id" INTEGER NOT NULL,
    "instrumento" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respuestas_instrumento_pkey" PRIMARY KEY ("usuario_id","instrumento","item_id","version")
);

-- CreateIndex
CREATE INDEX "respuestas_instrumento_instrumento_version_idx" ON "respuestas_instrumento"("instrumento", "version");

-- AddForeignKey
ALTER TABLE "respuestas_instrumento" ADD CONSTRAINT "respuestas_instrumento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
