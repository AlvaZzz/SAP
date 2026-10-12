-- CreateEnum
CREATE TYPE "EstadoInscripcion" AS ENUM ('aprobada', 'pendiente', 'rechazada');

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "estado_inscripcion" "EstadoInscripcion" NOT NULL DEFAULT 'aprobada',
ADD COLUMN     "inscripcion_motivo" TEXT,
ADD COLUMN     "inscripcion_solicitada" TIMESTAMP(3);

