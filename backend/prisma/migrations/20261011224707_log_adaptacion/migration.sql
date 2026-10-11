-- AlterTable
ALTER TABLE "configuracion_sistema" ADD COLUMN     "rango_objetivo_max" INTEGER NOT NULL DEFAULT 85,
ADD COLUMN     "rango_objetivo_min" INTEGER NOT NULL DEFAULT 50;

-- CreateTable
CREATE TABLE "log_adaptacion" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "tema_id" INTEGER,
    "ejercicio_id" INTEGER NOT NULL,
    "theta_antes" DOUBLE PRECISION,
    "theta_despues" DOUBLE PRECISION,
    "dificultad_b" DOUBLE PRECISION NOT NULL,
    "prob_acierto" DOUBLE PRECISION,
    "nivel_antes" "NivelDificultad",
    "nivel_despues" "NivelDificultad",
    "en_rango_objetivo" BOOLEAN,
    "personalizado" BOOLEAN NOT NULL DEFAULT false,
    "correcto" BOOLEAN NOT NULL,
    "latencia_ms" INTEGER NOT NULL,
    "tiempo_respuesta_ms" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_adaptacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_ranking" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "posicion_antes" INTEGER,
    "posicion_despues" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_ranking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "log_adaptacion_usuario_id_fecha_idx" ON "log_adaptacion"("usuario_id", "fecha");

-- CreateIndex
CREATE INDEX "log_adaptacion_tema_id_idx" ON "log_adaptacion"("tema_id");

-- CreateIndex
CREATE INDEX "historial_ranking_usuario_id_fecha_idx" ON "historial_ranking"("usuario_id", "fecha");

-- AddForeignKey
ALTER TABLE "log_adaptacion" ADD CONSTRAINT "log_adaptacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_adaptacion" ADD CONSTRAINT "log_adaptacion_ejercicio_id_fkey" FOREIGN KEY ("ejercicio_id") REFERENCES "ejercicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_adaptacion" ADD CONSTRAINT "log_adaptacion_tema_id_fkey" FOREIGN KEY ("tema_id") REFERENCES "temas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_ranking" ADD CONSTRAINT "historial_ranking_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
