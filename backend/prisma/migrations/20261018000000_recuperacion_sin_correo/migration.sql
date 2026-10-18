-- CreateEnum
CREATE TYPE "EstadoRecuperacion" AS ENUM ('pendiente', 'aprobada', 'rechazada', 'usada', 'cancelada');

-- CreateTable
CREATE TABLE "solicitudes_recuperacion" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "secreto_hash" TEXT NOT NULL,
    "estado" "EstadoRecuperacion" NOT NULL DEFAULT 'pendiente',
    "aprobador_id" INTEGER,
    "motivo" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resuelto_en" TIMESTAMP(3),
    "usado_en" TIMESTAMP(3),

    CONSTRAINT "solicitudes_recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_recuperacion_secreto_hash_key" ON "solicitudes_recuperacion"("secreto_hash");

-- CreateIndex
CREATE INDEX "solicitudes_recuperacion_usuario_id_estado_idx" ON "solicitudes_recuperacion"("usuario_id", "estado");

-- CreateIndex
CREATE INDEX "solicitudes_recuperacion_estado_creado_en_idx" ON "solicitudes_recuperacion"("estado", "creado_en");

-- AddForeignKey
ALTER TABLE "solicitudes_recuperacion" ADD CONSTRAINT "solicitudes_recuperacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_recuperacion" ADD CONSTRAINT "solicitudes_recuperacion_aprobador_id_fkey" FOREIGN KEY ("aprobador_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

