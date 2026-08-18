-- CreateEnum
CREATE TYPE "MomentoEncuesta" AS ENUM ('pre', 'post');

-- CreateTable
CREATE TABLE "respuestas_encuesta" (
    "usuario_id" INTEGER NOT NULL,
    "item_id" TEXT NOT NULL,
    "momento" "MomentoEncuesta" NOT NULL,
    "valor" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respuestas_encuesta_pkey" PRIMARY KEY ("usuario_id","item_id","momento")
);

-- CreateIndex
CREATE INDEX "respuestas_encuesta_usuario_id_momento_idx" ON "respuestas_encuesta"("usuario_id", "momento");

-- AddForeignKey
ALTER TABLE "respuestas_encuesta" ADD CONSTRAINT "respuestas_encuesta_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
