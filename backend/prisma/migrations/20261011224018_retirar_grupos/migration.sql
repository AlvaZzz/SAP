/*
  Warnings:

  - You are about to drop the column `grupos_bloqueados` on the `configuracion_sistema` table. All the data in the column will be lost.
  - You are about to drop the column `grupo` on the `usuarios` table. All the data in the column will be lost.
  - You are about to drop the `perfil_adaptativo` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "perfil_adaptativo" DROP CONSTRAINT "perfil_adaptativo_usuario_id_fkey";

-- AlterTable
ALTER TABLE "configuracion_sistema" DROP COLUMN "grupos_bloqueados",
ADD COLUMN     "encuesta_motivacion_activa" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "modelo_ia" SET DEFAULT 'gemini-3.5-flash-lite';

-- AlterTable
ALTER TABLE "usuarios" DROP COLUMN "grupo";

-- DropTable
DROP TABLE "perfil_adaptativo";

-- DropEnum
DROP TYPE "Grupo";
